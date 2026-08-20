// import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
// import { PrismaPg } from '@prisma/adapter-pg';
// import { PrismaClient } from '../../generated/prisma/client';

// @Injectable()
// export class PrismaService
//   extends PrismaClient
//   implements OnModuleInit, OnModuleDestroy
// {
//   constructor() {
//     const adapter = new PrismaPg({
//       connectionString: process.env.DATABASE_URL,
//     });

//     super({ adapter });
//   }

//   async onModuleInit(): Promise<void> {
//     await this.$connect();
//   }

//   async onModuleDestroy(): Promise<void> {
//     await this.$disconnect();
//   }
// }
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/phase-1-prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing in .env');
    }

    const adapter = new PrismaPg({
      connectionString: databaseUrl,
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
