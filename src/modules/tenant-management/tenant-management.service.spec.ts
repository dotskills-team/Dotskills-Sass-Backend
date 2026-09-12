import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';

import { Prisma } from '../../generated/phase-1-prisma/client';
import { TenantStatus } from '../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantManagementService } from './tenant-management.service';

describe('TenantManagementService.create', () => {
  let service: TenantManagementService;

  const mockTx = {
    tenant: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(mockTx);
      return Promise.all(arg);
    }),
    tenant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.tenant.findMany.mockResolvedValue([]);
    mockPrisma.tenant.findFirst.mockResolvedValue(null);
    mockTx.tenant.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'tenant-1', ...data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantManagementService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TenantManagementService);
  });

  it('generates an uppercase, dash-joined code with a legal-suffix stripped and a full lowercase slug', async () => {
    const result = await service.create(
      { name: 'ABC Trading Ltd' } as any,
      'user-1',
    );

    expect(result.data.code).toBe('ABC-TRADING-001');
    expect(result.data.slug).toBe('abc-trading-ltd');
    expect(result.data.name).toBe('ABC Trading Ltd');
    expect(result.data.status).toBe(TenantStatus.DRAFT);
  });

  it('increments the code/slug suffix when a base already has rows', async () => {
    mockPrisma.tenant.findMany.mockImplementation(({ where }: any) => {
      if (where.code) {
        return Promise.resolve([{ code: 'ABC-TRADING-001' }, { code: 'ABC-TRADING-002' }]);
      }
      return Promise.resolve([]);
    });
    mockPrisma.tenant.findFirst.mockResolvedValue({ id: 'existing' }); // base slug taken

    const result = await service.create(
      { name: 'ABC Trading Ltd' } as any,
      'user-1',
    );

    expect(result.data.code).toBe('ABC-TRADING-003');
    expect(result.data.slug).toBe('abc-trading-ltd-2');
  });

  it('retries with a freshly-generated candidate when a race loses to a concurrent P2002', async () => {
    mockTx.tenant.create
      .mockImplementationOnce(() => {
        throw new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '1',
        });
      })
      .mockImplementationOnce(({ data }: any) => Promise.resolve({ id: 'tenant-2', ...data }));

    const result = await service.create({ name: 'Race Co' } as any, 'user-1');

    expect(mockTx.tenant.create).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
  });

  it('rejects a blank/whitespace-only name', async () => {
    await expect(
      service.create({ name: '   ' } as any, 'user-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('gives up after repeated P2002 conflicts rather than looping forever', async () => {
    mockTx.tenant.create.mockImplementation(() => {
      throw new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '1',
      });
    });

    await expect(
      service.create({ name: 'Always Conflicts' } as any, 'user-1'),
    ).rejects.toThrow(ConflictException);
  });
});
