import { describe, expect, it } from 'vitest'
import { assemblyPart, createDestruction } from '../src'
import type { DestructionEvent, Vec3 } from '../src'
import { countByType, maxStage, ofType, wallWorld } from './wall-helpers'

const NINE_MM = { energy: 486, caliber: 9 }
const RIFLE_762 = { energy: 3300, caliber: 7.62 }
const SLEDGEHAMMER = { energy: 128, radius: 0.05 }

/** A burst of `rounds` shots at the wall, spread over a 0.8 x 0.6 m patch (the wall faces +z, bullets travel -z). */
const burst = (w: ReturnType<typeof wallWorld>, round: { energy: number; caliber: number }, rounds: number) => {
  for (let i = 0; i < rounds; i++) w.world.shoot([-0.4 + 0.2 * (i % 5), 0.8 + 0.15 * (i % 5 === 0 ? 0 : i % 4), 3], [0, 0, -1], round.energy, round.caliber)
}

const swing = (w: ReturnType<typeof wallWorld>, point: Vec3 = [0, 1, 0.065]) =>
  w.world.hit(w.objectId, { type: 'blunt', point, direction: [0, 0, -1], ...SLEDGEHAMMER })

describe('layered penetration and spall', () => {
  it('a bullet spends the coat on its way: the same shot stops, then goes through once the coat has spalled', () => {
    // the coats alone: without chipping (the first shot would knock its brick out)
    const w = wallWorld('brick_wall_plastered', { breach: { chipEnergy: 0 } })
    // core alone: 14 J/mm x 90 mm = 1260 J; with two coats of 60 J each the wall takes 1380 J
    const first = w.world.shoot([0, 1, 3], [0, 0, -1], 1330, 9)
    expect(first[0]!.penetrated).toBe(false)
    const spall = ofType(w.events, 'spall')
    expect(spall).toHaveLength(1)
    expect(spall[0]).toMatchObject({ part: 'wall', layer: 0 })
    expect(spall[0]!.area).toBeGreaterThan(0)
    const second = w.world.shoot([0, 1, 3], [0, 0, -1], 1330, 9)
    expect(second[0]!.penetrated).toBe(true)
  })

  it('spalls the outer coat before anything reaches the core, and the patch only spalls once', () => {
    const w = wallWorld('brick_wall_plastered')
    w.world.shoot([0, 1, 3], [0, 0, -1], NINE_MM.energy, NINE_MM.caliber)
    const kinds = w.events.map((e) => e.type)
    expect(kinds.indexOf('spall')).toBeGreaterThanOrEqual(0)
    expect(kinds.indexOf('spall')).toBeLessThan(kinds.indexOf('hole'))
    w.world.shoot([0, 1, 3], [0, 0, -1], NINE_MM.energy, NINE_MM.caliber)
    expect(ofType(w.events, 'spall')).toHaveLength(1)
  })

  it('a 9 mm burst on plastered brick spalls and holes the wall, knocks out the bricks hit most, and never passes stage 1', () => {
    const w = wallWorld('brick_wall_plastered')
    burst(w, NINE_MM, 60)
    const counts = countByType(w.events)
    expect(counts.spall).toBeGreaterThan(5)
    // a round that finds the gap of a brick that came out goes through: it leaves no hole
    expect(counts.chip).toBeGreaterThan(0)
    expect(counts.hole).toBeGreaterThan(10)
    expect(counts.hole).toBeLessThan(60)
    expect(w.world.part(w.objectId, 'wall')!.chipped).toHaveLength(counts.chip!)
    expect(ofType(w.events, 'hole').some((e) => e.hole.through)).toBe(false)
    expect(maxStage(w.events)).toBe(1)
    expect(w.world.part(w.objectId, 'wall')!.stage).toBe(1)
  })

  it('a 7.62 burst goes through brick (entry and exit coats spall) and breaks the bricks where the rounds land, not whole: the wall stands', () => {
    const w = wallWorld('brick_wall_plastered')
    burst(w, RIFLE_762, 40)
    expect(ofType(w.events, 'hole').every((e) => e.hole.through)).toBe(true)
    expect(ofType(w.events, 'spall').length).toBeGreaterThan(ofType(w.events, 'hole').length / 2)
    const chips = ofType(w.events, 'chip')
    expect(chips.length).toBeGreaterThan(5)
    // craters of about 10 cm through the bricks
    expect(chips.filter((c) => c.size[0] < 0.15).length).toBeGreaterThan(chips.length / 2)
    expect(maxStage(w.events)).toBe(1)
    expect(w.world.part(w.objectId, 'wall')!.status).not.toBe('broken')
  })

  it('a long 7.62 burst on one patch of brick opens it: stage 2, the wall stands', () => {
    const w = wallWorld('brick_wall_plastered')
    for (let i = 0; i < 200 && maxStage(w.events) < 2; i++) w.world.shoot([-0.3 + 0.03 * (i % 21), 0.75 + 0.03 * ((i * 7) % 17), 3], [0, 0, -1], RIFLE_762.energy, RIFLE_762.caliber)
    expect(maxStage(w.events)).toBe(2)
    expect(w.world.part(w.objectId, 'wall')!.status).not.toBe('broken')
  })

  it('a 7.62 burst takes the concrete out where it lands and leaves the steel: blocks out, the bars show there, no round goes through, the wall stands', () => {
    const w = wallWorld('reinforced_concrete')
    burst(w, RIFLE_762, 80)
    expect(ofType(w.events, 'hole').some((e) => e.hole.through)).toBe(false)
    expect(ofType(w.events, 'chip').length).toBeGreaterThan(0)
    const expose = ofType(w.events, 'expose')
    expect(expose.length).toBeGreaterThan(0)
    expect(expose.at(-1)!.bars.length).toBeGreaterThan(0)
    const wall = w.world.part(w.objectId, 'wall')!
    expect(wall.status).not.toBe('broken')
    expect(wall.stripped).toBeUndefined()
  })

  it.each([
    ['drywall', true], ['wood_frame_wall', true], ['sheet_metal_shack', true], ['glass_pane', true],
    ['brick_wall_plastered', false], ['concrete_block_wall', false], ['reinforced_concrete', false], ['log_wall', false],
  ])('a 9 mm round through %s: goes through = %s', (assembly, goesThrough) => {
    const world = createDestruction({ seed: 3 })
    const id = world.add({ parts: [assemblyPart(assembly, { id: 'w', width: 2, height: 2, position: [0, 1, 0] })] })
    expect(world.shoot([0, 1, 3], [0, 0, -1], NINE_MM.energy, NINE_MM.caliber).some((r) => r.penetrated)).toBe(goesThrough)
    expect(world.part(id, 'w')!.holes.length).toBeGreaterThan(0)
  })
})

