/**
 * The mark a hand-held blow leaves in a vehicle's skin, from the blow itself (energy, contact radius, whether it cuts, the length of a club's contact line) and
 * the panel's material: no table per weapon. A punch leaves a small shallow dent, a kick a wider one, a bat or a pipe swung level a long crease along its barrel,
 * a hard blow cracks the paint over the dent; a blade scratches the paint along its swing, a stronger one cuts to the bare metal, a heavy one opens a gash.
 */

export type StrikeMarkKind = 'dent' | 'crease' | 'scratch' | 'cut' | 'gash'

export interface StrikeInput {
  /** `blunt` or `slash` (`Hit.type`). */
  readonly type: 'blunt' | 'slash'
  /** Energy of the blow, joules. */
  readonly energy: number
  /** Contact radius of the striking face, metres (`Hit.radius`). */
  readonly radius: number
  /** Length of a club's contact line (a bat's barrel), metres; absent: a round face (a fist, a boot, a hammer's head). */
  readonly contactLength?: number
  /** The panel's material. */
  readonly material: string
}

export interface StrikeMarkShape {
  readonly kind: StrikeMarkKind
  /** Along the swing (a scratch, a crease), metres. */
  readonly length: number
  /** Across it, metres (a dent's diameter when round). */
  readonly width: number
  /** How far the sheet is pushed in at the middle, metres (0: only the paint is marked). */
  readonly depth: number
  /** The paint over the dent cracks (a hard blow on sheet metal). */
  readonly paintCracks: boolean
  /** The cut goes through the sheet (a gash). */
  readonly through: boolean
}

/** Depth of the dent of a 25 J blow (a fist) in a car's sheet steel, metres; it grows with the square root of the energy. */
const FIST_DEPTH = 0.0033
const FIST_ENERGY = 25
const DEEPEST_DENT = 0.025
/** A dent deeper than this cracks the paint over it, metres. */
export const PAINT_CRACK_DEPTH = 0.007
/** Below this a blade only scratches the paint (the primer shows); up to `GASH_ENERGY` it cuts to the bare metal; above it, a heavy blade opens the sheet. */
export const CUT_ENERGY = 60
export const GASH_ENERGY = 180
const SHORTEST_CUT = 0.08
const LONGEST_CUT = 0.5
const SHEET_METALS = new Set(['steel', 'aluminium'])
/** Aluminium gives a little more than steel under the same blow. */
const SOFTER: Readonly<Record<string, number>> = { aluminium: 1.2, plastic: 0.6 }

/** The mark of a blow on a panel (see {@link StrikeMarkShape}); `null` on a material a blow leaves nothing on (rubber, glass: those crack or bounce elsewhere). */
export function strikeMarkShape(input: StrikeInput): StrikeMarkShape | null {
  if (input.material === 'rubber' || input.material === 'glass' || input.energy <= 0) return null
  return input.type === 'slash' ? bladeMark(input) : bluntMark(input)
}

function bluntMark(input: StrikeInput): StrikeMarkShape {
  const give = SOFTER[input.material] ?? 1
  const depth = Math.min(DEEPEST_DENT, FIST_DEPTH * Math.sqrt(input.energy / FIST_ENERGY) * give)
  const width = Math.min(0.24, Math.max(0.04, input.radius * 1.2))
  const paintCracks = SHEET_METALS.has(input.material) && depth >= PAINT_CRACK_DEPTH
  const line = input.contactLength ?? 0
  if (line > width) return { kind: 'crease', length: line, width: Math.max(0.03, input.radius * 0.6), depth, paintCracks, through: false }
  return { kind: 'dent', length: width, width, depth, paintCracks, through: false }
}

function bladeMark(input: StrikeInput): StrikeMarkShape {
  const length = Math.min(LONGEST_CUT, Math.max(SHORTEST_CUT, SHORTEST_CUT + input.energy / 1000))
  if (input.energy < CUT_ENERGY) return { kind: 'scratch', length, width: 0.003, depth: 0, paintCracks: false, through: false }
  if (input.energy < GASH_ENERGY || !SHEET_METALS.has(input.material)) return { kind: 'cut', length, width: 0.005, depth: 0.0008, paintCracks: false, through: false }
  return { kind: 'gash', length, width: 0.008, depth: 0.003, paintCracks: false, through: true }
}
