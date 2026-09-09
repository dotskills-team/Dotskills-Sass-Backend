import type { IncomingMessage, ServerResponse } from 'http';
import type { Express } from 'express';

import { createNestApp } from '../src/bootstrap';

/**
 * Vercel serverless entry point — NOT used by local dev (`main.ts` still
 * owns that, via `app.listen()`). Vercel's Node.js runtime accepts a
 * plain `(req, res)` handler natively, and an Express instance already
 * is one, so no AWS-Lambda-event-translation package
 * (serverless-http/@vendia-style) is needed here at all.
 *
 * Cached at module scope so a warm invocation reuses the same compiled
 * Nest app — critically, the same `PrismaService`/`pg` connection pool —
 * instead of opening a fresh one per request. Only a genuine cold start
 * pays the full bootstrap + pool-creation cost.
 */
let cachedServer: Express | undefined;

async function getServer(): Promise<Express> {
  if (cachedServer) return cachedServer;

  const app = await createNestApp();
  await app.init();
  const server = app.getHttpAdapter().getInstance() as Express;
  cachedServer = server;
  return server;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const server = await getServer();
  server(req, res);
}
