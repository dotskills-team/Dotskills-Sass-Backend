import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { COMPANY_PERMISSIONS } from '../../common/constants/permission.constants';
import { PermissionEffect } from '../../generated/phase-1-prisma/enums';
import { AccessControlSetupService } from './access-control-setup.service';

/**
 * Covers the self-healing fix for the recurring "permission-catalog sync
 * gap" bug class (Stock Adjustment, LOCATION_ACCESS_ALL, NOTIFICATION_READ —
 * a new permission constant shipping without its two manual sync steps ever
 * being run). `reconcileOwnerAdminPermissions()` is the additive-only,
 * boot-time fix; this spec proves it adds exactly what's missing, writes
 * nothing when already synced, never touches MANAGER/CASHIER, and isolates
 * one company's failure from the rest.
 */
describe('AccessControlSetupService.reconcileOwnerAdminPermissions', () => {
  let service: AccessControlSetupService;

  const ALL_COMPANY_CODES = Object.values(COMPANY_PERMISSIONS);

  const mockTx = {
    permission: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
    companyRole: { findMany: jest.fn() },
    companyRolePermission: { createMany: jest.fn() },
  };

  function permissionIdFor(code: string) {
    return `perm-id-${code}`;
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    // syncPermissionCatalog() treats every real PERMISSION_CATALOG entry as
    // already existing (goes through the update() branch) — deterministic,
    // synthetic ids let assertions reference exactly which code is missing.
    mockTx.permission.findFirst.mockImplementation(({ where }: any) =>
      Promise.resolve({ id: permissionIdFor(where.OR[0].code) }),
    );
    mockTx.permission.update.mockImplementation(({ where, data }: any) =>
      Promise.resolve({ id: where.id, code: data.code }),
    );
    mockPrisma.companyRolePermission.createMany.mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlSetupService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(AccessControlSetupService);
  });

  it('adds exactly the one missing permission code to a COMPANY_OWNER role, leaving everything else untouched', async () => {
    const missingCode = COMPANY_PERMISSIONS.NOTIFICATION_READ;
    const existingPermissions = ALL_COMPANY_CODES.filter(
      (code) => code !== missingCode,
    ).map((code) => ({ permissionId: permissionIdFor(code) }));
    mockPrisma.companyRole.findMany.mockResolvedValue([
      {
        id: 'role-owner-1',
        companyId: 'company-1',
        permissions: existingPermissions,
      },
    ]);

    const result = await service.reconcileOwnerAdminPermissions();

    expect(mockPrisma.companyRolePermission.createMany).toHaveBeenCalledWith({
      data: [
        {
          companyRoleId: 'role-owner-1',
          permissionId: permissionIdFor(missingCode),
          effect: PermissionEffect.ALLOW,
        },
      ],
      skipDuplicates: true,
    });
    expect(result.rolesUpdated).toBe(1);
    expect(result.codesAdded).toBe(1);
    expect(result.companiesChecked).toBe(1);
    expect(result.failures).toEqual([]);
  });

  it('writes nothing when a role is already fully synced', async () => {
    mockPrisma.companyRole.findMany.mockResolvedValue([
      {
        id: 'role-admin-1',
        companyId: 'company-2',
        permissions: ALL_COMPANY_CODES.map((code) => ({
          permissionId: permissionIdFor(code),
        })),
      },
    ]);

    const result = await service.reconcileOwnerAdminPermissions();

    expect(mockPrisma.companyRolePermission.createMany).not.toHaveBeenCalled();
    expect(result.rolesUpdated).toBe(0);
    expect(result.codesAdded).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('only ever queries COMPANY_OWNER/COMPANY_ADMIN roles — MANAGER/CASHIER/custom roles are never fetched or touched', async () => {
    mockPrisma.companyRole.findMany.mockResolvedValue([]);

    await service.reconcileOwnerAdminPermissions();

    expect(mockPrisma.companyRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: { in: ['COMPANY_OWNER', 'COMPANY_ADMIN'] } },
      }),
    );
  });

  it("isolates one company's failure — a thrown error on one role never stops the rest from being reconciled", async () => {
    mockPrisma.companyRole.findMany.mockResolvedValue([
      { id: 'role-fail', companyId: 'company-fail', permissions: [] },
      { id: 'role-ok', companyId: 'company-ok', permissions: [] },
    ]);
    mockPrisma.companyRolePermission.createMany
      .mockRejectedValueOnce(new Error('DB hiccup'))
      .mockResolvedValueOnce({ count: ALL_COMPANY_CODES.length });

    const result = await service.reconcileOwnerAdminPermissions();

    expect(mockPrisma.companyRolePermission.createMany).toHaveBeenCalledTimes(
      2,
    );
    expect(result.rolesUpdated).toBe(1);
    expect(result.failures).toEqual([
      { companyId: 'company-fail', roleId: 'role-fail', message: 'DB hiccup' },
    ]);
  });
});

describe('AccessControlSetupService.onApplicationBootstrap', () => {
  let service: AccessControlSetupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessControlSetupService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get(AccessControlSetupService);
  });

  it('logs at warn level when the reconciliation actually changed something', async () => {
    const logger = (service as any).logger;
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(service, 'reconcileOwnerAdminPermissions').mockResolvedValue({
      companiesChecked: 1,
      rolesChecked: 2,
      rolesUpdated: 1,
      codesAdded: 1,
      failures: [],
    });

    await service.onApplicationBootstrap();

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('logs at info level when nothing needed to change', async () => {
    const logger = (service as any).logger;
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(logger, 'log').mockImplementation(() => undefined);
    jest.spyOn(service, 'reconcileOwnerAdminPermissions').mockResolvedValue({
      companiesChecked: 3,
      rolesChecked: 6,
      rolesUpdated: 0,
      codesAdded: 0,
      failures: [],
    });

    await service.onApplicationBootstrap();

    expect(logger.log).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('never throws — a total failure is caught and logged at error level so app boot is never blocked', async () => {
    const logger = (service as any).logger;
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest
      .spyOn(service, 'reconcileOwnerAdminPermissions')
      .mockRejectedValue(new Error('database unreachable'));

    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
