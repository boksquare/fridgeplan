// Prisma 7 no longer loads .env implicitly, so do it here for CLI commands.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 moved the datasource URL out of schema.prisma: the CLI (migrate,
 * db push, introspection) reads it from here, and the runtime client gets it
 * through the pg driver adapter in src/lib/prisma.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read loosely on purpose: `prisma generate` runs during the Docker image
    // build, where no database URL exists yet. Commands that actually talk to
    // the database (migrate, db seed) fail with a clear error if it is unset.
    url: process.env.DATABASE_URL ?? '',
  },
});
