'use client';

/**
 * Shrinks a photo in the browser before it is sent.
 *
 * Two reasons, both practical: a vision call's cost scales with the image, and
 * NVIDIA NIM only accepts an inline image under roughly 180 KB — a phone photo
 * is twenty times that. Receipt text survives this easily; it is high-contrast
 * and we only need it legible, not archival.
 */
const TARGET_BYTES = 120 * 1024;
const STEPS: { maxEdge: number; quality: number }[] = [
  { maxEdge: 1600, quality: 0.75 },
  { maxEdge: 1400, quality: 0.65 },
  { maxEdge: 1200, quality: 0.6 },
  { maxEdge: 1000, quality: 0.55 },
  { maxEdge: 900, quality: 0.5 },
];

async function loadImage(file: File): Promise<{ width: number; height: number; bitmap: ImageBitmap }> {
  const bitmap = await createImageBitmap(file);
  return { width: bitmap.width, height: bitmap.height, bitmap };
}

function draw(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function shrinkForVision(file: File): Promise<File> {
  const { bitmap } = await loadImage(file);
  try {
    let smallest: Blob | null = null;
    for (const step of STEPS) {
      const blob = await toBlob(draw(bitmap, step.maxEdge), step.quality);
      if (!blob) continue;
      smallest = blob;
      if (blob.size <= TARGET_BYTES) break;
    }
    if (!smallest) return file;
    return new File([smallest], 'receipt.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}
