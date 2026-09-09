import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { withUser } from '@/lib/api';
import { resolveUploadPath } from '@/lib/uploads';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/**
 * Serves uploaded recipe photos. Behind the same sign-in as everything else,
 * and path traversal is refused by `resolveUploadPath`.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { response } = await withUser();
  if (response) return response;

  const { path: segments } = await params;
  const resolved = resolveUploadPath(segments.join('/'));
  if (!resolved) return new NextResponse('Not found', { status: 404 });

  const contentType = CONTENT_TYPES[path.extname(resolved).toLowerCase()];
  if (!contentType) return new NextResponse('Not found', { status: 404 });

  try {
    const info = await stat(resolved);
    if (!info.isFile()) return new NextResponse('Not found', { status: 404 });
    const file = await readFile(resolved);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'content-type': contentType,
        'content-length': String(info.size),
        'cache-control': 'private, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
