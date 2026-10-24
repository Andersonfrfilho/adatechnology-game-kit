import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructionEvent, Vec3 } from '../src'
import { houseSpec, ofType, runFor } from './wall-helpers'

/** The six structural scenarios of the team's house area (sala-de-testes/area-casas.js L3833-3868), on an equivalent spec. */
const house = () => {
  const spec = houseSpec()
  const world = createDestruction({ seed: 11 })
  const id = world.add(spec)
  const events: DestructionEvent[] = []
  world.on('*', (e) => events.push(e))
  const center = (part: string): Vec3 => spec.parts.find((p) => p.id === part)!.position
  const strike = (part: string, energy: number) => world.hitPart(id, part, { type: 'blunt', point: center(part), energy, radius: 0.05, source: 'test' })
  const status = (part: string) => world.part(id, part)!.status
  const collapsed = () => ofType(events, 'collapse').flatMap((e) => e.parts)
  return { spec, world, id, events, center, strike, status, collapsed }
}

describe('house structure scenarios', () => {
  it('destroy one corner pillar: the slab stays', () => {
    const h = house()
    h.strike('c0', 3e6)
    runFor(h.world, 20)
    expect(h.status('c0')).toBe('broken')
    expect(h.status('slab')).not.toBe('broken')
    expect(h.collapsed()).not.toContain('slab')
    expect(h.world.part(h.id, 'c0')!.stripped).toBe(true)
  })

  it('destroy two pillars: the slab and the roof above fall', () => {
    const h = house()
    h.strike('c0', 3e6)
    h.strike('c1', 3e6)
    runFor(h.world, 90)
    expect(h.collapsed()).toEqual(expect.arrayContaining(['slab', 'roof']))
  })

  it('a partition falls alone and the slab stays up', () => {
    const h = house()
    h.strike('wall_back', 3e6)
    runFor(h.world, 20)
    expect(h.status('wall_back')).toBe('broken')
    expect(h.status('slab')).not.toBe('broken')
    expect(h.collapsed()).toEqual([])
    const fracture = ofType(h.events, 'fracture').find((e) => e.part === 'wall_back')!
    expect(fracture.fragments.length).toBeGreaterThan(20)
    expect(ofType(h.events, 'stage').filter((e) => e.part === 'wall_back').map((e) => e.stage)).toEqual([1, 3])
  })

  it('a shot at the glass holes the window first and breaks it within a dozen shots, leaving the walls whole', () => {
    const h = house()
    let shots = 0
    for (; shots < 12 && h.status('window') !== 'broken'; shots++) {
      h.world.hitPart(h.id, 'window', { type: 'ballistic', point: h.center('window'), direction: [0, 0, -1], energy: 600, caliber: 9 })
      runFor(h.world, 0.3)
    }
    expect(h.world.part(h.id, 'window')!.holes.length).toBeGreaterThan(0)
    expect(h.status('window')).toBe('broken')
    expect(h.status('wall_front')).not.toBe('broken')
    expect(h.status('wall_back')).not.toBe('broken')
  })

  it('a punctured water tank leaks', () => {
    const h = house()
    const before = h.world.part(h.id, 'tank')!.liters!
    h.world.hitPart(h.id, 'tank', { type: 'ballistic', point: h.center('tank'), direction: [0, 0, -1], energy: 600, caliber: 9 })
    runFor(h.world, 40)
    expect(h.world.part(h.id, 'tank')!.holes.length).toBeGreaterThan(0)
    expect(h.world.part(h.id, 'tank')!.liters!).toBeLessThan(before)
  })

  it('the gas bottle explodes in the fire and damages the walls near it', () => {
    const h = house()
    h.world.hitPart(h.id, 'bottle', { type: 'fire', point: h.center('bottle'), temperature: 900, radius: 0.6, duration: 8 })
    runFor(h.world, 12)
    expect(ofType(h.events, 'explode')).toHaveLength(1)
    const damaged = new Set(ofType(h.events, 'damage').filter((e) => e.part !== 'bottle' && e.damageType === 'explosive').map((e) => e.part))
    expect(damaged.has('wall_front')).toBe(true)
  })
})
