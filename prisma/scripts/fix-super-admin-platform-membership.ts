/**
 * One-off data-repair script — restores the missing `platform_members` row
 * for `admin@dotskills.com` (SUPER_ADMIN_EMAIL in .env).
 *
 * Root cause (confirmed by direct DB inspection): this user's `User` row
 * exists and its password hash is correct, but it has NO `PlatformMember`
 * row at all — `AuthService.authenticate()`'s `hasActivePlatformMembership`
 * check therefore always fails, so `POST /auth/staff/login` returns 401
 * regardless of password. A prior seed run (`seedPlatformRoles`/manual
 * `prisma db seed`) failed partway because the `employeeCode` it tried to
 * assign, `SA-001`, is already taken by a *different* user
 * (`firoj.dotskills@gmail.com`'s PlatformMember row) — `employeeCode` is
 * globally `@unique` in `schema.prisma`, so that insert rolled back and
 * `admin@dotskills.com` was left with no membership.
 *
 * This script creates exactly two rows:
 *   1. PlatformMember for admin@dotskills.com's userId, employeeCode: NULL
 *      (NULL avoids the SA-001 conflict entirely — employeeCode is
 *      optional, and Postgres unique constraints never conflict on NULL),
 *      status: ACTIVE.
 *   2. PlatformMemberRole linking that membership to the existing
 *      SUPER_ADMIN PlatformRole.
 *
 * Never touches firoj.dotskills@gmail.com's row, any other user, any
 * password, or any auth logic. Idempotent — safe to run more than once.
 *
 * Usage:
 *   npx ts-node --transpile-only prisma/scripts/fix-super-admin-platform-membership.ts            (dry run, default)
 *   npx ts-node --transpile-only prisma/scripts/fix-super-admin-platform-membership.ts --apply     (actually writes)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/phase-1-prisma/client';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing in .env');
}
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');

const TARGET_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'admin@dotskills.com';
const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

async function main() {
  console.log(
    `Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes — pass --apply to execute)'}`,
  );

  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true, status: true, deletedAt: true },
  });

  if (!user) {
    throw new Error(`No user found with email "${TARGET_EMAIL}" — nothing to fix.`);
  }
  console.log(`Target user: ${user.email} (${user.id}), status=${user.status}`);

  const role = await prisma.platformRole.findUnique({
    where: { code: SUPER_ADMIN_ROLE_CODE },
    select: { id: true, code: true, status: true },
  });

  if (!role) {
    throw new Error(
      `PlatformRole "${SUPER_ADMIN_ROLE_CODE}" does not exist — run the platform-roles seed first.`,
    );
  }
  console.log(`Target role: ${role.code} (${role.id}), status=${role.status}`);

  // --- Safety check 1: don't create a duplicate PlatformMember -----------
  let member = await prisma.platformMember.findUnique({
    where: { userId: user.id },
    select: { id: true, employeeCode: true, status: true },
  });

  if (member) {
    console.log(
      `[skip] PlatformMember already exists for ${user.email} (${member.id}, employeeCode=${member.employeeCode ?? 'NULL'}, status=${member.status}) — leaving it untouched.`,
    );
  } else {
    console.log(
      `[create] PlatformMember { userId: ${user.id}, employeeCode: NULL, status: ACTIVE }`,
    );
    if (APPLY) {
      member = await prisma.platformMember.create({
        data: { userId: user.id, employeeCode: null, status: 'ACTIVE' },
        select: { id: true, employeeCode: true, status: true },
      });
    }
  }

  // --- Safety check 2: don't create a duplicate role assignment ----------
  // Only reachable with a real `member.id` when APPLY is true (dry run has
  // no id to check against yet, which is fine — dry run only reports intent).
  if (member) {
    const existingAssignment = await prisma.platformMemberRole.findUnique({
      where: {
        platformMemberId_platformRoleId: {
          platformMemberId: member.id,
          platformRoleId: role.id,
        },
      },
    });

    if (existingAssignment) {
      console.log(
        `[skip] PlatformMemberRole already links this membership to ${role.code} — nothing to do.`,
      );
    } else {
      console.log(
        `[create] PlatformMemberRole { platformMemberId: ${member.id}, platformRoleId: ${role.id} }`,
      );
      if (APPLY) {
        await prisma.platformMemberRole.create({
          data: { platformMemberId: member.id, platformRoleId: role.id },
        });
      }
    }
  } else {
    console.log(
      '[dry-run] Role-assignment check skipped — no PlatformMember id yet (would be created above with --apply).',
    );
  }

  console.log(APPLY ? 'Done — changes applied.' : 'Dry run complete — no changes written. Re-run with --apply to write.');
}

main()
  .catch((error: unknown) => {
    console.error('Script failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
