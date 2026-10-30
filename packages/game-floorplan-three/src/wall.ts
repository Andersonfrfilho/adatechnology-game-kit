import { buildStructure, masonryConstruction } from '@adatechnology/game-floorplan-structure'

import { create } from './create.js'
import type { House, HouseRendererOptions } from './types.js'

/** A free-standing wall built and drawn as the walls of the houses. */
export interface WallPieceOptions {
  /** Length and height in metres. */
  w: number
  h: number
  /** Default 0.15 m, the houses' wall. */
  thickness?: number
  /** Facade finish of the houses: `plaster` (default), `roughcast` or `exposed_block`. */
  finish?: string
  /** Paint colour of the plaster (default the light plaster of the houses' palette). */
  color?: number
  /** Options of the house renderer (`create`) that draws it. */
  house?: Partial<HouseRendererOptions>
}

export interface WallPiece {
  /** The plan of the wall: one storey, one exterior wall, no rooms and no roof; its `structure` is the houses' load path. */
  readonly plan: any
  /** The destructible spec, as a house gives it (`house.structure.spec()`): the wall with its layers, units and breach on the ground, and the bond beam on it. */
  readonly spec: any
  /** Draws the wall with the house renderer: meshes carry `userData.destructionPart` of their part, in the space of the spec. */
  build(THREE: any): any
  /**
   * Once a drawing from `build` is in a destruction world as `objectId` (with this `spec`), the house renderer follows its events and draws on it what
   * a generic destruction renderer cannot: the bricks that shots and blows knock out (`chip`) and the opening of a breach, as gaps in the wall's
   * courses. `restore` puts the wall back (after `world.reset`), `dispose` stops following.
   */
  follow(root: any, world: any, objectId: string): { restore(): void; dispose(): void } | null
}

const PLASTER = 0xe8e2d4
const WALL_ID = 'wall_0_0'

/**
 * The plan of a free-standing wall along x, centred on the origin: a one-storey plan whose only wall is exterior on both sides, with the masonry construction of
 * the houses (brick, concrete bond beam, strip footing) and the structure `buildStructure` gives the houses, without a roof.
 */
export function wallPlan(options: WallPieceOptions): any {
  const { w, h, thickness = 0.15, finish = 'plaster', color = PLASTER } = options
  const facade = { finish, roof: 'none', floors: 1 }
  const wall = { id: WALL_ID, floor: 0, axis: 'u', u0: -w / 2, v0: 0, u1: w / 2, v1: 0, thickness, sides: ['outside', 'outside'], exterior: true, type: 'wall', h }
  const plan: any = {
    template: 'wall', name: 'wall', style: 'mid', state: 'normal', w, d: thickness,
    floors: [{ index: 0, y0: 0, ceiling: h }], rooms: [], walls: [wall], doors: [], windows: [], items: [], stateItems: [], openPairs: [], partyWalls: [], missing: [],
    facade, colors: { facade: color, wall: color }, lot: null, building: null, waterTank: null, outbuildings: [],
  }
  plan.construction = masonryConstruction({ ...plan, facade: { ...facade, roof: 'colonial' } })
  plan.structure = buildStructure(plan, { wallDetail: 'coarse', construction: plan.construction, roof: false })
  return plan
}

function draw(THREE: any, plan: any, options: Partial<HouseRendererOptions>): House {
  return create(THREE, { ...options, fleet: null }).build(plan, { quality: 'game', terrain: false, noPerimeter: true, pieces: 'meshes' })
}

/** The house each drawing of `build` came from (its root is the house's group). */
const houses = new WeakMap<object, House>()

/** Labels the meshes of each structural piece with its part id, so a destruction renderer binds them by `userData.destructionPart`. */
function label(house: House): any {
  houses.set(house.group, house)
  for (const [id, items] of Object.entries<any[]>(house.destruction.ranges())) {
    for (const item of items) {
      const object = item.isObject3D ? item : item.mesh
      object.userData.destructionPart = id
    }
  }
  return house.group
}

/**
 * A free-standing wall (a target wall, a garden wall) built and drawn exactly as the walls of the houses: the structure of `game-floorplan-structure` (the wall on
 * the strip footing, the bond beam on it, the assembly's layers, units and breach) and the house renderer's plaster, paint, baseboard and sidewalk.
 */
export function wallPiece(THREE: any, options: WallPieceOptions): WallPiece {
  const plan = wallPlan(options)
  const houseOptions = options.house ?? {}
  // no world: the wall is drawn once to describe its structure, as the houses' specimens are. The wall keeps the detail of the houses' walls (its
  // assembly's plaster, bricks and breach), so shots wear the brick they hit and knock it out
  const probe = draw(THREE, plan, { ...houseOptions, destruction: undefined, destructionRenderer: undefined })
  const spec = probe.structure.spec()
  probe.dispose()
  return {
    plan,
    spec,
    build: (T: any) => label(draw(T, plan, houseOptions)),
    follow: (root: any, world: any, objectId: string) => (houses.get(root) as any)?.destruction?.follow?.(world, objectId, spec) ?? null,
  }
}
