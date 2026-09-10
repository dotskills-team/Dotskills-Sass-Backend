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

  /**
   * Reverted the retry-loop experiment from earlier this session — verified
   * live that retrying `$connect()` on an already-failed PrismaClient
   * instance does NOT behave like a clean fresh attempt (the underlying
   * adapter/pool is left in a bad state after the first failure), so more
   * retries made cold-start reliability measurably worse, not better,
   * turning an occasional single-request flake into a sustained outage.
   * A single `$connect()` call — this project's original design — is the
   * correct behavior; NestJS/Vercel's own request lifecycle already
   * retries a failed function invocation on the client side (a fresh
   * request gets a fresh instance).
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
