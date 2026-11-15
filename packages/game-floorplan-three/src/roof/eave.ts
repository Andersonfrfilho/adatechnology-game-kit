/**
 * The eave as it is built: the rafters run past the wall and are cut plumb at the edge, the fascia board (testeira) nailed to their ends from the soffit up to
 * the tiles, and the soffit (forro do beiral) closing the underside right under the rafters' tails. Metres under the eave line of the roof (its `yb`).
 */
export const EAVE = {
  /** Top of the soffit: under the rafters' tails at the edge (6.5 cm under the tiles, 6 cm deep, a third of a slope's rise over the overhang's first cm). */
  soffitTop: 0.105,
  /** The soffit's boards. */
  soffitThickness: 0.012,
  /** Bottom of the fascia board: it reaches the soffit and closes it. */
  fasciaBottom: 0.13,
} as const
