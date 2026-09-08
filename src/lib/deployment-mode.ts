import { prisma } from '@/lib/prisma';
import type { DeploymentModeKind } from '@/generated/prisma/client';

export const DEPLOYMENT_MODE_ID = 'singleton';

/**
 * Returns the instance's deployment mode, or null if first-run setup has not
 * happened yet. Everything mode-dependent reads through here rather than an
 * env var, so the setup wizard is the single source of truth.
 */
export async function getDeploymentMode(): Promise<DeploymentModeKind | null> {
  const row = await prisma.deploymentMode.findUnique({
    where: { id: DEPLOYMENT_MODE_ID },
  });
  return row?.mode ?? null;
}

export async function setDeploymentMode(mode: DeploymentModeKind) {
  return prisma.deploymentMode.upsert({
    where: { id: DEPLOYMENT_MODE_ID },
    update: { mode },
    create: { id: DEPLOYMENT_MODE_ID, mode },
  });
}

export async function isSetupComplete(): Promise<boolean> {
  return (await getDeploymentMode()) !== null;
}
