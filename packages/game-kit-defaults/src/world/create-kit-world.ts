import { createDestructionHost, createWorld, withEngineWarmUp } from './destruction'
import { createDispose } from './dispose'
import { createEffects } from './effects'
import { createFrame } from './frame'
import { createGraphicsFor } from './graphics'
import { createGround } from './ground'
import { createInfo } from './info'
import { createLight } from './light'
import { createFluidWorld, createLiquidViews, createWater } from './liquids'
import { createObjectRegistry } from './objects'
import { createPhysics, givenPhysics } from './physics'
import type { KitWorldPhysics } from './physics'
import { createPieces } from './pieces'
import { createSeededRandom } from './random'
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
import type { KitWorld, KitWorldOptions, KitWorldSyncOptions } from './types'

const DEFAULT_QUALITY = 'medium'
const DEFAULT_GROUND_NAME = 'Ground'
const DEFAULT_LOCALE = 'en'

/**
 * The world every game wires the same way: renderer, sun, ground, the destruction world and its renderer, liquids, sound, effects, physics, workers, the
 * frame and its loop (spec 011, `design-host.md`). Physics is Jolt by default; blast pacing, the D4 debris policy and the ground tiles in workers are on by
 * default (the last only with a coordinator that has real workers) and each turns off by an explicit `false` (or `0` workers). The host releases only what
 * it made: a renderer, audio engine, coordinator or physics loop the game handed in is the game's.
 */
export async function createKitWorld<TRecord = unknown>(THREE: ThreeNamespace, options: KitWorldOptions): Promise<KitWorld<TRecord>> {
  return assembleKitWorld<TRecord>({ THREE, options, physics: await createPhysics(options.physics ?? 'jolt') })
}

/**
 * The same world at once, for a host that cannot wait (the test room's `createTestRoom` returns its room synchronously): the physics is one that needs no engine
 * loaded, the kit's own solver or what the game made (a loop the page loaded Jolt into, a seam).
 */
export function createKitWorldSync<TRecord = unknown>(THREE: ThreeNamespace, options: KitWorldSyncOptions): KitWorld<TRecord> {
  return assembleKitWorld<TRecord>({ THREE, options, physics: givenPhysics(options.physics) })
}

