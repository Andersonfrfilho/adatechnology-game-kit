import type { WaterBlastCharge, WaterBlastKind, WaterBlastKindId, WaterShotClass, WaterShotProfile } from './types'

/**
 * How each class of round meets water, entering straight down at its usual speed. A rifle bullet throws a tall thin spout and yaws and breaks up
 * within a few tens of centimetres; a pistol round a short one and goes on longer; a heavy rifle (.338, .50) a tall wide column; a buckshot pellet a
 * small spout and a lot of shallow foam; an arrow slips in with little splash and goes far.
 */
export const WATER_SHOT_PROFILES: Readonly<Record<WaterShotClass, WaterShotProfile>> = {
  rimfire: { speed: 350, columnHeight: 0.25, columnRadius: 0.02, drops: 8, dropSpeed: [0.9, 1.8], dropSize: 0.009, ringRadius: 0.32, rings: 1, ringLife: 1.2, foamRadius: 0.06, foamLife: 0.7, slowing: 0.35, bubblesPerMetre: 20, ricochetBelowDeg: 9 },
  pistol: { speed: 360, columnHeight: 0.45, columnRadius: 0.035, drops: 14, dropSpeed: [1.2, 2.6], dropSize: 0.012, ringRadius: 0.45, rings: 2, ringLife: 1.4, foamRadius: 0.09, foamLife: 0.9, slowing: 0.55, bubblesPerMetre: 30, ricochetBelowDeg: 8 },
  magnum: { speed: 450, columnHeight: 0.7, columnRadius: 0.045, drops: 20, dropSpeed: [1.5, 3.2], dropSize: 0.014, ringRadius: 0.6, rings: 2, ringLife: 1.6, foamRadius: 0.12, foamLife: 1.1, slowing: 0.7, bubblesPerMetre: 30, ricochetBelowDeg: 7 },
  rifle: { speed: 800, columnHeight: 1.1, columnRadius: 0.03, drops: 26, dropSpeed: [2.5, 4.5], dropSize: 0.011, ringRadius: 0.7, rings: 3, ringLife: 1.6, foamRadius: 0.11, foamLife: 1, slowing: 0.35, bubblesPerMetre: 45, ricochetBelowDeg: 6 },
  battle_rifle: { speed: 850, columnHeight: 1.4, columnRadius: 0.035, drops: 30, dropSpeed: [2.8, 5], dropSize: 0.012, ringRadius: 0.85, rings: 3, ringLife: 1.8, foamRadius: 0.13, foamLife: 1.1, slowing: 0.45, bubblesPerMetre: 45, ricochetBelowDeg: 6 },
  sniper: { speed: 900, columnHeight: 2.2, columnRadius: 0.06, drops: 48, dropSpeed: [3.5, 6.5], dropSize: 0.016, ringRadius: 1.4, rings: 4, ringLife: 2.2, foamRadius: 0.22, foamLife: 1.6, slowing: 0.9, bubblesPerMetre: 50, ricochetBelowDeg: 5 },
  buckshot: { speed: 400, columnHeight: 0.28, columnRadius: 0.025, drops: 7, dropSpeed: [1, 2], dropSize: 0.01, ringRadius: 0.3, rings: 1, ringLife: 1.1, foamRadius: 0.13, foamLife: 1.3, slowing: 0.3, bubblesPerMetre: 25, ricochetBelowDeg: 9 },
  birdshot: { speed: 400, columnHeight: 0.1, columnRadius: 0.012, drops: 2, dropSpeed: [0.6, 1.2], dropSize: 0.006, ringRadius: 0.14, rings: 1, ringLife: 0.8, foamRadius: 0.06, foamLife: 0.9, slowing: 0.08, bubblesPerMetre: 10, ricochetBelowDeg: 10 },
  slug: { speed: 460, columnHeight: 0.8, columnRadius: 0.07, drops: 24, dropSpeed: [1.6, 3], dropSize: 0.016, ringRadius: 0.75, rings: 2, ringLife: 1.7, foamRadius: 0.18, foamLife: 1.3, slowing: 0.8, bubblesPerMetre: 35, ricochetBelowDeg: 8 },
  arrow: { speed: 100, columnHeight: 0.18, columnRadius: 0.02, drops: 5, dropSpeed: [0.6, 1.2], dropSize: 0.01, ringRadius: 0.3, rings: 1, ringLife: 1.2, foamRadius: 0.05, foamLife: 0.6, slowing: 2.5, bubblesPerMetre: 6, ricochetBelowDeg: 4 },
  // a thrown thing the size of a grenade or a can falling in: a plop, a crown and wide rings, and it sinks
  object: { speed: 12, columnHeight: 0.5, columnRadius: 0.07, drops: 18, dropSpeed: [1, 2.4], dropSize: 0.015, ringRadius: 0.9, rings: 3, ringLife: 2, foamRadius: 0.14, foamLife: 1.2, slowing: 0.5, bubblesPerMetre: 25, ricochetBelowDeg: 3 },
  fragment: { speed: 600, columnHeight: 0.35, columnRadius: 0.02, drops: 6, dropSpeed: [1, 2.4], dropSize: 0.01, ringRadius: 0.3, rings: 1, ringLife: 1, foamRadius: 0.05, foamLife: 0.6, slowing: 0.15, bubblesPerMetre: 15, ricochetBelowDeg: 7 },
}

