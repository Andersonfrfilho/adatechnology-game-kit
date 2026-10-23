import type * as THREE_NS from 'three'
import type { DestructibleSpec, JointSpec, PartSpec, Vec3 } from '@adatechnology/game-contracts'
import type { WeaponDef } from '@adatechnology/game-weapons'

/** A low-poly prop: its destruction spec (box parts only) and one colour per part. */
export interface WeaponProp {
  spec: DestructibleSpec
  colors: Record<string, number>
}

type Extra = Partial<Omit<PartSpec, 'id' | 'material' | 'shape' | 'position'>>
const box = (id: string, material: string, size: Vec3, position: Vec3, extra: Extra = {}): PartSpec => ({ id, material, shape: { kind: 'box', size }, position, ...extra })
const joint = (a: string, b: string, kind: JointSpec['kind']): JointSpec => ({ a, b, kind })

// A grip and a body lying flat end to end, long axis along +x, the muzzle or head at +x. One thickness for both parts so the prop lies flat,
// and the parts touch without overlapping: overlapping parts are pushed apart by the physics and the prop slides away.
const handled = (name: string, handle: [string, Vec3], head: [string, Vec3]): WeaponProp => {
  const [handleMaterial, rawHandle] = handle
  const [headMaterial, rawHead] = head
  const thickness = Math.max(rawHandle[1], rawHead[1])
  const handleSize: Vec3 = [rawHandle[0], thickness, rawHandle[2]]
  const headSize: Vec3 = [rawHead[0], thickness, rawHead[2]]
  const shift = (handleSize[0] - headSize[0]) / 2
  return {
    spec: {
      name,
      parts: [box('handle', handleMaterial, handleSize, [-handleSize[0] / 2 + shift, thickness / 2, 0]), box('head', headMaterial, headSize, [headSize[0] / 2 + shift, thickness / 2, 0])],
      joints: [joint('handle', 'head', 'screw')],
      tags: ['weapon'],
    },
    colors: { handle: handleMaterial === 'steel' ? 0x3a3d42 : handleMaterial === 'plastic' ? 0x2b2d30 : 0x7a5530, head: headMaterial === 'steel' ? 0x8f969e : headMaterial === 'copper' ? 0xb87333 : 0x6b4a2a },
  }
}
const solid = (name: string, material: string, size: Vec3, color: number): WeaponProp => ({
  spec: { name, parts: [box('body', material, size, [0, size[1] / 2, 0])], joints: [], tags: ['weapon'] },
  colors: { body: color },
})

