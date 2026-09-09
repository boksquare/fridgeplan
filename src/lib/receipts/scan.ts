import { Unit, UnitSystem } from '@/generated/prisma/enums';
import { prisma } from '@/lib/prisma';
import { resolveActiveProvider, runAI } from '@/lib/ai/registry';
import { AIProviderError } from '@/lib/ai/types';
import { suggestUnit } from '@/lib/units/suggest';

/**
 * Reads a photo of a receipt into a list of draft inventory items.
 *
 * Nothing is saved from this: the photo is held in memory for the one request
 * and never written to disk or to the database, and the lines it produces are
 * a proposal the user edits and confirms. A model misreading "GRND BF" should
 * cost a correction, not a wrong fridge.
 */
export type DraftItem = {
  /** What the model made of the line, cleaned up. */
  name: string;
  quantity: number | null;
  unit: Unit | null;
  /** The line as printed, so the user can check the reading. */
  raw: string;
  /** True when the name matches something already in the dictionary. */
  known: boolean;
};

export type ScanResult = {
  items: DraftItem[];
  /** Anything the model wanted to flag, e.g. an unreadable section. */
  note: string | null;
  model: string;
};

const SYSTEM = `You read a photograph of a grocery receipt and list the food and drink on it.

Rules:
- Expand the shop's abbreviations into plain ingredient names: "GRND BF 80/20" is "Ground beef", "MLK 2% GAL" is "Milk", "BNLS SKNLS CHKN BRST" is "Chicken breast".
- One entry per purchased item. Skip anything that is not food or drink: totals, subtotals, tax, discounts, loyalty lines, bags, cleaning products, the shop's name.
- Include quantity and unit only when the receipt shows them. A weight like "1.02 LB" is quantity 1.02 unit "lb"; "2 @ 3.49" is quantity 2 unit "count". If no amount is printed, use null for both.
- unit must be one of: g, kg, ml, l, cup, tbsp, tsp, oz, lb, count — or null. There is no gallon: a gallon of milk is quantity 1, unit null, and the user will set it.
- Copy the line as printed into "raw", so the reading can be checked.
- If part of the receipt is unreadable, say so in "note" rather than guessing.

Reply with JSON only, no prose and no code fences:
{"items":[{"name":"Ground beef","quantity":1.02,"unit":"lb","raw":"GRND BF 80/20 1.02 LB"}],"note":null}`;

const UNITS = Object.values(Unit);
const MAX_ITEMS = 60;

function parseResponse(text: string): { items: unknown[]; note: string | null } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return { items: [], note: null };

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      items?: unknown[];
      note?: unknown;
    };
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      note: typeof parsed.note === 'string' && parsed.note.trim() ? parsed.note.trim() : null,
    };
  } catch {
    return { items: [], note: null };
  }
}

/**
 * Which of these names the dictionary already has.
 *
 * This must ask the same question resolveIngredient answers — exact match on
 * the whole name, case aside — or the "new ingredient" badge lies. Normalizing
 * first is tempting and wrong: it strips descriptors, so "Ground beef" becomes
 * "beef" and stops matching the "Ground Beef" row it will actually be saved
 * against.
 */
async function knownNames(names: string[]): Promise<Set<string>> {
  if (names.length === 0) return new Set();

  const rows = await prisma.ingredient.findMany({
    where: { name: { in: [...new Set(names)], mode: 'insensitive' } },
    select: { name: true },
  });

  return new Set(rows.map((row) => row.name.toLowerCase()));
}

export async function scanReceipt(input: {
  image: { mediaType: string; base64: string };
  userId: string;
  system: UnitSystem;
}): Promise<ScanResult> {
  const active = await resolveActiveProvider(input.userId);
  if (!active) {
    throw new AIProviderError('none', 'No AI provider is configured, so photos cannot be read.');
  }
  if (!active.provider.supportsVision) {
    throw new AIProviderError(
      active.provider.id,
      `${active.provider.label} cannot be sent images. Configure a provider with a vision model to scan receipts.`,
    );
  }

  const response = await runAI(
    {
      system: SYSTEM,
      prompt: 'Read this receipt and list the food and drink on it.',
      images: [input.image],
      maxTokens: 1600,
    },
    input.userId,
  );

  const parsed = parseResponse(response.text);
  const rows = parsed.items.slice(0, MAX_ITEMS).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) return [];

    const quantity =
      typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity > 0
        ? Number(row.quantity.toFixed(3))
        : null;
    const unit = UNITS.find((candidate) => candidate === row.unit) ?? null;

    return [{
      name,
      quantity,
      unit,
      raw: typeof row.raw === 'string' ? row.raw.trim() : '',
    }];
  });

  const known = await knownNames(rows.map((row) => row.name));

  // Fill in a unit for lines the receipt did not state one for, using the same
  // table and history that the entry form uses.
  const items: DraftItem[] = [];
  for (const row of rows) {
    const unit =
      row.unit ??
      (
        await suggestUnit({
          ingredientName: row.name,
          userId: input.userId,
          system: input.system,
          // A long receipt must not turn into one AI call per line.
          allowAI: false,
        })
      ).unit;
    items.push({
      ...row,
      unit,
      known: known.has(row.name.toLowerCase()),
    });
  }

  return { items, note: parsed.note, model: response.model };
}
