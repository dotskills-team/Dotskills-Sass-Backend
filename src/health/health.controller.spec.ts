import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  const mockPrisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('reports healthy when the database responds', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.checkHealth()).resolves.toEqual({
      success: true,
      message: 'DotSkills API is healthy',
      database: 'connected',
    });
  });

  it('reports unhealthy without throwing when the database is unreachable', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.checkHealth()).resolves.toEqual({
      success: false,
      message: 'DotSkills API is running',
      database: 'disconnected',
    });
  });
});
