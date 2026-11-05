import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { BASEBOARD_TILES, SIDEWALK_SLABS, wallPiece } from '../src'
import { THREE } from './helpers/houses'
import { fakeDocument } from './helpers/fake-document'

type Event = { type: string; part?: string; parts?: Array<string | { id: string }>; center?: number[] }
type Part = { id: string; material: string; mass?: number; position: number[]; shape: { kind: string; size?: number[] } }
const FRONT = 'baseboard:wall_0_0:1'

const setup = () => {
  const piece = wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } })
  const world = createDestruction({ seed: 1 })
  const id = world.add(piece.spec, { id: 'target' })
  const events: Event[] = []
  world.on('*', (e) => events.push(e as Event))
  const state = (partId: string) => world.state(id)!.parts.find((p) => p.id === partId)!
  const tiles = (piece.spec.parts as Part[]).filter((p) => p.id.startsWith(`${FRONT}:`))
  /** The tile of the front face under a point along the wall. */
  const tileAt = (x: number): Part => tiles.find((p) => Math.abs(p.position[0]! - x) <= (p.shape.size?.[0] ?? 0) / 2)!
  return { piece, world, id, events, state, tiles, tileAt }
}

describe('the outer baseboard', () => {
  it('is laid in glazed ceramic tiles on each face of the wall, each its own piece, glued to the wall, with the mass of 12 mm of tile', () => {
    const { piece, tiles } = setup()
    // a 10 m face (and the half thickness of the wall at each free end): 17 tiles of about 0.6 m
    expect(tiles.length).toBe(17)
    for (const tile of tiles) {
      expect(tile.material).toBe('ceramic')
      expect(tile.shape.size![0]).toBeCloseTo(10 / 17 - BASEBOARD_TILES.joint, 2)
      expect(tile.shape.size![1]).toBeCloseTo(0.35, 2)
      // 0.59 x 0.35 m x 12 mm of ceramic at 2300 kg/m³
      expect(tile.mass).toBeGreaterThan(5.4)
      expect(tile.mass).toBeLessThan(6.1)
    }
    const glued = piece.spec.joints.filter((j: { a: string }) => j.a.startsWith('baseboard:'))
    expect(glued.length).toBe(34)
    expect(glued.every((j: { kind: string; b: string }) => j.kind === 'glue' && j.b === 'wall_0_0')).toBe(true)
  })

  it('takes a rifle round in the tile it hits, at the hit, and the tiles beside it stay whole', () => {
    const { world, events, state, tileAt } = setup()
    const hit = tileAt(0.3)
    for (let i = 0; i < 2; i++) world.shoot([0.3, 0.2, 5], [0, 0, -1], 1800, 7.62, 'test')
    world.update(0.1)
    expect(state(hit.id).status).not.toBe('intact')
    const marks = events.filter((e) => (e.type === 'hole' || e.type === 'chip' || e.type === 'crack') && e.part?.startsWith(`${FRONT}:`))
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.every((e) => e.part === hit.id)).toBe(true)
    for (const x of [-0.5, 1.2]) expect(state(tileAt(x).id).status).toBe('intact')
  })

  it('breaks tile by tile: enough shots shatter the tile they hit and leave the rest of the band, a kick cracks the one it lands on', () => {
    const { world, id, events, state, tileAt } = setup()
    const shot = tileAt(-2)
    for (let i = 0; i < 25 && state(shot.id).status !== 'broken'; i++) world.shoot([-2 + (i % 3) * 0.1, 0.1 + (i % 4) * 0.06, 5], [0, 0, -1], 1800, 7.62, 'test')
    world.update(0.1)
    expect(state(shot.id).status).toBe('broken')
    expect(state(tileAt(-1).id).status).toBe('intact')
    expect(state(tileAt(-3).id).status).toBe('intact')
    const kicked = tileAt(3)
    world.hitPart(id, kicked.id, { type: 'blunt', point: [3, 0.15, 0.081], energy: 400, radius: 0.08, source: 'kick' })
    world.update(0.1)
    expect(events.some((e) => e.type === 'crack' && e.part === kicked.id)).toBe(true)
  })

  it('loses the tiles a blast at its foot reaches, not the whole band', () => {
    const { world, events, tiles, state, tileAt } = setup()
    // a charge of about 50 g of TNT 30 cm in front of the band
    world.explode([2, 0.15, 0.3], 2e5, 1.5, 'test')
    world.update(0.1)
    expect(state(tileAt(-3).id).status).toBe('intact')
    const broken = new Set(events.filter((e) => e.type === 'fracture' && e.part?.startsWith(`${FRONT}:`)).map((e) => e.part))
    expect(broken.size).toBeGreaterThan(0)
    expect(broken.size).toBeLessThan(tiles.length)
  })

  it('comes off the wall it is glued to when the wall goes', () => {
    const { world, id, events, tiles } = setup()
    world.hitPart(id, 'wall_0_0', { type: 'blunt', point: [0, 1.5, 0], energy: 5e7, radius: 0.05, source: 'test' })
    for (let t = 0; t < 2; t += 0.1) world.update(0.1)
    const detached = new Set(events.filter((e) => e.type === 'detach').map((e) => (e.parts ?? []).map((p) => (typeof p === 'string' ? p : p.id))).filter(([, b]) => b === 'wall_0_0').map(([a]) => a))
    expect(tiles.every((t) => detached.has(t.id))).toBe(true)
  })
})

describe('the sidewalk at the foot of the wall', () => {
  it('is cast concrete in slabs between expansion joints, resting on the ground, and a blast breaks the slabs it reaches', () => {
    const piece = wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } })
    const slabs = (piece.spec.parts as Part[]).filter((p) => p.id.startsWith('sidewalk:wall_0_0:1:'))
    expect(slabs.length).toBe(Math.round(10 / SIDEWALK_SLABS.length))
    expect(slabs.every((p) => p.material === 'concrete')).toBe(true)
    expect(piece.spec.joints.filter((j: { a: string; b: string }) => j.a.startsWith('sidewalk:') && j.b === 'ground').length).toBe(slabs.length * 2)
    const world = createDestruction({ seed: 1 })
    const id = world.add(piece.spec, { id: 'target' })
    const events: Event[] = []
    world.on('*', (e) => events.push(e as Event))
    world.explode([2, 0.1, 0.4], 2e5, 1.5, 'test')
    world.update(0.1)
    const hit = new Set(events.filter((e) => (e.type === 'crack' || e.type === 'fracture' || e.type === 'damage') && e.part?.startsWith('sidewalk:wall_0_0:1:')).map((e) => e.part))
    expect(hit.size).toBeGreaterThan(0)
    expect(hit.size).toBeLessThan(slabs.length)
    expect(world.state(id)!.parts.filter((p) => p.id.startsWith('sidewalk:') && p.status === 'broken').length).toBeLessThan(slabs.length)
  })
})
