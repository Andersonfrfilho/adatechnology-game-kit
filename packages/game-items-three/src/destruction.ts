import type * as THREE_NS from 'three'

import data from './data/destruction.json'

/** The destruction material (`game-destruction` id) of each material tag of the kit, for a mesh whose model says nothing else. */
export const DESTRUCTION_MATERIAL_BY_TAG: Readonly<Record<string, string>> = {
  metal: 'steel',
  wood: 'wood_soft',
  glass: 'glass',
  paper: 'paper',
  plastic: 'plastic',
  cloth: 'fabric',
  food: 'flesh_fruit',
}

/** How a model behaves under `game-destruction-three`'s `specFromObject3D`, as `data/destruction.json` keeps it. */
export interface ItemDestruction {
  /** The meshes are thin shells, not solid blocks. */
  readonly hollow?: boolean
  /** The parts of the model are welded to its largest mesh, so a hit dents and holes them instead of tearing them off. */
  readonly welded?: boolean
  /** Meshes made of these material tags are skins (labels, coats): drawn on a part, never a part of their own. */
  readonly skinTags?: readonly string[]
  /** Material tag to destruction material id, over `DESTRUCTION_MATERIAL_BY_TAG`. */
  readonly materials?: Readonly<Record<string, string>>
}

const DESTRUCTION = data as Readonly<Record<string, ItemDestruction>>

export const itemDestruction = (modelId: string): ItemDestruction | undefined => DESTRUCTION[modelId]

function tagOf(mesh: THREE_NS.Mesh): string | undefined {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const tag = (material?.userData as { tag?: unknown } | undefined)?.tag
  return typeof tag === 'string' ? tag : undefined
}

function volumeOf(mesh: THREE_NS.Mesh): number {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox
  if (!box) return 0
  return (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z)
}

/**
 * Writes the `userData` that `specFromObject3D` reads onto the meshes of a drawn item: the destruction material of each mesh from its kit material tag,
 * the item's real weight in kg (`destructionMass`, so the world weighs what the thing weighs) and what the model's entry in `data/destruction.json` asks for (hollow shells, welded parts, skins).
 */
export function tagForDestruction(root: THREE_NS.Object3D, modelId: string | undefined, weight?: number): void {
  if (weight !== undefined && weight > 0) root.userData.destructionMass = weight
  const rule = modelId === undefined ? undefined : itemDestruction(modelId)
  const solid: THREE_NS.Mesh[] = []
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    const tag = tagOf(mesh)
    if (tag === undefined) return
    const material = rule?.materials?.[tag] ?? DESTRUCTION_MATERIAL_BY_TAG[tag]
    if (material !== undefined) mesh.userData.destructionMaterial = material
    if (rule?.skinTags?.includes(tag)) {
      mesh.userData.destructionSkin = true
      return
    }
    if (rule?.hollow) mesh.userData.hollow = true
    solid.push(mesh)
  })
  if (!rule?.welded || solid.length < 2) return
  const anchor = solid.reduce((largest, mesh) => (volumeOf(mesh) > volumeOf(largest) ? mesh : largest))
  solid.forEach((mesh, index) => {
    mesh.userData.destructionPart = mesh === anchor ? { id: 'shell' } : { id: `shell_${index}`, parent: 'shell', kind: 'weld' }
  })
}
