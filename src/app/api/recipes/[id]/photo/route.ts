import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, notFound, withUser } from '@/lib/api';
import { ownRecipeFilter } from '@/lib/recipes/access';
import { UploadError, deleteUpload, saveRecipePhoto } from '@/lib/uploads';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const recipe = await prisma.recipe.findFirst({
    where: { AND: [{ id }, await ownRecipeFilter(user.id)] },
  });
  if (!recipe) return notFound('No such recipe.');

  const form = await request.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File) || file.size === 0) return badRequest('Choose a photo to upload.');

  try {
    const url = await saveRecipePhoto(file);
    // Replacing a photo should not leave the old file behind.
    if (recipe.imageUrl) await deleteUpload(recipe.imageUrl);
    await prisma.recipe.update({ where: { id }, data: { imageUrl: url } });
    return NextResponse.json({ imageUrl: url });
  } catch (error) {
    if (error instanceof UploadError) return badRequest(error.message);
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { user, response } = await withUser();
  if (response) return response;
  const { id } = await params;

  const recipe = await prisma.recipe.findFirst({
    where: { AND: [{ id }, await ownRecipeFilter(user.id)] },
  });
  if (!recipe) return notFound('No such recipe.');

  // No stock-photo fallback by design: a recipe without a photo has none.
  if (recipe.imageUrl) await deleteUpload(recipe.imageUrl);
  await prisma.recipe.update({ where: { id }, data: { imageUrl: null } });
  return NextResponse.json({ imageUrl: null });
}
