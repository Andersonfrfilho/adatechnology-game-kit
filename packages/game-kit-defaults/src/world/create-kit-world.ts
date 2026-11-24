import { createDestructionHost, createWorld } from './destruction'
import { createEffects } from './effects'
import { createFrame } from './frame'
import { createKitWorldGraphics, SILENT_LOADING } from './graphics'
import { createGround } from './ground'
import { createLight } from './light'
import { createFluidWorld, createLiquidViews, createWater } from './liquids'
import { createObjectRegistry } from './objects'
import { createPhysics } from './physics'
import { createPieces } from './pieces'
import { createRender } from './render'
import { createRenderBudget, registerWarmupProbes } from './render-budget'
import { createReportPort } from './reports'
import { createReset } from './reset'
import { createSound } from './sound'
import { createView } from './view'
import type { ThreeNamespace } from './view'
import { createWorkers } from './workers'
import { createWorldRules } from './world-rules'
import { createWorldStep } from './world-step'
import type { KitWorld, KitWorldInfo, KitWorldOptions } from './types'

const DEFAULT_QUALITY = 'medium'
const DEFAULT_GROUND_NAME = 'Ground'
const DEFAULT_LOCALE = 'en'
const SEED = 12345
const LOW_QUALITY_PIXEL_RATIO = 1
const MAX_PIXEL_RATIO = 2

