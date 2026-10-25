import type * as THREE_NS from 'three'
import { buildItem } from '@adatechnology/game-items-three'
import type { DrawableItem } from '@adatechnology/game-items-three'
import type { DestructibleSpec, PartShape, PartSpec, TestableItem, Vec3 } from '@adatechnology/game-contracts'
import type { ExplosiveDef } from '@adatechnology/game-weapons'

/** Prefix of the item ids of the explosives that sit in the world (`world_fuel_barrel`). */
export const WORLD_EXPLOSIVE_PREFIX = 'world_'

interface WorldShape {
  readonly shape: PartShape
  readonly position: Vec3
  readonly color: number
  /** The team's model of the thing (an item of `game-items-three`): when set it is drawn instead of the plain `shape`, which stays what the destruction world hits. */
  readonly model?: DrawableItem
  /** Wall thickness in metres when it is not the thin sheet of the others (a P13 shell is 2.5 mm of steel). */
  readonly wall?: number
}

/** Name of the mesh of the brass valve on the P13 model (the team's `botijao`: the 0xb8913a cylinder on the neck). */
export const P13_VALVE_MESH = 'valve'
const P13_VALVE_COLOR = 0xb8913a
/** The shell of a P13 is 2.5 mm of steel (a 13 kg cylinder weighs about 15 kg empty). */
const P13_WALL = 0.0025

// The game's drum (jogo.js addExplo 68141: radius 0.3, height 0.9); the car tank is a real measure. The P13 is the team's real model, at the size of the item `lpg_cylinder_13kg` of the goods catalogue (0.353 x 0.49 x 0.358 m, 29 kg).
const SHAPES: Readonly<Record<string, WorldShape>> = {
  fuel_barrel: { shape: { kind: 'cylinder', radius: 0.3, height: 0.9 }, position: [0, 0.45, 0], color: 0x2f5f9a },
  propane_p13: {
    shape: { kind: 'cylinder', radius: 0.176, height: 0.49 },
    position: [0, 0.245, 0],
    color: 0x355f86,
    model: { id: 'lpg_cylinder_13kg', category: 'fuel', size: [0.35299, 0.49, 0.35844], model: 'lpg_cylinder_13kg' },
    wall: P13_WALL,
  },
  car_fuel_tank: { shape: { kind: 'box', size: [0.9, 0.25, 0.5] }, position: [0, 0.4, 0], color: 0x4b4f55 },
}

/** The ids of the explosives of the arsenal that the area puts in the world. */
export const WORLD_EXPLOSIVE_IDS: readonly string[] = Object.keys(SHAPES)

// A hollow steel shell: thin and light, so a bullet or a blast breaks it (the weight of a solid steel part would hold it together).
const SHELL = { thickness: 0.001, fill: 0.03 }

/** What the bench (or a game) changes about a world explosive without touching the arsenal: the multiplier of its energy and reach, read each time one is spawned. */
export interface WorldExplosiveOptions {
  /** Multiplies `energy`, `lethalRadius` and `injuryRadius` of the explosive (default 1: the arsenal's numbers). It is a game value, not a physical table; the arsenal's own place for it is `ArsenalOptions.patch.explosives`. */
  readonly scale?: () => number
}

/** The part of a world explosive: the energy, the reach, the chain and the effect (the explosive's id in the host's catalogue) of the explosive def, which is what `explosivePart` of game-destruction builds. */
const explosivePart = (def: ExplosiveDef, shape: WorldShape, scale: number): PartSpec => ({
  id: 'tank',
  material: 'steel',
  shape: shape.shape,
  position: shape.position,
  ...(shape.wall === undefined ? SHELL : { thickness: shape.wall }),
  // a real mass (the vessel and what it holds) replaces the hollow-sheet density
  ...(def.mass !== undefined && shape.wall !== undefined ? { mass: def.mass } : {}),
  ...(def.leak ? { contains: { fluid: def.leak.fluid, liters: def.leak.liters, pressurized: def.leak.pressurized } } : {}),
  explodes: { energy: def.energy * scale, radius: def.injuryRadius * scale, effect: def.id, ...(def.chain ? { chain: { ...def.chain } } : {}) },
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

/** The team's model of a world explosive (a group, base at the origin), every mesh mapped to the part `tank`; the brass valve is named `valve`. Undefined for the ones that have no model of the team. */
const modelOf = (THREE: typeof THREE_NS, shape: WorldShape, wear: 0 | 2 = 0): THREE_NS.Group | undefined => {
  if (!shape.model) return undefined
  const { root, kind } = buildItem(THREE, shape.model, { wear })
  if (kind !== 'model') return undefined
  root.traverse((node) => {
    const mesh = node as THREE_NS.Mesh
    if (!mesh.isMesh) return
    mesh.userData.destructionPart = 'tank'
    mesh.castShadow = true
    mesh.receiveShadow = true
    const material = mesh.material as THREE_NS.MeshStandardMaterial
    if (material.color?.getHex() === P13_VALVE_COLOR) mesh.name = P13_VALVE_MESH
  })
  return root
}

/** Where the valve is on a spawned cylinder, in the world (the centre of the brass mesh), or undefined when the object has none. */
export const worldExplosiveValve = (THREE: typeof THREE_NS, root: THREE_NS.Object3D): Vec3 | undefined => {
  const valve = root.getObjectByName(P13_VALVE_MESH)
  if (!valve) return undefined
  root.updateMatrixWorld(true)
  const centre = new THREE.Box3().setFromObject(valve).getCenter(new THREE.Vector3())
  return [centre.x, centre.y, centre.z]
}

/**
 * What is left of a world explosive after the blast, as an object to fly: the same model, worn and darkened (the torn shell of the P13 in the Laboratório de Explosões, `SC.p13`),
 * with no part mapped. Undefined for the explosives that have no model of the team.
 */
export const worldExplosiveShell = (THREE: typeof THREE_NS, defId: string): THREE_NS.Group | undefined => {
  const shape = SHAPES[defId]
  const model = shape ? modelOf(THREE, shape, 2) : undefined
  if (!model) return undefined
  model.traverse((node) => {
    const mesh = node as THREE_NS.Mesh
    if (!mesh.isMesh) return
    delete mesh.userData.destructionPart
    ;(mesh.material as THREE_NS.MeshStandardMaterial).color.multiplyScalar(0.35)
  })
  model.name = `${WORLD_EXPLOSIVE_PREFIX}${defId}_shell`
  return model
}

/** An explosive of the arsenal standing in the world: it goes off by a bullet, fire or another blast, after the delay its `chain` gives. */
export const worldExplosiveItem = (def: ExplosiveDef, name: string, options: WorldExplosiveOptions = {}): TestableItem | undefined => {
  const shape = SHAPES[def.id]
  if (!shape) return undefined
  const scale = (): number => options.scale?.() ?? 1
  const spec = (): DestructibleSpec => ({ name, parts: [explosivePart(def, shape, scale())], joints: [], tags: ['explosive'] })
  return {
    id: `${WORLD_EXPLOSIVE_PREFIX}${def.id}`,
    name,
    build: (THREE: unknown) => {
      const T = THREE as typeof THREE_NS
      const model = modelOf(T, shape)
      if (model) return model
      const group = new T.Group()
      group.add(meshOf(T, shape))
      return group
    },
    spec,
  }
}
