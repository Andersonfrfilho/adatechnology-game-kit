import { readFileSync } from 'node:fs'
import { hashText } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'
import { INSTANT_FRAMES, LAB_ORDER, line, replayLabScene, stateFields } from './lab-replay'
import type { LabKey, LabRun } from './lab-replay'

const FIXTURE = new URL('./fixtures/team-golden/explosion-lab.json', import.meta.url)
const golden = JSON.parse(readFileSync(FIXTURE, 'utf8')) as GoldenRecord

type EventData = Record<string, unknown>
const eventsOf = (type: string, key: LabKey): EventData[] => golden.events.filter((event) => event.type === type && (event.data as EventData).key === key).map((event) => event.data as EventData)
const one = (type: string, key: LabKey): EventData => eventsOf(type, key)[0]!

function hashPool<T>(items: readonly T[], toFields: (item: T) => readonly (number | null | undefined)[]): string {
  return hashText(items.map((item) => line(toFields(item))).join('\n'))
}

function instantState(run: LabRun): EventData {
  const pools = run.world.pools()
  const lights = [...pools.lights.blast.map((light) => light.intensity), ...pools.lights.fire.map((light) => light.intensity), pools.lights.glow.intensity, pools.lights.glow.x, pools.lights.glow.y, pools.lights.glow.z]
  return {
    counts: run.counts().replaceAll('.', '/'),
    puffs: hashPool(pools.puffs.items, stateFields.puff),
    sparks: hashPool(pools.sparks.items, stateFields.spark),
    glows: hashPool(pools.glows.items, stateFields.glow),
    chunks: hashPool(pools.chunks.items, stateFields.chunk),
    fires: hashPool(run.world.fires(), stateFields.fire),
    rings: hashText(pools.rings.items.map((r) => line([r.t, r.x, r.z, r.y0, r.rise, r.rk, r.R0, r.R1, r.r, r.roll, r.life])).join('\n')),
    shocks: pools.shocks.items.map((s) => line([s.Rs, s.Rg, s.t, s.dur, s.x, s.z, s.shellScale, s.shellAlpha, s.ringScale, s.ringAlpha])),
    lights: line(lights),
  }
}

function firstMismatch(expected: readonly string[], actual: readonly string[]): string {
  const index = expected.findIndex((entry, at) => entry !== actual[at])
  if (index < 0) return actual.length === expected.length ? '' : `length ${actual.length} instead of ${expected.length}`
  return `entry ${index}\n  expected ${expected[index]}\n  actual   ${actual[index]}`
}

describe('the Explosion Lab, scene by scene, against the recording of the page', () => {
  const sceneEvent = (key: LabKey) => one('scene', key) as { camera: [number, number, number]; estimate: string }

  for (const key of LAB_ORDER) {
    describe(key, () => {
      const instants = new Map<number, EventData>()
      const run = replayLabScene(key, sceneEvent(key).camera, {
        onInstant: (current, seconds) => instants.set(seconds, instantState(current)),
      })

      it('detonates the same: LOD, what it made, the screen and the stream', () => {
        const expected = one('after_blast', key)
        expect(run.afterBlast).toEqual({ lod: expected.lod, counts: expected.counts, shake: expect.closeTo(expected.shake as number, 4), flash: expect.closeTo(expected.flash as number, 4), flashDecay: expected.flashDecay, events: expected.events, seed: expected.seed })
      })

      it('spawns the same things in the same order (the first 400 spawns, 4 decimals)', () => {
        const expected = one('spawns', key) as { list: string[]; count: number }
        expect(run.spawns.length).toBe(expected.count)
        expect(firstMismatch(expected.list, run.spawns)).toBe('')
      })

      it('has the same number of everything alive at every frame', () => {
        expect(run.frames.join(' ')).toBe((one('frames', key) as { counts: string }).counts)
      })

      it('shows each layer over the same frames as the page', () => {
        const expected = one('layers', key) as { first: Record<string, number>; last: Record<string, number> }
        expect(run.first).toEqual(expected.first)
        expect(run.last).toEqual(expected.last)
      })

      it('holds the same state at 0.08, 0.25, 0.5, 1, 2 and 4 s', () => {
        for (const instant of eventsOf('instant', key)) {
          const { seconds, stage: _stage, puffBuffer: _puffBuffer, key: _key, ...expected } = instant as EventData & { seconds: number }
          expect(instants.get(seconds), `${seconds} s`).toEqual(expected)
        }
        expect([...instants.keys()].sort()).toEqual([...INSTANT_FRAMES.values()].sort())
      })

      it('ends on the same stream state', () => {
        expect(run.world.randomState()).toBe((one('end', key) as { seed: number }).seed)
      })
    })
  }
})
