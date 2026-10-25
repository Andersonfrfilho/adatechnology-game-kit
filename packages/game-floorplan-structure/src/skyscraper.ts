import type { DestructibleSpec, PartSpec, PileSpec, SoilProfile } from '@adatechnology/game-contracts'
import { GRAVITY, MATERIALS, SOILS, createDestruction, partMass, pileLength, profileOf } from '@adatechnology/game-destruction'
import type { SizeStructureOptions, WindOptions } from '@adatechnology/game-destruction'

import {
  CORE_DEFAULTS, TOWER_DEFAULTS, buildTower, coreSize, mechanicalStoreys,
} from './tower'
import type { CoreOptions, CurtainWallOptions, DamperOptions, FlatRoofOptions, MechanicalFloorOptions, PunchedFacadeOptions, TowerMechanicalOptions, TowerOptions } from './tower'

/**
 * The skyscraper as a recipe: a few numbers (storeys, bay, core ratio, facade, mechanical floors, damper, wind, soil and piles) that `skyscraperLayout`
 * turns into the sizes of a `buildTower` and `buildSkyscraper` turns into a destructible spec on deep piles. The typologies that use it
 * (`game-floorplan-commercial` office tower, `game-floorplan-residential` residential tower) bring their own defaults and the rooms of the plan; the
 * structure is the same one. Design T10-estrutura-real.md §11.
 */

/** Deep foundation of a tower: bored piles under the raft, taken down to firm ground (`pileLength`) by the load each one carries. */
export interface PileDesign {
  /** Diameter in metres (default 1.2: the bored piles of high-rise foundations are 0.8 to 2.0 m). */
  diameter?: number
  /** Grid pitch as a multiple of the diameter (default 3.5; the usual minimum is 2.5 to 3). */
  pitch?: number
  method?: PileSpec['method']
  /** Longest pile in metres (default 60); when the load does not fit, the piles are put closer. */
  maxLength?: number
  /** Fixed length and count (default: from the load and the soil). */
  length?: number
  count?: number
}

export const PILE_DEFAULTS = { diameter: 1.2, pitch: 3.5, method: 'bored', maxLength: 60 } as const

/**
 * Most storeys a skyscraper has by default (owner decision 2026-10-25): above about 60 the drift at the top passes H/500, because the engine has no outrigger
 * or perimeter tube. A default, not a physical constant: `SkyscraperOptions.range` (or a preset with another `range`) raises it.
 */
export const SKYSCRAPER_MAX_STOREYS = 60

/** Numbers that describe one typology of skyscraper. Every one is an option of `skyscraperLayout`. */
export interface SkyscraperPreset {
  /** Storeys: the default and the range the typology accepts (the top storey is the mechanical floor). */
  storeys: number
  range: readonly [number, number]
  /** Clear height of a storey in metres (the storey pitch is this plus the slab). */
  height: number
  /** Column spacing in metres along x and z. */
  bay: readonly [number, number]
  /** Bays along x and z (z always odd: the core stands in the middle bay, between two rows of beams). */
  bays: readonly [number, number]
  /** Tallest the tower may be over its narrowest side (default 9: Taipei 101 is 8.3, the Burj Khalifa 8); the bays are widened to keep it. `false` leaves them as given. */
  slenderness: number | false
  /** Target share of the floor plate taken by the concrete core (tube footprint over plate); the number of elevators follows, as far as the bay allows. */
  coreRatio: number
  facade: 'curtain' | 'punched'
  /** Another mechanical floor every this many storeys; `false` none (only the top one). */
  mechanicalEvery: number | false
  /** Total height in metres from which a tuned mass damper is added on the top mechanical floor; `false` never. */
  damperAbove: number | false
  /** The wind the tower is designed for (`buildTower({ wind })`). */
  wind: WindOptions | false
  /** The ground: a soil class id or a profile of layers; `false` leaves the tower on anchored ground. */
  soil: string | SoilProfile | false
  /** Deep piles under the raft (only with `soil`); `false` leaves a shallow raft. */
  piles: PileDesign | false
  /**
   * Sizes the lateral system by height (default on): a tower taller than `above` metres whose design drift at the requested storeys is over the limit of
   * the wind (`driftLimit`, default H/500: NBR 6118 serviceability) gets wider bays, and with them a larger plate and core, in steps of 0.5 m up to `maxBay`
   * until it passes. `false` keeps the layout as given (and then a 60-storey tower is `drift`).
   */
  sizeForWind?: boolean | { above?: number; maxBay?: number }
  /** Dead load per m² of floor besides the slab itself, kg/m² (facade, partitions, finishes, equipment), used to size the columns. */
  superimposed: number
}

