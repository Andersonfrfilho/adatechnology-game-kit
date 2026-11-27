import type { HostSolid } from '@adatechnology/game-contracts'
import type { Three } from '../kernel-types.js'
import type { House, HouseFurnitureCollider } from '../types.js'

/** Height of what stands on the lot (a wall of the lot, a gate), m: the colliders carry no height. */
const LOT_HEIGHT = 2
/** Height of the top storey, m (walls are 3 m by default). */
const TOP_STOREY_HEIGHT = 3

const isFurniture = (collider: House['colliders'][number]): collider is HouseFurnitureCollider => collider.type === 'furniture'

const storeyOf = (house: House, floor: number): { readonly base: number; readonly height: number } => {
  if (floor < 0) return { base: house.y0(0), height: LOT_HEIGHT }
  const base = house.y0(floor)
  const next = house.y0(floor + 1)
  return { base, height: Number.isFinite(next) && next > base ? next - base : TOP_STOREY_HEIGHT }
}

/**
 * The colliders the walking player is stopped at in a house, as fixed boxes in the world: its walls, closed doors, lot walls and gates (boxes in the house's plane) and its furniture
 * (turned boxes), each on its own floor. An open door has no box, as it has no collider; the walls and gates of the lot only when the lot is drawn (`withLot`): nothing invisible collides.
 */
export function houseSolids(THREE: Three, house: House, withLot: boolean): readonly HostSolid[] {
  house.group.updateWorldMatrix(true, false)
  const matrix = house.group.matrixWorld.elements
  const known = made.get(house)
  if (known && known.withLot === withLot && known.matrix.every((v, k) => v === matrix[k]) && known.offs.length === house.colliders.length && house.colliders.every((c, k) => c.off === known.offs[k])) return known.list
  const list = measure(THREE, house, withLot)
  made.set(house, { withLot, matrix: [...matrix], offs: house.colliders.map((c) => c.off), list })
  return list
}

/** The boxes last made of a house, with what they were made at: asked every step, they are measured again only when the house moved or a door opened or closed. */
const made = new WeakMap<House, { readonly withLot: boolean; readonly matrix: readonly number[]; readonly offs: ReadonlyArray<boolean | undefined>; readonly list: readonly HostSolid[] }>()

function measure(THREE: Three, house: House, withLot: boolean): HostSolid[] {
  const turn = house.group.getWorldQuaternion(new THREE.Quaternion())
  const at = new THREE.Vector3()
  const out: HostSolid[] = []
  house.colliders.forEach((collider, index) => {
    if (collider.off || (collider.f < 0 && !withLot)) return
    const { base, height } = storeyOf(house, collider.f)
    if (isFurniture(collider)) {
      const { cx, cz, hw, hd, s, c } = collider.obb
      const high = Math.min(collider.h ?? height, height)
      const q = turn.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(s, c)))
      house.group.localToWorld(at.set(cx, base + high / 2, cz))
      out.push({ center: [at.x, at.y, at.z], half: [hw, high / 2, hd], rotation: [q.x, q.y, q.z, q.w], key: `furniture:${index}` })
      return
    }
    const box = collider as { readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number }
    house.group.localToWorld(at.set((box.x0 + box.x1) / 2, base + height / 2, (box.z0 + box.z1) / 2))
    out.push({ center: [at.x, at.y, at.z], half: [(box.x1 - box.x0) / 2, height / 2, (box.z1 - box.z0) / 2], rotation: [turn.x, turn.y, turn.z, turn.w], key: `${collider.type}:${index}` })
  })
  return out
}
