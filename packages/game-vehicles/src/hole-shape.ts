/**
 * The mark a round leaves in a vehicle's skin, from the round itself (calibre, mass, energy, how it met the panel) and the panel's material: no table per weapon.
 * A pistol round punches a clean hole with a tight dimple, a rifle round a small sharp hole with torn petals and a wide ring of chipped paint, a slug or a heavy
 * calibre a big ragged hole with the sheet pushed in, a shotgun pellet that stops a dimple without a bore, and a round at a slant a long gouge.
 */

/** What the mark looks like: drives the drawing of the mark (texture, size, stretch). */
export type HoleStyle = 'round' | 'petalled' | 'ragged' | 'dimple' | 'gouge'

export interface BulletHoleInput {
  /** Diameter of the round, millimetres (`Hit.caliber`). */
  readonly caliberMm: number
  /** Kinetic energy at the panel, joules. */
  readonly energy: number
  /** Mass of the round, grams (`Hit.mass`); without it the speed is not known and the mark goes by calibre. */
  readonly massGrams?: number
  /** |cos| of the angle between the round's path and the panel's normal: 1 square on, 0 along the panel. */
  readonly cosIncidence: number
  /** The round went through the panel. */
  readonly through: boolean
  /** The panel's material (`steel`, `aluminium`, `glass`, `plastic`, `rubber`). */
  readonly material: string
  /** The bore the panel already took (`holeDiam` of the impl, with a soft point's spread), metres. */
  readonly boreDiameter: number
}

export interface BulletHoleShape {
  readonly style: HoleStyle
  /** Diameter of the dark bore, metres (0: no bore, the sheet is only dented or scraped). */
  readonly boreDiameter: number
  /** Diameter of the whole mark across (bare metal and chipped paint around the bore), metres. */
  readonly markDiameter: number
  /** How far the sheet is pushed in at the middle, metres. */
  readonly dentDepth: number
  /** Length over width of the mark, along the round's path on the panel (1: round). */
  readonly elongation: number
  /** Torn petals of sheet around the bore (0: a clean edge). */
  readonly petals: number
}

/** Below this |cos| the round meets the panel at a slant (more than ~63° off square): it scrapes a gouge instead of a round hole. */
export const GOUGE_COS = 0.45
/** A round faster than this, metres per second, is a rifle round: its shock tears the sheet and chips the paint wide. */
export const RIFLE_SPEED = 600
/**
 * Without the round's mass (a world's shot carries the calibre and the energy only): a round carrying this many joules per square millimetre of its
 * cross-section is a rifle round (5.56 about 70, 7.62x39 about 40, .30-30 about 45; 9 mm about 8, .44 Magnum about 16, a 12 ga slug about 11).
 */
export const RIFLE_ENERGY_DENSITY = 35
/** A round this wide or wider, millimetres, is a slug or a heavy calibre: a big ragged hole. */
export const HEAVY_CALIBER_MM = 12
const LONGEST_GOUGE = 4
const SHORTEST_GOUGE = 1.5
const SHEET_METALS = new Set(['steel', 'aluminium'])

/** Speed of the round at the panel, metres per second, when its mass is known. */
function speedOf(input: BulletHoleInput): number | undefined {
  const mass = input.massGrams
  if (!mass || mass <= 0 || input.energy <= 0) return undefined
  return Math.sqrt((2 * input.energy) / (mass / 1000))
}

/** A rifle round: fast (its mass known), or carrying a lot of energy for its cross-section (its mass not known). */
function isRifleRound(input: BulletHoleInput): boolean {
  const speed = speedOf(input)
  if (speed !== undefined) return speed >= RIFLE_SPEED
  const area = Math.PI * (input.caliberMm / 2) ** 2
  return area > 0 && input.energy / area >= RIFLE_ENERGY_DENSITY
}

/** The style of the mark from the round and how it met the panel. */
export function holeStyleOf(input: BulletHoleInput): HoleStyle {
  const sheet = SHEET_METALS.has(input.material)
  if (sheet && input.cosIncidence < GOUGE_COS) return 'gouge'
  if (!input.through) return 'dimple'
  if (input.caliberMm >= HEAVY_CALIBER_MM) return 'ragged'
  return sheet && isRifleRound(input) ? 'petalled' : 'round'
}

/** The size and shape of the mark (see {@link BulletHoleShape}). */
export function bulletHoleShape(input: BulletHoleInput): BulletHoleShape {
  const style = holeStyleOf(input)
  const bore = Math.max(0.003, input.boreDiameter)
  const caliber = input.caliberMm / 1000
  switch (style) {
    case 'gouge': {
      const elongation = Math.min(LONGEST_GOUGE, Math.max(SHORTEST_GOUGE, 1 / Math.max(input.cosIncidence, 0.05)))
      return { style, boreDiameter: input.through ? bore * 0.6 : 0, markDiameter: caliber * 1.8, dentDepth: caliber * 0.12, elongation, petals: 0 }
    }
    case 'dimple':
      return { style, boreDiameter: 0, markDiameter: caliber * 1.9, dentDepth: caliber * 0.25, elongation: 1, petals: 0 }
    case 'ragged':
      return { style, boreDiameter: bore * 1.15, markDiameter: bore * 2.6, dentDepth: caliber * 0.35, elongation: 1, petals: 7 }
    case 'petalled':
      return { style, boreDiameter: bore, markDiameter: bore * 3.4, dentDepth: caliber * 0.18, elongation: 1, petals: 5 }
    default:
      return { style, boreDiameter: bore, markDiameter: bore * 2.2, dentDepth: caliber * 0.15, elongation: 1, petals: 0 }
  }
}