const SHAPES: Record<string, (name: string, id: string) => WeaponProp> = {
  pistol: (n) => handled(n, ['plastic', [0.06, 0.03, 0.11]], ['steel', [0.2, 0.03, 0.04]]),
  revolver: (n) => handled(n, ['wood_soft', [0.06, 0.035, 0.11]], ['steel', [0.24, 0.04, 0.05]]),
  smg: (n) => handled(n, ['plastic', [0.2, 0.05, 0.14]], ['steel', [0.45, 0.05, 0.06]]),
  carbine: (n) => handled(n, ['wood_soft', [0.35, 0.05, 0.12]], ['steel', [0.6, 0.04, 0.05]]),
  rifle: (n) => handled(n, ['wood_soft', [0.35, 0.06, 0.13]], ['steel', [0.75, 0.05, 0.07]]),
  sniper: (n) => handled(n, ['plastic', [0.4, 0.06, 0.14]], ['steel', [0.95, 0.06, 0.08]]),
  shotgun: (n) => handled(n, ['wood_soft', [0.38, 0.06, 0.13]], ['steel', [0.7, 0.05, 0.06]]),
  bow: (n) => solid(n, 'wood_soft', [0.95, 0.03, 0.22], 0x5a3d22),
  crossbow: (n) => handled(n, ['wood_soft', [0.6, 0.06, 0.08]], ['steel', [0.12, 0.04, 0.26]]),
  melee_blunt: (n, id) =>
    id === 'baseball_bat'
      ? solid(n, 'wood_soft', [0.84, 0.06, 0.06], 0xb08550)
      : handled(n, ['wood_soft', [id === 'sledgehammer' ? 0.8 : 0.32, 0.03, 0.03]], ['steel', id === 'sledgehammer' ? [0.08, 0.08, 0.2] : [0.06, 0.04, 0.12]]),
  melee_blade: (n, id) => handled(n, ['wood_soft', [0.13, 0.03, 0.03]], ['steel', id === 'axe' ? [0.5, 0.03, 0.16] : id === 'knife' ? [0.16, 0.01, 0.03] : [0.45, 0.01, 0.05]]),
  tool: (n) => handled(n, ['plastic', [0.12, 0.025, 0.03]], ['steel', [0.16, 0.02, 0.03]]),
  flame: (n, id) => (id === 'flamethrower' ? handled(n, ['steel', [0.3, 0.14, 0.14]], ['steel', [0.6, 0.05, 0.05]]) : solid(n, 'plastic', [0.08, 0.02, 0.04], 0xd9482b)),
  heat: (n) => handled(n, ['steel', [0.2, 0.08, 0.08]], ['copper', [0.25, 0.03, 0.03]]),
  throwable: (n, id) => (id === 'molotov' ? solid(n, 'glass', [0.25, 0.07, 0.07], 0x7fd6b0) : solid(n, 'steel', [id === 'pipe_bomb' ? 0.25 : 0.1, 0.06, 0.06], 0x4c5a3a)),
  extinguisher: (n) => solid(n, 'steel', [0.5, 0.15, 0.15], 0xc0392b),
}

/** Body actions of the arsenal: nothing to hold or lay on a counter. */
export const BODY_ACTIONS: ReadonlySet<string> = new Set(['hand', 'kick', 'shove', 'fists'])

// Real weights from the arsenal data: solid steel boxes would weigh several times more, go past a carry limit and stop being props.
const withMass = (prop: WeaponProp, kg: number): WeaponProp => {
  const volumes = prop.spec.parts.map((part) => (part.shape.kind === 'box' ? part.shape.size[0] * part.shape.size[1] * part.shape.size[2] : 0))
  const total = volumes.reduce((sum, volume) => sum + volume, 0) || 1
  return { ...prop, spec: { ...prop.spec, parts: prop.spec.parts.map((part, index) => ({ ...part, mass: (kg * volumes[index]) / total })) } }
}

/** The prop of a weapon: low-poly parts by category, the real mass of the weapon spread over them. */
export function weaponProp(def: Pick<WeaponDef, 'id' | 'category' | 'mass'>, name = def.id): WeaponProp {
  const shape = SHAPES[def.category] ?? SHAPES.tool
  return withMass(shape(name, def.id), def.mass)
}

/** One mesh per box part, named after the part (what destruction renderers bind to), in a group with its origin on the floor. */
export function buildProp(THREE: typeof THREE_NS, prop: WeaponProp): THREE_NS.Group {
  const group = new THREE.Group()
  group.name = prop.spec.name ?? 'weapon'
  for (const part of prop.spec.parts) {
    if (part.shape.kind !== 'box') continue
    const [w, h, d] = part.shape.size
    const material = new THREE.MeshStandardMaterial({ color: prop.colors[part.id] ?? 0x777777, roughness: 0.6, metalness: part.material === 'steel' ? 0.6 : 0.05 })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
    mesh.name = part.id
    mesh.position.set(part.position[0], part.position[1], part.position[2])
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  }
  return group
}

/** The model of a weapon for the hands or a shelf: the same prop the counters show. */
export function buildWeaponModel(THREE: typeof THREE_NS, def: Pick<WeaponDef, 'id' | 'category' | 'mass'>): THREE_NS.Group {
  return buildProp(THREE, weaponProp(def))
}
