/**
 * The room's seats: puts the player on a seat an item brings (`TestRoomItem.seats`, the shape of a `game-interactables` seat) and back on its feet at the seat's exit.
 * Seated, the keys do not walk and the view stays within reach of the seat's facing; a walk key or a jump gets up, and so does losing the seat (the item is gone).
 */
import type * as THREE_NS from 'three'
import type { ItemSeat, Vec3 } from '@adatechnology/game-contracts'
import type { Player } from './player'

const SIT_EYE = 0.62
const LIE_EYE = 0.18
const STANDING_EYE = 1.7
/** How far (radians) the view turns away from the seat's facing, either side. */
const LOOK_RANGE = 1.6

/** Something the player can sit on: where its object is drawn now and the seats it brings. */
export type SeatHolder = {
  readonly objectId: string
  readonly root: THREE_NS.Object3D
  readonly seats: readonly ItemSeat[]
}

/** The seat the player is on. */
export type RoomSeat = {
  readonly objectId: string
  readonly seatId: string
  readonly pose: ItemSeat['pose']
}

export type SeatingOptions = {
  readonly THREE: typeof THREE_NS
  readonly player: Player
  /** The aimed thing that has seats, or null. */
  pick(): SeatHolder | null
  /** The thing with that object id, or null when it is gone. */
  find(objectId: string): SeatHolder | null
  /** Height of the ground at a point, where the player stands when getting up. */
  groundAt(x: number, z: number): number
  onSit?(seat: RoomSeat): void
  onStand?(seat: RoomSeat): void
}

export type Seating = {
  /** Sits on `objectId` (default: the aimed thing), on `seatId` (default: the seat nearest the player). Null when there is no seat there. */
  sit(objectId?: string, seatId?: string): RoomSeat | null
  /** Gets up at the seat's exit; false when not seated or the exit is blocked. */
  stand(): boolean
  /** Once a frame, before the player moves: a walk key or a jump gets up. */
  update(): void
  /** Lets go of the seat without moving the player (the room is reset). */
  release(): void
  readonly seat: RoomSeat | null
}

export function createSeating(o: SeatingOptions): Seating {
  const { THREE, player } = o
  const v = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  let current: RoomSeat | null = null
  let facing = 0

  const toWorld = (root: THREE_NS.Object3D, local: Vec3): Vec3 => {
    root.updateWorldMatrix(true, false)
    v.set(local[0], local[1], local[2]).applyMatrix4(root.matrixWorld)
    return [v.x, v.y, v.z]
  }
  const yawOf = (root: THREE_NS.Object3D): number => {
    root.getWorldQuaternion(q)
    return e.setFromQuaternion(q, 'YXZ').y
  }
  const nearest = (holder: SeatHolder): ItemSeat | undefined => {
    let best: ItemSeat | undefined
    let bestDistance = Infinity
    for (const seat of holder.seats) {
      const [x, , z] = toWorld(holder.root, seat.pos)
      const distance = Math.hypot(x - player.x, z - player.z)
      if (distance < bestDistance) {
        best = seat
        bestDistance = distance
      }
    }
    return best
  }
  const hold = (): void => {
    player.setSeated(true)
    player.setWalkHeld(true)
    player.setLookLimit({ yaw: facing, range: LOOK_RANGE })
  }
  const release = (): void => {
    player.setSeated(false)
    player.setWalkHeld(false)
    player.setLookLimit(null)
    current = null
  }

  const seating: Seating = {
    sit(objectId, seatId) {
      const holder = objectId ? o.find(objectId) : o.pick()
      if (!holder) return null
      const seat = seatId ? holder.seats.find((s) => s.id === seatId) : nearest(holder)
      if (!seat) return null
      const [x, y, z] = toWorld(holder.root, seat.pos)
      const eye = seat.eye ?? (seat.pose === 'lie' ? LIE_EYE : SIT_EYE)
      // a seat faces the front of its item (+z); the player looks down -z at yaw 0
      facing = yawOf(holder.root) + seat.ry + Math.PI
      player.setPose([x, y + eye, z], facing, 0)
      current = { objectId: holder.objectId, seatId: seat.id, pose: seat.pose }
      hold()
      o.onSit?.(current)
      return current
    },
    stand() {
      if (!current) return false
      const holder = o.find(current.objectId)
      const seat = holder?.seats.find((s) => s.id === current?.seatId)
      if (holder && seat) {
        const [x, , z] = toWorld(holder.root, seat.exit)
        if (!player.canStand(x, z)) return false
        player.setPose([x, o.groundAt(x, z) + STANDING_EYE, z], player.yaw, 0)
      } else player.setPose([player.x, o.groundAt(player.x, player.z) + STANDING_EYE, player.z], player.yaw, 0)
      const left = current
      release()
      o.onStand?.(left)
      return true
    },
    update() {
      if (!current) return
      if (!o.find(current.objectId)) {
        seating.stand()
        return
      }
      const [walkX, walkZ] = player.walkIntent
      if (walkX || walkZ || player.keys.has('Space')) {
        seating.stand()
        return
      }
      // pushing or carrying lets the walk go when it ends: the seat holds it again
      hold()
    },
    release,
    get seat() {
      return current
    },
  }
  return seating
}
