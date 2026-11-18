// `kit_workers` of the game-kit MCP: how a project should set up the worker coordinator of `@adatechnology/game-workers` (CLAUDE.md §14,
// specs/regras/14-workers.md). Given the platform, the cores and the heavy work of the project, it answers the plan (workers per lane), the
// kit's kinds that apply with their schedule, whether to run the simulation thread, what the host must serve, and the code to start it.
// The plan comes from the built package itself (`planWorkers`), so it never drifts from the coordinator.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The platforms a game of the kit runs on, and what each gives the coordinator. */
export const PLATFORMS = {
  browser: {
    spawn: 'browserSpawn(new URL("./game-worker.js", import.meta.url)) (or sourceSpawn(text) for a page of one file)',
    sharedMemory: 'only when the page is cross-origin isolated: serve COOP: same-origin and COEP: require-corp',
    simThread: 'with shared memory: yes for a busy fixed step; without it the coordinator alone (sim lane with fallback)',
    notes: ['The main thread may not wait (Atomics.wait throws there): sim jobs are collected at their due frame or run here.', 'Count the latency in rendered frames: an answer only lands between browser tasks.'],
  },
  electron: {
    spawn: 'browserSpawn in the renderer (it is Chromium); nodeSpawn (worker_threads) in the main process for background and loading',
    sharedMemory: 'always: the app serves itself cross-origin isolated',
    simThread: 'yes: the renderer keeps input and drawing, the simulation thread steps and may wait for its jobs',
    notes: ['The renderer is Chromium: no Atomics.wait on its main thread either.', 'A native addon (Rust) is called from the main process or a worker, never from the renderer.'],
  },
  node: {
    spawn: 'nodeSpawn(new URL("./game-worker.mjs", import.meta.url)) from @adatechnology/game-workers/node',
    sharedMemory: 'always',
    simThread: 'optional: a server may run the whole step on its main thread, which may wait in Node',
    notes: ['A dedicated server or a test: paced: false runs the steps as fast as they compute.'],
  },
  mobile: {
    spawn: 'browserSpawn (a mobile browser or a webview)',
    sharedMemory: 'only cross-origin isolated, and some webviews never are',
    simThread: 'no by default: few big cores, the coordinator with a small cap (maxWorkers 2 to 3) saves battery',
    notes: ['Phones throttle: measure on the device before raising the cap.'],
  },
}

/** Heavy work a project may have, the kit kind that does it (when there is one) and what a game writes itself otherwise. */
export const WORK = {
  crowd: { kind: 'crowd.physics', from: '@adatechnology/game-crowd (crowdPhysicsKind; CrowdOptions.physics.workers)', sim: 'hordeSimModule runs the whole horde in the simulation thread' },
  ground: { kind: 'destruction.ground-tiles', from: '@adatechnology/game-destruction-three: groundTilesKind, createCoordinatorGroundPort(workers) for the engine (crater ground tiles)' },
  pieces: { kind: 'destruction.piece-boxes', from: '@adatechnology/game-destruction-three (fitted boxes of the broken parts)' },
  colliders: { kind: 'destruction.static-colliders', from: '@adatechnology/game-destruction (static colliders at load)' },
  shapes: { kind: 'shapes.generate', from: '@adatechnology/game-shapes: shapesGenerateKind, createShapePool({ workers }) (shapes and normals at load)' },
  world: { kind: 'world.region', from: 'your living world: a resident per far region (background lane, late: drop)' },
  physics: { kind: null, from: '@adatechnology/game-physics-jolt: Jolt has its own job threads; give them reserveCores instead of coordinator workers' },
  pathfinding: { kind: null, from: 'your own: a TaskKind (pure function of plain data) in the build or sim lane' },
  ai: { kind: null, from: 'your own: a TaskKind in the sim lane (late: sync) when the next frames read it, background otherwise' },
}

const kitDist = (/** @type {string} */ root, /** @type {string} */ name, file = 'index.js') => join(root, 'packages', name, 'dist', file)

/**
 * @param {string} root the repository root
 * @param {{ platform?: string, cores?: number, work?: string[], workers?: number | 'auto', reserveCores?: number, maxWorkers?: number }} input
 */