/** Defaults of a generic skyscraper: a 40-storey tower on 12 m bays with a curtain wall, a plant floor every 20 storeys, a damper above 150 m, in a city wind, on piles to the sand under soft clay. */
export const SKYSCRAPER_DEFAULTS: SkyscraperPreset = {
  storeys: 40,
  range: [20, SKYSCRAPER_MAX_STOREYS],
  height: 3.6,
  bay: [12, 12],
  bays: [3, 3],
  slenderness: 9,
  coreRatio: 0.08,
  facade: 'curtain',
  mechanicalEvery: 20,
  damperAbove: 150,
  wind: { speed: 40, terrain: 'IV' },
  soil: { layers: [{ soil: 'clay_soft', thickness: 10 }, { soil: 'sand_dense' }] },
  piles: {},
  superimposed: 450,
}

export interface SkyscraperOptions extends Partial<Omit<SkyscraperPreset, 'bay' | 'bays'>> {
  bay?: number | readonly [number, number]
  bays?: readonly [number, number]
  /** Sizes derived from the load and the height unless given: columns, beam depth and slab thickness in metres. */
  columnSize?: number
  beamHeight?: number
  slabThickness?: number
  /** The core (`false`: a frame alone); `wallThickness` and `elevators` are derived unless given. */
  core?: CoreOptions | false
  curtain?: CurtainWallOptions
  punchedFacade?: PunchedFacadeOptions
  flatRoof?: FlatRoofOptions | false
  mechanical?: (MechanicalFloorOptions & TowerMechanicalOptions) | false
  damper?: DamperOptions
  sizing?: SizeStructureOptions | false
}

export interface SkyscraperLayout {
  storeys: number
  /** Clear height, slab and storey pitch in metres. */
  height: number
  slab: number
  pitch: number
  /** Height from the ground to the roof. */
  total: number
  bay: [number, number]
  /** Distance between the outer column axes. */
  span: [number, number]
  columnsX: number
  columnsZ: number
  columnSize: number
  beamHeight: number
  /** Size of the floor slab, `[x, z]`, centred on the origin of the spec. */
  plate: [number, number]
  core: { center: [number, number]; size: [number, number]; wallThickness: number; elevators: number; stairWidth: number; shaftDepth: number } | null
  /** Footprint of the core over the plate. */
  coreRatio: number
  facade: 'curtain' | 'punched'
  /** Storeys with plant (the intermediate ones and the top one), ascending. */
  mechanical: number[]
  damper: boolean
  /** The options `buildTower` is called with. */
  tower: TowerOptions
}

const ceilTo = (v: number, step: number): number => Math.ceil(v / step - 1e-9) * step
const round2 = (v: number): number => Math.round(v * 100) / 100
/** Bearing stress used to size columns: 0.85 fck of a C25 concrete, in kg/m² (the cage steel is the margin), with the 0.65 utilisation of the sizing. */
const COLUMN_KG_M2 = (0.85 * 25e6) / GRAVITY * 0.65
/** Share of the gravity load the columns carry; the core and its walls take the rest. */
const COLUMN_SHARE = 0.5
/** Clear space kept between the core and the columns and beams around it, metres. */
const CORE_CLEARANCE = 0.4
/** A core wall is as thick as the total height over this, in metres per metre (40 cm at 80 m, 1.55 m at 312 m; real cores run 30 cm to 1.5 m). */
const WALL_SLENDER = 200

/** Sizing by wind below this height (metres) is skipped: every tower up to 40 storeys passes H/500 as laid out. */
export const WIND_SIZING_DEFAULTS = { above: 180, maxBay: 20 } as const

