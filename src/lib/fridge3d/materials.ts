import * as THREE from 'three';

/**
 * One place for the look of the appliance: dark graphite cabinet, brushed steel
 * fronts, polished handles, a bright moulded interior, and a cool accent light
 * that reads as modern rather than domestic.
 */
export type FridgeMaterials = ReturnType<typeof createMaterials>;

export function createMaterials() {
  const cabinet = new THREE.MeshStandardMaterial({
    color: 0x20242b,
    metalness: 0.55,
    roughness: 0.42,
  });

  const doorFront = new THREE.MeshStandardMaterial({
    color: 0xc9d2da,
    metalness: 0.88,
    roughness: 0.26,
  });

  const doorInner = new THREE.MeshStandardMaterial({
    color: 0xf4f8fb,
    metalness: 0.05,
    roughness: 0.75,
  });

  const handle = new THREE.MeshStandardMaterial({
    color: 0xeef3f7,
    metalness: 1,
    roughness: 0.14,
  });

  const accent = new THREE.MeshStandardMaterial({
    color: 0x0b1220,
    emissive: new THREE.Color(0x38bdf8),
    emissiveIntensity: 0.9,
    metalness: 0.4,
    roughness: 0.4,
  });

  const interior = new THREE.MeshStandardMaterial({
    color: 0xf6fafc,
    metalness: 0.02,
    roughness: 0.85,
  });

  const interiorFreezer = new THREE.MeshStandardMaterial({
    color: 0xe4f1fb,
    metalness: 0.04,
    roughness: 0.8,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xeaf6ff,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.42,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });

  // Smoked glass for drawer fronts: contents read through it from a level
  // viewpoint, which an opaque front hides completely.
  const frosted = new THREE.MeshPhysicalMaterial({
    color: 0xb9c8d8,
    metalness: 0.15,
    roughness: 0.5,
    transparent: true,
    opacity: 0.76,
    clearcoat: 0.9,
    clearcoatRoughness: 0.3,
  });

  // The cavity light: dark until a door opens, then it comes on.
  const lightPanel = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0,
    roughness: 1,
  });

  const item = {
    fresh: new THREE.MeshStandardMaterial({ color: 0xa8b6c6, roughness: 0.55, metalness: 0.1 }),
    soon: new THREE.MeshStandardMaterial({ color: 0xf5a524, roughness: 0.5, metalness: 0.1 }),
    expired: new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5, metalness: 0.1 }),
  };

  const all = [
    cabinet,
    doorFront,
    frosted,
    doorInner,
    handle,
    accent,
    interior,
    interiorFreezer,
    glass,
    lightPanel,
    item.fresh,
    item.soon,
    item.expired,
  ];

  return {
    cabinet,
    doorFront,
    frosted,
    doorInner,
    handle,
    accent,
    interior,
    interiorFreezer,
    glass,
    lightPanel,
    item,
    dispose() {
      for (const material of all) material.dispose();
    },
  };
}
