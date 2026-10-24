import { applyPatches, mergeById, removeIds } from '@adatechnology/game-contracts'
import type { DeepPartial } from '@adatechnology/game-contracts'
import { createSilhouetteRandom } from '@adatechnology/game-floorplan'

import { drawBuilding, fillBlock, DEFAULT_FACADES } from './block'
import type { BlockBuilding, BuildingOptions, FillBlockOptions } from './block'
import { createLightBudget } from './budget'
import { DEFAULT_POLES, POLE_SHAPES } from './poles'
import type { PoleDef, PoleOptions, PoleShapeBuilder } from './poles'
import { drawContainer, drawFence, drawPine, drawSandbags, drawStripLabel, drawTent, drawTree, drawWatchtower, drawWires, DEFAULT_PROP_COLORS } from './props'
import type { PropColors } from './props'
import { createUrbanBuilder } from './scene'
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
  packs?: { poles?: readonly PoleDef[] }
  /** Numbers changed on shipped entries, by id (objects merge, arrays replace). */
  patch?: { poles?: Record<string, DeepPartial<PoleDef>> }
  /** Ids taken out of the catalogues. */
  remove?: { poles?: readonly string[] }
  /** Shape builders for the poles a pack adds; the five of the Galeria are always there. */
  shapes?: Readonly<Record<string, PoleShapeBuilder>>
  lights?: { budget?: number }
  streets?: StreetOptions
  /** Facade colours of the city buildings. */
  facades?: readonly number[]
  props?: Partial<PropColors>
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
  const lightBudget = options.lights?.budget ?? DEFAULT_LIGHT_BUDGET
  const facades = options.facades ?? DEFAULT_FACADES
  const propColors: PropColors = { ...DEFAULT_PROP_COLORS, ...options.props }

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

  return {
    poles,
    /** A builder with its own seeded generator and light budget. */
    builder: (o: BuilderOptions = {}): UrbanBuilder =>
      createUrbanBuilder(o.random ?? createSilhouetteRandom(o.seed ?? DEFAULT_URBAN_SEED), { budget: createLightBudget(o.budget ?? lightBudget) }),
    streets: {
      road: (b: UrbanBuilder, x: number, z: number, w: number, l: number, along: 'x' | 'z') => drawRoad(b, x, z, w, l, along, options.streets),
      walk: (b: UrbanBuilder, x: number, z: number, w: number, d: number) => drawWalk(b, x, z, w, d, options.streets),
      ground: drawGround,
      grid: (b: UrbanBuilder, g: { block: number; count: number; width: number }) => drawStreetGrid(b, g.block, g.count, g.width, options.streets),
    },
    block: {
      facades,
      building: (b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, o?: BuildingOptions): BlockBuilding => drawBuilding(b, x, z, width, depth, height, color, o),
      fill: (b: UrbanBuilder, g: { cx: number; cz: number; size: number; minHeight: number; maxHeight: number } & FillBlockOptions): BlockBuilding[] =>
        fillBlock(b, g.cx, g.cz, g.size, g.minHeight, g.maxHeight, { palette: facades, ...g }),
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
}
