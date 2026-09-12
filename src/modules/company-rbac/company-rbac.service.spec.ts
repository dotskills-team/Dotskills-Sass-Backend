import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import {
  NotificationType,
  NotificationRelatedEntityType,
} from '../../generated/phase-1-prisma/enums';
import { CompanyRbacService } from './company-rbac.service';

/**
 * Focused coverage for the STAFF_ACTIVITY notification hook added to
 * createMember/replaceMemberRoles/replaceMemberLocations — this service had
 * no dedicated unit spec before (only indirect coverage via isolation
 * specs), so this file scopes itself to just the new notification side
 * effect rather than retrofitting full coverage of the whole service.
 */
describe('CompanyRbacService — STAFF_ACTIVITY notification', () => {
  let service: CompanyRbacService;

  const mockTx = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    companyMember: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
    companyMemberRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    companyMemberLocation: { deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
    companyRole: { findMany: jest.fn() },
    companyMember: { findFirst: jest.fn() },
    location: { findMany: jest.fn() },
  };

  const mockNotificationService = { create: jest.fn() };

  const context = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    companyMemberId: 'actor-member-1',
  } as any;
  const actor = { userId: 'actor-user-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyRbacService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get(CompanyRbacService);
  });

  it('createMember fires STAFF_ACTIVITY with action MEMBER_CREATED', async () => {
    mockPrisma.companyRole.findMany.mockResolvedValue([
      { id: 'role-cashier', code: 'CASHIER' },
    ]);
    mockTx.user.findUnique.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue({ id: 'user-2', deletedAt: null });
    mockTx.companyMember.create.mockResolvedValue({
      id: 'member-2',
      user: { id: 'user-2', fullName: 'Karim Uddin' },
    });

    await service.createMember(
      context,
      {
        email: 'karim@example.com',
        fullName: 'Karim Uddin',
        password: 'a-strong-password',
        roleCodes: ['CASHIER'],
      },
      actor,
    );

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      mockTx,
      context,
      {
        type: NotificationType.STAFF_ACTIVITY,
        relatedEntityType: NotificationRelatedEntityType.COMPANY_MEMBER,
        relatedEntityId: 'member-2',
        metadata: { memberName: 'Karim Uddin', action: 'MEMBER_CREATED' },
      },
    );
  });

  it('replaceMemberRoles fires STAFF_ACTIVITY with action MEMBER_ROLES_UPDATED', async () => {
    mockPrisma.companyMember.findFirst.mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      status: 'ACTIVE',
      roles: [{ companyRole: { code: 'CASHIER' } }],
    });
    mockPrisma.companyRole.findMany.mockResolvedValue([
      { id: 'role-manager', code: 'MANAGER' },
    ]);
    mockTx.companyMember.findUniqueOrThrow.mockResolvedValue({
      id: 'member-1',
      user: { id: 'user-1', fullName: 'Rahim Uddin' },
    });

    await service.replaceMemberRoles(
      context,
      'member-1',
      { roleCodes: ['MANAGER'] },
      actor,
    );

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      mockTx,
      context,
      {
        type: NotificationType.STAFF_ACTIVITY,
        relatedEntityType: NotificationRelatedEntityType.COMPANY_MEMBER,
        relatedEntityId: 'member-1',
        metadata: { memberName: 'Rahim Uddin', action: 'MEMBER_ROLES_UPDATED' },
      },
    );
  });

  it('replaceMemberLocations fires STAFF_ACTIVITY with action MEMBER_LOCATIONS_UPDATED', async () => {
    mockPrisma.companyMember.findFirst.mockResolvedValue({
      id: 'member-1',
      userId: 'user-1',
      status: 'ACTIVE',
      roles: [{ companyRole: { code: 'CASHIER' } }],
    });
    mockPrisma.location.findMany.mockResolvedValue([{ id: 'location-1' }]);
    mockTx.companyMember.findUniqueOrThrow.mockResolvedValue({
      id: 'member-1',
      user: { id: 'user-1', fullName: 'Rahim Uddin' },
    });

    await service.replaceMemberLocations(
      context,
      'member-1',
      { locationIds: ['location-1'] },
      actor,
    );

    expect(mockNotificationService.create).toHaveBeenCalledWith(
      mockTx,
      context,
      {
        type: NotificationType.STAFF_ACTIVITY,
        relatedEntityType: NotificationRelatedEntityType.COMPANY_MEMBER,
        relatedEntityId: 'member-1',
        metadata: {
          memberName: 'Rahim Uddin',
          action: 'MEMBER_LOCATIONS_UPDATED',
        },
      },
    );
  });
});
