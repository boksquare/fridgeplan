import type { Unit } from '@/generated/prisma/enums';

export type RecipeIngredient = {
  name: string;
  quantity: number | null;
  unit: Unit | null;
  /** The source's own wording, kept verbatim for display. */
  raw: string;
};

export type ProviderRecipe = {
  sourceApi: string;
  externalId: string;
  title: string;
  cuisine: string | null;
  imageUrl: string | null;
  ingredients: RecipeIngredient[];
  instructions: string;
};

export type SearchOptions = { query?: string; cuisine?: string; limit?: number };

/**
 * One interface per recipe source, so a self-hoster can point the app at
 * whichever provider they like and calling code never changes.
 */
export type RecipeProvider = {
  id: string;
  label: string;
  /** Attribution shown wherever this provider's recipes appear. */
  attribution: string;
  /**
   * How long results may be stored. null means indefinitely (TheMealDB);
   * a number of minutes means the rows must be treated as a short-lived cache
   * (Spoonacular's terms allow one hour).
   */
  cacheMinutes: number | null;
  searchByText(options: SearchOptions): Promise<ProviderRecipe[]>;
  /** Recipes that use as many of these ingredient names as possible. */
  searchByIngredients(names: string[], limit?: number): Promise<ProviderRecipe[]>;
  getByExternalId(externalId: string): Promise<ProviderRecipe | null>;
};

export class RecipeProviderError extends Error {
  constructor(
    public providerId: string,
    message: string,
  ) {
    super(message);
    this.name = 'RecipeProviderError';
  }
}