const sizedCache = new Map<string, SkyscraperLayout>()

/** The design drift (deflection over height) of the tower of a layout, in the wind it is designed for. */
const driftOf = (layout: SkyscraperLayout, wind: WindOptions): number => {
  const w = createDestruction({ wind })
  return w.state(w.add(buildTower(layout.tower)))?.wind?.drift ?? 0
}

/**
 * Resolves the numbers of a skyscraper from a preset and the options. Without `sizeForWind: false`, a tall tower that would drift past H/500 gets wider
 * bays (so a larger plate and core) until it does not: the way real towers thicken the core and widen the footprint with height. Memoised, because it
 * builds the tower to measure it.
 */
export function skyscraperLayout(options: SkyscraperOptions = {}, preset: SkyscraperPreset = SKYSCRAPER_DEFAULTS): SkyscraperLayout {
  const raw = rawLayout(options, preset)
  const o = { ...preset, ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) } as SkyscraperPreset & SkyscraperOptions
  const cfg = { ...WIND_SIZING_DEFAULTS, ...(typeof o.sizeForWind === 'object' ? o.sizeForWind : {}) }
  if (o.sizeForWind === false || !o.wind || o.core === false || raw.total < cfg.above) return raw
  const key = JSON.stringify([options, preset])
  const hit = sizedCache.get(key)
  if (hit) return hit
  const limit = o.wind.driftLimit ?? 1 / 500
  let layout = raw
  for (let i = 0; i < 6; i++) {
    const drift = driftOf(layout, o.wind)
    const widest = Math.max(...layout.bay)
    if (drift <= limit || widest >= cfg.maxBay) break
    // drift falls about with the cube of the bay (the plate, the core and the lever arm grow together)
    const k = Math.max(1.02, Math.pow(drift / limit, 1 / 3) * 1.02)
    const bay = layout.bay.map((b) => Math.min(cfg.maxBay, round2(ceilTo(b * k, 0.5)))) as [number, number]
    layout = rawLayout({ ...options, bay }, preset)
  }
  sizedCache.set(key, layout)
  return layout
}

