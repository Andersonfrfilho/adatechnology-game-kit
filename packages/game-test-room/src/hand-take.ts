import type { CarryHands, DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { Piece } from '@adatechnology/game-destruction-three'

/** What the room does with a part taken by hand once the renderer made it a piece: it closes the hand on it. */
export type TakenGrab = (objectId: string, piece: Piece, point: Vec3, hands: CarryHands) => boolean

/** Takes parts off objects by hand (a book off a bookcase) and hands the piece each one becomes to the room's grab. */
export interface HandTake {
  /** Opens the joints that hold `partId` (`DestructionWorld.take`); the piece comes on a later frame (`arrived`). Returns the hands it takes, or null. */
  take(objectId: string, partId: string | undefined, point: Vec3): CarryHands | null
  /** A new piece of the renderer: when it is the part being taken, the hand closes on it. Returns whether it did. */
  arrived(piece: Piece): boolean
}

interface PendingTake {
  readonly partId: string
  readonly point: Vec3
  readonly hands: CarryHands
}

/**
 * The renderer splits a loose group off its object when it applies the `detach` events, after the operation that opened the joints, so the part taken is
 * held when its piece is made, not at once.
 */
export function createHandTake(world: DestructionWorld, grab: TakenGrab): HandTake {
  let pending: PendingTake | null = null
  return {
    take(objectId, partId, point) {
      if (partId === undefined) return null
      const hands = world.take(objectId, partId)
      pending = hands === null ? pending : { partId, point, hands }
      return hands
    },
    arrived(piece) {
      if (!pending) return false
      const parts = world.state(piece.objectId)?.parts ?? []
      if (parts.length !== 1 || parts[0]?.id !== pending.partId) return false
      const { point, hands } = pending
      pending = null
      return grab(piece.objectId, piece, point, hands)
    },
  }
}
