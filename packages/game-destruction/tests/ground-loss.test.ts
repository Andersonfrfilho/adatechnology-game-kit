import { describe, expect, it } from 'vitest'

import { createDestruction, GROUND_LOSS_DEFAULTS, undercutAt } from '../src'
import { judgeBeam, mergeRuns, voidRuns } from '../src/foundation-span'
import type { BeamCheck } from '../src/foundation-span'
import { distortionOf, relativeToChord } from '../src/ground-loss'
import type { DestructibleSpec, DestructionEvent, GroundLoss, JointSpec, PartSpec } from '../src'
import { ofType, runFor } from './wall-helpers'

const WIDTH = 6
const DEPTH = 4
const HEIGHT = 2.8
const BEAM: [number, number] = [0.15, 0.3]

/**
 * A single-storey house of confined masonry on ground beams (viga baldrame), as the floorplan structure makes it: a terrain slab anchors it, the four
 * ground beams bear on it, a brick wall stands on each beam, a concrete pillar on the ground at each corner, and a concrete slab rests on walls and pillars.
 */
const houseOnGroundBeams = (): DestructibleSpec => {
  const beam = (id: string, along: 'x' | 'z', at: number): PartSpec => ({
    id, material: 'concrete', anchored: true, structure: { role: 'foundation' },
    shape: { kind: 'box', size: along === 'x' ? [WIDTH + BEAM[0], BEAM[1], BEAM[0]] : [BEAM[0], BEAM[1], DEPTH + BEAM[0]] },
    position: along === 'x' ? [WIDTH / 2, -BEAM[1] / 2, at] : [at, -BEAM[1] / 2, DEPTH / 2],
  })
  const wall = (id: string, along: 'x' | 'z', at: number): PartSpec => ({
    id, material: 'brick', structure: { role: 'wall' },
    shape: { kind: 'box', size: along === 'x' ? [WIDTH - BEAM[0], HEIGHT, BEAM[0]] : [BEAM[0], HEIGHT, DEPTH - BEAM[0]] },
    position: along === 'x' ? [WIDTH / 2, HEIGHT / 2, at] : [at, HEIGHT / 2, DEPTH / 2],
  })
  const pillar = (id: string, x: number, z: number): PartSpec => ({
    id, material: 'concrete', structure: { role: 'column' }, reinforcement: { material: 'steel', spacing: 0.1, diameter: 0.01 },
    shape: { kind: 'box', size: [BEAM[0], HEIGHT, BEAM[0]] }, position: [x, HEIGHT / 2, z],
  })
  const parts: PartSpec[] = [
    { id: 'ground', material: 'concrete', anchored: true, hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'], shape: { kind: 'box', size: [WIDTH + 6, 0.5, DEPTH + 6] }, position: [WIDTH / 2, -0.25, DEPTH / 2] },
    beam('gb_s', 'x', 0), beam('gb_n', 'x', DEPTH), beam('gb_w', 'z', 0), beam('gb_e', 'z', WIDTH),
    wall('w_s', 'x', 0), wall('w_n', 'x', DEPTH), wall('w_w', 'z', 0), wall('w_e', 'z', WIDTH),
    pillar('p_sw', 0, 0), pillar('p_se', WIDTH, 0), pillar('p_nw', 0, DEPTH), pillar('p_ne', WIDTH, DEPTH),
    { id: 'slab', material: 'concrete', structure: { role: 'slab' }, reinforcement: { material: 'steel', spacing: 0.15, diameter: 0.008 }, shape: { kind: 'box', size: [WIDTH + BEAM[0], 0.1, DEPTH + BEAM[0]] }, position: [WIDTH / 2, HEIGHT + 0.05, DEPTH / 2] },
  ]
  const on = (a: string, b: string, kind: JointSpec['kind']): JointSpec => ({ a, b, kind, bears: 'a_on_b' })
  const joints: JointSpec[] = [
    ...['gb_s', 'gb_n', 'gb_w', 'gb_e', 'p_sw', 'p_se', 'p_nw', 'p_ne'].map((id) => on(id, 'ground', 'rebar')),
    on('w_s', 'gb_s', 'mortar'), on('w_n', 'gb_n', 'mortar'), on('w_w', 'gb_w', 'mortar'), on('w_e', 'gb_e', 'mortar'),
    ...['w_s', 'w_n', 'w_w', 'w_e', 'p_sw', 'p_se', 'p_nw', 'p_ne'].map((id) => on('slab', id, 'mortar')),
    // the walls are tied to the pillars beside them (confined masonry): they hold together but bear on their own beam
    ...[['w_s', 'p_sw'], ['w_s', 'p_se'], ['w_n', 'p_nw'], ['w_n', 'p_ne'], ['w_w', 'p_sw'], ['w_w', 'p_nw'], ['w_e', 'p_se'], ['w_e', 'p_ne']].map(([a, b]) => ({ a: a!, b: b!, kind: 'mortar' as const, bears: false })),
  ]
  return { name: 'house', parts, joints, tags: ['structure', 'house'] }
}

const setUp = () => {
  const world = createDestruction({ seed: 3 })
  const id = world.add(houseOnGroundBeams())
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  const standing = () => world.state(id)!.parts.filter((p) => p.status !== 'broken' && p.status !== 'collapsed').map((p) => p.id)
  /** Structural parts still standing with no load path to the ground: what would float. */
  const floating = () => world.state(id)!.parts.filter((p) => p.id !== 'ground' && p.status !== 'broken' && p.status !== 'collapsed' && !(p.stress! > 0)).map((p) => p.id)
  const subsided = (status: string) => ofType(events, 'subside').filter((e) => e.status === status).map((e) => e.part)
  const cracked = () => new Set(ofType(events, 'crack').map((e) => e.part))
  return { world, id, events, standing, floating, subsided, cracked }
}

describe('ground taken away under a house', () => {
  it('the bearing zone of a footing widens down at the spread: a bowl beside it cuts in only when its wall reaches under that slope', () => {
    const loss: GroundLoss = { x: 0, z: 0, radius: 2, depth: 1 }
    expect(undercutAt(loss, 0, 0.3, 1)).toBeCloseTo(0.7, 6)
    expect(undercutAt(loss, 1, 0.3, 1)).toBeGreaterThan(0.75 - 0.3 - 1e-9)
    expect(undercutAt(loss, 3.5, 0.3, 1)).toBe(0)
    expect(undercutAt({ ...loss, depth: 0.2 }, 0, 0.3, 1)).toBe(0)
    expect(GROUND_LOSS_DEFAULTS.crackDistortion).toBeCloseTo(1 / 300, 9)
  })

  it('is queued and applied at the next update, never inside the call', () => {
    const h = setUp()
    h.world.groundLoss({ x: -0.6, z: -0.6, radius: 1.5, depth: 0.5, source: 'crater' })
    expect(h.events).toEqual([])
    expect(h.world.part(h.id, 'gb_s')!.subsidence).toBeUndefined()
    h.world.update(0.1)
    expect(ofType(h.events, 'subside').length).toBeGreaterThan(0)
    expect(ofType(h.events, 'subside').every((e) => e.source === 'crater')).toBe(true)
  })

  it('a small shallow crater at a corner: the footing settles, the masonry over it cracks, nothing falls', () => {
    const h = setUp()
    h.world.groundLoss({ x: -0.6, z: -0.6, radius: 1.5, depth: 0.5, source: 'crater' })
    runFor(h.world, 20)
    const subsides = ofType(h.events, 'subside')
    expect(subsides.map((e) => e.part)).toEqual(expect.arrayContaining(['gb_s', 'gb_w']))
    expect(subsides.every((e) => e.status !== 'unsupported')).toBe(true)
    // the beam goes down most at the corner, and the wall on it follows the same profile
    const line = h.world.part(h.id, 'gb_s')!.settlement!
    const peak = Math.max(...line.drop)
    expect(peak).toBeGreaterThan(0.001)
    expect(peak).toBeLessThanOrEqual(GROUND_LOSS_DEFAULTS.maxSettlement)
    expect(line.drop[0]).toBe(peak)
    expect(h.world.part(h.id, 'w_s')!.settlement).toEqual(line)
    expect(h.cracked()).toContain('w_s')
    expect(h.cracked()).toContain('w_w')
    // stair-step cracks that climb toward the corner that went down
    const stairs = ofType(h.events, 'crack').filter((e) => e.part === 'w_s').map((e) => e.crack.stair!)
    expect(stairs.length).toBeGreaterThan(0)
    for (const stair of stairs) {
      expect(stair.along[0]).toBeLessThan(0)
      expect(stair.along[1]).toBeGreaterThan(0)
      expect(stair.width).toBeGreaterThan(0)
    }
    expect(ofType(h.events, 'collapse')).toEqual([])
    expect(h.standing()).toHaveLength(14)
    expect(h.floating()).toEqual([])
  })

  it('a short void under the middle of a ground beam: the beam bridges it and cracks, and the house stands', () => {
    const h = setUp()
    h.world.groundLoss({ x: WIDTH / 2, z: 0, radius: 1.75, depth: 1, source: 'crater' })
    runFor(h.world, 20)
    expect(h.subsided('bridged')).toEqual(['gb_s'])
    expect(h.subsided('unsupported')).toEqual([])
    expect(h.world.part(h.id, 'gb_s')!.cracked).toBe(true)
    expect(h.cracked()).toContain('gb_s')
    // over the void the wall follows the beam, which sags millimetres, not the ground
    expect(h.world.part(h.id, 'gb_s')!.subsidence!).toBeLessThan(GROUND_LOSS_DEFAULTS.maxSettlement)
    expect(ofType(h.events, 'collapse')).toEqual([])
    expect(h.floating()).toEqual([])
  })

  it('a big crater under a corner: the pillar and the beams over it lose their support and the corner falls, the rest stands', () => {
    const h = setUp()
    h.world.groundLoss({ x: 0, z: 0, radius: 3, depth: 2, source: 'crater' })
    runFor(h.world, 30)
    expect(h.subsided('unsupported')).toEqual(expect.arrayContaining(['p_sw', 'gb_s', 'gb_w']))
    const fallen = ofType(h.events, 'collapse').flatMap((e) => e.parts)
    expect(fallen).toEqual(expect.arrayContaining(['p_sw', 'gb_s', 'gb_w', 'w_s', 'w_w']))
    for (const part of ['gb_n', 'gb_e', 'w_n', 'w_e', 'p_ne']) expect(h.standing()).toContain(part)
    expect(h.floating()).toEqual([])
  })

  it('the same loss twice changes nothing more, and the loss survives a save', () => {
    const h = setUp()
    const loss: GroundLoss = { x: 0, z: 0, radius: 3, depth: 2, source: 'crater' }
    h.world.groundLoss(loss)
    runFor(h.world, 30)
    const after = h.events.length
    h.world.groundLoss(loss)
    runFor(h.world, 2)
    expect(ofType(h.events.slice(after), 'collapse')).toEqual([])
    const copy = createDestruction({ seed: 3 })
    copy.load(h.world.serialize())
    expect(copy.state(h.id)!.parts.filter((p) => p.status !== 'collapsed' && p.status !== 'broken').map((p) => p.id).sort()).toEqual(h.standing().sort())
    expect(runFor(copy, 5).filter((e) => e.type === 'collapse')).toEqual([])
  })
})

/** The probes of the structural review (S1, S2, S3): a wall on its ground beam with pillars, a short beam, a slab on grade. */
const terrainOf = (width: number, depth: number): PartSpec => ({
  id: 'ground', material: 'concrete', anchored: true, hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'], shape: { kind: 'box', size: [width + 12, 0.5, depth + 12] }, position: [width / 2, -0.25, depth / 2],
})
const rests = (a: string, b: string, kind: JointSpec['kind'] = 'mortar'): JointSpec => ({ a, b, kind, bears: 'a_on_b' })
const probe = (spec: DestructibleSpec, loss: GroundLoss) => {
  const world = createDestruction({ seed: 3 })
  const id = world.add(spec)
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  world.groundLoss(loss)
  runFor(world, 20)
  const parts = world.state(id)!.parts
  const standing = parts.filter((p) => p.status !== 'broken' && p.status !== 'collapsed')
  return {
    status: (part: string) => ofType(events, 'subside').find((e) => e.part === part)?.status,
    fallen: ofType(events, 'collapse').flatMap((e) => e.parts),
    chipped: ofType(events, 'chip').map((e) => e.part),
    standing: standing.map((p) => p.id),
    floating: standing.filter((p) => p.id !== 'ground' && !(p.stress! > 0)).map((p) => p.id),
  }
}

/** S1: a 10 m wall on its ground beam, pillars on their own footings at 0, 2.9, 7.1 and 10 m, a bond beam on the wall and the pillars. */
const wallOnPillars = (): DestructibleSpec => {
  const length = 10
  const pillars = [0, 2.9, 7.1, 10]
  return {
    name: 's1',
    tags: ['structure'],
    parts: [
      terrainOf(length, 1),
      { id: 'gb', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [length, 0.3, 0.15] }, position: [length / 2, -0.15, 0] },
      { id: 'wall', material: 'brick', structure: { role: 'wall' }, shape: { kind: 'box', size: [length, 2.8, 0.15] }, position: [length / 2, 1.4, 0] },
      ...pillars.map((x, k): PartSpec => ({ id: `p${k}`, material: 'concrete', structure: { role: 'column' }, reinforcement: { material: 'steel', spacing: 0.1, diameter: 0.01 }, shape: { kind: 'box', size: [0.15, 2.8, 0.15] }, position: [x, 1.4, 0] })),
      { id: 'cinta', material: 'concrete', structure: { role: 'beam' }, reinforcement: { material: 'steel', spacing: 0.1, diameter: 0.01 }, shape: { kind: 'box', size: [length, 0.2, 0.15] }, position: [length / 2, 2.9, 0] },
    ],
    joints: [
      rests('gb', 'ground', 'rebar'), ...pillars.map((_, k) => rests(`p${k}`, 'ground', 'rebar')), rests('wall', 'gb'), rests('cinta', 'wall'),
      ...pillars.map((_, k) => rests('cinta', `p${k}`)), ...pillars.map((_, k): JointSpec => ({ a: 'wall', b: `p${k}`, kind: 'mortar', bears: false })),
    ],
  }
}

