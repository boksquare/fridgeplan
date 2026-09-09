import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — see .env.example.');
  }
  // Prisma 7 takes the connection through a driver adapter rather than a `url`
  // in schema.prisma.
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function client(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing) return existing;

  // Cached on the global so hot reloads in development reuse one client.
  const created = createClient();
  globalForPrisma.prisma = created;
  return created;
}

/**
 * Connects on first use, not on import.
 *
 * `next build` evaluates every route module to collect its config, and the
 * build has no database — so constructing the client at import time failed the
 * production image build. Going through a proxy keeps importing free and only
 * requires DATABASE_URL when a query actually runs.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const target = client();
    const value = target[property as keyof PrismaClient];
    // Methods such as $transaction need `this` to be the real client.
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
  },
  has(_target, property) {
    return property in client();
  },
});
