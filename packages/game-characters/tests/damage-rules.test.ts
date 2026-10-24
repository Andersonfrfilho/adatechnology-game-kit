import { MISSING_BITS } from '@adatechnology/game-contracts'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { PHYSICAL_PENETRATION, TEAM_GAME_PENETRATION, createCharacters, layeredProtection, penetrationForce, protect, segmentsBelow } from '../src'
import type { BodyHit, CharacterSpec, ProjectileInfo } from '../src'

const NINE_MM = { energy: 500, mass: 7.5, caliber: 9 } as const
const RIFLE_308 = { energy: 3504, mass: 9.7, caliber: 7.8 } as const
const kit = createCharacters()
const person = (extra: Partial<CharacterSpec> = {}) => kit.create({ seed: 1, kind: 'person', ...extra })
const shot = (part: string, load: { energy: number; mass: number; caliber: number } = NINE_MM, extra: Partial<BodyHit> = {}): BodyHit => ({ type: 'ballistic', point: [0, 1, 0], direction: [0, 0, -1], part, ...load, ...extra })
const bodyChanges = (events: readonly DestructionEvent[]) => events.flatMap((event) => (event.type === 'body' ? [`${event.change}${event.part ? `:${event.part}` : ''}`] : []))
const projectile = (force: number, extra: Partial<ProjectileInfo> = {}): ProjectileInfo => ({ force, class: 'pistol', skullRange: 1, pellets: 1, distance: 5, ...extra })

describe('1. resolve', () => {
  it('takes a segment id, a region id (its first segment) or the part nearest to the point', () => {
    const character = person()
    expect(bodyChanges(character.hit({ type: 'blunt', point: [0, 0, 0], part: 'shinL', points: 5 }))).toEqual(['wound:shinL'])
    expect(character.hit({ type: 'blunt', point: [0, 0, 0], part: 'armR', points: 5 }).find((event) => event.type === 'damage')).toMatchObject({ part: 'upperArmR' })
    const head = character.rig.joints.head
    expect(character.hit({ type: 'blunt', point: [head[0], head[1] + 0.1, head[2]], points: 1 }).find((event) => event.type === 'damage')).toMatchObject({ part: 'head' })
  })
})

describe('2. protection', () => {
  it('layers bite and scratch with 1 − Π(1 − b), capped at 90 %', () => {
    const layers = [
      { id: 'a', slots: ['arms' as const], bite: 0.5 },
      { id: 'b', slots: ['arms' as const], bite: 0.5, scratch: 0.99 },
    ]
    expect(layeredProtection({ layers, attack: 'bite' })).toBeCloseTo(0.75, 10)
    expect(layeredProtection({ layers, attack: 'scratch' })).toBe(0.9)
    expect(layeredProtection({ layers, attack: 'bite', conditions: { a: 0 } })).toBeCloseTo(0.5, 10)
  })

  it('a police vest lets 30 % of a stopped round through and 80 % of one that passes, in both models', () => {
    const vest = [{ id: 'vest_police', slots: ['torso' as const], ballistic: { resistance: 14, blunt: 0.3, pass: 0.8 } }]
    expect(protect({ layers: vest, projectile: projectile(7.67), model: PHYSICAL_PENETRATION }).ballistic).toBe(0.3)
    expect(protect({ layers: vest, projectile: projectile(18.5), model: PHYSICAL_PENETRATION }).ballistic).toBe(0.8)
    expect(protect({ layers: vest, projectile: projectile(99, { class: 'rifle' }), model: TEAM_GAME_PENETRATION }).ballistic).toBe(0.8)
    expect(protect({ layers: vest, model: PHYSICAL_PENETRATION }).ballistic).toBe(1)
  })

  it('a combat helmet takes one pistol round whole, then it is gone', () => {
    const character = person({ protection: ['helmet_combat'] })
    const first = character.hit(shot('head'))
    expect(character.lastHit).toMatchObject({ absorbedBy: 'helmet_combat', points: 0 })
    expect(first.map((event) => event.type)).toEqual(['debris'])
    expect(character.intactProtection()).toEqual([])
    character.hit(shot('head'))
    expect(character.alive).toBe(false)
  })

  it('a turnout coat takes 20 % off limb hits and 75 % off fire', () => {
    const coat = person({ protection: ['turnout_gear'] })
    const bare = person()
    coat.hit({ type: 'blunt', point: [0, 0, 0], part: 'thighL', points: 10 })
    bare.hit({ type: 'blunt', point: [0, 0, 0], part: 'thighL', points: 10 })
    const thigh = (character: typeof coat) => 55 - character.segments.find((segment) => segment.id === 'thighL')!.hp
    expect(thigh(coat)).toBeCloseTo(thigh(bare) * 0.8, 10)
    coat.hit({ type: 'fire', point: [0, 1, 0], temperature: 800, radius: 1, duration: 2 })
    expect(coat.lastHit?.points).toBeCloseTo(3 * 2 * 0.25, 10)
  })
})

