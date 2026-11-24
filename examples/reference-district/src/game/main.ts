import type * as THREE_NS from 'three'

import { createKitWorkers } from '@adatechnology/game-kit-defaults'
import { createKitWorld } from '@adatechnology/game-kit-defaults/world'
import { sourceSpawn } from '@adatechnology/game-workers'

import { createDistrictGrid, createHorde } from './assemble/horde'
import { createHouses } from './assemble/houses'
import { createPlayerRig } from './assemble/player'
import { createProps } from './assemble/props'
import { drawStreets } from './assemble/streets'
import { createDistrictWeather } from './assemble/weather'
import { groundLayoutOf, terrainBoundsOf } from './ground'
import { createMissingBoxes } from './missing'
import type { District, DistrictOptions } from './options'
import { createReferenceUrban, referencePlan } from './plan'
import { referenceSite } from './reference'

const DEFAULT_START = { x: 30, z: 0, yaw: -Math.PI / 2 } as const
const NIGHT_FROM_HOUR = 18
const NIGHT_UNTIL_HOUR = 6

/** The kit's worker source the page's build embeds (`__KIT_WORKER_SOURCE__`): a one-file page starts its workers from it, with no request. */
const embeddedWorkerSource = (): string | undefined => {
  const source = (globalThis as { __KIT_WORKER_SOURCE__?: unknown }).__KIT_WORKER_SOURCE__
  return typeof source === 'string' ? source : undefined
}

/**
 * The reference district: the example a game copies. One call makes the world (`createKitWorld`: renderer, sun, terrain, destruction, physics, sound, workers, the loop) and
 * puts the district in it through the packages that own each piece, reading only the three data files: the streets and blocks of the plan (`game-urban`), a house on every lot of the site
 * (`game-floorplan`), the parked vehicles and props, the horde, the weather, the player and its camera, and a warning box where a piece is still missing.
 */
export async function startDistrict(THREE: typeof THREE_NS, options: DistrictOptions): Promise<District> {
  const site = referenceSite
  const plan = referencePlan
  const source = embeddedWorkerSource()
  const workers = options.workers === 0 ? 0 : createKitWorkers({ spawn: source !== undefined && typeof Worker !== 'undefined' ? sourceSpawn(source, { type: 'classic', name: 'kit-worker' }) : null, workers: options.workers ?? 'auto' })
  const world = await createKitWorld(THREE, {
    container: options.container,
    bounds: terrainBoundsOf(plan),
    ground: groundLayoutOf(plan),
    workers,
    physics: options.physics ?? 'jolt',
    audio: options.sounds === false ? false : { samplesBaseUrl: options.sounds === undefined ? './sfx/' : options.sounds, userSamplesBaseUrl: null },
  })
  const scene = world.view.scene
  const isNight = options.hour >= NIGHT_FROM_HOUR || options.hour < NIGHT_UNTIL_HOUR

  const streets = drawStreets({ THREE, urban: createReferenceUrban(), plan, site, lights: world.lights, seed: site.seed, isNight })
  scene.add(streets.drawn.root)
  const houses = createHouses({ THREE, world, scene, site })
  const props = createProps({ THREE, world, scene, site })
  const missing = createMissingBoxes(THREE, site.missing)
  scene.add(missing.group)

  const grid = createDistrictGrid({ houses: houses.list.map((placed) => placed.footprint), buildings: streets.buildings, vehicles: props.footprints })
  const player = createPlayerRig({ THREE, world, grid, start: options.start ?? DEFAULT_START, mode: options.camera, seed: site.seed })
  const zones = options.hordeZones ?? site.hordes.map((zone) => zone.id)
  const horde = createHorde({ THREE, world, site, zombies: options.zombies, reserve: options.hordeReserve ?? 0, zones, grid, target: player.player })
  player.bindCrowd(horde.crowd.asPlayerCrowd())
  const weather = createDistrictWeather({ THREE, world, state: options.weather, hour: options.hour, seed: site.seed })

  const nightFactor = isNight ? 1 : 0
  const stops = [
    world.frame.add((context) => player.step(context.dt), { phase: 'fixedSimulate', order: 500, id: 'district.player' }),
    world.frame.add((context) => horde.step(context.dt, { nightFactor, viewYaw: player.view.yaw }), { phase: 'fixedSimulate', order: 1500, id: 'district.horde' }),
    world.frame.add(
      (context) => {
        player.pose(context.dt)
        houses.update(context.dt, context.simTime, world.view.camera.position)
        weather.update(context.dt)
        streets.drawn.animate(context.simTime)
        horde.draw(context.dt, player.view.yaw)
      },
      { phase: 'lateSimulate', order: 100, id: 'district.frame' },
    ),
  ]
  world.warmUp()
  const stopLoop = world.start()
  return {
    THREE,
    world,
    site,
    houses,
    horde,
    player,
    dispose() {
      stopLoop()
      stops.forEach((stop) => stop())
      weather.dispose()
      horde.dispose()
      player.dispose()
      missing.dispose()
      props.dispose()
      houses.dispose()
      streets.drawn.dispose()
      world.dispose()
    },
  }
}
