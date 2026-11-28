/**
 * One solid a mesh was built from (spec 019): its own box in the mesh's space, turned as it was drawn (`rotation`: x, y, z, w). The builder of the mesh lists them in
 * `userData.solids` (`ShapeSolid` of game-shapes, by the mesh api of game-interactables-three): the piece is then held by what was drawn, with no vertex read back.
 */
export interface BuiltSolid {
  readonly center: readonly [number, number, number]
  readonly half: readonly [number, number, number]
  readonly rotation: readonly [number, number, number, number]
  /** What drew it (`'box'`, `'cylinder'`...): a cylinder is held as a cylinder along its own y. */
  readonly kind?: string
}

const numbers = (value: unknown, count: number): value is readonly number[] => Array.isArray(value) && value.length === count && value.every((v) => typeof v === 'number' && Number.isFinite(v))

const isBuiltSolid = (value: unknown): value is BuiltSolid => {
  if (typeof value !== 'object' || value === null) return false
  const solid = value as { center?: unknown; half?: unknown; rotation?: unknown; kind?: unknown }
  return numbers(solid.center, 3) && numbers(solid.half, 3) && numbers(solid.rotation, 4) && (solid.kind === undefined || typeof solid.kind === 'string')
}

/**
 * The solids a mesh says it was built from, or null when it says none (a house, a vehicle, a mesh made by hand: those are measured from what is drawn). The list comes
 * from another package through `userData`, so it is read as data: one entry that is not a solid and the whole list is not used.
 */
export const builtSolidsOf = (mesh: { readonly userData: Record<string, unknown> }): readonly BuiltSolid[] | null => {
  const list = mesh.userData.solids
  if (!Array.isArray(list) || list.length === 0 || !list.every(isBuiltSolid)) return null
  return list
}

/** How far apart (a share of the larger) the two halves across a cylinder may be for it to be held as a round cylinder (an oval or a cone stays a box). */
const ROUND_SIDES = 0.05

/** Whether a solid is a straight round cylinder along its own y: drawn as one, with the two halves across it alike. */
export const isRoundSolid = (solid: { readonly half: readonly number[]; readonly kind?: string }): boolean =>
  solid.kind === 'cylinder' && Math.abs(solid.half[0]! - solid.half[2]!) <= ROUND_SIDES * Math.max(solid.half[0]!, solid.half[2]!)
