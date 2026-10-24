import type { BodyHit, DamageRules } from '@adatechnology/game-characters'

/**
 * What the "Hit" control of the bench does to the body: typical loads, in joules and millimetres, as the arsenal's calibre table gives them.
 * `caliberId` is used only when the kit's table knows it (the `team-game` model).
 */
export type HitPreset = { readonly id: string; readonly hit: Omit<BodyHit, 'point' | 'direction'>; readonly range?: number }

export const HIT_PRESETS: readonly HitPreset[] = [
  { id: '9x19', hit: { type: 'ballistic', energy: 500, mass: 7.5, caliber: 9, caliberId: '9x19' } },
  { id: '12ga_3', hit: { type: 'ballistic', energy: 3000, mass: 32, caliber: 8.4, pellets: 9, distance: 3, caliberId: '12ga_00buck' } },
  { id: '7_62x39', hit: { type: 'ballistic', energy: 2100, mass: 7.9, caliber: 7.62, caliberId: '7.62x39' } },
  { id: '308', hit: { type: 'ballistic', energy: 3504, mass: 9.7, caliber: 7.8, caliberId: '308' } },
  { id: '5_56x45', hit: { type: 'ballistic', energy: 1800, mass: 4, caliber: 5.56, caliberId: '5.56x45' } },
  { id: 'machete', hit: { type: 'slash', energy: 120 } },
  { id: 'axe', hit: { type: 'slash', energy: 220 } },
  { id: 'm67_1', hit: { type: 'explosive', energy: 6000, radius: 15 }, range: 1 },
  { id: 'm67_3', hit: { type: 'explosive', energy: 6000, radius: 15 }, range: 3 },
  { id: 'm67_6', hit: { type: 'explosive', energy: 6000, radius: 15 }, range: 6 },
]

export const hitPresetOf = (id: string): HitPreset => HIT_PRESETS.find((preset) => preset.id === id) ?? (HIT_PRESETS[0] as HitPreset)

/** The hit a preset makes on a body at `origin` (world metres), aimed at `part` height `y`; blasts start `range` metres to the side. */
export const hitFor = (preset: HitPreset, origin: readonly [number, number, number], y: number, known: ReadonlyMap<string, unknown>): BodyHit => {
  const { caliberId, ...rest } = preset.hit
  const withId = caliberId !== undefined && known.has(caliberId) ? { ...rest, caliberId } : rest
  if (preset.hit.type === 'explosive') return { ...withId, point: [origin[0] + (preset.range ?? 3), origin[1] + 0.2, origin[2]] } as BodyHit
  return { ...withId, point: [origin[0], origin[1] + y, origin[2] + 0.4], direction: [0, 0, -1] } as BodyHit
}

export type { DamageRules }
