import type * as THREE_NS from 'three'

import type { AudioEngine } from '@adatechnology/game-audio'
import type { BlastShoveOptions, GroundLayout, WorkerCoordinator } from '@adatechnology/game-contracts'
import type { DestructionOptions, DestructionWorld } from '@adatechnology/game-destruction'
import type { FluidWorld, LiquidDef, SurfaceSpec } from '@adatechnology/game-fluids'
import type { TerrainBudget } from '@adatechnology/game-terrain'
import type { StaticBatchQueue, LightBudget, ProgramWarmup, RenderPools } from '@adatechnology/game-render-three'

import type { BlastPacingOptions } from './blast-pacing'
import type { KitWorldDebrisOptions, KitWorldDestruction } from './destruction'
import type { KitWorldEffects } from './effects'
import type { KitWorldFrame, KitWorldFrameOptions } from './frame'
import type { KitWorldGraphics, KitWorldGraphicsSetup } from './graphics'
import type { KitWorldGround } from './ground'
import type { KitWorldQuality } from './light'
import type { KitWorldFilm, KitWorldFluids, KitWorldWater } from './liquids'
import type { ObjectRegistry } from './objects'
import type { KitWorldPhysics, KitWorldPhysicsInfo, PhysicsChoice } from './physics'
import type { KitWorldPieces } from './pieces'
import type { KitWorldRender } from './render'
import type { ReportPort, WorldReport } from './reports'
import type { KitWorldAudioOptions, KitWorldSound } from './sound'
import type { KitWorldView } from './view'
import type { KitWorldWorkers } from './workers'
import type { KitWorldRules } from './world-rules'

export type KitWorldOptions = {
  readonly container: HTMLElement
  /** The game's own renderer, scene and camera; omitted, the host makes (and releases) them. */
  readonly renderer?: THREE_NS.WebGLRenderer
  readonly scene?: THREE_NS.Scene
  readonly camera?: THREE_NS.PerspectiveCamera
  /** An existing destruction world, or the options of the one the host makes (seed, extra materials). */
  readonly world?: DestructionWorld
  readonly worldOptions?: DestructionOptions
  /** An existing fluid world, extra liquids, and the surfaces the floor and the tops lay (`fluids.addSurface`). */
  readonly fluids?: FluidWorld
  readonly liquids?: LiquidDef[]
  readonly surfaces?: readonly SurfaceSpec[]
  readonly locale?: string
  /** `false` for a silent world, an engine the game made (not released here), or the options of the engine the host makes. */
  readonly audio?: false | AudioEngine | KitWorldAudioOptions
  /** `[minX, minZ, maxX, maxZ]` of the terrain, metres. */
  readonly bounds: readonly [number, number, number, number]
  /** What the floor is made of (default a concrete slab). */
  readonly ground?: GroundLayout
  /** The name the ground has in the destruction world (default `Ground`). */
  readonly groundName?: string
  readonly terrainBudget?: Partial<TerrainBudget>
  /** Default `'jolt'`; `'own'` is the kit's own solver, a `PhysicsLoop` is the game's (not released here). */
  readonly physics?: PhysicsChoice
  /** The game's coordinator (not released here), `0` for none, or omitted for the kit's own by the cores. */
  readonly workers?: WorkerCoordinator | 0
  readonly quality?: KitWorldQuality
  /** The player's graphics settings, only on a renderer the host makes. Default off. */
  readonly graphics?: boolean | KitWorldGraphicsSetup
  readonly debris?: KitWorldDebrisOptions
  /** Spreads a large blast over frames with the world held. On by default (`{}`); `false` sets every blast off in its frame. */
  readonly blastPacing?: BlastPacingOptions | false
  readonly blastShove?: BlastShoveOptions
  readonly lightSizes?: { readonly point?: number; readonly spot?: number }
  /** Drawn frames the GPU may be behind before a draw is held back (default 2). */
  readonly framesInFlight?: number
  readonly frame?: KitWorldFrameOptions
  /** The stream of the ground's fire and smoke (default a generator of the host's own, the room's seeded one). */
  readonly random?: () => number
  /** Every report the world makes (a thing landed, sank, caught fire): the room writes them in its log, a game on its HUD. */
  readonly onEvent?: (report: WorldReport) => void
}

/** What the host turned on and what it could not, for a log line or a test. */
export type KitWorldInfo = {
  readonly physics: KitWorldPhysicsInfo
  readonly blastPacing: boolean
  readonly blastDebris: boolean
  readonly groundWorker: boolean
  /** Why the ground did not go to workers, when it did not. */
  readonly groundWorkerOff?: string
  readonly workers: number
}

export type KitWorld<TRecord = unknown> = {
  readonly view: KitWorldView
  readonly sun: THREE_NS.DirectionalLight
  readonly destruction: KitWorldDestruction
  readonly ground: KitWorldGround
  /** The objects of the world by id, and what the player holds (the record is the game's). */
  readonly objects: ObjectRegistry<TRecord>
  readonly reports: ReportPort
  readonly pieces: KitWorldPieces
  readonly liquids: KitWorldFluids & { readonly view: KitWorldFilm['view']; readonly film: KitWorldFilm['film']; readonly filmBridge: KitWorldFilm['bridge']; readonly water: KitWorldWater['water']; readonly waterView: KitWorldWater['view'] }
  readonly sound: KitWorldSound
  readonly effects: KitWorldEffects
  readonly lights: LightBudget
  readonly warmup: ProgramWarmup
  readonly pools: RenderPools
  readonly staticBatchQueue: StaticBatchQueue
  readonly physics: KitWorldPhysics
  readonly workers: KitWorldWorkers
  readonly rules: KitWorldRules
  readonly graphics: KitWorldGraphics | null
  readonly frame: KitWorldFrame
  readonly blastPacing: KitWorldFrame['blastPacing']
  readonly info: KitWorldInfo
  /** The sun's shadow map and the renderer's pixel ratio for a quality level, on a renderer the host made. */
  setQuality(quality: KitWorldQuality): void
  warmUp(): void
  render: KitWorldRender['render']
  start: KitWorldRender['start']
  /** The worlds back to their seeded start (`blastPacing.clear()` included). */
  reset(): void
  dispose(): void
}
