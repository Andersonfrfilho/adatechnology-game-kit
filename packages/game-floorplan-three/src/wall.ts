import type { WarmUpProbes } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import type { Hit } from '@adatechnology/game-destruction'
import { buildStructure, masonryConstruction } from '@adatechnology/game-floorplan-structure'
import type { Construction, SourceWall, Structure } from '@adatechnology/game-floorplan-structure'

import { create } from './create.js'
import type * as THREE from 'three'
import type { DestructibleSpec } from '@adatechnology/game-contracts'
import type { DestructionWorld } from '@adatechnology/game-destruction'
import type { HouseFollow } from './destruction/types.js'
import type { HouseRecord, Three } from './kernel-types.js'
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
  readonly plan: WallPlan
  /** The destructible spec, as a house gives it (`house.structure.spec()`): the wall with its layers, units and breach on the ground, its concrete pillars (`wall_column_*`, at the ends and every 4 m at most) and the bond beam on both. */
  readonly spec: DestructibleSpec
  /** Draws the wall with the house renderer: meshes carry `userData.destructionPart` of their part, in the space of the spec. */
  build(THREE: Three): THREE.Group
  /**
   * Once a drawing from `build` is in a destruction world as `objectId` (with this `spec`), the house renderer follows its events and draws on it what
   * a generic destruction renderer cannot: the bricks that shots and blows knock out (`chip`) and the opening of a breach, as gaps in the wall's
   * courses. `restore` puts the wall back (after `world.reset`), `dispose` stops following. `update` paints the damage of the events since the last call, once
   * per wall (call it every frame; without it the damage is painted 100 ms after the event). `blocks` says whether the wall, as drawn now, stops a body.
   */
  follow(root: THREE.Object3D, world: DestructionWorld, objectId: string): HouseFollow | null
  /**
   * The wall drawn with one brick shot out of it, for a host to draw once at load (`WarmUpProbes`): the breach's materials (the shell around the hole and
   * the bricks laid bare, instanced, lit and in the shadows) get their shader programs then, not at the first shot or blast of play. `dispose` frees its
   * geometries and textures and leaves its materials to the host's warmup, which keeps them so the programs stay.
   */
  warmUpProbes(THREE: unknown): WarmUpProbes
}

/** A rifle round at the middle of the wall: it knocks a brick out, so the breach draws its shell and its bare bricks. */
const WARM_UP_SHOT: Hit = { type: 'ballistic', point: [0, 1.2, 0.1], direction: [0, 0, -1], energy: 3500, caliber: 7.62 }
const WARM_UP_FRAMES = 5

/** What the probe reads of the drawing (structural: three.js objects fit). */
type ProbeTexture = { readonly isTexture?: boolean; dispose(): void }
type ProbeMaterial = { readonly uniforms?: Record<string, { readonly value?: unknown }>; readonly map?: ProbeTexture | null }
type ProbeNode = { visible: boolean; frustumCulled: boolean; readonly geometry?: { dispose(): void }; readonly material?: ProbeMaterial | ProbeMaterial[] }
type ProbeRoot = { traverse(visit: (node: ProbeNode) => void): void }
type ProbeHouse = {
  readonly destruction?: {
    follow?(world: unknown, objectId: string, spec: unknown): { update?(): void } | null
    readonly breach?: { flush?(budgetMs: number): number }
  }
}

const isTexture = (value: unknown): value is ProbeTexture => typeof value === 'object' && value !== null && (value as ProbeTexture).isTexture === true

const PLASTER = 0xe8e2d4
const WALL_ID = 'wall_0_0'

/** The plan of a free-standing wall, with its construction and structure. */
export type WallPlan = HouseRecord & { construction: Construction; structure: Structure }

/**
 * The plan of a free-standing wall along x, centred on the origin: a one-storey plan whose only wall is exterior on both sides, with the masonry construction of
 * the houses (brick, concrete bond beam, strip footing) and the structure `buildStructure` gives the houses, without a roof.
 */
