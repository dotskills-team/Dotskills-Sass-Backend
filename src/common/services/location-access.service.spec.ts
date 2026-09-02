import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CompanyPermissionResolverService } from './company-permission-resolver.service';
import { LocationAccessService } from './location-access.service';

describe('LocationAccessService', () => {
  let service: LocationAccessService;

  const mockPrisma = {
    companyMemberLocation: { findMany: jest.fn() },
  };

  const mockPermissionResolver = {
    hasPermission: jest.fn(),
  };

  const context = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    companyMemberId: 'member-1',
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationAccessService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: CompanyPermissionResolverService,
          useValue: mockPermissionResolver,
        },
      ],
    }).compile();

    service = module.get(LocationAccessService);
  });

  describe('getAssignedLocationIds', () => {
    it("returns 'ALL' without querying CompanyMemberLocation when the actor holds LOCATION_ACCESS_ALL", async () => {
      mockPermissionResolver.hasPermission.mockResolvedValue(true);

      const result = await service.getAssignedLocationIds(context);

      expect(result).toBe('ALL');
      expect(mockPrisma.companyMemberLocation.findMany).not.toHaveBeenCalled();
    });

    it('scopes the query by tenantId/companyId/companyMemberId, never companyMemberId alone', async () => {
      mockPermissionResolver.hasPermission.mockResolvedValue(false);
      mockPrisma.companyMemberLocation.findMany.mockResolvedValue([
        { locationId: 'loc-1' },
        { locationId: 'loc-2' },
      ]);

      const result = await service.getAssignedLocationIds(context);

      expect(result).toEqual(['loc-1', 'loc-2']);
      expect(mockPrisma.companyMemberLocation.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          companyId: 'company-1',
          companyMemberId: 'member-1',
        },
        select: { locationId: true },
      });
    });

    it('returns an empty array (fail-safe default) when the actor has no CompanyMemberLocation rows', async () => {
      mockPermissionResolver.hasPermission.mockResolvedValue(false);
      mockPrisma.companyMemberLocation.findMany.mockResolvedValue([]);

      const result = await service.getAssignedLocationIds(context);

      expect(result).toEqual([]);
    });
  });

  describe('assertHasLocationAccess', () => {
    it('never throws when the actor holds LOCATION_ACCESS_ALL, regardless of the locationId', async () => {
      mockPermissionResolver.hasPermission.mockResolvedValue(true);

      await expect(
        service.assertHasLocationAccess(context, 'any-location'),
      ).resolves.toBeUndefined();
      expect(mockPrisma.companyMemberLocation.findMany).not.toHaveBeenCalled();
    });

    it('resolves silently when the locationId is in the assigned set', async () => {
      mockPermissionResolver.hasPermission.mockResolvedValue(false);
      mockPrisma.companyMemberLocation.findMany.mockResolvedValue([
        { locationId: 'loc-1' },
      ]);

      await expect(
        service.assertHasLocationAccess(context, 'loc-1'),
      ).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when the locationId is not in the assigned set', async () => {
      mockPermissionResolver.hasPermission.mockResolvedValue(false);
      mockPrisma.companyMemberLocation.findMany.mockResolvedValue([
        { locationId: 'loc-1' },
      ]);

      await expect(
        service.assertHasLocationAccess(context, 'loc-2'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the actor has zero assigned locations — no rows means no access', async () => {
      mockPermissionResolver.hasPermission.mockResolvedValue(false);
      mockPrisma.companyMemberLocation.findMany.mockResolvedValue([]);

      await expect(
        service.assertHasLocationAccess(context, 'loc-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
