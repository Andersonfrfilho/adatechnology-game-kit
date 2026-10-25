import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'
import { createSilhouetteRandom } from '@adatechnology/game-floorplan'

import { drawBuilding, fillBlock, DEFAULT_FACADES } from './block'
import type { BlockBuilding, BuildingOptions, FillBlockOptions } from './block'
import { createLightBudget } from './budget'
import { createTowerDrawer, DEFAULT_TOWER_PRESETS } from './tower'
import type { TowerOptions } from './tower'
import { DEFAULT_POLES, POLE_SHAPES } from './poles'
import type { PoleDef, PoleOptions, PoleShapeBuilder } from './poles'
import { drawContainer, drawFence, drawPine, drawSandbags, drawStripLabel, drawTent, drawTree, drawWatchtower, drawWires, DEFAULT_PROP_COLORS } from './props'
import type { PropColors } from './props'
import { composePattern, patternMarker, SAMPLE_GROUND } from './neighbourhoods/compose'
import type { Origin, SampleSheetOptions } from './neighbourhoods/compose'
import { COMPOSERS } from './neighbourhoods/composers'
import { DEFAULT_PATTERNS, SAMPLE_CELLS } from './neighbourhoods/patterns'
import type { ComposeOptions, Composer, Locale, NeighbourhoodPattern, UrbanKitCore, UrbanPlan } from './neighbourhoods/types'
import { createCities } from './cities'
import type { CityPlanInput, DistrictKindDef } from './cities'
import { createUrbanBuilder } from './scene'
import { createTerrain, drawTerrain } from './terrain'
import type { Terrain, TerrainOptions } from './terrain'
import type { UrbanBuilder } from './scene'
import { drawGround, drawRoad, drawStreetGrid, drawWalk } from './streets'
import type { StreetOptions } from './streets'
import type { RandomSource } from './types'

/** Lights a scene may spend: the Galeria spends 16 real point lights. */
export const DEFAULT_LIGHT_BUDGET = 16
/** Seed of the Galeria's generator. */
export const DEFAULT_URBAN_SEED = 7

export type UrbanOptions = {
  /** Entries added to the catalogues (an entry with an existing id replaces it). */
  packs?: { poles?: readonly PoleDef[]; neighbourhoods?: readonly NeighbourhoodPattern<any>[]; districtKinds?: readonly DistrictKindDef[]; cityPlans?: readonly CityPlanInput[] }
  /** Numbers changed on shipped entries, by id (objects merge, arrays replace). */
  patch?: { poles?: Record<string, DeepPartial<PoleDef>>; neighbourhoods?: Record<string, DeepPartial<NeighbourhoodPattern<any>>>; districtKinds?: Record<string, DeepPartial<DistrictKindDef>>; cityPlans?: Record<string, DeepPartial<CityPlanInput>> }
  /** Ids taken out of the catalogues. */
  remove?: { poles?: readonly string[]; neighbourhoods?: readonly string[]; districtKinds?: readonly string[]; cityPlans?: readonly string[] }
  /** Shape builders for the poles a pack adds; the five of the Galeria are always there. */
  shapes?: Readonly<Record<string, PoleShapeBuilder>>
  /** Composers for the patterns a pack adds; the ten of the Galeria are always there. */
  composers?: Readonly<Record<string, Composer>>
  /** City plans (zoning): district kinds and plans are catalogues (`packs`, `patch` and `remove` above, under `districtKinds` and `cityPlans`). */
  cities?: { /** Most storeys a district may have. Default 60. */ maxFloors?: number }
  lights?: { budget?: number }
  streets?: StreetOptions
  /** Facade colours of the city buildings. */
  facades?: readonly number[]
  props?: Partial<PropColors>
  /**
   * Towers on the tall lots, off by default. `true` or an object turns them on: a building of the block or of an avenue at least `minHeight` (60 m) tall is drawn as
   * a tower of one of the `presets` (the office and residential typologies), not as a box; a `provider` replaces the drawing. See `TowerOptions`.
   */
  towers?: boolean | TowerOptions
}

export type Pole = { readonly def: PoleDef; build(b: UrbanBuilder, options: PoleOptions): void }

export type BuilderOptions = {
  /** Seed of the generator when no `random` is given. Default 7. */
  seed?: number
  random?: RandomSource
  /** Lights this scene may spend; default the kit's budget. */
  budget?: number
}

export type UrbanKit = ReturnType<typeof createUrban>