export async function recommendWorkers(root, input) {
  const platform = String(input.platform ?? 'browser')
  const profile = PLATFORMS[/** @type {keyof typeof PLATFORMS} */ (platform)]
  if (!profile) throw new Error(`platform is one of ${Object.keys(PLATFORMS).join(', ')}`)
  const work = (input.work ?? ['crowd', 'ground', 'pieces', 'colliders', 'shapes']).map(String)
  const unknown = work.filter((w) => !(w in WORK))
  if (unknown.length) throw new Error(`unknown work ${unknown.join(', ')}: one of ${Object.keys(WORK).join(', ')}`)
  const cores = Math.max(1, Math.floor(Number(input.cores ?? 8)))
  const jolt = work.includes('physics')
  const reserveCores = input.reserveCores ?? (jolt ? Math.min(2, Math.max(0, cores - 3)) : 0)
  const maxWorkers = input.maxWorkers ?? (platform === 'mobile' ? 3 : 8)
  const planOptions = { workers: input.workers ?? 'auto', maxWorkers, reserveCores }

  const workersDist = kitDist(root, 'game-workers')
  const contractsDist = kitDist(root, 'game-contracts')
  if (!existsSync(workersDist) || !existsSync(contractsDist)) throw new Error('build the packages first: pnpm --filter @adatechnology/game-workers... build')
  const { planWorkers } = await import(pathToFileURL(workersDist).href)
  const { WORKER_KIND_DEFAULTS } = await import(pathToFileURL(contractsDist).href)
  const plan = planWorkers(planOptions, cores)

  const kinds = work.map((w) => {
    const entry = WORK[/** @type {keyof typeof WORK} */ (w)]
    return { work: w, kind: entry.kind, from: entry.from, schedule: entry.kind ? (WORKER_KIND_DEFAULTS[entry.kind] ?? null) : null, ...('sim' in entry ? { simThread: entry.sim } : {}) }
  })
  const busyStep = work.includes('crowd') || work.includes('ground') || work.includes('ai')
  // a busy fixed step moves to the simulation thread where memory is shared; a server or a phone keeps the plain coordinator
  const simThread = !busyStep ? false : platform === 'electron' ? true : platform === 'browser' ? 'only when cross-origin isolated' : false
  const ownKinds = kinds.filter((k) => !k.kind).map((k) => k.work)
  const kitKinds = kinds.filter((k) => k.kind && k.work !== 'world').map((k) => k.kind)

  const code = [
    `// the short way: the kit preset (on by default) builds the page's coordinator with the kit's kinds and its own worker file`,
    `import { createKitWorkers } from '@adatechnology/game-kit-defaults'`,
    `const workers = createKitWorkers({ workers: ${JSON.stringify(planOptions.workers)} }) // spawn: null turns workers off`,
    `engine.groundWorker = createCoordinatorGroundPort(workers) // @adatechnology/game-destruction-three`,
    ``,
    `// by hand, when the game has kinds of its own:`,
    `// game-worker.ts: the file every worker loads, with every kind the game hands to workers (the kit's and its own)`,
    `import { installWorkerHost } from '@adatechnology/game-workers'`,
    `installWorkerHost(self, [/* ${kitKinds.join(', ') || 'the kit kinds'} */ ${ownKinds.length ? `, /* your kinds: ${ownKinds.join(', ')} */` : ''}])`,
    ``,
    `// the game: one coordinator for every module (on by default in the kit preset; pass your own to configure it by hand)`,
    `const workers = createWorkerCoordinator({ spawn: ${platform === 'node' ? 'nodeSpawn(...)' : 'browserSpawn(...)'}, workers: ${JSON.stringify(planOptions.workers)}, maxWorkers: ${maxWorkers}, reserveCores: ${reserveCores} })`,
    `await workers.warm([/* the same kinds */])`,
    `// each fixed step: workers.tick(frame); the modules take it in their options (crowdPhysics: { ...CROWD_PHYSICS_DEFAULTS, workers })`,
  ]
  if (simThread) {
    code.push(``, `// the simulation thread: the whole fixed step in a worker that may wait (needs shared memory)`, `if (canRunSimThread()) startSimThread(spawnSim, { module: 'crowd.horde', init, snapshotBytes: hordeSnapshotBytes(capacity) })`)
  }

  return {
    platform,
    cores,
    plan: { ...planOptions, ...plan },
    kinds,
    simThread,
    host: { spawn: profile.spawn, sharedMemory: profile.sharedMemory, simThread: profile.simThread },
    notes: [
      ...profile.notes,
      ...(jolt ? [`Jolt runs its own job threads: reserveCores ${reserveCores} leaves them free (the coordinator does not schedule Jolt).`] : []),
      ...(ownKinds.length ? [`Write ${ownKinds.join(', ')} as your own kinds: defineTaskKind / defineResidentKind with an id "package.thing", a lane, a priority, latencyFrames and a late rule; test them with checkTaskKind (byte for byte against the main thread).`] : []),
      'No package creates a Worker itself: every worker comes from the coordinator (CLAUDE.md §14).',
      'Native code, when a measurement asks for it, is Rust compiled to WebAssembly, run inside a kind (spec 009, D5).',
    ],
    code: code.join('\n'),
    docs: ['packages/game-workers/README.md', 'specs/regras/14-workers.md', '.claude/skills/kit-base/references/game-workers.md', 'specs/009-coordenador-de-workers/'],
  }
}
