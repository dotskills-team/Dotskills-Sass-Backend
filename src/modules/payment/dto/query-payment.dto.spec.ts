import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { QueryPaymentDto } from './query-payment.dto';

/**
 * Regression: `page`/`limit` arrive from `@Query()` as raw strings
 * (e.g. "5"), not numbers. Without `@Type(() => Number)`, class-validator's
 * `@IsInt()` rejects them, which broke pagination on
 * `GET /platform/payments?page=1&limit=20` end-to-end.
 */
describe('QueryPaymentDto', () => {
  it('accepts string page/limit query values (as Express delivers them)', async () => {
    const dto = plainToInstance(QueryPaymentDto, { page: '1', limit: '20' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('still rejects a limit above 100', async () => {
    const dto = plainToInstance(QueryPaymentDto, { limit: '101' });
    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });
});