/** The urban pattern as data: poles, streets, blocks and props that add parts to a builder. Knows nothing about three.js, a game or a place. */
export function createUrban(options: UrbanOptions = {}) {
  const entries = mergeById(DEFAULT_POLES, options.packs?.poles)
  applyPatches(entries, options.patch?.poles)
  removeIds(entries, options.remove?.poles)
  const shapes: Record<string, PoleShapeBuilder> = { ...POLE_SHAPES, ...options.shapes }
  const patterns = mergeById(DEFAULT_PATTERNS, options.packs?.neighbourhoods)
  applyPatches(patterns, options.patch?.neighbourhoods)
  removeIds(patterns, options.remove?.neighbourhoods)
  const composers: Record<string, Composer> = { ...COMPOSERS, ...options.composers }
  const lightBudget = options.lights?.budget ?? DEFAULT_LIGHT_BUDGET
  const facades = options.facades ?? DEFAULT_FACADES
  const propColors: PropColors = { ...DEFAULT_PROP_COLORS, ...options.props }

  const towers: TowerOptions | null = options.towers ? (options.towers === true ? {} : options.towers) : null
  const building = (b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, o?: BuildingOptions): BlockBuilding => drawBuilding(b, x, z, width, depth, height, color, o)
  const drawBlockBuilding = towers ? createTowerDrawer(towers, building) : building

  const poles = {
    ids: (): string[] => [...entries.keys()],
    list: (): PoleDef[] => [...entries.values()],
    get(id: string): Pole {
      const def = entries.get(id)
      if (!def) throw new Error(`Unknown pole "${id}"`)
      const shape = shapes[def.shape]
      if (!shape) throw new Error(`Pole "${id}" needs the shape "${def.shape}", which is not registered`)
      return { def, build: (b, o) => shape(b, def.spec, o) }
    },
  }

  const core: UrbanKitCore = {
    poles,
    streets: {
      road: (b: UrbanBuilder, x: number, z: number, w: number, l: number, along: 'x' | 'z') => drawRoad(b, x, z, w, l, along, options.streets),
      walk: (b: UrbanBuilder, x: number, z: number, w: number, d: number) => drawWalk(b, x, z, w, d, options.streets),
      ground: drawGround,
      grid: (b: UrbanBuilder, g: { block: number; count: number; width: number }) => drawStreetGrid(b, g.block, g.count, g.width, options.streets),
    },
    block: {
      facades,
      building: drawBlockBuilding,
      fill: (b: UrbanBuilder, g: { cx: number; cz: number; size: number; minHeight: number; maxHeight: number } & FillBlockOptions): BlockBuilding[] =>
        fillBlock(b, g.cx, g.cz, g.size, g.minHeight, g.maxHeight, { palette: facades, draw: drawBlockBuilding, ...(towers?.presets ? { presets: towers.presets } : {}), ...g }),
    },
    props: {
      fence: drawFence,
      tent: (b: UrbanBuilder, x: number, z: number, ry: number, w: number, d: number, color?: number) => drawTent(b, x, z, ry, w, d, color, propColors),
      pine: (b: UrbanBuilder, x: number, z: number, scale?: number, y?: number) => drawPine(b, x, z, scale, y, propColors),
      tree: (b: UrbanBuilder, x: number, z: number, scale?: number) => drawTree(b, x, z, scale, propColors),
      container: drawContainer,
      watchtower: (b: UrbanBuilder, x: number, z: number, searchlight?: boolean) => drawWatchtower(b, x, z, searchlight, propColors),
      sandbags: (b: UrbanBuilder, x: number, z: number, length: number, along: 'x' | 'z', rows?: number) => drawSandbags(b, x, z, length, along, rows, propColors),
      label: (b: UrbanBuilder, x: number, z: number, title: string, subtitle: string) => drawStripLabel(b, x, z, title, subtitle, propColors),
      wires: (b: UrbanBuilder, points: readonly (readonly [number, number])[], y: number, color?: number) => drawWires(b, points, y, color, propColors),
    },
  }
  /** A builder with its own seeded generator and light budget. */
  const builder = (o: BuilderOptions = {}): UrbanBuilder =>
      createUrbanBuilder(o.random ?? createSilhouetteRandom(o.seed ?? DEFAULT_URBAN_SEED), { budget: createLightBudget(o.budget ?? lightBudget) })
  const neighbourhoods = {
    ids: (): string[] => [...patterns.keys()],
    get(id: string) {
      const pattern = patterns.get(id)
      if (!pattern) throw new Error(`Unknown neighbourhood pattern "${id}"`)
      const composer = composers[pattern.compose]
      if (!composer) throw new Error(`Pattern "${id}" needs the composer "${pattern.compose}", which is not registered`)
      return {
        pattern,
        /** Draws the pattern at `origin` and gives back what it put there. */
        compose: (b: UrbanBuilder, origin: Origin, o?: ComposeOptions): UrbanPlan => composePattern(core, pattern, composer, b, origin, o),
        marker: (origin: Origin, locale?: Locale) => patternMarker(pattern, origin, locale),
      }
    },
    /** The Galeria's sample sheet: the ground, then each pattern in its cell, in the order the page builds them. */
    composeSampleSheet(b: UrbanBuilder, o: SampleSheetOptions = {}) {
      if (o.ground !== false) drawGround(b, (o.ground ?? SAMPLE_GROUND).color, (o.ground ?? SAMPLE_GROUND).size)
      const cells = { ...SAMPLE_CELLS, ...o.cells }
      const plans: UrbanPlan[] = []
      for (const id of o.ids ?? [...patterns.keys()]) {
        const cell = cells[id]
        if (!cell) throw new Error(`The sample sheet has no cell for "${id}"`)
        plans.push(neighbourhoods.get(id).compose(b, cell, o))
      }
      return { plans, markers: plans.map((plan) => neighbourhoods.get(plan.id).marker(plan.origin, o.locale)) }
    },
  }
  /** A ground from its layers (see TerrainOptions): the numbers of the place are the game's. */
  const terrain = (o: TerrainOptions): Terrain => createTerrain(o)
  const cities = createCities({
    maxFloors: options.cities?.maxFloors,
    packs: { kinds: options.packs?.districtKinds, plans: options.packs?.cityPlans },
    patch: { kinds: options.patch?.districtKinds, plans: options.patch?.cityPlans },
    remove: { kinds: options.remove?.districtKinds, plans: options.remove?.cityPlans },
    presets: towers?.presets ?? DEFAULT_TOWER_PRESETS,
    fill: core.block.fill,
  })
  return { ...core, poles, cities, builder, neighbourhoods, terrain, drawTerrain, towers: { enabled: towers !== null, options: towers } }
}