/** The class of round of each calibre of `@adatechnology/game-weapons` (its `calibers.json` ids). A calibre not here is classed by `waterShotClassOf`. */
export const WATER_SHOT_BY_CALIBER: Readonly<Record<string, WaterShotClass>> = {
  '22lr': 'rimfire',
  '380acp': 'pistol',
  '9x18': 'pistol',
  '9x19': 'pistol',
  '40sw': 'pistol',
  '45acp': 'pistol',
  '5_7x28': 'pistol',
  '38spl': 'pistol',
  '32acp': 'pistol',
  '7_62x25': 'pistol',
  '4_6x30': 'pistol',
  '357mag': 'magnum',
  '44mag': 'magnum',
  '50ae': 'magnum',
  '45_70_bp': 'magnum',
  '12ga_00buck': 'buckshot',
  '20ga_buck': 'buckshot',
  '12ga_birdshot': 'birdshot',
  '12ga_slug': 'slug',
  '5_56x45': 'rifle',
  '5_45x39': 'rifle',
  '7_62x39': 'rifle',
  '30_30': 'rifle',
  '9x39': 'rifle',
  '7_62x51': 'battle_rifle',
  '7_62x54r': 'battle_rifle',
  '30_06': 'battle_rifle',
  '7_92x57': 'battle_rifle',
  '300wm': 'battle_rifle',
  '338lapua': 'sniper',
  '408cheytac': 'sniper',
  '50bmg': 'sniper',
  arrow: 'arrow',
  crossbow_bolt: 'arrow',
}

/** What is known of a round that has no calibre in the table: its mass in grams, speed in m/s and diameter in millimetres. */
export interface WaterRound {
  readonly grams: number
  readonly speed: number
  readonly diameter?: number
  /** One of several pellets of a shell. */
  readonly pellet?: boolean
}

/** The class of a round from what it weighs and how fast it goes, for a calibre the table does not know. */
export function waterShotClassOf(round: WaterRound): WaterShotClass {
  const joules = 0.5 * (round.grams / 1000) * round.speed * round.speed
  if (round.speed < 150) return 'arrow'
  if (round.pellet) return round.grams < 0.5 ? 'birdshot' : 'buckshot'
  if ((round.diameter ?? 0) >= 15) return 'slug'
  if (joules >= 6000) return 'sniper'
  if (joules >= 2800) return 'battle_rifle'
  if (joules >= 1200) return 'rifle'
  if (joules >= 900) return 'magnum'
  return joules < 200 ? 'rimfire' : 'pistol'
}

