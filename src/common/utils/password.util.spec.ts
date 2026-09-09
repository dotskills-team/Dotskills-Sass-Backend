import * as bcrypt from 'bcrypt';

import { argonOptions, hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  describe('hashPassword / verifyPassword (argon2)', () => {
    it('hashes a password and verifies the same plaintext against it', async () => {
      const hash = await hashPassword('a-strong-password-123');

      expect(hash.startsWith('$argon2')).toBe(true);
      await expect(verifyPassword(hash, 'a-strong-password-123')).resolves.toBe(true);
    });

    it('rejects the wrong plaintext against a real hash', async () => {
      const hash = await hashPassword('a-strong-password-123');

      await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
    });
  });

  describe('verifyPassword — legacy bcrypt compatibility', () => {
    it('still verifies a correct password against a legacy bcrypt hash', async () => {
      const legacyHash = await bcrypt.hash('legacy-password-123', 12);

      await expect(verifyPassword(legacyHash, 'legacy-password-123')).resolves.toBe(true);
    });

    it('rejects the wrong password against a legacy bcrypt hash', async () => {
      const legacyHash = await bcrypt.hash('legacy-password-123', 12);

      await expect(verifyPassword(legacyHash, 'wrong-password')).resolves.toBe(false);
    });
  });

  it('verifyPassword never throws and returns false for an unrecognized hash format', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(false);
  });

  it('argonOptions returns the fixed, documented cost parameters', () => {
    expect(argonOptions()).toEqual({
      type: 2, // argon2.argon2id
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
  });
});
