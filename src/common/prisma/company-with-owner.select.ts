import { Prisma } from '../../generated/phase-1-prisma/client';

/**
 * Shared Company + primary-owner projection reused by every Platform
 * Billing/Invoice/Payment read (`findAll`/`findOne`/`getReceipt`) so the
 * Super Admin dashboard can show which company/owner a record belongs to
 * without each service re-deriving the same join. `ownerships` is filtered
 * to the current primary owner only (`isPrimary: true, endedAt: null`) —
 * the same definition of "the Owner" already used by
 * `CompanyOwnersSection`/`company-owner.service.ts` elsewhere in this
 * codebase, not a new concept.
 */
export const companyWithOwnerSelect = {
  id: true,
  legalName: true,
  tradeName: true,
  ownerships: {
    where: { isPrimary: true, endedAt: null },
    take: 1,
    select: {
      companyMember: {
        select: {
          user: { select: { fullName: true, email: true } },
        },
      },
    },
  },
} satisfies Prisma.CompanySelect;