describe('3. penetration (physical)', () => {
  it('a 9 mm goes through a limb and a torso (P 7.67 > R) but not a torso under a police vest', () => {
    expect(penetrationForce(NINE_MM.energy, NINE_MM.mass, NINE_MM.caliber)).toBeGreaterThan(7.5)
    const events = person({ vitality: 1000 }).hit(shot('torso'))
    expect(events.find((event) => event.type === 'hole')).toMatchObject({ hole: { through: true }, exitPoint: expect.any(Array) })
    const vested = person({ protection: ['vest_police'] })
    expect(vested.hit(shot('torso')).find((event) => event.type === 'hole')).toMatchObject({ hole: { through: false } })
    expect(vested.lastHit?.exitEnergy).toBe(0)
  })

  it('a brute torso resists like two bodies', () => {
    expect(person({ bodyCount: 2 }).resistanceOf('torso')).toBe(15)
    expect(person().resistanceOf('head')).toBeCloseTo(5.25, 10)
    expect(person().resistanceOf('legL')).toBe(3.75)
  })
})

describe('4. points', () => {
  it('3.5·E^0.37 by default, the caller or the calibre table override it, the spread draws once per blow', () => {
    const character = person({ vitality: 1e6 })
    character.hit(shot('torso'))
    expect(character.lastHit?.points).toBeCloseTo(3.5 * 500 ** 0.37, 10)
    character.hit(shot('torso', NINE_MM, { points: 12 }))
    expect(character.lastHit?.points).toBe(12)
    const tabled = createCharacters({ calibers: [{ id: 'nine', points: 40 }] }).create({ seed: 1, kind: 'person' })
    tabled.hit(shot('torso', NINE_MM, { caliberId: 'nine' }))
    expect(tabled.lastHit?.points).toBe(40)
    const spread = createCharacters({ damage: { spread: 0.15 } }).create({ seed: 1, kind: 'person', random: () => 1, vitality: 1e6 })
    const torso = () => spread.segments.find((segment) => segment.id === 'torso')!.hp
    spread.hit({ type: 'blunt', point: [0, 0, 0], part: 'torso', points: 10 })
    expect(150 - torso()).toBeCloseTo(11.5, 10)
  })
})

describe('5. multipliers', () => {
  it('segment MULT × type multiplier × age on limbs', () => {
    const character = person({ multipliers: { arms: 1.2 }, limbFactor: 1.3 })
    character.hit({ type: 'blunt', point: [0, 0, 0], part: 'forearmL', points: 10 })
    expect(30 - character.segments.find((segment) => segment.id === 'forearmL')!.hp).toBeCloseTo(10 * 0.6 * 1.2 * 1.3, 10)
  })
})