describe('damage stages and breach', () => {
  it('a sledgehammer on plastered brick leaves stage 1 for a while, then breaches to stage 2 after N swings', () => {
    const w = wallWorld('brick_wall_plastered')
    let swings = 0
    for (; swings < 200 && (w.world.part(w.objectId, 'wall')!.stage ?? 0) < 2; swings++) swing(w)
    expect(swings).toBeGreaterThan(20)
    expect(swings).toBeLessThan(100)
    expect(ofType(w.events, 'stage').map((e) => e.stage)).toEqual([1, 2])
    const wall = w.world.part(w.objectId, 'wall')!
    expect(wall.status).not.toBe('broken')
    expect(wall.opening!.radius).toBeGreaterThanOrEqual(Math.sqrt(0.25 / Math.PI) - 1e-9)
    expect(wall.opening!.radius).toBeLessThanOrEqual(0.55)
  })

  it('the breach throws unit-sized fragments (0.23 x 0.075 m bricks) from the region and the wall loses that mass', () => {
    const w = wallWorld('brick_wall_plastered')
    const before = w.world.part(w.objectId, 'wall')!.mass
    while ((w.world.part(w.objectId, 'wall')!.stage ?? 0) < 2) swing(w)
    const stage = ofType(w.events, 'stage').find((e) => e.stage === 2)!
    const fragments = stage.fragments!
    expect(fragments.length).toBeGreaterThan(8)
    for (const f of fragments) {
      expect(f.size[0]).toBeLessThanOrEqual(0.23 + 1e-9)
      expect(f.size[1]).toBeLessThanOrEqual(0.075 + 1e-9)
      expect(f.part).toBe('wall')
    }
    // the blows knocked bricks out one by one before the breach: the wall lost those too
    const chipped = ofType(w.events, 'chip').flatMap((e) => e.fragments)
    const thrown = [...fragments, ...chipped].reduce((sum, f) => sum + f.mass, 0)
    expect(w.world.part(w.objectId, 'wall')!.mass).toBeCloseTo(before - thrown, 6)
    expect(stage.opening!.center[2]).toBeCloseTo(0, 6)
  })

  it('shots and rays pass through the opening, and the wall around it still stops bullets', () => {
    const w = wallWorld('brick_wall_plastered')
    while ((w.world.part(w.objectId, 'wall')!.stage ?? 0) < 2) swing(w)
    const target = w.world.add({ parts: [{ id: 'target', material: 'wood_soft', shape: { kind: 'box', size: [1, 1, 0.05] }, position: [0, 1, -1] }] })
    const holesBefore = ofType(w.events, 'hole').filter((e) => e.part === 'wall').length
    const through = w.world.shoot([0, 1, 3], [0, 0, -1], 400, 9)
    expect(through.map((r) => r.object)).toEqual([target])
    expect(ofType(w.events, 'hole').filter((e) => e.part === 'wall').length).toBe(holesBefore)
    expect(w.world.raycast([0, 1, 3], [0, 0, -1])?.object).toBe(target)
    expect(w.world.raycast([1, 1.8, 3], [0, 0, -1])?.part).toBe('wall')
    expect(w.world.shoot([1, 1.8, 3], [0, 0, -1], 400, 9)[0]!.penetrated).toBe(false)
    expect(w.world.shoot([1, 1.8, 3], [0, 0, -1], 400, 9).map((r) => r.object)).toEqual([w.objectId])
  })

  it('a blow as wide as the part cuts it instead of opening it (a narrow pilaster)', () => {
    const world = createDestruction({ seed: 3 })
    const id = world.add({ parts: [assemblyPart('brick_wall_plastered', { id: 'p', width: 0.4, height: 2.5, position: [0, 1.25, 0] })] })
    const events: DestructionEvent[] = []
    world.on('*', (e) => events.push(e))
    for (let i = 0; i < 200 && world.part(id, 'p')!.status !== 'broken'; i++) world.hit(id, { type: 'blunt', point: [0, 1, 0.065], direction: [0, 0, -1], ...SLEDGEHAMMER })
    expect(world.part(id, 'p')!.status).toBe('broken')
    expect(ofType(events, 'stage').map((e) => e.stage)).toEqual([1, 3])
    expect(ofType(events, 'fracture')).toHaveLength(1)
  })

  it('a part that only had a layer or a unit goes through stages too, one without any of them does not', () => {
    const world = createDestruction()
    const id = world.add({ parts: [{ id: 'plain', material: 'brick', shape: { kind: 'box', size: [1, 1, 0.1] }, position: [0, 0, 0] }] })
    world.shoot([0, 0, 3], [0, 0, -1], 400, 9)
    expect(world.part(id, 'plain')!.stage).toBeUndefined()
  })

  it('snapshots keep stage, opening, spalls and breach progress, and the world carries on identically', () => {
    const a = wallWorld('brick_wall_plastered')
    for (let i = 0; i < 10; i++) swing(a)
    a.world.shoot([0.5, 1.5, 3], [0, 0, -1], 486, 9)
    const snapshot = JSON.parse(JSON.stringify(a.world.serialize()))
    const b = createDestruction({ seed: 7 })
    b.load(snapshot)
    const idB = b.ids()[0]!
    for (let i = 0; i < 50; i++) {
      swing(a)
      b.hit(idB, { type: 'blunt', point: [0, 1, 0.065], direction: [0, 0, -1], ...SLEDGEHAMMER })
    }
    expect(b.part(idB, 'wall')!.stage).toBe(a.world.part(a.objectId, 'wall')!.stage)
    expect(b.part(idB, 'wall')!.opening).toEqual(a.world.part(a.objectId, 'wall')!.opening)
    expect(b.part(idB, 'wall')!.mass).toBeCloseTo(a.world.part(a.objectId, 'wall')!.mass, 9)
  })
})

