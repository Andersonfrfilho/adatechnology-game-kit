import type { DestructibleSpec, GroundExcavation, PartShape } from '@adatechnology/game-contracts'

import type { SurfacePiece } from './surface'

/** Id of the one part of a cover's plate in its `DestructibleSpec`: the drawing binds its meshes to it. */
export const COVER_PLATE_PART = 'plate'

/** Metres the pit goes under the bottom of its shaft: the floor the shaft stands on is part of the opening. */
const PIT_FLOOR = 0.1

/**
 * The hole a cover leaves where it was thrown off: the square of the shaft under it, down to the shaft's floor, as the ground dug away
 * (`GroundExcavation`, what `Terrain.open` takes). Undefined for a piece with no pit under it, or one that is no cover (a hydrant, a wing wall).
 */
export function openingOf(piece: SurfacePiece): GroundExcavation | undefined {
  if (piece.shaft === undefined || piece.solid) return undefined
  const half = piece.shaft.width / 2
  return { rect: [piece.at[0] - half, piece.at[2] - half, piece.at[0] + half, piece.at[2] + half], depth: piece.at[1] - piece.shaft.bottom + PIT_FLOOR }
}

/** A cover as a loose piece: a plate of its material (cast iron) in the shape of its frame, as the destruction world takes it, and where it stood. */
export type CoverBody = {
  readonly id: string
  readonly spec: DestructibleSpec
  readonly position: readonly [number, number, number]
  /** Turn about y, radians. */
  readonly ry: number
  /** Kilograms the plate weighs: density times volume (`game-destruction` gives the same when the part has no mass). */
  readonly mass: number
}

/** Kilograms per cubic metre of each material of a cover (the `game-destruction` table). */
const DENSITY: Readonly<Record<SurfacePiece['material'], number>> = { cast_iron: 7200, concrete: 2400, plastic: 950, steel: 7850 }

export function coverBodyOf(piece: SurfacePiece): CoverBody | undefined {
  if (piece.shaft === undefined || piece.solid) return undefined
  const [width, height, depth] = piece.size
  const isRound = piece.shape === 'round'
  const shape: PartShape = isRound ? { kind: 'cylinder', radius: width / 2, height } : { kind: 'box', size: [width, height, depth] }
  const volume = isRound ? Math.PI * (width / 2) ** 2 * height : width * height * depth
  return {
    id: `cover:${piece.id}`,
    spec: { name: piece.kind, tags: ['network_cover'], parts: [{ id: COVER_PLATE_PART, material: piece.material, shape, position: [0, height / 2, 0] }] },
    position: piece.at,
    ry: piece.ry,
    mass: volume * DENSITY[piece.material],
  }
}

/** Metres per second a cover is thrown outward from the middle of the bowl at least, and how much each metre of the bowl's depth adds; upward the same, twice. */
const THROW_BASE = 1.5
const THROW_PER_DEPTH = 1.2
const THROW_UP = 2

/**
 * The velocity a crater throws a cover off with: away from the middle of the bowl (along +x for a cover right at it), faster the deeper the bowl, and up. Pure: the same bowl
 * throws the same cover the same way, so a LAN client that repeats the blow sees the same lid land in the same place.
 */
export function coverThrowOf(piece: SurfacePiece, crater: { readonly x: number; readonly z: number; readonly depth: number }): readonly [number, number, number] {
  const [dx, dz] = [piece.at[0] - crater.x, piece.at[2] - crater.z]
  const length = Math.hypot(dx, dz)
  const [ux, uz] = length < 1e-6 ? [1, 0] : [dx / length, dz / length]
  const out = THROW_BASE + THROW_PER_DEPTH * crater.depth
  return [ux * out, THROW_UP * out, uz * out]
}
