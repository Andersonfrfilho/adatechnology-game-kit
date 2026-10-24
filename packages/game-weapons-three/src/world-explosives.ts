import type * as THREE_NS from 'three'
import type { DestructibleSpec, PartShape, PartSpec, TestableItem, Vec3 } from '@adatechnology/game-contracts'
import type { ExplosiveDef } from '@adatechnology/game-weapons'

/** Prefix of the item ids of the explosives that sit in the world (`world_fuel_barrel`). */
export const WORLD_EXPLOSIVE_PREFIX = 'world_'

interface WorldShape {
  readonly shape: PartShape
  readonly position: Vec3
  readonly color: number
}

// The game's drum (jogo.js addExplo 68141: radius 0.3, height 0.9); the P13 cylinder and the car tank are real measures.
const SHAPES: Readonly<Record<string, WorldShape>> = {
  fuel_barrel: { shape: { kind: 'cylinder', radius: 0.3, height: 0.9 }, position: [0, 0.45, 0], color: 0x2f5f9a },
  propane_p13: { shape: { kind: 'cylinder', radius: 0.15, height: 0.48 }, position: [0, 0.24, 0], color: 0xcfd3d8 },
  car_fuel_tank: { shape: { kind: 'box', size: [0.9, 0.25, 0.5] }, position: [0, 0.4, 0], color: 0x4b4f55 },
}

/** The ids of the explosives of the arsenal that the area puts in the world. */
export const WORLD_EXPLOSIVE_IDS: readonly string[] = Object.keys(SHAPES)

// A hollow steel shell: thin and light, so a bullet or a blast breaks it (the weight of a solid steel part would hold it together).
const SHELL = { thickness: 0.001, fill: 0.03 }

/** The part of a world explosive: the energy, the reach and the chain of the explosive def, which is what `explosivePart` of game-destruction builds. */
const explosivePart = (def: ExplosiveDef, shape: WorldShape): PartSpec => ({
  id: 'tank',
  material: 'steel',
  shape: shape.shape,
  position: shape.position,
  ...SHELL,
  explodes: { energy: def.energy, radius: def.injuryRadius, ...(def.chain ? { chain: { ...def.chain } } : {}) },
})

const meshOf = (THREE: typeof THREE_NS, shape: WorldShape): THREE_NS.Mesh => {
  const geometry = shape.shape.kind === 'cylinder' ? new THREE.CylinderGeometry(shape.shape.radius, shape.shape.radius, shape.shape.height, 16) : shape.shape.kind === 'box' ? new THREE.BoxGeometry(...shape.shape.size) : new THREE.SphereGeometry(0.2)
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: shape.color, roughness: 0.55, metalness: 0.5 }))
  mesh.name = 'tank'
  mesh.userData.destructionPart = 'tank'
  mesh.position.set(...shape.position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** An explosive of the arsenal standing in the world: it goes off by a bullet, fire or another blast, after the delay its `chain` gives. */
export const worldExplosiveItem = (def: ExplosiveDef, name: string): TestableItem | undefined => {
  const shape = SHAPES[def.id]
  if (!shape) return undefined
  const spec: DestructibleSpec = { name, parts: [explosivePart(def, shape)], joints: [], tags: ['explosive'] }
  return {
    id: `${WORLD_EXPLOSIVE_PREFIX}${def.id}`,
    name,
    build: (THREE: unknown) => {
      const group = new (THREE as typeof THREE_NS).Group()
      group.add(meshOf(THREE as typeof THREE_NS, shape))
      return group
    },
    spec,
  }
}
