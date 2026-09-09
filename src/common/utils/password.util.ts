import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';

/**
 * Single source of truth for password hashing/verification — extracted
 * from `AuthService`'s own private methods (previously duplicated inline
 * in `company-rbac.service.ts`/`platform-staff.service.ts` too; not
 * touching those two here, out of scope for the feature that needed this
 * extraction, but nothing new should ever re-duplicate this again).
 * `verifyPassword()` deliberately still accepts legacy bcrypt hashes
 * (`$2a$`/`$2b$`/`$2y$`) alongside argon2id, since some existing accounts
 * may not have logged in since the argon2 migration and still carry one.
 */
export function argonOptions(): argon2.Options & { raw?: false } {
  return {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argonOptions());
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    if (hash.startsWith('$argon2')) return await argon2.verify(hash, password);
    if (/^\$2[aby]\$/.test(hash)) return await bcrypt.compare(password, hash);
    return false;
  } catch {
    return false;
  }
}
