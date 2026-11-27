import { KIT_WORLD, createPhysicsLoop, isPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsLoop, PhysicsServices, SeamWorld, WorldDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltEngine, JoltEngineOptions, JoltThreading, JoltWorld } from '@adatechnology/game-physics-jolt'

import { servicesOf } from './physics-services'

/** How the loose pieces are stepped: the kit's Jolt (the default), a loop the game made and steps no one else, or a world the game steps itself (a seam). */
export type PhysicsChoice = 'jolt' | PhysicsLoop | SeamWorld | KitWorldJoltOptions

/** A choice that needs no engine loaded: what `createKitWorldSync` takes. */
export type GivenPhysicsChoice = PhysicsLoop | SeamWorld

/** Jolt with its threading and world numbers by hand: what the page of the test room reads from its address. */
export type KitWorldJoltOptions = JoltEngineOptions & {
  readonly engine: 'jolt'
  /** Numbers of the world over `KIT_WORLD` (the iterations and the push-out, in the room page). */
  readonly world?: WorldDesc
}

export type KitWorldPhysics = {
  /** What steps the pieces, or null for a seam the game steps. */
  readonly loop: PhysicsLoop | null
  /** What the destruction renderer hands its pieces to: the loop or the game's seam. */
  readonly pieces: PhysicsLoop | SeamWorld
  /** The engine the host loaded (what the destruction renderer's JIT warm-up heats); null when the loop or the seam is the game's. */
  readonly engine: JoltEngine | null
  readonly info: KitWorldPhysicsInfo
  /** What a module makes bodies with (`ModuleHost.physics`); only when a loop steps the pieces. The `dispose` of the host takes them out before it releases the world. */
  readonly services?: PhysicsServices
  /** Releases the world the host made; a loop the game handed in is not touched. */
  dispose(): void
}

export type KitWorldPhysicsInfo = {
  readonly kind: 'jolt' | 'loop' | 'seam'
  readonly threading?: JoltThreading
  /** Why the multithreaded build gave way to the single one, when it did. */
  readonly fallback?: string
}

// a seam keeps the world's body calls (`createBody`); a Jolt world as a seam also says `engine: 'jolt'`, so the seam is asked first
const isSeam = (choice: PhysicsChoice): choice is SeamWorld => typeof choice === 'object' && typeof (choice as Partial<SeamWorld>).createBody === 'function'
const isGiven = (choice: Exclude<PhysicsChoice, 'jolt'>): choice is PhysicsLoop | SeamWorld => isSeam(choice) || ('frame' in choice && 'add' in choice)

async function loadEngine(options: JoltEngineOptions): Promise<{ readonly engine: JoltEngine; readonly fallback?: string }> {
  try {
    return { engine: await createJoltEngine(options) }
  } catch (error) {
    // a build that cannot run here (no shared memory, a missing module file) falls back to the single-threaded one, and the host says so
    if (options.build === undefined && options.workerThreads === undefined) throw error
    const reason = error instanceof Error ? ((error as { code?: string }).code ?? error.message) : String(error)
    return { engine: await createJoltEngine(), fallback: reason }
  }
}

/** The physics the game handed in (none of it released here), no engine to load. */
export function givenPhysics(choice: GivenPhysicsChoice): KitWorldPhysics {
  if (isPhysicsLoop(choice)) return servicesOf<Omit<KitWorldPhysics, 'services'>>({ loop: choice, pieces: choice, engine: null, info: { kind: 'loop' }, dispose: () => undefined })
  return { loop: null, pieces: choice, engine: null, info: { kind: 'seam' }, dispose: () => undefined }
}

export async function createPhysics(choice: PhysicsChoice): Promise<KitWorldPhysics> {
  if (choice !== 'jolt' && isGiven(choice)) return givenPhysics(choice)
  const asked: Partial<KitWorldJoltOptions> = choice === 'jolt' ? {} : choice
  const { engine, fallback } = await loadEngine({ ...(asked.build !== undefined ? { build: asked.build } : {}), ...(asked.workerThreads !== undefined ? { workerThreads: asked.workerThreads } : {}), ...(asked.contactCallbacks !== undefined ? { contactCallbacks: asked.contactCallbacks } : {}), ...(asked.moduleUrl !== undefined ? { moduleUrl: asked.moduleUrl } : {}) })
  const world = engine.createWorld({ ...KIT_WORLD, ...asked.world }) as JoltWorld
  const loop = createPhysicsLoop(world)
  return servicesOf<Omit<KitWorldPhysics, 'services'>>({
    loop,
    pieces: loop,
    engine,
    info: { kind: 'jolt', threading: world.threading, ...(fallback === undefined ? {} : { fallback }) },
    dispose: () => world.dispose(),
  })
}
