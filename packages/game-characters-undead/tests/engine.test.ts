import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createCharacters, createRng } from '@adatechnology/game-characters'
import { describe, expect, it } from 'vitest'

import { UNDEAD_INFECTION, UNDEAD_MOMENTS, createUndead, createUndeadPack, pickWound, speedFor, woundInfects } from '../src'

type SpawnData = { type: string; seed: number; height: number; build: number; chaseSpeed: number; wanderSpeed: number; health: number; age: number; outfit: number; helmet: number; crawls: number; variant: number; state: number; color: number }
const fixture = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/team-golden/game-spawn.json', import.meta.url)), 'utf8')) as { events: { type: string; data: SpawnData }[] }

// the game keeps its zombies in Float32Array: the recorded numbers went through float32
const round4 = (value: number): number => Math.round(Math.fround(value) * 1e4) / 1e4

const kit = createCharacters({ packs: [createUndeadPack()], penetration: 'team-game' })
const game = createUndead(kit, { speedPreset: 'team-game' })

const observe = (spawn: ReturnType<typeof game.assign>): Omit<SpawnData, 'seed'> => {
  const { traits } = spawn
  return {
    type: traits.type,
    height: round4(traits.variance.height),
    build: round4(traits.variance.build),
    chaseSpeed: round4(traits.speeds.chase as number),
    wanderSpeed: round4(traits.speeds.wander as number),
    health: round4(traits.health),
    age: traits.ageIndex,
    outfit: traits.outfitIndex,
    helmet: traits.helmet ? 1 : 0,
    crawls: traits.crawls ? 1 : 0,
    variant: traits.look.variant,
    state: traits.posture === 'upright' ? 0 : 6,
    color: traits.look.color,
  }
}

describe('G-spawn: the game zSpawn, replayed by assign (team-game speeds)', () => {
  it('matches the 650 forced spawns (13 types x seeds 1..50): size, speeds, health, age, outfit, variant and colour', () => {
    const spawns = fixture.events.filter((event) => event.type === 'spawn')
    expect(spawns).toHaveLength(650)
    const mismatches: string[] = []
    for (const { data } of spawns) {
      const { seed, ...expected } = data
      const actual = observe(game.assign({ seed }, { type: data.type }))
      if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push(`${data.type}/${seed}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`)
    }
    expect(mismatches.slice(0, 3)).toEqual([])
  })

  it('matches the 200 weighted type draws (no water: the drowned have weight 0 in the game)', () => {
    const draws = fixture.events.filter((event) => event.type === 'draw')
    expect(draws).toHaveLength(200)
    const mismatches: string[] = []
    for (const { data } of draws) {
      const { seed, ...expected } = data
      const actual = observe(game.assign({ seed }))
      if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push(`${seed}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`)
    }
    expect(mismatches.slice(0, 3)).toEqual([])
  })
})

describe('assign', () => {
  it('fills the spec the damage model reads: multipliers, age limb factor, blood, outfit protection, health', () => {
    const { spec, traits } = game.assign({ seed: 5 }, { type: 'brute', age: 'old', outfit: 'military' })
    expect(spec.kind).toBe('brute')
    expect(spec.bodyCount).toBe(2)
    expect(spec.multipliers).toEqual({ head: 1, torso: 1, arms: 0.6, legs: 0.7 })
    expect(spec.limbFactor).toBe(1.3)
    expect(spec.bloodFactor).toBe(0.25)
    expect(spec.protection).toEqual(['vest_military', 'helmet_combat'])
    expect(spec.stunSeconds).toBe(0.25)
    expect(spec.vitality).toBeCloseTo(traits.health, 12)
    expect((spec.traits?.undead as { type: string }).type).toBe('brute')
  })

  it('the firefighter outfit lowers the limb damage on top of the age', () => {
    const { spec } = game.assign({ seed: 5 }, { type: 'walker', age: 'fresh', outfit: 'firefighter' })
    expect(spec.limbFactor).toBeCloseTo(0.8 * 0.8, 12)
  })

  it('a given type, age or outfit does not move the draws that follow', () => {
    const forced = game.assign({ seed: 9 }, { type: 'walker', age: 'fresh', outfit: 'civilian' })
    const free = game.assign({ seed: 9 }, { type: 'walker' })
    expect(forced.traits.variance.height).toBe(free.traits.variance.height)
  })

  it('draws the drowned only where there is water, and keeps a runner no older than recent', () => {
    for (let seed = 1; seed <= 300; seed++) expect(game.assign({ seed }).traits.type).not.toBe('drowned')
    const seen = new Set<string>()
    for (let seed = 1; seed <= 3000; seed++) seen.add(game.assign({ seed }, { context: { water: true } }).traits.type)
    expect(seen.has('drowned')).toBe(true)
    for (let seed = 1; seed <= 200; seed++) expect(['fresh', 'recent']).toContain(game.assign({ seed }, { type: 'runner' }).traits.age)
  })

  it('create gives a character with the type, health and traits', () => {
    const zombie = game.create({ seed: 4 }, { type: 'runner' })
    expect(zombie.spec.kind).toBe('runner')
    expect(game.traitsOf(zombie)?.type).toBe('runner')
    expect(zombie.state().body?.vitality).toBeGreaterThan(40)
  })
})

