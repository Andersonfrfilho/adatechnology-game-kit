import type * as THREE_NS from 'three'

import type { ItemMaterialData } from './kit'

/** 0 new, 1 used, 2 spoiled (the three stages of the showcase). */
export type WearStage = 0 | 1 | 2

/** The colour each material tag turns toward as it wears (`STAGE_TARGET` of the showcase). */
export const WEAR_TARGET: Readonly<Record<string, number>> = { food: 0x5d6b2e, metal: 0x7a3e1d, wood: 0x3f3326, cloth: 0x4a4033, plastic: 0x6b6556, paper: 0x8a7a52, glass: 0x55503a }

/** How far toward the target colour each stage goes (`AMT`). */
export const WEAR_AMOUNT: readonly [number, number, number] = [0, 0.3, 0.62]

const hexToRgb = (hex: number): readonly [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]

const dataOf = (material: THREE_NS.Material): ItemMaterialData | undefined => {
  const data = material.userData as Partial<ItemMaterialData>
  return data.base && data.baseRgb && data.tag !== undefined && data.rough !== undefined ? (data as ItemMaterialData) : undefined
}

/** Every material under `root` that the kit made (with a tag), once each. */
export function wearableMaterials(root: THREE_NS.Object3D): THREE_NS.MeshStandardMaterial[] {
  const found = new Set<THREE_NS.MeshStandardMaterial>()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (dataOf(material)) found.add(material as THREE_NS.MeshStandardMaterial)
  })
  return [...found]
}

/**
 * Sets the wear of an item (`setStage` of the showcase): each material goes from its own colour toward the target of its tag by `WEAR_AMOUNT[stage]`, gets rougher, and
 * metal loses its shine. The colours are mixed in sRGB, as the page mixes them (three r128 had no colour management), so stage 0 is exactly the colour the material was made with.
 * Takes the object or the list of materials of a kit.
 */
export function setWear(target: THREE_NS.Object3D | readonly THREE_NS.MeshStandardMaterial[], stage: WearStage): void {
  const materials = 'traverse' in target ? wearableMaterials(target) : target
  if ('traverse' in target) target.userData.wear = stage
  const amount = WEAR_AMOUNT[stage]
  for (const material of materials) {
    const data = dataOf(material)
    if (!data) continue
    const goal = WEAR_TARGET[data.tag]
    if (goal === undefined) continue
    const [tr, tg, tb] = hexToRgb(goal)
    const [r, g, b] = data.baseRgb
    material.color.setRGB(r + (tr - r) * amount, g + (tg - g) * amount, b + (tb - b) * amount, 'srgb')
    material.roughness = Math.min(1, data.rough + (0.2 * stage) / 2)
    if (data.tag === 'metal') material.metalness = Math.max(0.1, 0.55 - 0.2 * stage)
  }
}
