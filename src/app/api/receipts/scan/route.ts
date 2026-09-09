import { NextResponse } from 'next/server';
import { badRequest, withUser } from '@/lib/api';
import { AIProviderError } from '@/lib/ai/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { scanReceipt } from '@/lib/receipts/scan';

/** Kept small on purpose: a vision call's cost scales with the image. */
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Reads a receipt photo into draft items. The photo is held for this request
 * only — never written to disk, never stored in the database, never logged.
 */
export async function POST(request: Request) {
  const { user, response } = await withUser();
  if (response) return response;

  // The only endpoint that spends the operator's AI quota per call.
  const limit = checkRateLimit(`receipt:${user.id}`, 20, 60 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `That is a lot of receipts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.` },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File) || file.size === 0) return badRequest('Choose a photo to read.');
  if (!ALLOWED.includes(file.type)) return badRequest('Photos must be JPEG, PNG or WebP.');
  if (file.size > MAX_BYTES) {
    return badRequest('That photo is too large — the app shrinks photos before sending, so try again.');
  }

  try {
    const result = await scanReceipt({
      image: {
        mediaType: file.type,
        base64: Buffer.from(await file.arrayBuffer()).toString('base64'),
      },
      userId: user.id,
      system: user.unitSystem,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
