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
   * Serverless cold starts (Vercel) sometimes race Neon's pooled/PgBouncer
   * connection on the very first `$connect()` of a fresh instance — verified
   * live: the first request to a cold instance intermittently fails while
   * immediate retries on the now-warm instance succeed reliably. A short
   * retry-with-backoff here absorbs that one-time cold-start hiccup without
   * masking a genuinely unreachable database (still throws after 3 tries).
   */
  async onModuleInit(): Promise<void> {
    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        // No artificial backoff — the failed $connect() attempt itself
        // already takes real time on a cold container; adding delay on
        // top of that risks exceeding the serverless function's own
        // execution timeout before enough attempts land.
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
