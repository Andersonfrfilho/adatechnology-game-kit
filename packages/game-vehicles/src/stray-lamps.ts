/**
 * The lamps a body draws outside the kit's lamp units: the round fog lamps a body lists in `c.fogBulbs` (or tags `userData.lamp = 'fog'`) and the
 * lit strips and lamps set into a bumper (a daytime running lamp, a fog lamp drawn as a lit panel). None is in `c.lights`, so no damage zone
 * holds them and a round that hits one used to leave it glowing. Each becomes a lamp of its own: the destructible model makes it a light part,
 * the shots break it and put it out, and the lamp switch of `game-vehicles-three` reads it. `c.lights` and the zones stay as the fleet drew them.
 */
import type { Box3, Material, Mesh, Object3D, Vector3 } from './three-types'

import type { VehicleLamp } from './api'
import type { BuildContext } from './types'

/** A lamp found outside the kit's lamp units. `fog`: switched by the fog lamp switch; `aux`: lit as drawn (a running lamp), only put out by damage. */
export type StrayLamp = VehicleLamp & { fog?: boolean; aux?: boolean; side: 'left' | 'right' | 'center' }

/** How far, along the length, from the front or the rear end a glowing piece counts as a lamp of that end (the cabin's gauges and screens are further in). */
const END_DEPTH = 0.45
/** A piece glows like a lamp when its brightest emissive channel and its intensity reach these (an engine block's faint self-light does not). */
const LAMP_EMISSIVE_MIN = 0.25
const LAMP_INTENSITY_MIN = 0.2
/** Margin around a lamp unit inside which a glowing piece belongs to that unit (the destructible layer darkens it with the unit). */
const UNIT_MARGIN = 0.03
/** Glowing pieces this close to each other are one lamp. */
const CLUSTER_GAP = 0.04
/** A lamp this close to the vehicle's axis is a centre lamp. */
const CENTRE_Z = 0.08

type Geometry = { Box3: new () => Box3; Vector3: new () => Vector3 }

function glowsLikeLamp(material: Material | Material[] | null | undefined): boolean {
  if (!material || Array.isArray(material)) return false
  const { emissive, emissiveIntensity } = material as Material & { emissive?: { r: number; g: number; b: number }; emissiveIntensity?: number }
  if (!emissive || !((emissiveIntensity ?? 0) >= LAMP_INTENSITY_MIN)) return false
  return Math.max(emissive.r, emissive.g, emissive.b) >= LAMP_EMISSIVE_MIN
}

function membersOf(lights: VehicleLamp[]): Set<Object3D> {
  const members = new Set<Object3D>()
  for (const L of lights) {
    L.group?.traverse((o: Object3D) => members.add(o))
    for (const m of [...L.lens, ...L.inner, ...(L.halo ?? [])]) members.add(m)
  }
  return members
}

function sideOf(box: Box3): StrayLamp['side'] {
  const z = (box.min.z + box.max.z) / 2
  return Math.abs(z) < CENTRE_Z ? 'center' : z < 0 ? 'left' : 'right'
}

function lampOf(inner: Mesh[], box: Box3, front: boolean, flags: { fog?: boolean; aux?: boolean }): StrayLamp {
  return { group: null, lens: [], inner, kind: front ? 'headlight' : 'taillight', tint: front ? 'clear' : 'red', broken: false, side: sideOf(box), ...flags }
}

/**
 * The stray lamps of a built vehicle, found on the first call and kept on `c.strayLamps`. Read on demand (the destructible model, the lamp switch), never
 * while building: finding them updates the world matrices and the bounding boxes of the drawing, which the build leaves as the fleet drew them.
 */
export function strayLampsOf(c: BuildContext, THREE: Geometry): StrayLamp[] {
  c.strayLamps ??= findStrayLamps(c, THREE)
  return c.strayLamps
}

function findStrayLamps(c: BuildContext, THREE: Geometry): StrayLamp[] {
  const Box = THREE.Box3
  const vehicle = c.vehicle as Object3D
  vehicle.updateMatrixWorld(true)
  const inverse = vehicle.matrixWorld.clone().invert()
  const localBox = (o: Object3D): Box3 => new Box().setFromObject(o).applyMatrix4(inverse)
  const lights: VehicleLamp[] = c.lights ?? []
  const members = membersOf(lights)
  const units = lights.map((L) => {
    const bb = new Box()
    for (const o of L.group ? [L.group] : [...L.lens, ...L.inner]) bb.union(localBox(o))
    return bb.expandByScalar(UNIT_MARGIN)
  })
  const front = c.meta?.front ?? new Box().setFromObject(vehicle).applyMatrix4(inverse).max.x
  const rear = c.meta?.rear ?? new Box().setFromObject(vehicle).applyMatrix4(inverse).min.x
  const found: StrayLamp[] = []

  // the round fog lamps: one lamp per bulb, so each goes out on its own
  const bulbs: Mesh[] = [...((c.fogBulbs as Mesh[] | undefined) ?? [])]
  vehicle.traverse((o: Object3D) => {
    if (o.userData.lamp === 'fog' && (o as Mesh).isMesh && !bulbs.includes(o as Mesh)) bulbs.push(o as Mesh)
  })
  for (const bulb of bulbs) {
    if (members.has(bulb)) continue
    members.add(bulb)
    const bb = localBox(bulb)
    found.push(lampOf([bulb], bb, bb.max.x > (front + rear) / 2, { fog: true }))
  }

  // the lit pieces at either end that no lamp unit holds
  const loose: Array<{ mesh: Mesh; box: Box3; front: boolean }> = []
  vehicle.traverse((o: Object3D) => {
    const mesh = o as Mesh
    if (!mesh.isMesh || members.has(mesh) || mesh.userData.glass || mesh.userData.decal || mesh.userData.lamp === 'beacon') return
    if (!glowsLikeLamp(mesh.material as Material)) return
    const bb = localBox(mesh)
    const mid = bb.getCenter(new THREE.Vector3())
    const atFront = mid.x > front - END_DEPTH
    if (!atFront && mid.x > rear + END_DEPTH) return
    if (units.some((u) => u.containsPoint(mid))) return
    loose.push({ mesh, box: bb, front: atFront })
  })
  const groups: Array<{ meshes: Mesh[]; box: Box3; front: boolean }> = []
  for (const piece of loose) {
    const near = groups.find((g) => g.front === piece.front && g.box.clone().expandByScalar(CLUSTER_GAP).intersectsBox(piece.box))
    if (near) {
      near.meshes.push(piece.mesh)
      near.box.union(piece.box)
    } else groups.push({ meshes: [piece.mesh], box: piece.box.clone(), front: piece.front })
  }
  for (const g of groups) found.push(lampOf(g.meshes, g.box, g.front, { aux: true }))
  return found
}
