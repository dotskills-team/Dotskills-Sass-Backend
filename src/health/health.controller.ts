import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        success: true,
        message: 'DotSkills API is healthy',
        database: 'connected',
      };
    } catch {
      return {
        success: false,
        message: 'DotSkills API is running',
        database: 'disconnected',
      };
    }
  }
}
