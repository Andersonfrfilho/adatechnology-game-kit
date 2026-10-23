import type * as THREE_NS from 'three'
import type { DestructibleSpec, PartSpec } from '@adatechnology/game-destruction'

/** Default look of each built-in destruction material (`0xRRGGBB`). */
export const MATERIAL_COLORS: Record<string, number> = {
  steel: 0x8d949c,
  cast_iron: 0x4a4d52,
  aluminium: 0xc4c9ce,
  copper: 0xb8733a,
  wood_soft: 0xb9854f,
  wood_hard: 0x7a4a26,
  plywood: 0xc9a46a,
  mdf: 0xa88b64,
  glass: 0x9cd6e6,
  tempered_glass: 0x9cd6e6,
  ceramic: 0xe9e4da,
  concrete: 0x9a9a96,
  brick: 0xa5472e,
  plaster: 0xe6e1d4,
  stone: 0x77746f,
  plastic: 0x3b78c4,
  rubber: 0x1f1f22,
  fabric: 0x8a4b5e,
  foam: 0xe3c458,
  leather: 0x5b3a26,
  paper: 0xeeeadf,
  foliage: 0x3f8f3a,
  green_wood: 0x6b4a2b,
  cactus: 0x3e7d4a,
  flesh_fruit: 0xd24b32,
  wax: 0xefe2b5,
  soil: 0x4a3322,
}

export interface BuildFromSpecOptions {
  /** Colour per part id, then per material id (falls back to `MATERIAL_COLORS`, then grey). */
  colors?: Record<string, number>
  /** Segments of cylinders and spheres (default 12: low poly on purpose). */
  segments?: number
  /** Cast and receive shadows (default true). */
  shadows?: boolean
}

const TRANSPARENT: Record<string, number> = { glass: 0.38, tempered_glass: 0.38 }

/**
 * Draw any `DestructibleSpec` as plain meshes: one mesh per part (box, cylinder or sphere) with `name` and `userData.destructionPart` set to the
 * part id and `userData.destructionMaterial` to its material, so `renderer.bind` and `specFromObject3D` find them. Useful for teams that describe
 * objects as specs and want something to look at while they tune them.
 */
export function buildFromSpec(THREE: typeof THREE_NS, spec: DestructibleSpec, options: BuildFromSpecOptions = {}): THREE_NS.Group {
  const root = new THREE.Group()
  root.name = spec.name ?? 'object'
  const seg = options.segments ?? 12
  const shadows = options.shadows !== false
  const mats = new Map<string, THREE_NS.Material>()
  const materialFor = (p: PartSpec): THREE_NS.Material => {
    const color = options.colors?.[p.id] ?? options.colors?.[p.material] ?? MATERIAL_COLORS[p.material] ?? 0x888888
    const key = `${p.material}:${color}`
    let m = mats.get(key)
    if (!m) {
      const alpha = TRANSPARENT[p.material]
      const metal = p.material === 'steel' || p.material === 'aluminium' || p.material === 'copper' || p.material === 'cast_iron'
      m = new THREE.MeshStandardMaterial({
        color,
        roughness: alpha ? 0.1 : metal ? 0.45 : 0.85,
        metalness: metal ? 0.7 : 0,
        transparent: !!alpha,
        opacity: alpha ?? 1,
        depthWrite: !alpha,
      })
      mats.set(key, m)
    }
    return m
  }
  for (const p of spec.parts) {
    let geo: THREE_NS.BufferGeometry
    const s = p.shape
    if (s.kind === 'box') geo = new THREE.BoxGeometry(s.size[0], s.size[1], s.size[2])
    else if (s.kind === 'cylinder') geo = new THREE.CylinderGeometry(s.radius, s.radius, s.height, seg)
    else geo = new THREE.SphereGeometry(s.radius, seg, Math.max(6, seg - 4))
    const mesh = new THREE.Mesh(geo, materialFor(p))
    mesh.name = p.id
    mesh.userData.destructionPart = p.id
    mesh.userData.destructionMaterial = p.material
    mesh.position.set(p.position[0], p.position[1], p.position[2])
    if (p.rotation) mesh.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2], 'XYZ')
    mesh.castShadow = shadows && !TRANSPARENT[p.material]
    mesh.receiveShadow = shadows
    root.add(mesh)
  }
  return root
}
