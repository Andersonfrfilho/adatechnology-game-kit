import type { FloorplanEngine, StyleDef } from '@adatechnology/game-floorplan'

/** Rural style: low wire fence around the lot, board or log facades, asphalt or zinc roofs. */
export const ruralStyle: Omit<StyleDef, 'swatches'> = {
  id: 'rural',
  height: 1.1,
  fenceHeight: 1.1,
  front: { type: { fence: 1 }, top: { none: 1 } },
  sideYard: { type: { fence: 1 }, top: { none: 1 } },
  back: { type: { fence: 1 }, top: { none: 1 } },
  gate: { garage: { sliding: 1 } },
  facade: { finish: { horizontal_boards: 0.6, vertical_boards: 0.25, log: 0.15 }, grilles: 0, roof: { asphalt: 0.7, zinc: 0.3 } },
  grounds: { garden: { lawn: 0.7, dirt: 0.3 }, parking: { dirt: 0.6, concrete: 0.4 }, backyard: { lawn: 0.6, dirt: 0.4 }, side_yard: { lawn: 0.5, dirt: 0.5 } },
}

/** Decor of the rural style: fewer pictures, a plant here and there, curtains everywhere, no air conditioning. */
export const ruralDecorProfile = { light: { ceiling_light: 0.7, pendant: 0.3 }, lightAreaPerLight: 12, mult: 0.7, plantChance: 0.35, tablePlantChance: 0.3, hangingPlantChance: 0.05, curtain: 1, airConditioner: {}, smallPictureChance: 0.7 }

/** Facade colours of the Brazilian countryside, `[labelKey, hue, saturation, lightness]` (the palette picks its base colour here). */
export const ruralFacadeColors: [string, number, number, number][] = [
  ['natural_wood', 30, 0.35, 0.5], ['worn_white', 45, 0.1, 0.88], ['moss_green', 100, 0.2, 0.4], ['bluish_grey', 205, 0.16, 0.62], ['barn_red', 8, 0.45, 0.38], ['wood_grey', 35, 0.06, 0.58],
]

/** Paint swatches shown on the facade, `[labelKey, hex]`. */
export const ruralSwatches: [string, string][] = [['natural_wood', '#b08a5c'], ['worn_white', '#e4e0d4'], ['moss_green', '#6f8a5a'], ['bluish_grey', '#7f98a8'], ['barn_red', '#9a4a3a'], ['wood_grey', '#9a958a']]

/** The rural palette follows the residential mid recipe (same draws) with its own facade table and stream. */
export function registerRuralStyle(engine: FloorplanEngine): void {
  engine.registerStyle({ ...ruralStyle, swatches: ruralSwatches })
  const mid = engine.paletteStyles.mid
  if (!mid) throw new Error('Register @adatechnology/game-floorplan-residential before the rural pack: the palette style "mid" is missing')
  engine.registerPaletteStyle('rural', { ...mid, seedKey: 'rural', facadeColors: ruralFacadeColors })
  engine.registerDecorProfile('rural', ruralDecorProfile)
}
