/**
 * Seeds the Ingredient dictionary that backs autocomplete and recipe matching.
 *
 * Primary source is TheMealDB's ingredient list (free, no key, cacheable
 * indefinitely with attribution). If the network is unavailable the small
 * fallback list below keeps autocomplete usable, and re-running the seed later
 * fills in the rest — it is idempotent.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set — see .env.example.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const THEMEALDB_INGREDIENTS = 'https://www.themealdb.com/api/json/v1/1/list.php?i=list';

const FALLBACK_INGREDIENTS = [
  'Butter', 'Carrots', 'Cheddar Cheese', 'Chicken Breast', 'Chicken Thighs', 'Eggs',
  'Flour', 'Garlic', 'Ground Beef', 'Lemon', 'Milk', 'Olive Oil', 'Onion', 'Parsley',
  'Pasta', 'Potatoes', 'Rice', 'Salmon', 'Salt', 'Black Pepper', 'Sugar', 'Tomatoes',
  'Yoghurt',
];

async function fetchIngredientNames(): Promise<string[]> {
  try {
    const res = await fetch(THEMEALDB_INGREDIENTS);
    if (!res.ok) throw new Error(`TheMealDB returned ${res.status}`);
    const body = (await res.json()) as { meals?: { strIngredient?: string }[] | null };
    const names = (body.meals ?? [])
      .map((meal) => meal.strIngredient?.trim())
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) throw new Error('TheMealDB returned no ingredients');
    return names;
  } catch (error) {
    console.warn(
      `[seed] Could not reach TheMealDB (${(error as Error).message}); using the fallback list.`,
    );
    return FALLBACK_INGREDIENTS;
  }
}

async function main() {
  const names = await fetchIngredientNames();
  const result = await prisma.ingredient.createMany({
    data: names.map((name) => ({ name })),
    skipDuplicates: true,
  });
  console.log(`[seed] ${result.count} new ingredients (${names.length} in source list).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
