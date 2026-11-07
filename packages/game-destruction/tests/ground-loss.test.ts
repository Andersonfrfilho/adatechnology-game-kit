import { describe, expect, it } from 'vitest'

import { createDestruction, GROUND_LOSS_DEFAULTS, undercutAt } from '../src'
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
