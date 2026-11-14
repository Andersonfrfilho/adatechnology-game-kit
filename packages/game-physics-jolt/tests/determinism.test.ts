import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { Sim } from './determinism-sim'
import type { CostMode } from './determinism-sim'

const FRAMES = 240
const SEED = 7
const OUT = process.env.DETERMINISM_OUT

const hashes = async (mode: CostMode, msPerBody: number): Promise<string[]> => {
  const sim = await Sim.create(SEED, mode, msPerBody)
  const out: string[] = []
  for (let i = 0; i < FRAMES; i++) {
    sim.step()
    out.push(sim.hash())
  }
  sim.world.dispose()
  return out
}

/** The same scene in another Node process (this file again, with the output path set), with the fake machine's cost. */
const inAnotherProcess = (mode: CostMode, msPerBody: number): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const file = join(mkdtempSync(join(tmpdir(), 'determinism-')), 'hashes.json')
    const child = spawn('npx', ['vitest', 'run', 'tests/determinism.test.ts'], { env: { ...process.env, DETERMINISM_OUT: file, DETERMINISM_MODE: mode, DETERMINISM_COST: String(msPerBody) }, stdio: 'ignore' })
    child.on('exit', (code) => (code === 0 ? resolve(JSON.parse(readFileSync(file, 'utf8')) as string[]) : reject(new Error(`worker exited ${code}`))))
  })

describe.skipIf(OUT === undefined)('determinism worker (run by the test below, one per process)', () => {
  it('writes the hash of every frame', { timeout: 120000 }, async () => {
    writeFileSync(OUT ?? '', JSON.stringify(await hashes(process.env.DETERMINISM_MODE as CostMode, Number(process.env.DETERMINISM_COST))))
  })
})

describe.skipIf(OUT !== undefined)('C8: determinism (spec 008)', () => {
  it('two processes, the fixed cost mode, machines of very different cost: every frame bit-identical', { timeout: 240000 }, async () => {
    const [a, b] = await Promise.all([inAnotherProcess('fixed', 0.002), inAnotherProcess('fixed', 0.09)])
    expect(a).toHaveLength(FRAMES)
    expect(a).toEqual(b)
    expect(a).toEqual(await hashes('fixed', 0.5))
  })

  it('two processes with the same measured cost are identical too', { timeout: 240000 }, async () => {
    const [a, b] = await Promise.all([inAnotherProcess('measured', 0.05), inAnotherProcess('measured', 0.05)])
    expect(a).toEqual(b)
  })

  it('the hazard is real: in the measured mode two machines of different cost diverge', { timeout: 240000 }, async () => {
    const [a, b] = await Promise.all([inAnotherProcess('measured', 0.002), inAnotherProcess('measured', 0.09)])
    expect(a).not.toEqual(b)
  })

  for (const mode of ['fixed', 'measured'] as const) {
    it(`save at frame 11 with the queue half drained, run, load into a fresh world and into the same one, run again: bit-identical (${mode})`, { timeout: 120000 }, async () => {
      const sim = await Sim.create(SEED, mode, 0.05)
      for (let i = 0; i < 11; i++) sim.step()
      const saved = sim.save()
      expect(saved.queue.length).toBeGreaterThan(0)
      expect(saved.queue.length).toBeLessThan(48)
      const run = (target: Sim): string[] => {
        const out: string[] = []
        for (let i = 0; i < 120; i++) {
          target.step()
          out.push(target.hash())
        }
        return out
      }
      const first = run(sim)
      const fresh = await Sim.create(SEED, mode, 0.05)
      expect(fresh.load(saved)).toBe(true)
      expect(run(fresh)).toEqual(first)
      expect(sim.load(saved)).toBe(true)
      expect(run(sim)).toEqual(first)
      sim.world.dispose()
      fresh.world.dispose()
    })
  }
})
