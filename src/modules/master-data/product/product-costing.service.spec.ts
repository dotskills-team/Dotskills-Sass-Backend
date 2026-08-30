import { Test, TestingModule } from '@nestjs/testing';

import { Prisma } from '../../../generated/phase-1-prisma/client';
import { ProductCostingService } from './product-costing.service';

describe('ProductCostingService.applyPurchaseCost', () => {
  let service: ProductCostingService;

  const mockTx = {
    product: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    inventory: {
      aggregate: jest.fn(),
    },
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductCostingService],
    }).compile();

    service = module.get(ProductCostingService);
  });

  it('sums Inventory quantity across all locations for the product, not just one', async () => {
    mockTx.product.findUniqueOrThrow.mockResolvedValue({ costPrice: new Prisma.Decimal(100) });
    mockTx.inventory.aggregate.mockResolvedValue({ _sum: { quantity: new Prisma.Decimal(10) } });
    mockTx.product.update.mockResolvedValue({});

    await service.applyPurchaseCost(mockTx as any, context, 'product-1', 10, 200);

    expect(mockTx.inventory.aggregate).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', companyId: 'company-1', productId: 'product-1' },
      _sum: { quantity: true },
    });
  });

  it('updates Product.costPrice to the computed weighted average and returns it', async () => {
    mockTx.product.findUniqueOrThrow.mockResolvedValue({ costPrice: new Prisma.Decimal(100) });
    mockTx.inventory.aggregate.mockResolvedValue({ _sum: { quantity: new Prisma.Decimal(10) } });
    mockTx.product.update.mockResolvedValue({});

    const result = await service.applyPurchaseCost(mockTx as any, context, 'product-1', 10, 200);

    expect(result.toString()).toBe('150');
    const updateCall = mockTx.product.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: 'product-1' });
    expect(updateCall.data.costPrice.toString()).toBe('150');
  });

  it('treats a product with no Inventory rows anywhere as zero existing quantity, not an error', async () => {
    mockTx.product.findUniqueOrThrow.mockResolvedValue({ costPrice: new Prisma.Decimal(0) });
    mockTx.inventory.aggregate.mockResolvedValue({ _sum: { quantity: null } });
    mockTx.product.update.mockResolvedValue({});

    const result = await service.applyPurchaseCost(mockTx as any, context, 'product-1', 5, 40);

    expect(result.toString()).toBe('40');
  });
});
