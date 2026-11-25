import type * as THREE_NS from 'three'

import { engine } from '@adatechnology/game-floorplan'
import type { FloorplanResult } from '@adatechnology/game-floorplan'
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { create as createFloorplanInteractables } from '@adatechnology/game-floorplan-interactables'
import { register as registerPostApocalyptic } from '@adatechnology/game-floorplan-post-apocalyptic'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register as registerRural } from '@adatechnology/game-floorplan-rural'
import { register as registerStructure } from '@adatechnology/game-floorplan-structure'
import { create as createHouseRenderer, planLod, registerHouseQueues } from '@adatechnology/game-floorplan-three'
import type { House, HouseRendererOptions } from '@adatechnology/game-floorplan-three'
import * as GameInteractables from '@adatechnology/game-interactables'
import * as GameInteractablesHousehold from '@adatechnology/game-interactables-household'
import * as GameInteractablesThree from '@adatechnology/game-interactables-three'
import * as GameVegetation from '@adatechnology/game-vegetation'
import * as GameVegetationThree from '@adatechnology/game-vegetation/three'
import * as GameVegetationSpecies from '@adatechnology/game-vegetation-species'
import type { PlanRect } from '@adatechnology/game-urban'

import { lotPlacement, overflowOf } from '../placement'
import type { HousePlacement, HouseSize } from '../placement'
import { seedOf } from '../seed'
import type { Lot, Site } from '../site'
import type { KitWorld } from '@adatechnology/game-kit-defaults/world'

/** Draw calls the houses share: the nearest stay complete, the farther lose the small pieces, the farthest vanish (`planLod`, N10). */
const HOUSE_DRAW_CALL_BUDGET = 900
const PLAN_EVERY_SECONDS = 0.25
/** The interior and the whole house are drawn no farther than this (metres): only the houses near the player are enterable. */
const HOUSE_LOD_DISTANCE = { interior: 48, hide: 260 } as const

export type PlacedHouse = {
  readonly lot: Lot
  readonly plan: FloorplanResult
  readonly house: House
  readonly placement: HousePlacement
  /** The house's footprint in the world, metres. */
  readonly footprint: PlanRect
  readonly overflow: { readonly along: number; readonly deep: number }
}

export type Houses = {
  readonly list: readonly PlacedHouse[]
  readonly renderer: ReturnType<typeof createHouseRenderer>
  /** Cuts or restores the grid of one lot's house (an outage of its circuit): each house has its own interactables world. False for a lot with no house or no interactables. */
  setLotGrid(lot: string, on: boolean): boolean
  /** Steps the doors, the wind and the level of detail; the focus is the camera. */
  update(dt: number, time: number, focus: { readonly x: number; readonly y: number; readonly z: number }): void
  dispose(): void
}

/** What `setLotGrid` reads of a placed house: its lot and its own interactables world. */
export type LotPower = { readonly lot: { readonly id: string }; readonly house: { readonly interactives: { readonly world: { readonly power: { setGrid(on: boolean): void } } } | null } }

/** Cuts or restores the grid of one lot's house, in that house's own interactables world; false for a lot with no house or no interactables. */
export function setLotGrid({ list, lot, on }: { readonly list: readonly LotPower[]; readonly lot: string; readonly on: boolean }): boolean {
  const power = list.find((placed) => placed.lot.id === lot)?.house.interactives?.world.power
  if (!power) return false
  power.setGrid(on)
  return true
}

let isRegistered = false
/** Puts the content packs in the shared engine, once: the residential pack first, the structure pack gives every plan its pillars, beams and roof, the post-apocalyptic one the states. */
export function registerPacks(): typeof engine {
  if (isRegistered) return engine
  registerResidential(engine, { region: 'br' })
  registerCommercial(engine, { region: 'br' })
  registerRural(engine, { region: 'br' })
  registerStructure(engine)
  registerPostApocalyptic(engine)
  isRegistered = true
  return engine
}

/** The engine's state for a lot: `none` is the normal house, `draw` (or none given) leaves the choice to the state plugin, which draws it from the seed (35 % fortified, 45 % abandoned, 20 % normal). */
export function stateOfLot(lot: Lot): string | undefined {
  if (lot.state === 'none') return 'normal'
  return lot.state === 'draw' || lot.state === undefined ? undefined : lot.state
}