function rawLayout(options: SkyscraperOptions, preset: SkyscraperPreset): SkyscraperLayout {
  const o = { ...preset, ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) } as SkyscraperPreset & SkyscraperOptions
  const range = o.range
  const storeys = Math.max(range[0], Math.min(range[1], Math.round(o.storeys)))
  const given: [number, number] = typeof o.bay === 'number' ? [o.bay, o.bay] : [o.bay[0], o.bay[1]]
  const oddZ = (n: number) => (Math.round(n) % 2 === 1 ? Math.round(n) : Math.round(n) + 1)
  const bays: [number, number] = [Math.max(1, Math.round(o.bays[0])), oddZ(Math.max(1, o.bays[1]))]
  const slabOf = (b: number) => Math.max(TOWER_DEFAULTS.slabThickness, round2(ceilTo(b / 32, 0.05)))
  // too slender for its plate: the bays grow until the narrowest side is a ninth of the height (the slab, and so the height, follow the bay)
  let bay: [number, number] = given
  for (let i = 0; i < 4 && o.slenderness !== false; i++) {
    const total = storeys * (o.height + (o.slabThickness ?? slabOf(Math.max(...bay))))
    const narrow = Math.min(bays[0] * bay[0], bays[1] * bay[1])
    if (narrow >= total / o.slenderness) break
    const k = total / o.slenderness / narrow
    bay = [round2(ceilTo(bay[0] * k, 0.5)), round2(ceilTo(bay[1] * k, 0.5))]
  }
  const span: [number, number] = [bays[0] * bay[0], bays[1] * bay[1]]
  const slab = o.slabThickness ?? slabOf(Math.max(...bay))
  const beamHeight = o.beamHeight ?? Math.max(TOWER_DEFAULTS.beamHeight, round2(ceilTo(Math.max(...bay) / 14, 0.1)))
  const pitch = o.height + slab
  const total = storeys * pitch
  const tributary = bay[0] * bay[1]
  const load = COLUMN_SHARE * tributary * storeys * (o.superimposed + slab * 2500)
  const columnSize = o.columnSize ?? Math.max(TOWER_DEFAULTS.columnSize, round2(ceilTo(Math.sqrt(load / COLUMN_KG_M2), 0.1)))
  const plate: [number, number] = [round2(span[0] + columnSize + 0.2), round2(span[1] + columnSize + 0.2)]
  const mech = o.mechanicalEvery === false ? undefined : o.mechanicalEvery
  const relays = o.mechanical === false ? [] : mechanicalStoreys(storeys, o.mechanical === undefined ? mech : o.mechanical.every ?? mech)
  const mechanical = o.mechanical === false ? [] : [...relays, storeys - 1]

  let coreLayout: SkyscraperLayout['core'] = null
  let coreOptions: CoreOptions | false = false
  if (o.core !== false) {
    const given = o.core ?? {}
    // a wall thicker than a third of its height is a block, not a plate, to the engine: it would hold no vertical bars (and no pull)
    const maxWall = Math.floor((o.height / 3 - 0.05) * 20) / 20
    const wallThickness = given.wallThickness ?? Math.max(CORE_DEFAULTS.wallThickness, Math.min(maxWall, round2(ceilTo(total / WALL_SLENDER, 0.05))))
    const ti = given.innerThickness ?? CORE_DEFAULTS.innerThickness
    const shaft = given.shaft ?? CORE_DEFAULTS.shaft
    // the most elevators whose row of shafts fits between the beams on each side of the middle bay
    const fit = Math.max(1, Math.floor((bay[1] - 2 * CORE_CLEARANCE - 0.2 - 2 * wallThickness + ti) / (shaft + ti)))
    const probe = coreSize({ ...given, wallThickness, elevators: 2 })
    const wanted = given.elevators ?? Math.max(2, Math.ceil((o.coreRatio * plate[0] * plate[1] / probe[0] - 2 * wallThickness + ti) / (shaft + ti)))
    const elevators = Math.max(1, Math.min(wanted, fit))
    // what the ratio asks beyond the elevators the bay holds goes into the width: deeper cars and service space beside the shafts, as far as the bay allows
    const narrow = coreSize({ ...given, wallThickness, elevators })
    const room = bay[0] - columnSize - 2 * CORE_CLEARANCE - narrow[0]
    const extra = given.shaftDepth !== undefined ? 0 : Math.max(0, Math.min(room, (o.coreRatio * plate[0] * plate[1]) / narrow[1] - narrow[0]))
    // the middle bay in z has no row of columns; in x the core stands in the middle bay too, or in the first half bay when the count is even
    const xs = Array.from({ length: bays[0] + 1 }, (_, i) => -span[0] / 2 + i * bay[0])
    const middle = Math.floor(bays[0] / 2)
    const center: [number, number] = given.center ?? [bays[0] % 2 === 1 ? (xs[middle] + xs[middle + 1]) / 2 : xs[middle] + bay[0] / 2, 0]
    // a high-rise core is caged tighter than a house wall: 10 cm between bars, 7.5 cm above 50 storeys (the pull at the top of a tall core needs the steel)
    const rebar = { spacing: storeys > 50 ? 0.075 : 0.1, ...given.rebar }
    coreOptions = { ...given, wallThickness, elevators, center, rebar, shaftDepth: (given.shaftDepth ?? CORE_DEFAULTS.shaftDepth) + round2(extra) }
    const size = coreSize(coreOptions)
    coreLayout = { center, size, wallThickness, elevators, stairWidth: given.stairWidth ?? CORE_DEFAULTS.stairWidth, shaftDepth: coreOptions.shaftDepth! }
  }
  const damperOn = o.damperAbove !== false && total >= o.damperAbove && o.mechanical !== false
  const tower: TowerOptions = {
    floors: storeys, height: o.height, spanX: span[0], spanZ: span[1], columnsX: bays[0] + 1, columnsZ: bays[1] + 1, columnSize, beamHeight, slabThickness: slab,
    roofThickness: round2(slab + 0.1), columnCage: { ...TOWER_DEFAULTS.columnCage }, core: coreOptions,
    facade: o.facade === 'curtain' ? (o.curtain ?? {}) : false, punched: o.facade === 'punched' ? (o.punchedFacade ?? {}) : false,
    flatRoof: o.flatRoof ?? {}, mechanical: o.mechanical === false ? false : { every: o.mechanicalEvery === false ? undefined : mech, ...o.mechanical },
    damper: damperOn ? (o.damper ?? {}) : false, wind: o.wind === false ? false : o.wind, sizing: o.sizing ?? {},
    raft: true,
  }
  return {
    storeys, height: o.height, slab, pitch, total, bay, span, columnsX: bays[0] + 1, columnsZ: bays[1] + 1, columnSize, beamHeight, plate, core: coreLayout,
    coreRatio: coreLayout ? (coreLayout.size[0] * coreLayout.size[1]) / (plate[0] * plate[1]) : 0, facade: o.facade, mechanical, damper: damperOn, tower,
  }
}