/**
 * How each kind of charge works on water. A high explosive throws the water; a shaped charge a narrow jet; a fragmentation charge over the surface
 * also peppers it with fragments; a gas or fuel deflagration mostly boils it into steam.
 */
export const WATER_BLAST_KINDS: Readonly<Record<WaterBlastKindId, WaterBlastKind>> = {
  blast: { brisance: 1, columnWidth: 1, fragments: 0, mist: 1, fireballUnderwater: false },
  fragmentation: { brisance: 0.9, columnWidth: 1, fragments: 16, mist: 1, fireballUnderwater: false },
  shaped_charge: { brisance: 0.8, columnWidth: 0.6, fragments: 6, mist: 0.8, fireballUnderwater: false },
  directional: { brisance: 0.7, columnWidth: 0.9, fragments: 24, mist: 0.8, fireballUnderwater: false },
  fuel: { brisance: 0.25, columnWidth: 1.4, fragments: 4, mist: 2.2, fireballUnderwater: false },
  incendiary: { brisance: 0.05, columnWidth: 1.2, fragments: 0, mist: 1.5, fireballUnderwater: false },
  flash: { brisance: 0.1, columnWidth: 1, fragments: 0, mist: 0.6, fireballUnderwater: false },
}

/** The explosives of `@adatechnology/game-weapons` (`explosives.json`): TNT equivalent in kilograms and kind. */
export const WATER_BLASTS: Readonly<Record<string, WaterBlastCharge>> = {
  m67: { tnt: 0.24, kind: 'fragmentation' },
  pipe_bomb: { tnt: 0.15, kind: 'fragmentation' },
  m79_40mm: { tnt: 0.045, kind: 'fragmentation' },
  vog_25: { tnt: 0.045, kind: 'fragmentation' },
  dynamite: { tnt: 0.25, kind: 'blast' },
  c4: { tnt: 0.76, kind: 'blast' },
  semtex: { tnt: 0.83, kind: 'blast' },
  claymore: { tnt: 0.9, kind: 'directional' },
  m72_66mm: { tnt: 0.45, kind: 'shaped_charge' },
  at4_84mm: { tnt: 0.7, kind: 'shaped_charge' },
  pg7v: { tnt: 0.45, kind: 'shaped_charge' },
  carl_gustaf_84mm: { tnt: 0.7, kind: 'shaped_charge' },
  propane_p13: { tnt: 1.5, kind: 'fuel' },
  fuel_barrel: { tnt: 1, kind: 'fuel' },
  car_fuel_tank: { tnt: 0.5, kind: 'fuel' },
  fuel_pump: { tnt: 0.5, kind: 'fuel' },
  fuel_station_tank: { tnt: 20, kind: 'fuel' },
  molotov: { tnt: 0.02, kind: 'incendiary' },
  flashbang: { tnt: 0.01, kind: 'flash' },
}

/** The profile a host asks for by class id, or the profile it gives; an unknown id falls back to `pistol`. */
export function resolveWaterShotProfile(profile: string | WaterShotProfile, table: Readonly<Record<string, WaterShotProfile>> = WATER_SHOT_PROFILES): WaterShotProfile {
  if (typeof profile !== 'string') return profile
  return table[profile] ?? WATER_SHOT_PROFILES.pistol
}

/** Changes a profile table without touching the kit's: `null` removes an entry, a partial entry is merged over the old one. */
export function patchWaterShotProfiles(base: Readonly<Record<string, WaterShotProfile>>, changes: Readonly<Record<string, Partial<WaterShotProfile> | null>>): Record<string, WaterShotProfile> {
  const out: Record<string, WaterShotProfile> = { ...base }
  for (const [id, change] of Object.entries(changes)) {
    if (change === null) delete out[id]
    else out[id] = { ...(base[id] ?? WATER_SHOT_PROFILES.pistol), ...change }
  }
  return out
}