/** The plan's size, with the depth of its own lot in front of the facade (`lot.rect[1]` is negative when the lot has a front yard). */
export const houseSizeOf = (plan: FloorplanResult): HouseSize => ({ width: Number(plan.w) || 10, depth: Number(plan.d) || 10, yard: Math.max(0, -(plan.lot?.rect[1] ?? 0)) })

/** The footprint of a placed house: its width along the street and its depth into the lot, turned as the front says. */
function footprintOf(placement: HousePlacement, size: HouseSize): PlanRect {
  const a = [placement.x, placement.z] as const
  const cos = Math.round(Math.cos(placement.ry))
  const sin = Math.round(Math.sin(placement.ry))
  // a point (u, v) of the plan is at (x + u cos + v sin, z - u sin + v cos) in the world (rotation about y)
  const b = [a[0] + size.width * cos + size.depth * sin, a[1] - size.width * sin + size.depth * cos] as const
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]
}

/** A lot's plan, generated and placed before anything is drawn: the streets read its doors, gates and entrance to stand their poles and run its drop. */
export type PlannedLot = { readonly lot: Lot; readonly plan: FloorplanResult; readonly size: HouseSize; readonly placement: HousePlacement }

/**
 * The plan of every lot of the site (`engine.generate`, by the lot's typology, seed and state), on a street with a utility network (`street: 'network'`: the meter post stands inside
 * the lot and the house declares its connections), placed on its lot facing the street.
 */
export function planLots(site: Site): PlannedLot[] {
  const engine = registerPacks()
  return site.lots.map((lot): PlannedLot => {
    const plan = engine.generate(lot.typology, { seed: seedOf(site.seed, lot.id), street: 'network', ...(stateOfLot(lot) === undefined ? {} : { state: stateOfLot(lot) }) })
    const size = houseSizeOf(plan)
    return { lot, plan, size, placement: lotPlacement(lot.rect, lot.front, size) }
  })
}

export type HousesParams = {
  readonly THREE: typeof THREE_NS
  readonly world: KitWorld
  readonly scene: THREE_NS.Object3D
  readonly lots: readonly PlannedLot[]
}

/**
 * The houses of the site: the plan of every lot (`planLots`), drawn by `game-floorplan-three` with the
 * interactables and the vegetation of the kit, standing on its lot facing the street and registered in the world's destruction. The distance level of detail (`planLod`) keeps only the near houses
 * complete: the others lose their interior and, far away, vanish.
 */
export function createHouses({ THREE, world, scene, lots }: HousesParams): Houses {
  const options: HouseRendererOptions = {
    locale: 'pt-BR',
    quality: 'game',
    lod: HOUSE_LOD_DISTANCE,
    destruction: world.destruction.world,
    destructionRenderer: world.destruction.renderer,
    interactives: { adapter: { create: createFloorplanInteractables }, GameInteractables, GameInteractablesHousehold, GameInteractablesThree, effectSink: () => world.effects },
    vegetation: { GameVegetation: { ...GameVegetation, ...GameVegetationThree }, GameVegetationSpecies },
  }
  const renderer = createHouseRenderer(THREE, options)
  const unregister = registerHouseQueues(renderer, world.frame.scheduler.budget)
  const list = lots.map(({ lot, plan, size, placement }): PlacedHouse => {
    const house = renderer.build(plan, { quality: 'game', terrain: false })
    house.group.rotation.y = placement.ry
    house.group.position.set(placement.x, 0, placement.z)
    house.group.updateMatrixWorld(true)
    scene.add(house.group)
    house.destruction.activate()
    return { lot, plan, house, placement, footprint: footprintOf(placement, size), overflow: overflowOf(lot.rect, lot.front, size) }
  })
  let sincePlan = PLAN_EVERY_SECONDS
  return {
    list,
    renderer,
    setLotGrid(lot, on) {
      return setLotGrid({ list, lot, on })
    },
    update(dt, time, focus) {
      sincePlan += dt
      if (sincePlan >= PLAN_EVERY_SECONDS) {
        sincePlan = 0
        planLod(list.map((placed) => placed.house), focus, HOUSE_DRAW_CALL_BUDGET)
      }
      for (const placed of list) placed.house.update(dt, time)
    },
    dispose() {
      unregister()
      for (const placed of list) placed.house.dispose()
      renderer.dispose?.()
    },
  }
}
