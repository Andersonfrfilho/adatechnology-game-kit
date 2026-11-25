import type * as THREE_NS from 'three'

import { createKitWorkers } from '@adatechnology/game-kit-defaults'
import { createKitWorld, createLoading } from '@adatechnology/game-kit-defaults/world'
import { sourceSpawn } from '@adatechnology/game-workers'

import { createDistrictGrid, createHorde } from './assemble/horde'
import { createHouses, planLots } from './assemble/houses'
import { createDistrictHud } from './assemble/hud'
import { createPlayerRig } from './assemble/player'
import { createProps } from './assemble/props'
import { buildNetworks, drawDistrictNetworks } from './assemble/networks'
import { drawStreets } from './assemble/streets'
import { createDistrictWeather } from './assemble/weather'
import { groundLayoutOf, terrainBoundsOf } from './ground'
import { DISTRICT_LOADING_TEXT, startDistrictProgress } from './loading'
import type { DistrictStep } from './loading'
import { createMissingBoxes } from './missing'
import type { District, DistrictOptions } from './options'
import { createReferenceUrban, referencePlan } from './plan'
import { referenceSite } from './reference'
import { POLE_MIN_GAP } from './roads'
import { keepOutOf } from './service'

const DEFAULT_START = { x: 30, z: 0, yaw: -Math.PI / 2 } as const
const NIGHT_FROM_HOUR = 18
const NIGHT_UNTIL_HOUR = 6
const DEFAULT_LOCALE = 'pt-BR'

/** The kit's worker source the page's build embeds (`__KIT_WORKER_SOURCE__`): a one-file page starts its workers from it, with no request. */
const embeddedWorkerSource = (): string | undefined => {
  const source = (globalThis as { __KIT_WORKER_SOURCE__?: unknown }).__KIT_WORKER_SOURCE__
  return typeof source === 'string' ? source : undefined
}

/**
 * The reference district: the example a game copies. One call makes the world (`createKitWorld`: renderer, sun, terrain, destruction, physics, sound, workers, the loop) and
 * puts the district in it through the packages that own each piece, reading only the three data files: the streets and blocks of the plan (`game-urban`), a house on every lot of the site
 * (`game-floorplan`), the parked vehicles and props, the horde, the weather, the player and its camera, and a warning box where a piece is still missing.
 * The kit's loading card covers the container from the first line until the world is assembled and warmed up, one notch per step (`loading: false` shows none).
 */
export async function startDistrict(THREE: typeof THREE_NS, options: DistrictOptions): Promise<District> {
  const text = options.loading || DISTRICT_LOADING_TEXT
  const loading = options.loading === false ? undefined : createLoading({ container: options.container, working: text.working })
  const progress = startDistrictProgress(loading, text)
  let district: District
  try {
    district = await assembleDistrict(THREE, options, progress.step)
  } catch (error) {
    progress.fail(error)
    throw error
  }
  progress.end()
  return {
    ...district,
    dispose() {
      district.dispose()
      loading?.dispose()
    },
  }
}

async function assembleDistrict(THREE: typeof THREE_NS, options: DistrictOptions, step: (name: DistrictStep) => Promise<void>): Promise<District> {
  const site = referenceSite
  const plan = referencePlan
  const source = embeddedWorkerSource()
  await step('world')
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

  await step('streets')
  const lots = planLots(site)
  const avoid = keepOutOf(lots, POLE_MIN_GAP)
  const networks = buildNetworks({ plan, site, lots, avoid })
  const urban = createReferenceUrban({ hostLights: true })
  const streets = drawStreets({ THREE, urban, plan, site, lights: world.lights, seed: site.seed })
  scene.add(streets.drawn.root)
  const lines = drawDistrictNetworks({ THREE, urban, generated: networks, lights: world.lights, isNight, ...(options.lights === undefined ? {} : { lamps: options.lights }) })
  scene.add(lines.drawn.root)
  await step('houses')
  const houses = createHouses({ THREE, world, scene, lots })
  const props = createProps({ THREE, world, scene, site })
  const missing = createMissingBoxes(THREE, site.missing)
  scene.add(missing.group)

  await step('horde')
  const grid = createDistrictGrid({ houses: houses.list.map((placed) => placed.footprint), buildings: streets.buildings, vehicles: props.footprints })
  const player = createPlayerRig({ THREE, world, grid, start: options.start ?? DEFAULT_START, mode: options.camera, seed: site.seed })
  const zones = options.hordeZones ?? site.hordes.map((zone) => zone.id)
  const horde = createHorde({ THREE, world, site, zombies: options.zombies, reserve: options.hordeReserve ?? 0, zones, grid, target: player.player })
  player.bindCrowd(horde.crowd.asPlayerCrowd())
  const hud = createDistrictHud({
    container: options.container,
    rig: player,
    locale: options.locale ?? DEFAULT_LOCALE,
    ...(options.title === undefined ? {} : { title: options.title }),
    onRestart: options.onRestart ?? (() => location.reload()),
    ...(world.view.domElement ? { canvas: world.view.domElement } : {}),
  })
  const weather = createDistrictWeather({ THREE, world, state: options.weather, hour: options.hour, seed: site.seed, ...(options.fog === undefined ? {} : { fog: options.fog }) })

  const nightFactor = isNight ? 1 : 0
  const stops = [
    world.frame.add(
      (context) => {
        player.step(context.dt)
        hud.step(context.dt)
      },
      { phase: 'fixedSimulate', order: 500, id: 'district.player' },
    ),
    world.frame.add((context) => horde.step(context.dt, { nightFactor, viewYaw: player.view.yaw }), { phase: 'fixedSimulate', order: 1500, id: 'district.horde' }),
    world.frame.add(
      (context) => {
        player.pose(context.dt)
        houses.update(context.dt, context.simTime, world.view.camera.position)
        weather.update(context.dt)
        streets.drawn.animate(context.simTime)
        lines.update(context.simTime, world.view.camera.position)
        horde.draw(context.dt, player.view.yaw)
        hud.frame()
      },
      { phase: 'lateSimulate', order: 100, id: 'district.frame' },
    ),
  ]
  await step('warmUp')
  world.warmUp()
  const stopLoop = world.start()
  return {
    THREE,
    world,
    site,
    networks: networks.networks,
    houses,
    horde,
    player,
    hud,
    dispose() {
      stopLoop()
      stops.forEach((stop) => stop())
      weather.dispose()
      hud.dispose()
      horde.dispose()
      player.dispose()
      missing.dispose()
      props.dispose()
      houses.dispose()
      streets.drawn.dispose()
      lines.drawn.dispose()
      world.dispose()
    },
  }
}
