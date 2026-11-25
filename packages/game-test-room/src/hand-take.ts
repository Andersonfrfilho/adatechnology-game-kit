import type { HostTakenItem } from '@adatechnology/game-contracts'
import type { CarryHands, DestructibleSpec, DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import type { Piece } from '@adatechnology/game-destruction-three'
import type * as THREE_NS from 'three'

import type { TestRoomItem } from './types'

/** What the room does with a part taken by hand once the renderer made it a piece: it closes the hand on it. */
export type TakenGrab = (objectId: string, piece: Piece, point: Vec3, hands: CarryHands) => boolean

/** Takes parts off objects by hand (a book off a bookcase) and hands the piece each one becomes to the room's grab. */
export interface HandTake {
  /** Opens the joints that hold `partId` (`DestructionWorld.take`); the piece comes on a later frame (`arrived`). Returns the hands it takes, or null. */
  take(objectId: string, partId: string | undefined, point: Vec3): CarryHands | null
  /** A new piece of the renderer: when it is the part being taken, the hand closes on it. Returns whether it did. */
  arrived(piece: Piece): boolean
  /** Whether `objectId` is the object a part was just taken off by hand (its split is that, not the object coming apart); asking forgets it. */
  wasTakenFrom(objectId: string): boolean
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
  let takenFrom: string | null = null
  return {
    take(objectId, partId, point) {
      if (partId === undefined) return null
      const hands = world.take(objectId, partId)
      pending = hands === null ? pending : { partId, point, hands }
      takenFrom = hands === null ? takenFrom : objectId
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
    wasTakenFrom(objectId) {
      if (takenFrom !== objectId) return false
      takenFrom = null
      return true
    },
  }
}

export interface PartNameParams {
  readonly world: DestructionWorld
  /** The spec of the object the piece came off. */
  readonly spec: DestructibleSpec | undefined
  /** The piece, a loose group split off that object. */
  readonly objectId: string
  /** The room's strings: `part.<tag>` names a part by one of its tags (`part.book`: a book off a bookcase). */
  readonly text: Readonly<Record<string, string>>
}

/** The name of a piece that is one part named by its tag (a book off a shelf is "Book", not "Bookcase (piece)"), or undefined. */
export function partNameOf({ world, spec, objectId, text }: PartNameParams): string | undefined {
  const parts = world.state(objectId)?.parts ?? []
  if (parts.length !== 1) return undefined
  const tags = spec?.parts.find((part) => part.id === parts[0]?.id)?.tags ?? []
  for (const tag of tags) {
    const name = text[`part.${tag}`]
    if (name) return name
  }
  return undefined
}

/** Prefix of the catalogue entry the room keeps for an item a module handed over (`taken_jeans`): apart from the modules' own entries. */
export const TAKEN_ITEM_PREFIX = 'taken_'

/** What the room lends the hand that takes an item a module's object hands over. */
export interface TakenInHandHost {
  /** The room's catalogue by id: an item handed over is added to it once, to be spawned and named like any other. */
  readonly catalog: Map<string, TestRoomItem>
  /** Makes the catalogue item an object of the world at `position`; a movable one is a piece at once. */
  spawn(itemId: string, position: Vec3): { readonly objectId: string }
  /** The piece of a world object, or undefined. */
  pieceOf(objectId: string): Piece | undefined
  /** Closes the hand on the piece with `hands` (the hands and holster rule). */
  grab(objectId: string, piece: Piece, point: Vec3, hands: CarryHands): boolean
}

/** `ModuleHost.takeInHand`: the item handed over becomes an object at the place it was taken from, and the hand closes on it. */
export function createTakenInHand(host: TakenInHandHost): (item: HostTakenItem) => boolean {
  return (item) => {
    const id = `${TAKEN_ITEM_PREFIX}${item.itemId}`
    if (!host.catalog.has(id)) {
      const entry: TestRoomItem = {
        id,
        name: item.name,
        group: 'taken',
        movable: true,
        build: (T) => item.build(T) as THREE_NS.Object3D,
        ...(item.physical ? { physical: { weightKg: item.physical.weightKg, size: [item.physical.size[0], item.physical.size[1], item.physical.size[2]] } } : {}),
      }
      host.catalog.set(id, entry)
    }
    const { objectId } = host.spawn(id, item.position)
    const piece = host.pieceOf(objectId)
    if (!piece) return false
    return host.grab(objectId, piece, item.position, item.hands)
  }
}
