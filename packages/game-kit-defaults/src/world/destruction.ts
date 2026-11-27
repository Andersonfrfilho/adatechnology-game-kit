import type * as THREE_NS from 'three'

import type { BlastShoveOptions, WorkerCoordinator } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionOptions, DestructionWorld, Vec3 } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type {
  BlastDebrisOptions,
  RendererOptions,
  ExplosionWorkOptions,
  FragmentLifeRule,
  GroundWorkerPort,
  JitWarmUpOptions,
  Piece,
  PiecePhysics,
  Quality,
  SettledBatchOptions,
  SoundDetail,
} from '@adatechnology/game-destruction-three'
import type { BlastQuery } from '@adatechnology/game-physics'
import type { SpriteKindDef } from '@adatechnology/game-vfx'
import type { VfxRenderer } from '@adatechnology/game-vfx-three'

import { workBudgetOf } from './frame-queues'
import type { KitWorldGround } from './ground'
import type { KitWorldPieces } from './pieces'

/** How long what breaks off stays, how many pieces move, how a blast treats its debris. */
export type KitWorldDebrisOptions = {
  readonly fragmentLife?: number | FragmentLifeRule
  readonly maxFragments?: number
  readonly particles?: Readonly<Record<string, Partial<SpriteKindDef> | null>>
  /** Milliseconds of destruction events the renderer applies per frame (default 8). `Infinity` applies every event in the frame it happens. */
  readonly eventBudgetMs?: number
  readonly particleLimit?: number
  readonly maxAwakePieces?: number
  readonly maxAwakeFragments?: number
  /** The debris at rest drawn in batches (default on with its defaults); `false` draws every mesh on its own. */
  readonly settledBatches?: SettledBatchOptions | false
  /** The blast debris policy (D4: wake queue by step cost, how many pieces enter physics, far and old debris). On by default; `false` turns it off. */
  readonly blast?: BlastDebrisOptions | false
  readonly tilesUnderParts?: boolean
  /** Where the engine's ground tiles are made: on by default through the coordinator when it has real workers; `false` makes them on the main thread. */
  readonly groundWorker?: GroundWorkerPort | false
  /** The coordinator for the fixed colliders measured from what is drawn (`destruction.static-colliders`). Default none: measured here. */
  readonly workers?: WorkerCoordinator
  /** The renderer's JIT warm-up (default on, heating the engine the host loaded): `false` turns it off. */
  readonly jitWarmUp?: boolean | JitWarmUpOptions
  readonly workBudget?: ExplosionWorkOptions
  /** The engine's fixed bodies as the broad phase of the world's rays (shots, sweeps, blast sight lines). On by default when a loop steps the pieces; `false` turns it off. */
  readonly rayBroadPhase?: boolean
  /** A blow of the engine on a fixed part of the drawn world becomes a hit of the world (`RendererOptions.contactHits`). On by default when a loop steps the pieces; `false` turns it off. */
  readonly contactHits?: RendererOptions['contactHits']
}

/** What the renderer tells about its pieces, for the host's own lists. */
export type DestructionEvents = {
  readonly piece: (piece: Piece) => void
  readonly released: (pieceIds: readonly string[]) => void
  readonly loosened: (objectId: string, piece: Piece, cause: 'blast' | 'apart') => void
  readonly brokenChecked: (objectId: string, released: boolean) => void
}

/** The renderer with the queues it hands to a frame budget. */
export type KitWorldRenderer = ReturnType<typeof createDestructionRenderer>

export type KitWorldDestruction = {
  readonly world: DestructionWorld
  /** The world is the host's: it is put back to its seeded start on `reset`. A world the game handed in is the game's to reset. */
  readonly isWorldOwned: boolean
  readonly renderer: KitWorldRenderer
  on<TEvent extends keyof DestructionEvents>(event: TEvent, handler: DestructionEvents[TEvent]): () => void
  /** Which objects a blast moves although they are not nailed down; the renderer makes the ones this answers true for a piece the moment the shove reaches them. */
  shoveable(test: (objectId: string) => boolean): void
  /** The world as it started, to load again on `reset`; null for a world the game handed in. */
  readonly pristine: PristineWorld | null
}

type PristineWorld = ReturnType<DestructionWorld['serialize']>

export function createWorld(options: { readonly world?: DestructionWorld; readonly worldOptions?: DestructionOptions }): { readonly world: DestructionWorld; readonly isOwned: boolean; readonly pristine: PristineWorld | null } {
  if (options.world) return { world: options.world, isOwned: false, pristine: null }
  const world = createDestruction({ seed: 1, ...options.worldOptions, materials: [...(options.worldOptions?.materials ?? [])] })
  return { world, isOwned: true, pristine: world.serialize() }
}

export type DestructionDeps = {
  readonly THREE: typeof THREE_NS
  readonly scene: THREE_NS.Scene
  readonly camera: THREE_NS.Camera
  readonly world: DestructionWorld
  readonly isWorldOwned: boolean
  readonly pristine: PristineWorld | null
  readonly physics: PiecePhysics
  readonly quality: Quality
  readonly pointScale: number
  readonly ground: KitWorldGround
  readonly pieces: KitWorldPieces
  readonly effects: VfxRenderer
  readonly debris: KitWorldDebrisOptions | undefined
  /** A `PhysicsLoop` steps the pieces: the rays' broad phase is on unless the debris options say otherwise. */
  readonly hasLoop: boolean
  /** The engine's blast query (`PhysicsServices.blast`), when there are services: a blast finds the pieces it reaches there. */
  readonly blastQuery?: BlastQuery
  readonly groundWorker: GroundWorkerPort | null
  readonly blastShove?: BlastShoveOptions
  readonly frameBudgetMs: number
  readonly playSound: (key: string, point: Vec3, volume: number, detail?: SoundDetail) => void
}

