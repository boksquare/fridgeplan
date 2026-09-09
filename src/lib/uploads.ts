import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Photos for private recipes live on a plain volume (docker-compose mounts one
 * at /app/uploads) rather than in an object store, so self-hosting needs no
 * extra service.
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export function extensionForType(type: string): string | null {
  return ALLOWED[type] ?? null;
}

export class UploadError extends Error {}

/** Saves an uploaded image and returns the URL to serve it from. */
export async function saveRecipePhoto(file: File): Promise<string> {
  const extension = extensionForType(file.type);
  if (!extension) throw new UploadError('Photos must be JPEG, PNG, WebP or AVIF.');
  if (file.size > MAX_BYTES) throw new UploadError('Photos must be 5 MB or smaller.');

  const name = `${randomUUID()}.${extension}`;
  const directory = path.join(UPLOAD_DIR, 'recipes');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, name), Buffer.from(await file.arrayBuffer()));

  return `/api/uploads/recipes/${name}`;
}

/** Removes a previously saved photo; a missing file is not an error. */
export async function deleteUpload(url: string) {
  const relative = url.replace(/^\/api\/uploads\//, '');
  const resolved = resolveUploadPath(relative);
  if (!resolved) return;
  try {
    await unlink(resolved);
  } catch {
    // Already gone.
  }
}

/**
 * Maps a request path to a file inside the upload directory, refusing anything
 * that climbs out of it.
 */
export function resolveUploadPath(relative: string): string | null {
  // turbopackIgnore keeps the bundler from tracing the whole project into the
  // server output because this path comes from configuration.
  const resolved = path.resolve(/* turbopackIgnore: true */ UPLOAD_DIR, relative);
  const root = path.resolve(/* turbopackIgnore: true */ UPLOAD_DIR);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
