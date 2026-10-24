import type { HouseRendererOptions } from '../types.js'

/** The part of the floorplan engine (`engine` of `@adatechnology/game-floorplan`, with the content packs the page registered) the test area reads. */
export interface FloorplanEngineLike {
  generate(template: string, options?: { seed?: number; state?: string }): any
  listTemplates(): Array<{ id: string; name?: string; floors?: number }>
  listStates(): string[]
  translate?(namespace: any, key: string, locale?: string, vars?: Record<string, string | number>): string
}

/** A pack of templates the bench lists together (residential, commercial, rural, post-apocalyptic). Ids the engine does not know are left out. */
export interface TemplateGroup {
  id: string
  /** Name by locale (`en`, `pt-BR`); the id when absent. */
  name?: Record<string, string>
  templates: readonly string[]
}

/** A small house the area lays out for the structural scenarios: the structure spec of a template, drawn as boxes named by part (the team's HouseArea items). */
export interface SpecimenDef {
  /** Item id (`house_casa_portico`): the scenarios and the golden name them. */
  id: string
  template: string
  seed?: number
  state?: string
  /** The bearing walls only close: a frame of pillars and beams carries the building. */
  portico?: boolean
  /**
   * How the structure is sized (`toDestructibleSpec`): `safety` is the share of its capacity a pillar uses at rest, `redundancy` the most it uses after one other pillar is lost.
   * A slab on four pillars is held by the sum of the four: with `safety` 0.72 and `redundancy` 0.97 it holds one loss (0.96) and falls with two.
   */
  sizing?: { safety?: number; redundancy?: number; safetyOthers?: number }
  /** Name by locale; the text of the area when absent. */
  name?: Record<string, string>
}

export interface FloorplanTestOptions {
  locale?: string
  /** The engine with the packs registered. Without it the module has no houses to build. */
  engine?: FloorplanEngineLike
  /** The packs the bench lists, in order. Default: every template of the engine in one group. */
  groups?: readonly TemplateGroup[]
  /** The states the bench offers (`normal`, `fortified`, `abandoned`). Default: the engine's. */
  states?: readonly string[]
  /** The room's destruction world and renderer (`room.world`, `room.renderer`): the houses built here register in them, so every shot, blast and fire of the room reaches the walls. */
  world?: any
  renderer?: any
  /** Passed to the house renderer: `fleet`, `reflector`, `interactives`, `vegetation`, `props`, `textures`... */
  house?: Partial<HouseRendererOptions>
  /** Template and seed the bench starts with. */
  template?: string
  seed?: number
  /** Specimens of the structural scenarios; default the five of the team's house area, those whose template the engine has. */
  specimens?: readonly SpecimenDef[]
  /** Half size of the room's arena (`createTestRoom({ arenaSize })`), 14 by default: where the houses are laid. */
  arenaSize?: number
  /** Where the specimens stand for the scenarios (the team's page: `[-5, 0, -11]`). */
  specimenAt?: readonly [number, number, number]
}