export function createDestructionHost(deps: DestructionDeps): KitWorldDestruction {
  const { debris, ground, pieces, camera } = deps
  const listeners: { [TEvent in keyof DestructionEvents]: Set<DestructionEvents[TEvent]> } = { piece: new Set(), released: new Set(), loosened: new Set(), brokenChecked: new Set() }
  let isShoveable: (objectId: string) => boolean = () => false
  const blast = debris?.blast === false ? undefined : (debris?.blast ?? {})
  const groundWorker = debris?.groundWorker === false ? undefined : (debris?.groundWorker ?? deps.groundWorker ?? undefined)
  const terrain = ground.terrain
  const renderer = createDestructionRenderer(deps.THREE, {
    physics: deps.physics,
    interpolate: true,
    scene: deps.scene,
    world: deps.world,
    vfx: deps.effects.world,
    quality: deps.quality,
    groundAt: ground.at,
    terrainAt: (x, z) => terrain.heightAt(x, z),
    // a can or a rod rolls on as the ground under it lets it: much farther on the road than on the lawn or in the sand
    terrainRollingAt: (x, z) => terrain.rollingAt(x, z),
    terrainRollingDampingAt: (x, z) => terrain.rollingDampingAt(x, z),
    terrainRangeAt: (minX, maxX, minZ, maxZ) => terrain.heightRange(minX, maxX, minZ, maxZ),
    terrainGridAt: terrain.heightGrid,
    terrainPatchAt: terrain.heightPatch,
    pointScale: deps.pointScale,
    ...(debris?.fragmentLife !== undefined ? { fragmentLife: debris.fragmentLife } : {}),
    ...(debris?.maxFragments !== undefined ? { maxFragments: debris.maxFragments } : {}),
    // the biggest budget the loose queues had: 8 ms a frame
    eventBudgetMs: debris?.eventBudgetMs ?? 8,
    ...(debris?.maxAwakePieces !== undefined ? { maxAwakePieces: debris.maxAwakePieces } : {}),
    ...(debris?.maxAwakeFragments !== undefined ? { maxAwakeFragments: debris.maxAwakeFragments } : {}),
    ...(debris?.tilesUnderParts ? { tilesUnderParts: true } : {}),
    ...(groundWorker ? { groundWorker } : {}),
    ...(debris?.workers ? { workers: debris.workers } : {}),
    ...((debris?.rayBroadPhase ?? deps.hasLoop) ? { rayBroadPhase: true } : {}),
    ...((debris?.contactHits ?? deps.hasLoop) ? { contactHits: debris?.contactHits || true } : {}),
    ...(deps.blastQuery ? { blastQuery: deps.blastQuery } : {}),
    ...(debris?.jitWarmUp !== undefined ? { jitWarmUp: debris.jitWarmUp } : {}),
    ...(debris?.workBudget ? { workBudget: workBudgetOf({ workBudget: debris.workBudget, ceilingMs: deps.frameBudgetMs }) } : {}),
    ...(debris?.settledBatches === false ? {} : { settledBatches: debris?.settledBatches ?? {} }),
    ...(blast || debris?.workBudget ? { focus: (): Vec3 => [camera.position.x, camera.position.y, camera.position.z] } : {}),
    ...(blast ? { blastDebris: blast } : {}),
    onSound: deps.playSound,
    ...(deps.blastShove ? { blastShove: deps.blastShove } : {}),
    shoveable: (objectId) => isShoveable(objectId),
    onLoosened: (objectId, piece, cause) => {
      for (const handler of [...listeners.loosened]) handler(objectId, piece, cause)
    },
    // after a break the collision of the object is measured again from what is still drawn; what stood on nothing was let go
    onBrokenChecked: (objectId, released) => {
      for (const handler of [...listeners.brokenChecked]) handler(objectId, released)
    },
    onPiece: (piece) => {
      pieces.add(piece)
      for (const handler of [...listeners.piece]) handler(piece)
    },
    // a module let an object go for good and the renderer took its pieces out of the world: the host forgets them too
    onReleased: (pieceIds) => {
      pieces.forget(pieceIds)
      for (const handler of [...listeners.released]) handler(pieceIds)
    },
  })
  return {
    world: deps.world,
    isWorldOwned: deps.isWorldOwned,
    renderer,
    on(event, handler) {
      const set = listeners[event] as Set<typeof handler>
      set.add(handler)
      return () => set.delete(handler)
    },
    shoveable: (test) => void (isShoveable = test),
    pristine: deps.pristine,
  }
}

/** The renderer's JIT warm-up heats the engine the host loaded, unless the game said otherwise. */
export function withEngineWarmUp(debris: KitWorldDebrisOptions | undefined, engine: JitWarmUpOptions['engine'] | null): KitWorldDebrisOptions {
  return { ...debris, ...(debris?.jitWarmUp === undefined && engine ? { jitWarmUp: { engine } } : {}) }
}