describe('6. severity', () => {
  it('an edge severs at the joint and everything below falls with it', () => {
    const character = person()
    const events = character.hit({ type: 'slash', point: [0, 0, 0], part: 'upperArmL', points: 80 })
    expect(bodyChanges(events)).toContain('severed:upperArmL')
    expect(events.find((event) => event.type === 'detach')).toMatchObject({ joint: 'torso~upperArmL', groups: [['upperArmL', 'forearmL', 'handL']] })
    expect(character.state().groups).toEqual([character.segments.filter((segment) => segment.attached).map((segment) => segment.id), ['upperArmL', ...segmentsBelow('upperArmL')]])
  })

  it('a pistol breaks a bone; a blow of twice the segment or a blast destroys it', () => {
    const broken = person()
    for (let blow = 0; blow < 3; blow++) broken.hit(shot('forearmR', NINE_MM, { points: 20 }))
    expect(broken.segments.find((segment) => segment.id === 'forearmR')).toMatchObject({ status: 'broken', attached: true })
    const destroyed = person()
    expect(destroyed.hit({ type: 'blunt', point: [0, 0, 0], part: 'handL', points: 50 }).some((event) => event.type === 'fracture')).toBe(true)
    expect(destroyed.segments.find((segment) => segment.id === 'handL')?.status).toBe('destroyed')
    expect(broken.state().body?.missing).toBe(MISSING_BITS.armRBroken)
  })

  it('a leg at half limps, a lost thigh crawls, a torso blow of 150 splits the body', () => {
    const character = person({ vitality: 1e6 })
    expect(bodyChanges(character.hit({ type: 'blunt', point: [0, 0, 0], part: 'thighL', points: 40 }))).toContain('limp')
    expect(bodyChanges(character.hit({ type: 'slash', point: [0, 0, 0], part: 'thighL', points: 40 }))).toEqual(expect.arrayContaining(['severed:thighL', 'crawl']))
    const split = person({ vitality: 1e6 })
    expect(bodyChanges(split.hit({ type: 'blunt', point: [0, 0, 0], part: 'pelvis', points: 150 }))).toEqual(expect.arrayContaining(['severed:torso', 'split:torso', 'killed']))
  })

  it('head: a 9 mm pierces the skull and kills, a .308 above 60 points takes the head off, a club needs the head hit points', () => {
    const nine = person()
    nine.hit(shot('head'))
    expect(nine.lastHit).toMatchObject({ killed: true, headshot: true })
    expect(nine.segments.find((segment) => segment.id === 'head')?.status).toBe('broken')
    const rifle = person()
    rifle.hit(shot('head', RIFLE_308))
    expect(rifle.state().body?.missing).toBe(MISSING_BITS.head)
    expect(rifle.segments.find((segment) => segment.id === 'head')?.status).toBe('destroyed')
    const club = person()
    club.hit({ type: 'blunt', point: [0, 0, 0], part: 'head', points: 10 })
    expect(club.alive).toBe(true)
    club.hit({ type: 'blunt', point: [0, 0, 0], part: 'head', points: 4 })
    expect(club.alive).toBe(false)
  })

  it('a non-lethal head blow above 25 points takes the jaw 30 % of the time', () => {
    const lucky = person({ random: () => 0.29, vitality: 1e6 })
    expect(bodyChanges(lucky.hit({ type: 'blunt', point: [0, 0, 0], part: 'head', points: 12, distance: 1 }))).not.toContain('severed:jaw')
    const jaw = createCharacters({ penetration: 'team-game' }).create({ seed: 1, kind: 'person', random: () => 0.29, vitality: 1e6 })
    expect(bodyChanges(jaw.hit({ type: 'ballistic', point: [0, 0, 0], part: 'head', points: 30, caliberId: '12ga_00buck', distance: 12 }))).toContain('severed:jaw')
  })
})

describe('7. death rules', () => {
  it('vitality-or-head kills at 0 vitality; head-only keeps the body going until the head', () => {
    const rules = createCharacters({ damage: { deathRule: 'head-only' } })
    const halves = rules.create({ seed: 1, kind: 'person' })
    halves.hit({ type: 'blunt', point: [0, 0, 0], part: 'pelvis', points: 150 })
    expect(halves.alive).toBe(true)
    expect(halves.state().body?.crawl).toBe(true)
    const headOnly = rules.create({ seed: 1, kind: 'person', vitality: 10 })
    headOnly.hit({ type: 'blunt', point: [0, 0, 0], part: 'torso', points: 20 })
    expect(headOnly.alive).toBe(true)
    headOnly.hit(shot('head'))
    expect(headOnly.alive).toBe(false)
    const normal = person({ vitality: 10 })
    normal.hit({ type: 'blunt', point: [0, 0, 0], part: 'torso', points: 11 })
    expect(normal.alive).toBe(false)
  })
})

describe('8. bleeding', () => {
  it('a wound bleeds 30 % of the segment rate for 10 s, scaled by the blood factor, and reports leaks each second', () => {
    const character = person({ bloodFactor: 0.6, vitality: 1e6 })
    const opened = character.hit({ type: 'slash', point: [0, 1, 0], part: 'thighL', points: 5 })
    expect(character.bleeders()).toEqual([{ part: 'thighL', rate: 19 * 0.3 * 0.6, duration: 10, spurt: false, age: 0, reported: 0 }])
    expect(opened.find((event) => event.type === 'leak')).toMatchObject({ fluid: 'blood', pressurized: false })
    const leaks = Array.from({ length: 12 }, () => character.update(1)).map((events) => events.filter((event) => event.type === 'leak').length)
    expect(leaks).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0])
  })

  it('a severed limb bleeds from the stump (45 s, spurting) and from the piece (15 s)', () => {
    const character = person({ vitality: 1e6 })
    character.hit({ type: 'slash', point: [0, 1, 0], part: 'forearmL', points: 80, woundAtPoint: false })
    expect(character.bleeders().map(({ part, rate, duration, spurt }) => [part, rate, duration, spurt])).toEqual([
      ['upperArmL', 8, 45, true],
      ['forearmL', 8 * 0.35, 15, true],
    ])
  })

  it('a heavy hit stuns, and the stun runs out', () => {
    const character = person({ vitality: 1e6 })
    expect(bodyChanges(character.hit({ type: 'blunt', point: [0, 0, 0], part: 'torso', points: 40 }))).toContain('stunned')
    expect(character.stunSeconds).toBe(0.45)
    character.update(0.5)
    expect(character.stunSeconds).toBe(0)
  })
})
