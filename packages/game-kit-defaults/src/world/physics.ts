import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { PhysicsLoop, WorldDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltEngine, JoltEngineOptions, JoltThreading, JoltWorld } from '@adatechnology/game-physics-jolt'

/** How the loose pieces are stepped: the kit's Jolt (the default), the kit's own solver, or a loop the game made and steps no one else. */
export type PhysicsChoice = 'jolt' | 'own' | PhysicsLoop | KitWorldJoltOptions

/** Jolt with its threading and world numbers by hand: what the page of the test room reads from its address. */
export type KitWorldJoltOptions = JoltEngineOptions & {
  readonly engine: 'jolt'
  /** Numbers of the world over `KIT_WORLD` (the iterations and the push-out, in the room page). */
  readonly world?: WorldDesc
}

export type KitWorldPhysics = {
  /** What steps the pieces, or null for the kit's own solver. */
  readonly loop: PhysicsLoop | null
  /** The engine the host loaded (what the destruction renderer's JIT warm-up heats); null when the loop is the game's or the solver is the kit's own. */
  readonly engine: JoltEngine | null
  readonly info: KitWorldPhysicsInfo
  /** Releases the world the host made; a loop the game handed in is not touched. */
  dispose(): void
}

export type KitWorldPhysicsInfo = {
  readonly kind: 'jolt' | 'own' | 'loop'
  readonly threading?: JoltThreading
  /** Why the multithreaded build gave way to the single one, when it did. */
  readonly fallback?: string
}

const isLoop = (choice: PhysicsChoice): choice is PhysicsLoop => typeof choice === 'object' && 'frame' in choice && 'add' in choice

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

export async function createPhysics(choice: PhysicsChoice): Promise<KitWorldPhysics> {
  if (choice === 'own') return { loop: null, engine: null, info: { kind: 'own' }, dispose: () => undefined }
  if (isLoop(choice)) return { loop: choice, engine: null, info: { kind: 'loop' }, dispose: () => undefined }
  const asked: Partial<KitWorldJoltOptions> = choice === 'jolt' ? {} : choice
  const { engine, fallback } = await loadEngine({ ...(asked.build !== undefined ? { build: asked.build } : {}), ...(asked.workerThreads !== undefined ? { workerThreads: asked.workerThreads } : {}), ...(asked.contactCallbacks !== undefined ? { contactCallbacks: asked.contactCallbacks } : {}), ...(asked.moduleUrl !== undefined ? { moduleUrl: asked.moduleUrl } : {}) })
  const world = engine.createWorld({ ...KIT_WORLD, ...asked.world }) as JoltWorld
  return {
    loop: createPhysicsLoop(world),
    engine,
    info: { kind: 'jolt', threading: world.threading, ...(fallback === undefined ? {} : { fallback }) },
    dispose: () => world.dispose(),
  }
}