/** Mass in kg of everything above the raft's top face in a spec, plus the raft itself. */
const totalMass = (spec: DestructibleSpec): number => {
  const byId = new Map(MATERIALS.map((m) => [m.id, m]))
  return spec.parts.reduce((sum, part) => sum + (part.mass ?? partMass(part, byId.get(part.material)!)), 0)
}

/**
 * Piles under the raft, by the load: a grid of `pitch` diameters over the raft, each as long as it needs to carry its share of the tower with the
 * NBR 6122 safety (`pileLength`); when that is longer than `maxLength` the grid is closed up and tried again, down to a pitch of 2.5 diameters.
 */
export function pilesFor(spec: DestructibleSpec, soil: string | SoilProfile, design: PileDesign = {}): PileSpec {
  const raft = spec.parts.find((p) => p.id === 'raft')
  if (!raft || raft.shape.kind !== 'box') throw new Error('Piles go under a raft: the spec has none')
  const d = { ...PILE_DEFAULTS, ...design }
  const [sx, sy, sz] = raft.shape.size
  const profile = profileOf(soil)
  const soils = new Map(SOILS.map((s) => [s.id, s]))
  const weight = totalMass(spec) * GRAVITY
  if (design.length !== undefined || design.count !== undefined) {
    const count = design.count ?? Math.max(4, Math.ceil((sx * sz) / (d.pitch * d.diameter) ** 2))
    const length = design.length ?? pileLength(profile, { load: weight / count, diameter: d.diameter, top: sy, method: d.method, maxLength: d.maxLength, soils })
    return { length, diameter: d.diameter, count, method: d.method }
  }
  let pitch: number = d.pitch
  for (;;) {
    const count = Math.max(4, Math.ceil(sx / (pitch * d.diameter)) * Math.ceil(sz / (pitch * d.diameter)))
    const length = pileLength(profile, { load: weight / count, diameter: d.diameter, top: sy, method: d.method, maxLength: d.maxLength, soils })
    if (length < d.maxLength || pitch <= 2.5) return { length, diameter: d.diameter, count, method: d.method }
    pitch = Math.max(2.5, pitch - 0.25)
  }
}

/** The tower of a layout: `buildTower` on a raft, then the soil and, with it, the deep piles sized by the load. */
export function buildSkyscraper(options: SkyscraperOptions = {}, preset: SkyscraperPreset = SKYSCRAPER_DEFAULTS): DestructibleSpec {
  const layout = skyscraperLayout(options, preset)
  const o = { ...SKYSCRAPER_DEFAULTS, ...preset, ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) } as SkyscraperPreset
  const built = buildTower(layout.tower)
  const spec: DestructibleSpec = { ...built, name: 'skyscraper', tags: [...(built.tags ?? []), 'skyscraper'] }
  if (o.soil === false) return spec
  const parts: PartSpec[] = spec.parts.map((part) => {
    if (part.id !== 'raft') return part
    return o.piles === false ? { ...part, structure: { ...part.structure!, role: 'foundation' } } : { ...part, structure: { ...part.structure!, role: 'foundation', pile: pilesFor(spec, o.soil as string | SoilProfile, o.piles) } }
  })
  return { ...spec, parts, soil: o.soil }
}
