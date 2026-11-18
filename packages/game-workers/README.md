# @adatechnology/game-workers

The coordinator of every worker of a game. It decides how many workers there are (by the machine's cores, or by hand), which lane each kind of job runs in, the order by priority and by the frame a result is due, and runs the same kernel on the main thread when a worker is late or missing. Physics stays deterministic: a `sim` job gives the same bytes with 0, 1 or 8 workers. Browser module workers, a one-file page (Blob URL), Node `worker_threads`, or none. The rule that every package follows is CLAUDE.md §14 (`specs/regras/14-workers.md`).

```ts
import { createWorkerCoordinator, browserSpawn } from '@adatechnology/game-workers'

const workers = createWorkerCoordinator({ spawn: browserSpawn(new URL('./game-worker.js', import.meta.url)) })
await workers.warm(KINDS)                                  // at load: workers up, each kernel run once (JIT), unknown kinds caught here

// fixed step N
workers.tick(frame)
const handle = workers.submit(groundTiles, input, { frame }) // due in N + latencyFrames
// fixed step handle.dueFrame
const tiles = handle.collect(frame)                         // the worker's answer, or the kernel run here now
```

## Kinds

A **task** kind is a pure function of plain data: `run(input)` reads nothing but its input (a seed travels inside it), and the same function runs in the worker and on the main thread. A **resident** kind is an instance built once per worker from an `init` and stepped (the crowd physics, later a region of the world).

```ts
export const pathfinding = defineTaskKind<PathInput, PathOutput>({
  id: 'mygame.pathfinding',          // package.thing, unique in a coordinator
  lane: 'sim',                       // sim | build | background
  priority: 180,                     // higher first, as DEFERRED_PRIORITY
  latencyFrames: 2,                  // sim: applied in N + 2
  late: 'sync',                      // sim: always sync
  run: (input) => ({ cells: aStar(input) }),
  transferOutput: (out) => [out.cells.buffer],
  warmup: SMALL_GRID,                // run once in every worker at warm()
})
```

The kit's kinds and their default schedule are in `WORKER_KIND_DEFAULTS` (`@adatechnology/game-contracts`); a game changes any of them by id: `createWorkerCoordinator({ kinds: { 'crowd.physics': { priority: 260 } } })`.

## Lanes and the automatic split

| Lane | For | Late or no worker |
| --- | --- | --- |
| `sim` | physics and anything the next frames read; the result is applied in a fixed frame | the main thread runs it at `collect` (`late: 'sync'`, the only rule) |
| `build` | generation at load: shapes, colliders, normals | `sync`: one job per macrotask on the main thread; `drop`; `keep-waiting` |
| `background` | the living world far from the player | usually `drop`: the far world can wait, the frame cannot |

`workers: 'auto'` (default) makes `cores − 1 − reserveCores` workers, at most `maxWorkers` (8). `sim` gets a third rounded up (1 to 3), `background` its own worker from 6 on, `build` the rest; one worker serves every lane. A `build` worker takes `sim` jobs first (they have a deadline); a `background` worker never does. `reserveCores` leaves cores to others (Jolt's job threads, an audio worklet). `workers: 0`, no `spawn`, or a runtime with no workers: every job runs on the main thread through the same kernel.

| Cores | Workers | sim | build | background |
| --- | --- | --- | --- | --- |
| 1 | 0 | main thread | main thread | main thread |
| 2 | 1 | 1, every lane | shared | shared, when idle |
| 4 | 3 | 1 | 2 | shared with build |
| 8 | 7 | 3 | 3 | 1 |
| 16+ | 8 | 3 | 4 | 1 |

## Due frame, determinism and the fallback

1. Frame N: `submit(kind, input, { frame: N })`; `dueFrame = N + latencyFrames`. The input is the coordinator's from here on: do not change it.
2. A free worker takes the job (each worker holds at most `inFlightPerWorker`, 16 by default; the rest wait in the coordinator's queue, where an urgent job passes them. Jobs leave that queue only when the main thread reads a worker's answer, so a small cap turns a burst into several frames of round trips: in the room a crater's tiles were 139 of 163 late with 2 and none with 16).
3. Frame `dueFrame`: `collect(dueFrame)` gives the worker's answer if it is back; otherwise the kernel runs here, and the late answer is thrown away when it comes. Collecting before the due frame is an error, so an early answer changes nothing.

The main thread never waits for a worker (`Atomics.wait` is forbidden there in a browser). The input of a `sync` job is copied to the worker, never transferred: the main thread keeps it for the fallback. A kind whose caller keeps its own copy for its own fallback (the ground tiles) sets `transferAwaitedInput: true`: its awaited jobs (`run`) transfer the input (`transferInput`) instead of a structured clone, and such a job, once sent, is never run on the main thread (a worker that fails it or dies holding it rejects its promise); jobs read through `collect` still copy. Outputs are transferred back (`transferOutput`). A worker that crashes is replaced (at most 5 times per worker) and its jobs go back in line; a job that kills two workers runs on the main thread.

## Workers: browser, one-file page, Node

```ts
// game-worker.ts — the file each worker loads: the kit's kinds and the game's own
import { installWorkerHost } from '@adatechnology/game-workers'
import { crowdPhysicsKind } from '@adatechnology/game-crowd'
installWorkerHost(self, [crowdPhysicsKind, pathfinding])
```

- `browserSpawn(url)`: module workers (`new URL('./game-worker.js', import.meta.url)`, resolved by the bundler).
- `sourceSpawn(code)`: a page that is one file embeds the worker bundle as text; a Blob URL is made once.
- `nodeSpawn(url)` and `nodeWorkerScope()` from `@adatechnology/game-workers/node`: `worker_threads` with the same protocol.
- `inThreadSpawn(kinds)`: the same protocol in this thread on a later macrotask (copy and transfer included), for tests.

## Equivalence test

Every kind passes `checkTaskKind(kind, samples, [nodeSpawn(url)])` in CI: each sample on the main thread, through the in-thread worker and through a real `worker_threads` worker, compared byte for byte (`firstDifference`). A resident is checked through its package (the crowd: `tests/physics/coordinator.test.ts`, the whole crowd state hashed with no worker, a worker on time and a worker always late).

## Stats

`stats()`: workers per lane, queued, running, respawned, and per kind `submitted`, `onTime`, `fallback`, `dropped`, `cancelled`, `failed`, `workerMs`, `mainMs`, `queueMs`. The test room and `perf-gate` read them: a kind with many fallbacks needs more latency, a higher priority, or more `sim` workers.

## The simulation thread

The main thread of a page may not wait, so in the plain coordinator a late `sim` job is computed again on the main thread. The simulation thread removes that limit the way native engines do: the whole fixed step runs in one dedicated worker, which **may wait** for the jobs it hands to other workers and sleeps until its next step (`Atomics.wait` is allowed in a worker). The page only pushes input and draws.

```ts
// sim-worker.ts: the simulation thread's file, with every module the game may start
import { installSimThread } from '@adatechnology/game-workers'
import { hordeSimModule } from '@adatechnology/game-crowd'
installSimThread(self, [hordeSimModule])

// the page
if (canRunSimThread()) {
  const sim = startSimThread(browserSpawn(new URL('./sim-worker.js', import.meta.url)), { module: 'crowd.horde', init, snapshotBytes: hordeSnapshotBytes(capacity) })
  // every frame: input in, the newest whole snapshot out; neither ever waits
  sim.send([HORDE_COMMAND.TARGET, player.x, player.z, player.yaw, 1])
  const snapshot = sim.latest()
  if (snapshot) readHordeSnapshot(crowd.store, snapshot.bytes)
}
```

- A module is a `SimModule` (`game-contracts`): `create(init)` gives `step(frame, dt, commands)` and `write(out, frame)`. `step` may return a promise: the loop awaits the jobs it handed to a coordinator of its own (`workers.run`), so the result never depends on how fast those workers were.
- The state reaches the page through a triple buffer of snapshots (`SnapshotWriter` / `SnapshotReader`): the writer never waits, the reader always gets the newest whole snapshot. Input goes the other way through a ring of fixed-width commands (`CommandRing`): a full ring refuses a command instead of waiting.
- `runSimInline(module, init, { steps, commands })` runs the same loop on this thread: the reference the thread must match byte for byte, and the fallback where memory cannot be shared.
- It needs shared memory: `canShareMemory()` is true in Node, in Electron (always cross-origin isolated) and in a page served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Without it, keep the plain coordinator.
- The paced loop counts its own steps (`stats()`: steps, mean and max step ms, stalls dropped); `stop()` wakes it from its sleep.

## Choosing a setup by project

| Project | Coordinator | Simulation thread | Notes |
|---|---|---|---|
| Browser game, page not isolated | `'auto'` (on in the kit preset) | no | `sim` jobs collected at their due frame, fallback here |
| Browser game, served with COOP/COEP | `'auto'` | yes, when the fixed step is busy (horde, crater ground, AI) | the page keeps input and drawing |
| Electron app | `'auto'`, `reserveCores` for Jolt | yes | `nodeSpawn` in the main process for the far world and loading; native code as a Rust addon only from the main process or a worker |
| Node server or tool | `nodeSpawn`, `'auto'` | optional (`paced: false` for a server tick or a replay) | the main thread may wait in Node |
| Phone or webview | `maxWorkers: 2` to `3` | no | measure on the device before raising it |
| Tests | `inThreadSpawn` or `nodeSpawn` | `runSimInline` | `checkTaskKind` byte for byte |

The `kit_workers` tool of the repository's `game-kit` MCP answers this for a given platform, core count and set of heavy work: the plan per lane, the kit kinds that apply with their schedule, whether to run the simulation thread, what the host must serve, and the code to start it.

Native code, when a measurement shows a kernel is worth it, is Rust compiled to WebAssembly and run inside a kind, with the same equivalence test against the TypeScript kernel (spec 009, D5). Physics stays on Jolt, which runs its own job threads: leave them cores with `reserveCores`.

## Inspirations

Naughty Dog's fiber job system (everything heavy is a job, frames in a pipeline), Unity's Job System (data-only jobs, handles, `Complete()` that forces the end: here the fallback), Unreal's TaskGraph (priority classes, named pools), Frostbite (jobs by frame phase) and Bevy's task pools (pools by the nature of the work, each a share of the cores with a floor and a ceiling). What does not carry over to the browser: fibers, waiting on the main thread, thread affinity. The design document is linked from `specs/regras/14-workers.md`.