export function wallPlan(options: WallPieceOptions): WallPlan {
  const { w, h, thickness = 0.15, finish = 'plaster', color = PLASTER } = options
  const facade = { finish, roof: 'none', floors: 1 }
  const wall: SourceWall & { id: string; sides: string[]; exterior: boolean; type: string; h: number } = { id: WALL_ID, floor: 0, axis: 'u', u0: -w / 2, v0: 0, u1: w / 2, v1: 0, thickness, sides: ['outside', 'outside'], exterior: true, type: 'wall', h }
  const plan = {
    template: 'wall', name: 'wall', style: 'mid', state: 'normal', w, d: thickness,
    floors: [{ index: 0, y0: 0, ceiling: h }], rooms: [] as HouseRecord['rooms'], walls: [wall], doors: [] as HouseRecord['doors'], windows: [] as HouseRecord['windows'], items: [] as HouseRecord['items'], stateItems: [] as HouseRecord['items'], openPairs: [] as unknown[], partyWalls: [] as unknown[], missing: [] as unknown[],
    facade, colors: { facade: color, wall: color }, lot: null, building: null, waterTank: null, outbuildings: [],
  }
  const construction = masonryConstruction({ ...plan, facade: { ...facade, roof: 'colonial' } })
  const structure = buildStructure({ ...plan, construction }, { wallDetail: 'coarse', construction, roof: false })
  return Object.assign(plan, { construction, structure }) as unknown as WallPlan /* the plan of one wall: the fields of a house plan it needs */
}

function draw(THREE: Three, plan: HouseRecord, options: Partial<HouseRendererOptions>): House {
  return create(THREE, { ...options, fleet: null }).build(plan, { quality: 'game', terrain: false, noPerimeter: true, pieces: 'meshes' })
}

/** The house each drawing of `build` came from (its root is the house's group). */
const houses = new WeakMap<object, House>()

/** Labels the meshes of each structural piece with its part id, so a destruction renderer binds them by `userData.destructionPart`. */
function label(house: House): THREE.Group {
  houses.set(house.group, house)
  for (const [id, items] of Object.entries<(THREE.Object3D | { mesh: THREE.Object3D })[]>(house.destruction.ranges())) {
    for (const item of items) {
      const object = 'isObject3D' in item ? item : item.mesh
      object.userData.destructionPart = id
    }
  }
  return house.group
}

/**
 * A free-standing wall (a target wall, a garden wall) built and drawn exactly as the walls of the houses: the structure of `game-floorplan-structure` (the wall on
 * the strip footing, the bond beam on it, the assembly's layers, units and breach) and the house renderer's plaster, paint, baseboard and sidewalk.
 */
export function wallPiece(THREE: Three, options: WallPieceOptions): WallPiece {
  const plan = wallPlan(options)
  const houseOptions = options.house ?? {}
  // no world: the wall is drawn once to describe its structure, as the houses' specimens are. The wall keeps the detail of the houses' walls (its
  // assembly's plaster, bricks and breach), so shots wear the brick they hit and knock it out
  const probe = draw(THREE, plan, { ...houseOptions, destruction: undefined, destructionRenderer: undefined })
  const spec: DestructibleSpec = probe.structure.spec()
  probe.dispose()
  return {
    plan,
    spec,
    build: (T: Three) => label(draw(T, plan, houseOptions)),
    follow: (root: THREE.Object3D, world: DestructionWorld, objectId: string) => houses.get(root)?.destruction?.follow?.(world, objectId, spec) ?? null,
    warmUpProbes: (T: unknown): WarmUpProbes => {
      const house = draw(T as Three, plan, houseOptions)
      const root = label(house) as ProbeRoot
      const world = createDestruction({ seed: 1 })
      const objectId = world.add(spec, { id: 'warm_up_wall' })
      const destruction = (house as unknown as ProbeHouse).destruction
      const follower = destruction?.follow?.(world, objectId, spec) ?? null
      world.hitPart(objectId, WALL_ID, WARM_UP_SHOT)
      for (let frame = 0; frame < WARM_UP_FRAMES; frame++) {
        world.update(1 / 60)
        follower?.update?.()
      }
      // paint all of it now: in a room the breach paints within the frame budget, and the probe is drawn before any frame runs
      for (let guard = 0; guard < WARM_UP_FRAMES && (destruction?.breach?.flush?.(Infinity) ?? 0) > 0; guard++);
      // drawn whatever the camera: the breach hides its bricks from afar (its level of detail), and an object that is not drawn builds no program
      root.traverse((node) => {
        node.visible = true
        node.frustumCulled = false
      })
      return {
        group: root,
        // the materials stay: the warmup keeps them as anchors, and disposing the last material of a program frees the program it was drawn for (so the
        // follower is not disposed either: it would put the wall back and dispose the breach's materials; its world goes with the probe)
        dispose: () => {
          root.traverse((node) => {
            node.geometry?.dispose()
            for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
              for (const uniform of Object.values(material.uniforms ?? {})) if (isTexture(uniform.value)) uniform.value.dispose()
              material.map?.dispose()
            }
          })
        },
      }
    },
  }
}