/** S2: a 3 m wall on its ground beam, nothing else. */
const shortWall = (): DestructibleSpec => ({
  name: 's2',
  tags: ['structure'],
  parts: [
    terrainOf(3, 1),
    { id: 'gb', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [3, 0.3, 0.15] }, position: [1.5, -0.15, 0] },
    { id: 'wall', material: 'brick', structure: { role: 'wall' }, shape: { kind: 'box', size: [3, 2.8, 0.15] }, position: [1.5, 1.4, 0] },
  ],
  joints: [rests('gb', 'ground', 'rebar'), rests('wall', 'gb')],
})

/** S3: a 10 cm slab on grade, 8 x 6 m, with a 1 t block standing on its middle. */
const slabOnGrade = (): DestructibleSpec => ({
  name: 's3',
  tags: ['structure'],
  parts: [
    terrainOf(8, 6),
    { id: 'slab', material: 'concrete', anchored: true, structure: { role: 'slab' }, reinforcement: { material: 'steel', spacing: 0.15, diameter: 0.0063 }, shape: { kind: 'box', size: [8, 0.1, 6] }, position: [4, -0.05, 3] },
    { id: 'box', material: 'concrete', structure: { role: 'column' }, shape: { kind: 'box', size: [0.4, 1, 0.4] }, position: [4, 0.5, 3] },
  ],
  joints: [rests('slab', 'ground', 'rebar'), rests('box', 'slab')],
})

