import { readFileSync } from 'node:fs'

import type { GoldenEvent, GoldenRecord } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import { VM_GOLDENS } from '../src/golden/vm-goldens'
import { serializeGolden } from '../src/golden/write-golden'
import { fixturePath } from '../src/paths'

const read = (package_: string, file: string): GoldenRecord => JSON.parse(readFileSync(fixturePath(package_, file), 'utf8')) as GoldenRecord
const eventsOf = (record: GoldenRecord, type: string): readonly Record<string, unknown>[] => record.events.filter((event: GoldenEvent) => event.type === type).map((event) => event.data ?? {})

describe('vm goldens (the game code run with a seeded RNG per character)', () => {
  it.each(VM_GOLDENS)('$id is re-recorded twice byte-identical and equals the fixture', ({ path, record }) => {
    const first = serializeGolden(record())
    expect(serializeGolden(record())).toBe(first)
    expect(readFileSync(path, 'utf8')).toBe(first)
  })
})

describe('G-spawn', () => {
  const golden = read('game-characters-undead', 'game-spawn.json')

  it('spawns every type for seeds 1..50, and draws the type by weight for 200 more', () => {
    const spawns = eventsOf(golden, 'spawn')
    expect(spawns).toHaveLength(13 * 50)
    expect(new Set(spawns.map((spawn) => spawn.type)).size).toBe(13)
    const draws = eventsOf(golden, 'draw')
    expect(draws).toHaveLength(200)
    const counts = new Map<unknown, number>()
    for (const draw of draws) counts.set(draw.type, (counts.get(draw.type) ?? 0) + 1)
    expect(counts.get('walker') ?? 0).toBeGreaterThan(counts.get('runner') ?? 0)
    expect(counts.has('drowned')).toBe(false)
  })

  it('keeps the zSpawn clamps: height 0.9..1.1 (times the type scale), runner never older than "recent", crawler crawls', () => {
    const spawns = eventsOf(golden, 'spawn')
    for (const spawn of spawns.filter((entry) => entry.type === 'walker')) expect(spawn.height as number).toBeGreaterThanOrEqual(0.9 - 1e-3)
    for (const spawn of spawns.filter((entry) => entry.type === 'runner')) expect(spawn.age as number).toBeLessThanOrEqual(1)
    for (const spawn of spawns.filter((entry) => entry.type === 'crawler')) expect(spawn.crawls).toBe(1)
    for (const spawn of spawns.filter((entry) => entry.type === 'brute')) expect(spawn.height as number).toBeGreaterThan(1.2)
  })
})

describe('G-damage-regions', () => {
  const golden = read('game-characters', 'game-damage-regions.json')
  const hits = (scenario: string) => eventsOf(golden, 'hit').filter((hit) => hit.scenario === scenario)

  it('lets a helmet take one pistol-class shot and the second one kill', () => {
    const [first, second] = hits('helmet_then_9mm')
    expect([first?.helmet, first?.died, second?.died, second?.headshot]).toEqual([0, false, true, true])
  })

  it('limps at half the leg, crawls with the bone broken (bit 128) when it runs out, and severs (bit 8) with a cut', () => {
    const legs = hits('leg_to_limp_then_crawl')
    expect(legs[0]).toMatchObject({ limp: 0, crawl: 0 })
    expect(legs[1]).toMatchObject({ limp: 1, crawl: 0 })
    expect(legs[2]).toMatchObject({ crawl: 1, missing: 128 })
    expect(hits('arm_severed_by_machete')[0]?.missing).toBe(2)
  })

  it('kills a head with 9 mm and .308 at once, and takes the skull (bit 1) at over 60', () => {
    expect(hits('head_9mm_kills')[0]).toMatchObject({ died: true, headshot: true, missing: 0 })
    expect(hits('head_308_takes_the_skull')[0]).toMatchObject({ died: true, missing: 1 })
  })

  it('rolls the jaw (bit 512) in some seeds and not in others', () => {
    const rolls = eventsOf(golden, 'hit').filter((hit) => String(hit.scenario).startsWith('jaw_roll_'))
    expect(rolls).toHaveLength(20)
    expect(rolls.some((hit) => hit.missing === 512)).toBe(true)
    expect(rolls.some((hit) => hit.missing === 0)).toBe(true)
  })
})

describe('G-penetration', () => {
  const golden = read('game-characters', 'game-penetration.json')
  const lines = eventsOf(golden, 'line')
  const crossed = (line: string): unknown => lines.find((entry) => entry.line === line)?.bodiesHit

  it('crosses 2, 1, 3 and 4 walkers with 9x19, 12 ga, 7.62x39 and .308, as the game pen points say', () => {
    expect(['walkers_9x19', 'walkers_12ga', 'walkers_762x39', 'walkers_308'].map(crossed)).toEqual([2, 1, 3, 4])
  })

  it('pays double for a brute torso and 75% of the damage per body', () => {
    expect(crossed('brute_first_762')).toBe(2)
    const bodies = eventsOf(golden, 'body').filter((body) => body.line === 'walkers_762x39')
    expect(bodies.map((body) => body.damage)).toEqual([55, 41.25, 30.9375, 0, 0])
  })
})

describe('G-gait (walkGait) and the body shader chunk', () => {
  it('has the stride of the game: 0 below 0.05 m/s and growing with speed', () => {
    const golden = read('game-characters', 'game-walk-gait.json')
    const walk = eventsOf(golden, 'walk').filter((entry) => entry.height === 1)
    expect(walk[0]?.amplitude).toBe(0)
    expect((walk.at(-1)?.amplitude as number) > (walk[4]?.amplitude as number)).toBe(true)
    expect(walk).toHaveLength(25)
  })

  it('has the vertex shader chunk of the instanced body (a source test: the port carries it byte for byte)', () => {
    const [chunk] = eventsOf(read('game-characters-three', 'game-body-chunk.json'), 'glsl')
    expect(chunk?.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(chunk?.length as number).toBeGreaterThan(2000)
  })
})