describe('holes stay on the pieces', () => {
  it('a wall that falls apart in blocks keeps its bullet holes on the blocks, inside each block', () => {
    // every hole stays on the wall until it falls: without chipping (a brick knocked out takes its holes with it)
    const w = wallWorld('brick_wall_plastered', { breach: { chipEnergy: 0 } })
    burst(w, NINE_MM, 12)
    const holes = w.world.part(w.objectId, 'wall')!.holes.length
    expect(holes).toBe(12)
    w.world.hit(w.objectId, { type: 'blunt', point: [0, 1, 0.065], direction: [0, 0, -1], energy: 3e6, radius: 0.05 })
    const fracture = ofType(w.events, 'fracture')[0]!
    const marks = fracture.fragments.flatMap((f) => (f.marks ?? []).map((m) => ({ f, m })))
    expect(marks.length).toBe(holes)
    for (const { f, m } of marks) {
      for (let k = 0; k < 3; k++) expect(Math.abs(m.point[k]!)).toBeLessThanOrEqual(f.size[k]! / 2 + m.diameter / 2 + 1e-9)
      expect(m.diameter).toBeCloseTo(0.009, 6)
    }
    expect(Math.max(...fracture.fragments.map((f) => (f.marks ?? []).length))).toBeLessThanOrEqual(12)
  })

  it('a hole in the region of a breach leaves with its fragment', () => {
    const w = wallWorld('brick_wall_plastered')
    w.world.shoot([0.02, 1.0, 3], [0, 0, -1], NINE_MM.energy, NINE_MM.caliber)
    while ((w.world.part(w.objectId, 'wall')!.stage ?? 0) < 2) swing(w)
    const stage = ofType(w.events, 'stage').find((e) => e.stage === 2)!
    // the brick with the hole leaves in the breach, or before it, knocked out by the blows
    const out = [...stage.fragments!, ...ofType(w.events, 'chip').flatMap((e) => e.fragments)]
    expect(out.flatMap((f) => f.marks ?? [])).toHaveLength(1)
    expect(w.world.part(w.objectId, 'wall')!.holes).toHaveLength(0)
  })
})