function assembleKitWorld<TRecord>({ THREE, options, physics }: { readonly THREE: ThreeNamespace; readonly options: Omit<KitWorldOptions, 'physics'>; readonly physics: KitWorldPhysics }): KitWorld<TRecord> {
  const view = createView({ THREE, ...options })
  const { scene, camera, gl } = view
  const locale = options.locale ?? DEFAULT_LOCALE
  const quality = options.quality ?? DEFAULT_QUALITY
  const light = createLight({ THREE, scene })
  const graphics = view.ownsRenderer && options.graphics ? createGraphicsFor({ gl, camera, sun: light.sun, container: view.container, locale, setup: options.graphics === true ? undefined : options.graphics }) : null
  const { world, isOwned: isWorldOwned, pristine } = createWorld(options)
  const seeded = createSeededRandom()
  const workers = createWorkers({ workers: options.workers, isGroundWorkerAllowed: options.debris?.groundWorker !== false })
  const reports = createReportPort()
  if (options.onEvent) reports.on(options.onEvent)
  const pieces = createPieces()
  const sound = createSound({ world, audio: options.audio, onSound: options.onSound })
  const lazy: { renderer?: ReturnType<typeof createDestructionHost>['renderer']; fluids?: ReturnType<typeof createFluidWorld>['fluids'] } = {}
  const ground = createGround({ THREE, scene, world, bounds: options.bounds, layout: options.ground, budget: options.terrainBudget, name: options.groundName ?? DEFAULT_GROUND_NAME, random: options.random ?? seeded.next, renderer: () => lazy.renderer as NonNullable<typeof lazy.renderer>, fluids: () => lazy.fluids as NonNullable<typeof lazy.fluids>, playSound: sound.play })
  const fluids = createFluidWorld({ fluids: options.fluids, locale, liquids: options.liquids, groundAt: ground.at, surfaces: options.surfaces ?? [] })
  lazy.fluids = fluids.fluids
  const budget = createRenderBudget({ THREE, scene, camera, gl, lightSizes: options.lightSizes })
  const effects = createEffects({ THREE, scene, lights: budget.lights, camera, container: view.container, quality, pointScale: view.pointScale, terrain: ground.terrain, groundAt: ground.at, particles: options.debris?.particles })
  const water = createWater({ THREE, scene, terrain: ground.terrain })
  const debris = withEngineWarmUp(options.debris, physics.engine)
  const destruction = createDestructionHost({ THREE, scene, camera, world, isWorldOwned, pristine, physics: physics.pieces, quality, pointScale: view.pointScale, ground, pieces, effects, debris, groundWorker: workers.groundPort, blastShove: options.blastShove, frameBudgetMs: options.frame?.budgetMs ?? 8, playSound: sound.play })
  const renderer = destruction.renderer
  lazy.renderer = renderer
  ground.attach(renderer)
  ground.register()
  const liquids = createLiquidViews({ THREE, scene, camera, gl, fluids: fluids.fluids, groundAt: ground.at, quality, pointScale: view.pointScale, vfx: effects.world })
  const rules = createWorldRules()
  const step = createWorldStep({ THREE, camera, world, fluids: fluids.fluids, fluidView: liquids.view, film: liquids, renderer, physicsLoop: physics.loop, ground, water: water.water, waterView: water.view, effects, light, sound, audio: sound.audio, rules })
  const frame = createFrame({ options: options.frame, blastPacing: options.blastPacing, world, renderer, physicsStep: physics.loop?.world.fixedStep, queues: { audio: sound.audio, film: liquids.film, staticBatchQueue: budget.staticBatchQueue }, hasWorkBudget: debris.workBudget !== undefined, step, camera, budget })
  registerWarmupProbes({ THREE, budget, adapters: { destruction: renderer, vfx: effects, fluids: liquids.view, film: liquids.film }, effects })
  const render = createRender({ view, frame, budget, graphics, targetMs: options.frame?.targetMs, framesInFlight: options.framesInFlight })
  const reset = createReset({ world, destruction, renderer, ground, fluids, liquids, fluidView: liquids.view, water: water.water, effects, sound, pieces, frame, resetRandom: options.random ? undefined : seeded.reset })
  const dispose = createDispose([() => render.dispose(), () => frame.scheduler.dispose(), () => sound.dispose(), () => graphics?.dispose(), () => renderer.dispose(), () => effects.dispose(), () => water.view.dispose(), () => budget.dispose(), () => liquids.view.dispose(), () => liquids.bridge.dispose(), () => liquids.film.dispose(), () => ground.view.dispose(), () => light.dispose(), () => physics.dispose(), () => workers.dispose(), () => view.dispose()])

  return {
    view, sun: light.sun, ambient: light.ambient, destruction, ground, objects: createObjectRegistry<TRecord>(), reports, pieces,
    liquids: { ...fluids, view: liquids.view, film: liquids.film, filmBridge: liquids.bridge, filmRandom: liquids.random, water: water.water, waterView: water.view },
    sound, effects, lights: budget.lights, warmup: budget.warmup, pools: budget.pools, staticBatchQueue: budget.staticBatchQueue, physics, workers, rules, graphics, frame,
    blastPacing: frame.blastPacing,
    info: createInfo({ physics, frame, debris, workers }),
    random: options.random ?? seeded.next,
    setQuality: (next) => {
      view.setQuality(next)
      light.setShadowQuality(next)
    },
    warmUp: budget.warmUp,
    render: render.render,
    start: render.start,
    get isLooping() {
      return render.isLooping
    },
    reset,
    dispose,
  }
}
