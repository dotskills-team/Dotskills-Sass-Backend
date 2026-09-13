import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { CompanyOwnerService } from './company-owner.service';

describe('CompanyOwnerService.create', () => {
  let service: CompanyOwnerService;

  const mockTx = {
    company: { findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
    companyMember: { findFirst: jest.fn(), create: jest.fn() },
    companyRole: { findFirst: jest.fn(), create: jest.fn() },
    permission: { findMany: jest.fn() },
    companyRolePermission: { createMany: jest.fn() },
    companyOwnership: { findFirst: jest.fn(), create: jest.fn() },
    companyMemberRole: { upsert: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) => arg(mockTx)),
  };

  const dto = {
    companyId: 'company-1',
    email: 'owner@test.com',
    fullName: 'Test Owner',
    password: 'a-strong-password-123',
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockTx.company.findUnique.mockResolvedValue({
      id: 'company-1',
      tenantId: 'tenant-1',
      status: 'DRAFT',
      legalName: 'Test Co',
    });
    mockTx.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', status: 'ACTIVE' });
    mockTx.user.findUnique.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue({
      id: 'user-1',
      email: dto.email,
      fullName: dto.fullName,
      phone: null,
      status: 'ACTIVE',
    });
    mockTx.companyMember.findFirst.mockResolvedValue(null);
    mockTx.companyMember.create.mockResolvedValue({
      id: 'member-1',
      status: 'ACTIVE',
      designation: 'Company Owner',
    });
    mockTx.companyOwnership.findFirst.mockResolvedValue(null);
    mockTx.companyOwnership.create.mockResolvedValue({
      id: 'ownership-1',
      isPrimary: true,
      startedAt: new Date(),
    });
    mockTx.companyMemberRole.upsert.mockResolvedValue({});
    mockTx.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyOwnerService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CompanyOwnerService);
  });

  it('grants the full company permission set to a newly-created COMPANY_OWNER role, so the Owner is never left permission-less', async () => {
    mockTx.companyRole.findFirst.mockResolvedValue(null);
    mockTx.companyRole.create.mockResolvedValue({
      id: 'role-1',
      code: 'COMPANY_OWNER',
      name: 'Company Owner',
    });
    mockTx.permission.findMany.mockResolvedValue([
      { id: 'perm-1' },
      { id: 'perm-2' },
    ]);

    await service.create(dto, 'actor-1');

    expect(mockTx.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
    expect(mockTx.companyRolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { companyRoleId: 'role-1', permissionId: 'perm-1', effect: 'ALLOW', assignedByUserId: 'actor-1' },
        { companyRoleId: 'role-1', permissionId: 'perm-2', effect: 'ALLOW', assignedByUserId: 'actor-1' },
      ],
    });
  });

  it('does not touch permissions for an already-existing COMPANY_OWNER role (never overwrites prior customization)', async () => {
    mockTx.companyRole.findFirst.mockResolvedValue({
      id: 'role-existing',
      code: 'COMPANY_OWNER',
      name: 'Company Owner',
    });

    await service.create(dto, 'actor-1');

    expect(mockTx.companyRole.create).not.toHaveBeenCalled();
    expect(mockTx.permission.findMany).not.toHaveBeenCalled();
    expect(mockTx.companyRolePermission.createMany).not.toHaveBeenCalled();
  });
});
