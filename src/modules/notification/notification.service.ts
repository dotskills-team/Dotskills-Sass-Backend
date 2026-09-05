import { Injectable, NotFoundException } from '@nestjs/common';

import { Prisma } from 'src/generated/phase-1-prisma/client';
import {
  NotificationRelatedEntityType,
  NotificationType,
} from 'src/generated/phase-1-prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import type { CompanyContext } from '../../common/types/company-context.type';
import { ListNotificationsQueryDto } from './dto/notification.dto';

export interface CreateNotificationInput {
  type: NotificationType;
  relatedEntityType: NotificationRelatedEntityType;
  relatedEntityId: string;
  locationId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Dashboard Notification Bell — Owner/Admin only this phase. `create()` is
 * a plain, dumb writer with no business logic of its own (matches
 * AuditLog's own precedent) — every caller decides *whether* and *when* to
 * call it (dedup logic, if any, lives at the call site, see
 * InventoryService.decreaseStock() for the one real example). Takes a
 * `Prisma.TransactionClient` so it always writes inside the caller's own
 * transaction — a notification for a mutation that rolls back must never
 * exist, one for a mutation that commits must never be silently lost.
 */
@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tx: Prisma.TransactionClient,
    context: Pick<CompanyContext, 'tenantId' | 'companyId'>,
    input: CreateNotificationInput,
  ) {
    return tx.notification.create({
      data: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        type: input.type,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        locationId: input.locationId,
        metadata: input.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async listForCompany(
    context: CompanyContext,
    query: ListNotificationsQueryDto = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      ...(query.unreadOnly ? { isRead: false } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUnreadCount(context: CompanyContext) {
    const count = await this.prisma.notification.count({
      where: {
        tenantId: context.tenantId,
        companyId: context.companyId,
        isRead: false,
      },
    });
    return { success: true, data: { count } };
  }

  async markRead(context: CompanyContext, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId: context.tenantId, companyId: context.companyId },
    });
    if (!notification) {
      throw new NotFoundException('Notification was not found');
    }
    if (notification.isRead) {
      return { success: true, data: notification };
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true, data: updated };
  }
}