describe('speeds x moments (P3)', () => {
  const walker = { type: 'walker', speeds: { wander: 0.6, chase: 1.4 } }
  const drowned = { type: 'drowned', speeds: { wander: 0.6, chase: 1.2, frenzy: 2.5, water: 3 } }
  const m = UNDEAD_MOMENTS

  it('wander, alert (x1.3 of wander), chase and the scream boost (x1.2 of the chase)', () => {
    expect(speedFor(walker.speeds, { moment: 'wander' }, m)).toBe(0.6)
    expect(speedFor(walker.speeds, { moment: 'alert' }, m)).toBeCloseTo(0.78, 12)
    expect(speedFor(walker.speeds, { moment: 'chase' }, m)).toBe(1.4)
    expect(speedFor(walker.speeds, { moment: 'chase', screamBoost: true }, m)).toBeCloseTo(1.68, 12)
    expect(speedFor(walker.speeds, { moment: 'wander', screamBoost: true }, m)).toBe(0.6)
  })

  it('a limp halves it, a crawl is capped at 0.4 and wins over the limp', () => {
    expect(speedFor(walker.speeds, { moment: 'chase', limp: true }, m)).toBeCloseTo(0.7, 12)
    expect(speedFor(walker.speeds, { moment: 'chase', crawling: true }, m)).toBe(0.4)
    expect(speedFor(walker.speeds, { moment: 'wander', crawling: true, limp: true }, m)).toBe(0.4)
  })

  it('in water the drowned swim at 3.0 and the rest slow to x0.6', () => {
    expect(speedFor(drowned.speeds, { moment: 'chase', inWater: true }, m, 'drowned')).toBe(3)
    expect(speedFor(walker.speeds, { moment: 'chase', inWater: true }, m, 'walker')).toBeCloseTo(0.84, 12)
  })

  it('night changes nothing (the game has no night speed), and a moment the body lacks is its chase', () => {
    expect(speedFor(walker.speeds, { moment: 'chase', night: true }, m)).toBe(1.4)
    expect(speedFor(walker.speeds, { moment: 'frenzy' }, m)).toBe(1.4)
    expect(speedFor(drowned.speeds, { moment: 'frenzy' }, m)).toBe(2.5)
  })

  it('the stalker creeps at 1.4 whatever its age and chases at the scaled chase', () => {
    const stalker = game.assign({ seed: 3 }, { type: 'stalker', age: 'old' })
    expect(stalker.traits.speeds.stalk).toBe(1.4)
    expect(game.speedFor(stalker.traits, { moment: 'stalk' })).toBe(1.4)
    expect(game.speedFor(stalker.traits, { moment: 'chase' })).toBeCloseTo(stalker.traits.speeds.chase as number, 12)
  })

  it('the default preset keeps the catalog chase; team-game takes the frenzy of the types that have one', () => {
    const plain = createUndead(kit)
    expect(plain.assign({ seed: 1 }, { type: 'blind' }).traits.speeds.chase).toBeLessThan(game.assign({ seed: 1 }, { type: 'blind' }).traits.speeds.chase as number)
  })
})

describe('damage hooks', () => {
  it('the bloater bursts: a 4 m cloud, 5 s blind, a smell for 60 s and 15 m of noise; nobody else does', () => {
    const bloater = game.create({ seed: 2 }, { type: 'bloater' })
    expect(game.onDeath(bloater)).toEqual([
      { kind: 'cloud', radius: 4, seconds: 8, color: 0x8a9a2a },
      { kind: 'blind', radius: 4, seconds: 5, scentSeconds: 60 },
      { kind: 'noise', radius: 15 },
    ])
    expect(game.onDeath(game.create({ seed: 2 }, { type: 'walker' }))).toEqual([])
  })

  it('the charred ignore fire and lose 30% in water; the brute has a smaller head area and breaks doors x3', () => {
    const charred = game.create({ seed: 1 }, { type: 'charred' })
    const brute = game.create({ seed: 1 }, { type: 'brute' })
    const walker = game.create({ seed: 1 }, { type: 'walker' })
    expect(game.isFireImmune(charred)).toBe(true)
    expect(game.isFireImmune(walker)).toBe(false)
    expect(game.waterHealthLoss(charred)).toBe(0.3)
    expect(game.waterHealthLoss(walker)).toBe(0)
    expect(game.headAreaFactor(brute)).toBe(0.6)
    expect(game.headAreaFactor(walker)).toBe(1)
    expect(game.doorDamageFactor(brute)).toBe(3)
    expect(game.doorDamageFactor(walker)).toBe(1)
  })
})

