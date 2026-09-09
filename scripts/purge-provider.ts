/**
 * Deletes every cached recipe obtained from one source, e.g. when an operator
 * stops using Spoonacular and their terms require the data to be removed:
 *
 *   npx tsx scripts/purge-provider.ts spoonacular
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const sourceApi = process.argv[2];
if (!sourceApi) {
  console.error('Usage: npx tsx scripts/purge-provider.ts <sourceApi>');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set — see .env.example.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// No top-level await: the file is transpiled to CommonJS when run with tsx.
async function main() {
  const { count } = await prisma.recipe.deleteMany({ where: { isPrivate: false, sourceApi } });
  console.log(`Deleted ${count} cached recipes from ${sourceApi}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
