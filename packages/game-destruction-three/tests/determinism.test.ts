import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { DebrisCostSample } from '../src/blast-debris'
import { Scene, runScene } from './determinism-scene'
import { IS_JOLT } from './setup-physics'

const FRAMES = 150
const SEED = 5
const OUT = process.env.DETERMINISM_OUT

interface Worker {
  readonly hashes: string[]
  readonly samples: DebrisCostSample[]
}

/** The scene in another Node process (this file again, with the output path set), with the fake machine's cost; `replay` plays a recording of another machine. */
const inAnotherProcess = (source: 'fixed' | 'measured' | 'replay', msPerBody: number, replay?: readonly DebrisCostSample[]): Promise<Worker> =>
  new Promise((resolve, reject) => {
    const dir = mkdtempSync(join(tmpdir(), 'determinism-d3-'))
    const file = join(dir, 'out.json')
    const replayFile = join(dir, 'replay.json')
    if (replay) writeFileSync(replayFile, JSON.stringify(replay))
    const env = { ...process.env, PIECE_SOLVER: 'jolt', DETERMINISM_OUT: file, DETERMINISM_SOURCE: source, DETERMINISM_COST: String(msPerBody), ...(replay ? { DETERMINISM_REPLAY: replayFile } : {}) }
    const child = spawn('npx', ['vitest', 'run', 'tests/determinism.test.ts'], { env, stdio: 'ignore' })
    child.on('exit', (code) => (code === 0 ? resolve(JSON.parse(readFileSync(file, 'utf8')) as Worker) : reject(new Error(`worker exited ${code}`))))
  })

describe.skipIf(OUT === undefined || !IS_JOLT)('determinism worker (run by the tests below, one per process)', () => {
  it('writes the hash of every frame and the cost samples it read', { timeout: 120000 }, () => {
    const source = process.env.DETERMINISM_SOURCE as 'fixed' | 'measured' | 'replay'
    const msPerBody = Number(process.env.DETERMINISM_COST)
    const samples: DebrisCostSample[] = []
    const replay = process.env.DETERMINISM_REPLAY ? (JSON.parse(readFileSync(process.env.DETERMINISM_REPLAY, 'utf8')) as DebrisCostSample[]) : []
    const cost = source === 'fixed' ? ({ source } as const) : source === 'replay' ? ({ source, samples: replay } as const) : ({ source, record: samples } as const)
    writeFileSync(OUT ?? '', JSON.stringify({ hashes: runScene({ seed: SEED, cost, msPerBody }, FRAMES), samples }))
  })
})

describe.skipIf(OUT !== undefined || !IS_JOLT)('C8: determinism of the debris policy (spec 008)', () => {
  it('two processes, fixed cost, machines of very different step cost: every frame bit-identical', { timeout: 240000 }, async () => {
    const [a, b] = await Promise.all([inAnotherProcess('fixed', 0.002), inAnotherProcess('fixed', 0.09)])
    expect(a.hashes).toHaveLength(FRAMES)
    expect(a.hashes).toEqual(b.hashes)
    expect(a.hashes).toEqual(runScene({ seed: SEED, cost: { source: 'fixed' }, msPerBody: 0.5 }, FRAMES))
  })

  it('the hazard is real: measured on two machines of different cost, the frames diverge', { timeout: 240000 }, async () => {
    const [a, b] = await Promise.all([inAnotherProcess('measured', 0.002), inAnotherProcess('measured', 0.09)])
    expect(a.hashes).not.toEqual(b.hashes)
  })

  it('a session measured on one machine replays on another with the same frames, whatever that machine reports', { timeout: 240000 }, async () => {
    const recorded = await inAnotherProcess('measured', 0.03)
    expect(recorded.samples.length).toBeGreaterThan(0)
    const replayed = await inAnotherProcess('replay', 0.09, recorded.samples)
    expect(replayed.hashes).toEqual(recorded.hashes)
  })

  it('save at frame 32 with the wake queue pending, run, then a renderer rebuilt to frame 32 loads the bytes over a disturbed world: bit-identical', { timeout: 120000 }, () => {
    const options = { seed: SEED, cost: { source: 'fixed' }, msPerBody: 0.05 } as const
    const scene = new Scene(options)
    for (let i = 0; i < 32; i++) scene.step()
    const saved = scene.save()
    expect(saved.wakes.length).toBeGreaterThan(0)
    const run = (target: Scene): string[] => {
      const out: string[] = []
      for (let i = 0; i < 100; i++) {
        target.step()
        out.push(target.hash())
      }
      return out
    }
    const first = run(scene)
    // the host describes its own bodies again (the scene is deterministic, so the same ones in the same order), then the saved bytes go over a world that was woken and shoved
    const rebuilt = new Scene(options)
    for (let i = 0; i < 32; i++) rebuilt.step()
    expect(rebuilt.save().wakes.map((e) => [e.priority, e.waited, e.maxDelay])).toEqual(saved.wakes.map((e) => [e.priority, e.waited, e.maxDelay]))
    rebuilt.loop.world.wakeInBox([-100, -1, -100], [100, 10, 100])
    expect(rebuilt.load(saved, false)).toBe(true)
    expect(run(rebuilt)).toEqual(first)
  })
})
