import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import {
  StockMovementType,
  StockTransferStatus,
} from '../../../generated/phase-1-prisma/enums';
import { PrismaService } from '../../../prisma/prisma.service';
import { InventoryService } from '../../master-data/inventory/inventory.service';
import { StockTransferService } from './stock-transfer.service';

describe('StockTransferService', () => {
  let service: StockTransferService;

  const mockTx = {
    stockTransfer: { create: jest.fn(), update: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrisma = {
    stockTransfer: { findFirst: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockTx) : Promise.all(arg),
    ),
  };

  const mockInventoryService = {
    increaseStock: jest.fn(),
    decreaseStock: jest.fn(),
  };

  const context = { tenantId: 'tenant-1', companyId: 'company-1' } as any;
  const actor = { userId: 'user-1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockTransferService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get(StockTransferService);
  });

  describe('create', () => {
    it('rejects when fromLocationId equals toLocationId', async () => {
      await expect(
        service.create(
          context,
          {
            fromLocationId: 'loc-1',
            toLocationId: 'loc-1',
            productId: 'p-1',
            quantity: 5,
          } as any,
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.stockTransfer.create).not.toHaveBeenCalled();
    });

    it('creates a PENDING transfer without touching Inventory at all', async () => {
      mockTx.stockTransfer.create.mockResolvedValue({
        id: 't-1',
        status: StockTransferStatus.PENDING,
      });

      await service.create(
        context,
        {
          fromLocationId: 'loc-1',
          toLocationId: 'loc-2',
          productId: 'p-1',
          quantity: 5,
        },
        actor,
      );

      expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
      expect(mockInventoryService.increaseStock).not.toHaveBeenCalled();
    });
  });

  describe('dispatch', () => {
    const pending = {
      id: 't-1',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      productId: 'p-1',
      quantity: 5,
      status: StockTransferStatus.PENDING,
    };

    it('rejects dispatching a transfer that is not PENDING', async () => {
      mockPrisma.stockTransfer.findFirst.mockResolvedValue({
        ...pending,
        status: StockTransferStatus.IN_TRANSIT,
      });

      await expect(service.dispatch(context, 't-1', actor)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
    });

    it('decreases stock at the source location with allowNegative:false and movementType TRANSFER_OUT, then moves to IN_TRANSIT', async () => {
      mockPrisma.stockTransfer.findFirst.mockResolvedValue(pending);
      mockInventoryService.decreaseStock.mockResolvedValue({});
      mockTx.stockTransfer.update.mockResolvedValue({
        id: 't-1',
        status: StockTransferStatus.IN_TRANSIT,
      });

      await service.dispatch(context, 't-1', actor);

      expect(mockInventoryService.decreaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'p-1',
          locationId: 'loc-1',
          quantity: 5,
          movementType: StockMovementType.TRANSFER_OUT,
          allowNegative: false,
        }),
      );
      expect(mockTx.stockTransfer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: StockTransferStatus.IN_TRANSIT,
          }),
        }),
      );
      // destination must not be touched at dispatch time
      expect(mockInventoryService.increaseStock).not.toHaveBeenCalled();
    });
  });

  describe('receive', () => {
    const inTransit = {
      id: 't-1',
      fromLocationId: 'loc-1',
      toLocationId: 'loc-2',
      productId: 'p-1',
      quantity: 5,
      status: StockTransferStatus.IN_TRANSIT,
    };

    it('rejects receiving a transfer that is not IN_TRANSIT', async () => {
      mockPrisma.stockTransfer.findFirst.mockResolvedValue({
        ...inTransit,
        status: StockTransferStatus.PENDING,
      });

      await expect(service.receive(context, 't-1', actor)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockInventoryService.increaseStock).not.toHaveBeenCalled();
    });

    it('increases stock at the destination location with movementType TRANSFER_IN, then moves to RECEIVED', async () => {
      mockPrisma.stockTransfer.findFirst.mockResolvedValue(inTransit);
      mockInventoryService.increaseStock.mockResolvedValue({});
      mockTx.stockTransfer.update.mockResolvedValue({
        id: 't-1',
        status: StockTransferStatus.RECEIVED,
      });

      await service.receive(context, 't-1', actor);

      expect(mockInventoryService.increaseStock).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          productId: 'p-1',
          locationId: 'loc-2',
          quantity: 5,
          movementType: StockMovementType.TRANSFER_IN,
        }),
      );
      expect(mockTx.stockTransfer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: StockTransferStatus.RECEIVED,
          }),
        }),
      );
      // source must not be touched again at receive time
      expect(mockInventoryService.decreaseStock).not.toHaveBeenCalled();
    });
  });
});
