import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { ProductService } from './product.service';

/**
 * Scoped to `findByBarcode()` only — the pre-existing list/create/update
 * methods are mechanical field-mapping with no dedicated spec before this
 * change either (same precedent as `CompanySettingsService`'s own spec).
 * `findByBarcode()` has real conditional logic (Product-match vs
 * ProductVariant-match vs no-match, both tenant/company-scoped) worth a
 * focused spec.
 */
describe('ProductService.findByBarcode', () => {
  let service: ProductService;

  const mockPrisma = {
    product: { findFirst: jest.fn() },
    productVariant: { findFirst: jest.fn() },
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ProductService);
  });

  it('returns the Product directly (variant: null) when Product.barcode matches', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({
      id: 'product-1',
      barcode: '8901234567890',
    });

    const result = await service.findByBarcode(context, '8901234567890');

    expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          companyId: 'company-1',
          barcode: '8901234567890',
        },
      }),
    );
    expect(mockPrisma.productVariant.findFirst).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: {
        product: { id: 'product-1', barcode: '8901234567890' },
        variant: null,
      },
    });
  });

  it('falls back to ProductVariant.barcode and returns both the variant and its parent Product when the plain Product lookup misses', async () => {
    mockPrisma.product.findFirst
      .mockResolvedValueOnce(null) // Product.barcode miss
      .mockResolvedValueOnce({
        id: 'product-1',
        name: 'T-Shirt',
        hasVariants: true,
      }); // parent Product lookup
    mockPrisma.productVariant.findFirst.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
      barcode: '8901234567890',
    });

    const result = await service.findByBarcode(context, '8901234567890');

    expect(mockPrisma.productVariant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: 'tenant-1',
          companyId: 'company-1',
          barcode: '8901234567890',
        },
      }),
    );
    expect(mockPrisma.product.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          id: 'product-1',
          tenantId: 'tenant-1',
          companyId: 'company-1',
        },
      }),
    );
    expect(result).toEqual({
      success: true,
      data: {
        product: { id: 'product-1', name: 'T-Shirt', hasVariants: true },
        variant: {
          id: 'variant-1',
          productId: 'product-1',
          barcode: '8901234567890',
        },
      },
    });
  });

  it('returns data: null (not an exception) when the barcode matches neither a Product nor a ProductVariant', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.productVariant.findFirst.mockResolvedValue(null);

    const result = await service.findByBarcode(context, 'no-such-barcode');

    expect(result).toEqual({ success: true, data: null });
  });

  it("never leaks another company's product for the same barcode — every lookup is tenant+company scoped", async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.productVariant.findFirst.mockResolvedValue(null);

    await service.findByBarcode(context, 'shared-code');

    expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          companyId: 'company-1',
        }),
      }),
    );
    expect(mockPrisma.productVariant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          companyId: 'company-1',
        }),
      }),
    );
  });
});
