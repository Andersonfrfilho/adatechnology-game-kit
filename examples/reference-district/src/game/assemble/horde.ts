import type * as THREE_NS from 'three'

import { createBestBuilder } from '@adatechnology/game-characters-three'
import { UNDEAD_TYPES, undeadCrowdPack } from '@adatechnology/game-characters-undead'
import type { NavObstacleSource } from '@adatechnology/game-contracts'
import { CELL, CROWD_PHYSICS_DEFAULTS, bindNavObstacles, createCrowd, createNavGrid, createRng } from '@adatechnology/game-crowd'
import type { Crowd, NavGrid } from '@adatechnology/game-crowd'
import { createCrowdRenderer } from '@adatechnology/game-crowd-three'
import type { CrowdRenderer } from '@adatechnology/game-crowd-three'
import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import type { Player } from '@adatechnology/game-player'
import type { PlanRect } from '@adatechnology/game-urban'

import { pointsIn, zoneCounts } from '../horde-plan'
import type { Site } from '../site'

/** The nav grid is as big as the district: a cell is half a metre, and the horde's physics copies its occupancy every step. */
const NAV_GRID_SIZE = 480
const CROWD_CAPACITY_MARGIN = 64
const VEHICLE_HEIGHT = 1.6
const BODY_BAKE_SEED = 11

export type Horde = {
  readonly crowd: Crowd
  readonly renderer: CrowdRenderer
  readonly grid: NavGrid
  /** Brings `count` more agents into a zone of the site, from the crowd's own stream. */
  release(zoneId: string, count: number): number
  /** One fixed step of the crowd: who sees, hears and chases whom. */
  step(dt: number, context: { readonly nightFactor: number; readonly viewYaw: number }): void
  /** One frame of the drawing: the bodies, the corpses, the levels of detail. */
  draw(dt: number, viewYaw: number): void
  dispose(): void
}

export type HordeParams = {
  readonly THREE: typeof THREE_NS
  readonly world: KitWorld
  readonly site: Site
  readonly zombies: number
  readonly zones: readonly string[]
  /** Room for agents released after the start (default none). */
  readonly reserve?: number
  readonly grid: NavGrid
  /** The houses' walls, lot walls, doors and gates (`createHouseNavObstacles`): written into the grid and followed as doors open and walls are cut. */
  readonly obstacles: NavObstacleSource
  /** Where no zombie is born (the houses' footprints: none starts shut in a room). */
  readonly keepOut: readonly PlanRect[]
  /** What the horde hunts: the player's body. */
  readonly target: Player
}

/**
 * The nav grid of the district: the buildings the city placed (each at its own footprint, so the gaps between them are open) and the vehicles as solid cells, the same grid the player walks on.
 * The houses are not rectangles here: the horde binds their own walls, lot walls, doors and gates (`createHouseNavObstacles` of `game-floorplan-three`) when it is made.
 */
export type DistrictSolids = { readonly buildings: ReadonlyArray<{ readonly rect: PlanRect; readonly height: number }>; readonly vehicles: readonly PlanRect[] }

export function createDistrictGrid(solids: DistrictSolids): NavGrid {
  const grid = createNavGrid({ size: NAV_GRID_SIZE })
  for (const { rect, height } of solids.buildings) grid.fillRect(rect[0], rect[1], rect[2], rect[3], CELL.SOLID, height)
  for (const rect of solids.vehicles) grid.fillRect(rect[0], rect[1], rect[2], rect[3], CELL.SOLID, VEHICLE_HEIGHT)
  return grid
}

const isInside = (rects: readonly PlanRect[], x: number, z: number): boolean => rects.some((rect) => x >= rect[0] && x <= rect[2] && z >= rect[1] && z <= rect[3])

/**
 * The horde of the district: the crowd of `game-crowd` with the undead pack of `game-characters-undead` on the district's grid, its bodies baked by the Bestiary builder of
 * `game-characters-three` and drawn in a few draw calls by `game-crowd-three`. Each zone of the site gets its share of the zombies, from the crowd's own seeded stream: same seed, same horde.
 */
export function createHorde({ THREE, world, site, zombies, zones, grid, obstacles, keepOut, target, reserve = 0 }: HordeParams): Horde {
  const crowd = createCrowd({
    pack: undeadCrowdPack(),
    seed: site.seed,
    grid,
    capacity: zombies + reserve + CROWD_CAPACITY_MARGIN,
    water: (x, z) => world.ground.terrain.waterAt(x, z) !== null,
    physics: { ...CROWD_PHYSICS_DEFAULTS, ...(world.workers.coordinator ? { workers: world.workers.coordinator } : { worker: 'off' as const }) },
  })
  crowd.target = target
  // the houses stand in the grid as their walls and doors: a zombie walks round a wall, comes in through an open door or gate, and hits a closed one until it breaks
  const houseObstacles = bindNavObstacles(crowd, obstacles)
  const best = createBestBuilder(THREE, { types: UNDEAD_TYPES.map((card) => ({ name: card.name['pt-BR'] ?? card.id, eye: Number.parseInt(card.eye.color, 16) })), random: createRng(BODY_BAKE_SEED) })
  const renderer = createCrowdRenderer(THREE, {
    crowd,
    builders: {
      buildBest: (spec, lod) => {
        best.setLOD(lod)
        return best.build(spec)
      },
      topMaterial: () => best.topM(),
    },
    typeName: (type) => UNDEAD_TYPES.find((card) => card.id === type.id)?.name['pt-BR'] ?? type.id,
  })
  world.view.scene.add(renderer.group)
  const zoneOf = new Map(site.hordes.map((zone) => [zone.id, zone]))
  const release = (zoneId: string, count: number): number => {
    const zone = zoneOf.get(zoneId)
    if (!zone) throw new Error(`the site has no horde zone "${zoneId}"`)
    const isFree = (x: number, z: number): boolean => !grid.blocked(x, z) && !isInside(keepOut, x, z)
    const points = pointsIn({ rect: zone.rect, count, random: crowd.random, isFree })
    for (const point of points) crowd.spawn(point.x, point.z)
    return points.length
  }
  const chosen = site.hordes.filter((zone) => zones.includes(zone.id))
  for (const [zoneId, count] of zoneCounts(chosen, zombies)) release(zoneId, count)
  return {
    crowd,
    renderer,
    grid,
    release,
    step(dt, context) {
      houseObstacles.sync()
      crowd.updateTrail(dt)
      crowd.update(dt, { nightFactor: context.nightFactor, viewYaw: context.viewYaw })
      crowd.updateCorpses(dt)
    },
    draw(dt, viewYaw) {
      renderer.update(dt, { camera: { x: world.view.camera.position.x, z: world.view.camera.position.z }, viewYaw, target: { x: target.state.x, z: target.state.z, alive: target.state.alive } })
    },
    dispose() {
      houseObstacles.dispose()
      world.view.scene.remove(renderer.group)
      renderer.dispose()
      crowd.dispose()
    },
  }
}