/** The room's seeded stream, for the ground's fire and smoke when the game gives none. */
const createSeededRandom = (): (() => number) => {
  let state = SEED
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * The world every game wires the same way: renderer, sun, ground, the destruction world and its renderer, liquids, sound, effects, physics, workers, the
 * frame and its loop (spec 011, `design-host.md`). Physics is Jolt by default; blast pacing, the D4 debris policy and the ground tiles in workers are on by
 * default (the last only with a coordinator that has real workers) and each turns off by an explicit `false` (or `0` workers). The host releases only what
 * it made: a renderer, audio engine, coordinator or physics loop the game handed in is the game's.
 */
export async function createKitWorld<TRecord = unknown>(THREE: ThreeNamespace, options: KitWorldOptions): Promise<KitWorld<TRecord>> {
  const view = createView(THREE, options)
  const { scene, camera, gl } = view
  const light = createLight(THREE, scene)
  const graphicsSetup = options.graphics === true ? {} : options.graphics
  const graphics = view.ownsRenderer && graphicsSetup
    ? createKitWorldGraphics({ gl, camera, sun: light.sun, container: view.container, locale: options.locale ?? DEFAULT_LOCALE, loading: graphicsSetup.loading ?? SILENT_LOADING, label: graphicsSetup.label ?? 'Graphics', ui: graphicsSetup.ui ?? true, options: graphicsSetup })
    : null
  const { world, isOwned: isWorldOwned, pristine } = createWorld(options)
  const random = options.random ?? createSeededRandom()
  const workers = createWorkers(options.workers, options.debris?.groundWorker !== false)
  const physics = await createPhysics(options.physics ?? 'jolt')
  const quality = options.quality ?? DEFAULT_QUALITY
  const reports = createReportPort()
  if (options.onEvent) reports.on(options.onEvent)
  const pieces = createPieces()
  const sound = createSound(world, options.audio)
  const lazy: { renderer?: ReturnType<typeof createDestructionHost>['renderer']; fluids?: ReturnType<typeof createFluidWorld>['fluids'] } = {}

  const ground = createGround({
    THREE,
    scene,
    world,
    bounds: options.bounds,
    ...(options.ground ? { layout: options.ground } : {}),
    ...(options.terrainBudget ? { budget: options.terrainBudget } : {}),
    name: options.groundName ?? DEFAULT_GROUND_NAME,
    random,
    renderer: () => lazy.renderer as NonNullable<typeof lazy.renderer>,
    fluids: () => lazy.fluids as NonNullable<typeof lazy.fluids>,
    playSound: sound.play,
  })
  const fluids = createFluidWorld({ ...(options.fluids ? { fluids: options.fluids } : {}), locale: options.locale ?? DEFAULT_LOCALE, ...(options.liquids ? { liquids: options.liquids } : {}), groundAt: ground.at, surfaces: options.surfaces ?? [] })
  lazy.fluids = fluids.fluids

  const budget = createRenderBudget(THREE, { scene, camera, gl, ...(options.lightSizes ? { lightSizes: options.lightSizes } : {}) })
  const effects = createEffects(THREE, { scene, lights: budget.lights, camera, container: view.container, quality, pointScale: view.pointScale, terrain: ground.terrain, groundAt: ground.at, ...(options.debris?.particles ? { particles: options.debris.particles } : {}) })
  const water = createWater(THREE, scene, ground.terrain)
  const isJitWarmUpGiven = options.debris?.jitWarmUp !== undefined
  const debris = { ...options.debris, ...(!isJitWarmUpGiven && physics.engine ? { jitWarmUp: { engine: physics.engine } } : {}) }
  const destruction = createDestructionHost({
    THREE,
    scene,
    camera,
    world,
    isWorldOwned,
    pristine,
    physics: physics.loop ?? 'own',
    quality,
    pointScale: view.pointScale,
    ground,
    pieces,
    effects,
    debris,
    groundWorker: workers.groundPort,
    ...(options.blastShove ? { blastShove: options.blastShove } : {}),
    frameBudgetMs: options.frame?.budgetMs ?? 8,
    playSound: sound.play,
  })
  const renderer = destruction.renderer
  lazy.renderer = renderer
  ground.attach(renderer)
  ground.register()
  const liquids = createLiquidViews(THREE, { scene, camera, gl, fluids: fluids.fluids, groundAt: ground.at, quality, pointScale: view.pointScale, vfx: effects.world })

  const rules = createWorldRules()
  const step = createWorldStep({ THREE, camera, world, fluids: fluids.fluids, fluidView: liquids.view, film: liquids, renderer, physicsLoop: physics.loop, ground, water: water.water, waterView: water.view, effects, light, sound, audio: sound.audio, rules })
  const frame = createFrame({
    options: options.frame,
    blastPacing: options.blastPacing,
    world,
    renderer,
    physicsStep: physics.loop?.world.fixedStep,
    queues: { audio: sound.audio, film: liquids.film, staticBatchQueue: budget.staticBatchQueue },
    hasWorkBudget: debris.workBudget !== undefined,
    step,
    camera,
    budget,
  })
  registerWarmupProbes(THREE, budget, { destruction: renderer, vfx: effects, fluids: liquids.view, film: liquids.film }, { root: effects.root, play: (query) => effects.play(query), stop: (handle) => effects.stop(handle), update: (dt) => effects.update(dt), world: effects.world, ...(effects.catalog ? { catalog: () => effects.catalog?.() ?? [] } : {}) })
  const render = createRender({ view, frame, budget, graphics, targetMs: options.frame?.targetMs, framesInFlight: options.framesInFlight })
  const reset = createReset({ world, destruction, renderer, ground, fluids, liquids, fluidView: liquids.view, water: water.water, effects, sound, pieces, frame })

  const isGroundWorker = debris.groundWorker !== false && (debris.groundWorker !== undefined || workers.groundPort !== null)
  const info: KitWorldInfo = {
    physics: physics.info,
    blastPacing: frame.blastPacing !== undefined,
    blastDebris: debris.blast !== false,
    groundWorker: isGroundWorker,
    ...(isGroundWorker ? {} : { groundWorkerOff: debris.groundWorker === false ? 'turned off' : workers.coordinator === null ? 'no workers' : 'the coordinator has no real workers' }),
    workers: workers.coordinator?.stats().workers ?? 0,
  }

  return {
    view,
    sun: light.sun,
    destruction,
    ground,
    objects: createObjectRegistry<TRecord>(),
    reports,
    pieces,
    liquids: { ...fluids, view: liquids.view, film: liquids.film, filmBridge: liquids.bridge, water: water.water, waterView: water.view },
    sound,
    effects,
    lights: budget.lights,
    warmup: budget.warmup,
    pools: budget.pools,
    staticBatchQueue: budget.staticBatchQueue,
    physics,
    workers,
    rules,
    graphics,
    frame,
    blastPacing: frame.blastPacing,
    info,
    setQuality(next) {
      if (!view.ownsRenderer) return
      gl.shadowMap.enabled = next !== 'low'
      gl.setPixelRatio(next === 'low' ? LOW_QUALITY_PIXEL_RATIO : Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, MAX_PIXEL_RATIO))
      light.setShadowQuality(next)
      view.resize()
    },
    warmUp: budget.warmUp,
    render: render.render,
    start: render.start,
    reset,
    dispose() {
      render.dispose()
      frame.scheduler.dispose()
      sound.dispose()
      graphics?.dispose()
      renderer.dispose()
      effects.dispose()
      water.view.dispose()
      budget.dispose()
      liquids.view.dispose()
      liquids.bridge.dispose()
      liquids.film.dispose()
      ground.view.dispose()
      light.dispose()
      physics.dispose()
      workers.dispose()
      view.dispose()
    },
  }
}
