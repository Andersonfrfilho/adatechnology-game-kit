import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { BASEBOARD_TILES, wallPiece } from '../src'
import { THREE } from './helpers/houses'
import { fakeDocument } from './helpers/fake-document'

type Event = { type: string; part?: string; parts?: Array<string | { id: string }>; torn?: boolean; center?: number[] }
const FRONT = 'baseboard:wall_0_0:1'

const setup = () => {
  const piece = wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } })
  const world = createDestruction({ seed: 1 })
  const id = world.add(piece.spec, { id: 'target' })
  const events: Event[] = []
  world.on('*', (e) => events.push(e as Event))
  const part = (partId: string) => world.state(id)!.parts.find((p) => p.id === partId)!
  return { piece, world, id, events, part }
}

describe('the outer baseboard', () => {
  it('is a band of glazed ceramic tiles on each face of the wall, glued to it, with the mass of its tiles', () => {
    const { piece } = setup()
    const bands = piece.spec.parts.filter((p: { id: string }) => p.id.startsWith('baseboard:'))
    expect(bands.map((p: { id: string }) => p.id).sort()).toEqual(['baseboard:wall_0_0:0', 'baseboard:wall_0_0:1'])
    for (const band of bands) {
      expect(band.material).toBe('ceramic')
      expect(band.units).toMatchObject({ size: [BASEBOARD_TILES.length, expect.closeTo(0.35, 3), expect.closeTo(0.012, 3)], mortar: 'mortar' })
      // 10 m x 0.35 m x 12 mm of ceramic at 2300 kg/m³: about 97 kg a face
      expect(band.mass).toBeGreaterThan(90)
      expect(band.mass).toBeLessThan(105)
    }
    expect(piece.spec.joints.filter((j: { id: string }) => j.id.startsWith('baseboard:')).map((j: { kind: string; b: string }) => `${j.kind}>${j.b}`)).toEqual(['glue>wall_0_0', 'glue>wall_0_0'])
  })

  it('takes a rifle round where it lands: a crater in the tile at the hit, and the round goes on into the wall', () => {
    const { world, events, part } = setup()
    for (let i = 0; i < 3; i++) world.shoot([0.3, 0.2, 5], [0, 0, -1], 1800, 7.62, 'test')
    world.update(0.1)
    expect(part(FRONT).status).toBe('damaged')
    const craters = events.filter((e) => e.type === 'chip' && e.part === FRONT)
    expect(craters.length).toBeGreaterThan(0)
    for (const crater of craters) expect(Math.hypot(crater.center![0]! - 0.3, crater.center![1]! - 0.2)).toBeLessThan(0.05)
    // 12 mm of tile does not stop a 7.62 mm round: the wall behind takes it
    expect(part('wall_0_0').status).not.toBe('intact')
  })

  it('cracks under a kick and under a blast at its foot, and a charge against it shatters it', () => {
    const kicked = setup()
    kicked.world.hitPart(kicked.id, FRONT, { type: 'blunt', point: [-3, 0.15, 0.081], energy: 400, radius: 0.08, source: 'kick' })
    kicked.world.update(0.1)
    expect(kicked.events.some((e) => e.type === 'crack' && e.part === FRONT)).toBe(true)
    expect(kicked.part(FRONT).hp).toBeLessThan(kicked.part(FRONT).maxHp)
    const near = setup()
    near.world.explode([2, 0.15, 0.35], 2e4, 0.8, 'test')
    near.world.update(0.1)
    expect(near.events.some((e) => e.type === 'crack' && e.part === FRONT)).toBe(true)
    const close = setup()
    close.world.explode([2, 0.15, 0.3], 3e5, 1.2, 'test')
    close.world.update(0.1)
    expect(close.events.some((e) => e.type === 'fracture' && e.part === FRONT)).toBe(true)
  })

  it('comes off the wall it is glued to when the wall goes', () => {
    const { world, id, events } = setup()
    world.hitPart(id, 'wall_0_0', { type: 'blunt', point: [0, 1.5, 0], energy: 5e7, radius: 0.05, source: 'test' })
    for (let t = 0; t < 2; t += 0.1) world.update(0.1)
    const detached = events.filter((e) => e.type === 'detach').map((e) => (e.parts ?? []).map((p) => (typeof p === 'string' ? p : p.id)).join('~'))
    expect(detached).toContain(`${FRONT}~wall_0_0`)
  })
})