describe('the structural review: load paths over a void', () => {
  it('S1: a span too long for the beam breaks only over the void; the wall arches over it on the pillars and the rest stands', () => {
    const r = probe(wallOnPillars(), { x: 5, z: 0, radius: 2.05, depth: 1, source: 'crater' })
    expect(r.status('gb')).toBe('opened')
    expect(r.fallen).toEqual([])
    for (const part of ['gb', 'wall', 'cinta', 'p0', 'p1', 'p2', 'p3']) expect(r.standing).toContain(part)
    // the masonry under the relieving arch over the void falls out of the wall
    expect(r.chipped).toContain('wall')
    expect(r.floating).toEqual([])
  })

  it('S1b: a span the beam can bridge between the ground on each side holds', () => {
    const r = probe(wallOnPillars(), { x: 5, z: 0, radius: 1.55, depth: 1, source: 'crater' })
    expect(r.status('gb')).toBe('bridged')
    expect(r.fallen).toEqual([])
  })

  it('S2: a short overhang holds; past half the span limit, or with its weight past the ground left, the beam tips into the hole', () => {
    expect(probe(shortWall(), { x: -0.3, z: 0, radius: 1.0, depth: 2, source: 'crater' }).status('gb')).toBe('bridged')
    for (const radius of [1.5, 2.5]) {
      const r = probe(shortWall(), { x: -0.3, z: 0, radius, depth: 2, source: 'crater' })
      expect(r.status('gb')).toBe('unsupported')
      expect(r.fallen).toEqual(expect.arrayContaining(['gb', 'wall']))
    }
  })

  it('S3: a slab on grade that cannot span the hole opens over it: what stood there falls, the slab stays on the ground around; with most of its ground gone it goes', () => {
    const middle = probe(slabOnGrade(), { x: 4, z: 3, radius: 1.5, depth: 2, source: 'crater' })
    expect(middle.status('slab')).toBe('opened')
    expect(middle.fallen).toEqual(['box'])
    expect(middle.standing).toContain('slab')
    expect(middle.floating).toEqual([])
    const wide = probe(slabOnGrade(), { x: 4, z: 3, radius: 3.5, depth: 2, source: 'crater' })
    expect(wide.status('slab')).toBe('unsupported')
    expect(wide.fallen).toEqual(expect.arrayContaining(['slab', 'box']))
  })

  const beam: BeamCheck = { length: 10, depth: 0.3, load: 8000, resists: 20000, cracking: 8600, spanDepth: 10, soilSafety: 3, pillars: [], loadFactor: 1 }
  const flags = (step: number, ...runs: Array<[number, number]>): boolean[] =>
    Array.from({ length: Math.round(beam.length / step) }, (_, k) => runs.some(([a, b]) => (k + 0.5) * step > a && (k + 0.5) * step < b))

  it('every void is judged, not only the longest: a short span that holds and an overhang that does not tip the beam', () => {
    const verdict = judgeBeam(flags(0.1, [3, 4], [8.2, 10]), 0.1, beam)
    expect(verdict.runs.map((r) => r.kind)).toEqual(['span', 'cantilever'])
    expect(verdict.runs[0]!.holds).toBe(true)
    expect(verdict.tips).toBe(true)
  })

  it('voids with less ground between them than the beam is deep, or ground that cannot take the reactions, are one span', () => {
    expect(mergeRuns(voidRuns(flags(0.1, [2, 3], [3.2, 4]), 0.1), beam)).toEqual([{ start: 2, end: 4 }])
    // 0.5 m of ground between two 2 m voids takes 2 m of reactions, past twice its own share
    const merged = mergeRuns(voidRuns(flags(0.1, [3, 5], [5.5, 7.5]), 0.1), beam)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.start).toBeCloseTo(3, 6)
    expect(merged[0]!.end).toBeCloseTo(7.5, 6)
    // and the ground at the end of the beam that cannot take the reaction of the span beside it goes with it: the span reaches the end
    expect(mergeRuns(voidRuns(flags(0.1, [1, 3], [3.5, 5.5]), 0.1), beam)[0]!.start).toBe(0)
    // a pillar on that ground carries them
    expect(mergeRuns(voidRuns(flags(0.1, [3, 5], [5.5, 7.5]), 0.1), { ...beam, pillars: [5.25] })).toHaveLength(2)
  })

  it('a pillar inside a void is a support: the void is two spans', () => {
    const verdict = judgeBeam(flags(0.1, [2, 6]), 0.1, { ...beam, pillars: [4] })
    expect(verdict.runs.map((r) => [r.start, r.end])).toEqual([[2, 4], [4, 6]].map(([a, b]) => [expect.closeTo(a!, 6), expect.closeTo(b!, 6)]))
    expect(verdict.runs.every((r) => r.holds)).toBe(true)
  })

  it('a wall that only turned as a whole does not crack: the chord of the panel comes off first (Burland & Wroth)', () => {
    const tilt = Array.from({ length: 30 }, (_, k) => 0.002 * k)
    expect(distortionOf(tilt, 0.1).value).toBeGreaterThan(1 / 300)
    expect(distortionOf(relativeToChord(tilt), 0.1).value).toBeCloseTo(0, 9)
    const sag = tilt.map((v, k) => v + 0.01 * Math.sin((Math.PI * k) / 29))
    expect(distortionOf(relativeToChord(sag), 0.1).value).toBeGreaterThan(0)
  })

  it('a load-bearing wall is held to tighter limits than an infill panel', () => {
    expect(GROUND_LOSS_DEFAULTS.crackDistortion).toBeCloseTo(1 / 300, 9)
    expect(GROUND_LOSS_DEFAULTS.damageDistortion).toBeCloseTo(1 / 150, 9)
    expect(GROUND_LOSS_DEFAULTS.bearingCrackDistortion).toBeCloseTo(1 / 500, 9)
    expect(GROUND_LOSS_DEFAULTS.bearingDamageDistortion).toBeCloseTo(1 / 300, 9)
  })
})
