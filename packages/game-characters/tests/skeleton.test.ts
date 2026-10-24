import { MISSING_BITS } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { GAME_BONES, GUIDE, JOINT_IDS, REGION_HIT_POINTS, REGION_SEGMENTS, SEGMENT_IDS, SEGMENT_NUMBERS, SEGMENT_TREE, TEAM_GAME, createCharacters, segmentsBelow } from '../src'
import body from '../src/data/body.json'

describe('body spec and rig', () => {
  it('GUIDE follows the Elenco guide: 1.80 m, shoulders 0.61 m apart at 1.475 m, left on +x', () => {
    expect(GUIDE.heightMetres).toBe(1.8)
    expect(GUIDE.joints.shoulderL[0] - GUIDE.joints.shoulderR[0]).toBeCloseTo(body.guide.shoulderWidthMetres, 10)
    expect(GUIDE.joints.shoulderL[1]).toBe(1.475)
    expect(GUIDE.joints.shoulderL[0]).toBeGreaterThan(0)
  })

  it('TEAM_GAME keeps the game joints verbatim (shoulders ±0.24 m)', () => {
    expect(TEAM_GAME.joints.shoulderL).toEqual([-0.24, 1.44, 0])
    expect(TEAM_GAME.joints.kneeR).toEqual([0.1, 0.5, 0])
    expect(TEAM_GAME.joints.hip).toEqual([0, 0.95, 0])
  })

  it('every joint has a position in both specs, and the game bones are 0..11', () => {
    for (const spec of [GUIDE, TEAM_GAME]) for (const joint of JOINT_IDS) expect(spec.joints[joint]).toHaveLength(3)
    expect(Object.values(GAME_BONES).sort((a, b) => a - b)).toEqual([...Array(12).keys()])
  })

  it('the rig scales with height and build', () => {
    const kit = createCharacters()
    const tall = kit.create({ seed: 1, kind: 'person', height: 2.0, build: 1.2 })
    expect(tall.rig.joints.shoulderL[1]).toBeCloseTo((1.475 * 2) / 1.8, 10)
    expect(tall.rig.joints.shoulderL[0]).toBeCloseTo((0.305 * 2 * 1.2) / 1.8, 10)
  })
})

describe('segment tree', () => {
  it('has 17 segments of the 11 kinds, parents before children', () => {
    expect(SEGMENT_TREE).toHaveLength(17)
    expect(new Set(SEGMENT_TREE.map((node) => node.kind)).size).toBe(11)
    SEGMENT_TREE.forEach((node, index) => {
      if (node.parent) expect(SEGMENT_IDS.indexOf(node.parent)).toBeLessThan(index)
    })
  })

  it('what falls with a severed segment is everything below it', () => {
    expect(segmentsBelow('upperArmL')).toEqual(['forearmL', 'handL'])
    expect(segmentsBelow('thighR')).toEqual(['shinR', 'footR'])
    expect(segmentsBelow('neck')).toEqual(['head', 'jaw'])
    expect(segmentsBelow('torso')).toEqual(['neck', 'head', 'jaw', 'upperArmL', 'forearmL', 'handL', 'upperArmR', 'forearmR', 'handR'])
  })

  it('uses the Arsenal numbers (A4)', () => {
    expect(SEGMENT_NUMBERS.torso).toEqual({ hitPoints: 150, multiplier: 1, bleed: 10 })
    expect(SEGMENT_NUMBERS.head).toEqual({ hitPoints: 40, multiplier: 3, bleed: 40 })
    expect(SEGMENT_NUMBERS.neck.bleed).toBe(46)
  })

  it('the 6 regions cover the 17 segments once, with the game hit points', () => {
    const covered = Object.values(REGION_SEGMENTS).flat()
    expect(new Set(covered).size).toBe(17)
    expect(REGION_HIT_POINTS).toEqual({ head: 40, armL: 60, armR: 60, legL: 80, legR: 80 })
    expect(MISSING_BITS.jaw).toBe(512)
  })
})

describe('createCharacters', () => {
  it('creates a character from a preset, and the spec wins over the preset', () => {
    const kit = createCharacters({ packs: [{ id: 'test', presets: [{ id: 'big', kind: 'big', vitality: 220, bodyCount: 2, multipliers: { arms: 0.6 } }] }] })
    const brute = kit.create({ seed: 3, kind: 'big', multipliers: { legs: 0.7 } })
    expect(brute.spec.vitality).toBe(220)
    expect(brute.spec.bodyCount).toBe(2)
    expect(brute.spec.multipliers).toEqual({ head: 1, torso: 1, arms: 0.6, legs: 0.7 })
    expect(kit.create({ seed: 3, kind: 'big', vitality: 50 }).spec.vitality).toBe(50)
  })

  it('patches and removes presets by id', () => {
    const kit = createCharacters({ packs: [{ id: 'test', presets: [{ id: 'a', vitality: 10 }, { id: 'b' }] }], patch: { a: { vitality: 20 } }, remove: ['b'] })
    expect(kit.presets.get('a')?.vitality).toBe(20)
    expect(kit.presets.has('b')).toBe(false)
    expect(kit.presets.has('person')).toBe(true)
  })

  it('defaults the corpses to 400 bodies for 900 s', () => {
    expect(createCharacters().corpses).toEqual({ max: 400, seconds: 900 })
    expect(createCharacters({ corpses: { max: 50 } }).corpses).toEqual({ max: 50, seconds: 900 })
  })

  it('describes the body as 17 parts and reports its state in the destruction contract', () => {
    const character = createCharacters().create({ seed: 1, kind: 'person', id: 'p1' })
    const spec = character.describe()
    expect(spec.parts.map((part) => part.id)).toEqual(SEGMENT_IDS)
    expect(spec.joints).toHaveLength(16)
    const state = character.state()
    expect(state.groups).toEqual([[...SEGMENT_IDS]])
    expect(state.body).toEqual({ alive: true, vitality: 100, missing: 0, limp: false, crawl: false })
    const mass = spec.parts.reduce((sum, part) => sum + (part.mass ?? 0), 0)
    expect(mass).toBeCloseTo(70, 6)
  })

  it('swaps detail: regions are the segments summed and rescaled to the game hit points', () => {
    const character = createCharacters().create({ seed: 1, kind: 'person' })
    const forearm = character.segments.find((segment) => segment.id === 'forearmL')!
    forearm.hp = 0
    character.setDetail('regions')
    expect(character.detail).toBe('regions')
    expect(character.regionHitPoints().armL).toBeCloseTo((60 * (45 + 12)) / 87, 10)
    expect(character.regionHitPoints().armR).toBe(60)
  })

  it('state is plain JSON and reset brings the body back', () => {
    const character = createCharacters().create({ seed: 1, kind: 'person' })
    character.segments[0]!.hp = 1
    const state = character.state()
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
    character.reset()
    expect(character.segments[0]!.hp).toBe(SEGMENT_NUMBERS.pelvis.hitPoints)
  })
})
