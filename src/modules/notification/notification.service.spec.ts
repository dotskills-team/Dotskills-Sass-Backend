import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const mockTx = {
    notification: { create: jest.fn() },
  };

  const mockPrisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const context = {
    tenantId: 'tenant-1',
    companyId: 'company-1',
    companyMemberId: 'member-1',
    companyStatus: 'LIVE',
    tenantStatus: 'ACTIVE',
    scopes: [],
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('create', () => {
    it('writes tenantId/companyId from context, never trusting a client-supplied value', async () => {
      mockTx.notification.create.mockResolvedValue({ id: 'notif-1' });

      await service.create(
        mockTx as any,
        { tenantId: 'tenant-1', companyId: 'company-1' },
        {
          type: 'LOW_STOCK',
          relatedEntityType: 'PRODUCT',
          relatedEntityId: 'product-1',
          locationId: 'loc-1',
          metadata: { sku: 'SKU-1' },
        },
      );

      expect(mockTx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          companyId: 'company-1',
          type: 'LOW_STOCK',
          relatedEntityType: 'PRODUCT',
          relatedEntityId: 'product-1',
          locationId: 'loc-1',
          metadata: { sku: 'SKU-1' },
        }),
      });
    });
  });

  describe('listForCompany', () => {
    it('scopes by tenantId/companyId, and adds isRead:false only when unreadOnly is requested', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.listForCompany(context, { unreadOnly: true });

      const [findManyArgs] = mockPrisma.notification.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({
        tenantId: 'tenant-1',
        companyId: 'company-1',
        isRead: false,
      });
    });

    it('returns pagination metadata computed from total/limit', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(125);

      const result = await service.listForCompany(context, {
        page: 2,
        limit: 50,
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 50,
        total: 125,
        totalPages: 3,
      });
    });
  });

  describe('getUnreadCount', () => {
    it("counts only this company's unread notifications", async () => {
      mockPrisma.notification.count.mockResolvedValue(4);

      const result = await service.getUnreadCount(context);

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', companyId: 'company-1', isRead: false },
      });
      expect(result.data.count).toBe(4);
    });
  });

  describe('markRead', () => {
    it('throws NotFoundException for a notification outside this company scope', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markRead(context, 'notif-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('marks isRead:true and sets readAt', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        isRead: false,
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: 'notif-1',
        isRead: true,
      });

      const result = await service.markRead(context, 'notif-1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true, readAt: expect.any(Date) },
      });
      expect(result.data.isRead).toBe(true);
    });

    it('is idempotent — calling it again on an already-read notification does not re-update', async () => {
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notif-1',
        isRead: true,
      });

      await service.markRead(context, 'notif-1');

      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });
  });
});
