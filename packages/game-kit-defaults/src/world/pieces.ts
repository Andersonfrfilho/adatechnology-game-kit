import type { Piece } from '@adatechnology/game-destruction-three'

/** The loose pieces of the world, kept by the renderer's `piece` and `released` events. */
export type KitWorldPieces = {
  /** The live list: the pieces split off, in the order they came. */
  readonly all: readonly Piece[]
  add(piece: Piece): void
  /** Forgets the pieces that left the world (what `release` took out). */
  forget(pieceIds: readonly string[]): void
  /** Forgets every piece (the host is clearing or resetting its world; taking them out of the scene is the caller's). */
  clear(): void
}

export function createPieces(): KitWorldPieces {
  const loose: Piece[] = []
  return {
    all: loose,
    add: (piece) => void loose.push(piece),
    forget(pieceIds) {
      const gone = new Set(pieceIds)
      let kept = 0
      for (const piece of loose) if (!gone.has(piece.objectId)) loose[kept++] = piece
      loose.length = kept
    },
    clear: () => void (loose.length = 0),
  }
}
