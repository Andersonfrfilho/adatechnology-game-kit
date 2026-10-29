import type * as THREE_NS from 'three'
import type { ModelKit } from './kit'
import type { WeaponModel } from './index'

type Substitution = ReadonlyMap<THREE_NS.Material, THREE_NS.Material>

/** The paint of worn metal by the rule's condition id (`new` and `used` keep the factory finish): the page's `applyQuality`, with its four steps named like the rule's. */
const substitutions = (kit: ModelKit, condition: string): Substitution | null => {
  const { M } = kit
  if (condition === 'rusty')
    return new Map<THREE_NS.Material, THREE_NS.Material>([
      [M.metal, M.rust],
      [M.dark, M.rustD],
      [M.steel, M.rust],
      [M.steelL, M.rust],
    ])
  if (condition === 'worn')
    return new Map<THREE_NS.Material, THREE_NS.Material>([
      [M.metal, M.worn],
      [M.dark, M.worn],
    ])
  return null
}

/** Dresses the model for how worn the weapon is. The first call keeps the finish each mesh came with, so any condition can be put back. */
export function applyCondition(kit: ModelKit, model: WeaponModel, condition: string): void {
  const replacement = substitutions(kit, condition)
  const glowing = new Set<THREE_NS.Object3D>(model.parts.glow)
  const paint = condition === 'rusty' ? kit.M.rust.color : condition === 'worn' ? kit.M.worn.color : undefined
  model.root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    mesh.userData.baseMaterial ??= mesh.material
    const base = mesh.userData.baseMaterial as THREE_NS.Material
    if (glowing.has(mesh)) {
      const material = mesh.material as THREE_NS.MeshStandardMaterial
      mesh.userData.baseColor ??= material.color.clone()
      material.color.copy(paint ?? (mesh.userData.baseColor as THREE_NS.Color))
      return
    }
    mesh.material = replacement?.get(base) ?? base
  })
}
