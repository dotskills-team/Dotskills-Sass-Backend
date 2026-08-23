import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateCompanyOwnerDto } from './create-company-owner.dto';

const VALID_BODY = {
  email: 'owner@example.com',
  fullName: 'Jane Doe',
  password: 'Str0ng!Pass',
};

/**
 * Regression: `POST /platform/companies/:companyId/owner` never sends
 * `companyId` in the body (the URL param is authoritative — the controller
 * assigns `dto.companyId = companyId` after this DTO is validated). With
 * `companyId` previously required, the global `ValidationPipe` rejected
 * every request with "companyId must be a UUID" before the controller's
 * assignment ever ran.
 */
describe('CreateCompanyOwnerDto', () => {
  it('accepts a valid request that omits companyId from the body', async () => {
    const dto = plainToInstance(CreateCompanyOwnerDto, { ...VALID_BODY });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.companyId).toBeUndefined();
  });

  it('still rejects an explicitly-provided companyId that is not a UUID', async () => {
    const dto = plainToInstance(CreateCompanyOwnerDto, {
      ...VALID_BODY,
      companyId: 'not-a-uuid',
    });
    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'companyId')).toBe(true);
  });

  it('accepts an explicitly-provided companyId when it is a valid UUID', async () => {
    const dto = plainToInstance(CreateCompanyOwnerDto, {
      ...VALID_BODY,
      companyId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('leaves existing field validation unchanged', async () => {
    const dto = plainToInstance(CreateCompanyOwnerDto, {
      email: 'not-an-email',
      fullName: 'A',
      password: 'weak',
    });
    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'email')).toBe(true);
    expect(errors.some((e) => e.property === 'fullName')).toBe(true);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