describe('size of a drawn zombie', () => {
  it('is the body spec\'s height times the drawn factor, in metres (not the factor itself)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const zombie = game.create({ seed }, { type: 'walker' })
      const factor = game.traitsOf(zombie)!.variance.height
      expect(zombie.spec.height).toBeCloseTo(kit.body.heightMetres * factor, 9)
      expect(zombie.spec.height).toBeGreaterThan(1.3)
    }
  })
})

describe('turning a person (P6)', () => {
  it('keeps the body of the person: seed, size, age group and a missing limb; health is the type\'s', () => {
    const person = kit.create({ seed: 12, kind: 'person', age: 'adult', height: 1.74, build: 1.02 })
    person.hit({ type: 'slash', point: [0.2, 1.4, 0], direction: [-1, 0, 0], part: 'upperArmL', points: 100, cut: 1 })
    expect(person.segments.find((segment) => segment.id === 'upperArmL')?.status).toBe('severed')
    const zombie = game.turn(person, { type: 'walker' })
    expect(zombie.spec.seed).toBe(12)
    expect(zombie.spec.height).toBe(1.74)
    expect(zombie.spec.kind).toBe('walker')
    expect(zombie.segments.find((segment) => segment.id === 'upperArmL')?.status).toBe('severed')
    expect(zombie.segments.find((segment) => segment.id === 'torso')?.status).toBe('ok')
    expect(zombie.alive).toBe(true)
    expect(game.traitsOf(zombie)?.turnedFrom?.kind).toBe('person')
  })

  it('children turn too, but never into a brute or a bloater (the child pool)', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 600; seed++) {
      const child = kit.create({ seed, kind: 'person', age: 'child', height: 1.2 })
      const zombie = game.turn(child)
      seen.add(zombie.spec.kind)
      expect(zombie.spec.age).toBe('child')
      expect(zombie.spec.height).toBe(1.2)
    }
    expect(seen.has('brute')).toBe(false)
    expect(seen.has('bloater')).toBe(false)
    expect(seen.size).toBeGreaterThan(5)
  })

  it('the child pool is an option', () => {
    const only = createUndead(kit, { childTypePool: ['crawler'] })
    expect(only.turn(kit.create({ seed: 3, kind: 'person', age: 'child' })).spec.kind).toBe('crawler')
  })

  it('a seed from game-infection becomes a zombie of the region; a removed agent makes none', () => {
    expect(game.fromAgent({ state: 'removed', seed: 1 })).toBeUndefined()
    const zombie = game.fromAgent({ state: 'active', seed: 77 }, { id: 'region-1' })
    expect(zombie?.spec.seed).toBe(77)
    expect(game.fromAgent({ state: 'active', seed: 77 })?.spec.kind).toBe(zombie?.spec.kind)
  })
})

describe('wound infection', () => {
  it('scratch 6%, laceration 22%, bite 100% against one draw', () => {
    expect(woundInfects(UNDEAD_INFECTION, 'bite', () => 0.999)).toBe(true)
    expect(woundInfects(UNDEAD_INFECTION, 'laceration', () => 0.21)).toBe(true)
    expect(woundInfects(UNDEAD_INFECTION, 'laceration', () => 0.23)).toBe(false)
    expect(woundInfects(UNDEAD_INFECTION, 'scratch', () => 0.05)).toBe(true)
    expect(woundInfects(UNDEAD_INFECTION, 'scratch', () => 0.07)).toBe(false)
    expect([0.1, 0.7, 0.95].map((draw) => pickWound(UNDEAD_INFECTION, () => draw))).toEqual(['scratch', 'laceration', 'bite'])
  })

  it('a bite runs the accelerated timeline: malaise, fever at 30 s, delirium at 70 s, death at 120 s and the reanimation 8 s later', () => {
    const bite = game.infect('bite', createRng(1))!
    expect(bite.sample().phase.id).toBe('malaise')
    expect(bite.advance(30).phase.id).toBe('fever')
    expect(bite.advance(40).phase.id).toBe('delirium')
    expect(bite.dead).toBe(false)
    expect(bite.advance(50).phase.id).toBe('dead')
    expect(bite.dead).toBe(true)
    expect(bite.reanimated).toBe(false)
    expect(bite.advance(8).phase.id).toBe('reanimated')
    expect(bite.reanimated).toBe(true)
  })

  it('no infection when the draw misses; the hours clock follows the Elenco (2, 12, 30, 48 h)', () => {
    expect(game.infect('scratch', () => 0.99)).toBeUndefined()
    const hours = createUndead(kit, { infectionClock: 'hours', hoursPerSecond: 1 }).infect('bite', () => 0)!
    expect(hours.sample().phase.id).toBe('well')
    expect(hours.advance(2).phase.id).toBe('malaise')
    expect(hours.advance(10).phase.id).toBe('fever')
    expect(hours.advance(18).phase.id).toBe('delirium')
    expect(hours.advance(18).phase.id).toBe('reanimated')
  })
})
