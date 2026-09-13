import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { SetupStatusService } from './setup-status.service';

describe('SetupStatusService.getStatus', () => {
  let service: SetupStatusService;

  const mockPrisma = {
    subscription: { findFirst: jest.fn() },
    companyMemberRole: { findFirst: jest.fn() },
    location: { count: jest.fn() },
    unit: { count: jest.fn() },
    product: { count: jest.fn() },
  };

  const context = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    companyMemberId: 'member-1',
    companyStatus: 'LIVE',
    tenantStatus: 'ACTIVE',
    scopes: [],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupStatusService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SetupStatusService);
  });

  it('reports 0/5 for a brand-new company with no subscription, no permissions, and no master data', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.companyMemberRole.findFirst.mockResolvedValue(null);
    mockPrisma.location.count.mockResolvedValue(0);
    mockPrisma.unit.count.mockResolvedValue(0);
    mockPrisma.product.count.mockResolvedValue(0);

    const result = await service.getStatus(context);

    expect(result.data.completedCount).toBe(0);
    expect(result.data.totalCount).toBe(5);
    expect(result.data.isComplete).toBe(false);
    expect(result.data.checks.every((check) => !check.completed)).toBe(true);
  });

  it('reports 5/5 and isComplete=true when every requirement is satisfied', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      isComplimentary: false,
    });
    mockPrisma.companyMemberRole.findFirst.mockResolvedValue({
      companyMemberId: 'member-1',
    });
    mockPrisma.location.count.mockResolvedValue(2);
    mockPrisma.unit.count.mockResolvedValue(3);
    mockPrisma.product.count.mockResolvedValue(10);

    const result = await service.getStatus(context);

    expect(result.data.completedCount).toBe(5);
    expect(result.data.totalCount).toBe(5);
    expect(result.data.isComplete).toBe(true);
    expect(result.data.checks.every((check) => check.completed)).toBe(true);
  });

  it('treats a TRIALING subscription as ready, and an EXPIRED one as not ready', async () => {
    mockPrisma.companyMemberRole.findFirst.mockResolvedValue(null);
    mockPrisma.location.count.mockResolvedValue(0);
    mockPrisma.unit.count.mockResolvedValue(0);
    mockPrisma.product.count.mockResolvedValue(0);

    mockPrisma.subscription.findFirst.mockResolvedValue({
      status: 'TRIALING',
      isComplimentary: false,
    });
    const trialing = await service.getStatus(context);
    expect(
      trialing.data.checks.find((check) => check.key === 'SUBSCRIPTION')
        ?.completed,
    ).toBe(true);

    mockPrisma.subscription.findFirst.mockResolvedValue({
      status: 'EXPIRED',
      isComplimentary: false,
    });
    const expired = await service.getStatus(context);
    expect(
      expired.data.checks.find((check) => check.key === 'SUBSCRIPTION')
        ?.completed,
    ).toBe(false);
  });

  it('treats a complimentary subscription as ready regardless of status', async () => {
    mockPrisma.companyMemberRole.findFirst.mockResolvedValue(null);
    mockPrisma.location.count.mockResolvedValue(0);
    mockPrisma.unit.count.mockResolvedValue(0);
    mockPrisma.product.count.mockResolvedValue(0);
    mockPrisma.subscription.findFirst.mockResolvedValue({
      status: 'SUSPENDED',
      isComplimentary: true,
    });

    const result = await service.getStatus(context);

    expect(
      result.data.checks.find((check) => check.key === 'SUBSCRIPTION')
        ?.completed,
    ).toBe(true);
  });

  it('reports RBAC not ready when the member has a role with zero attached permissions (the known trap)', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      isComplimentary: false,
    });
    mockPrisma.location.count.mockResolvedValue(1);
    mockPrisma.unit.count.mockResolvedValue(1);
    mockPrisma.product.count.mockResolvedValue(1);
    // A role assignment exists, but the `some: { effect: 'ALLOW' }` filter
    // inside the query itself means no row comes back when permissions are empty.
    mockPrisma.companyMemberRole.findFirst.mockResolvedValue(null);

    const result = await service.getStatus(context);

    expect(
      result.data.checks.find((check) => check.key === 'RBAC')?.completed,
    ).toBe(false);
    expect(result.data.completedCount).toBe(4);
    expect(result.data.isComplete).toBe(false);
  });

  it('scopes location/unit/product counts to the current tenant+company', async () => {
    mockPrisma.subscription.findFirst.mockResolvedValue(null);
    mockPrisma.companyMemberRole.findFirst.mockResolvedValue(null);
    mockPrisma.location.count.mockResolvedValue(0);
    mockPrisma.unit.count.mockResolvedValue(0);
    mockPrisma.product.count.mockResolvedValue(0);

    await service.getStatus(context);

    expect(mockPrisma.location.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', companyId: 'company-1' },
    });
    expect(mockPrisma.unit.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', companyId: 'company-1' },
    });
    expect(mockPrisma.product.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', companyId: 'company-1' },
    });
  });
});
