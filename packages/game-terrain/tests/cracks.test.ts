import { describe, expect, it } from 'vitest'
import { crackLines, createTerrain } from '../src'

const make = (surface: string) => createTerrain({ bounds: [-10, -10, 10, 10], layout: { surface } })
const GRENADE = 800_000
const ONE_KG_TNT = 4_200_000
const PISTOL = 500

describe('rigid ground cracks, soft ground gives way', () => {
  it('a grenade cracks a slab about a metre out and asphalt about half that; soil does not crack', () => {
    const slab = make('concrete_slab').strike('explosive', { x: 0, z: 0, energy: GRENADE })
    const road = make('road').strike('explosive', { x: 0, z: 0, energy: GRENADE })
    const dirt = make('dirt').strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(slab.crack?.reach).toBeGreaterThan(0.7)
    expect(slab.crack?.reach).toBeLessThan(1.3)
    expect(road.crack?.reach).toBeGreaterThan(0.35)
    expect(road.crack!.reach).toBeLessThan(slab.crack!.reach)
    expect(dirt.crack).toBeUndefined()
  })

  it('a pistol round leaves a hairline star a hand wide; a knife leaves none', () => {
    const slab = make('concrete_slab')
    const shot = slab.strike('ballistic', { x: 0, z: 0, energy: PISTOL })
    expect(shot.crack?.reach).toBeLessThan(0.15)
    expect(make('concrete_slab').strike('slash', { x: 0, z: 0, energy: 2000 }).crack).toBeUndefined()
  })

  it('blows on the same spot run the same star further instead of piling up stars', () => {
    const slab = make('concrete_slab')
    const first = slab.strike('explosive', { x: 0, z: 0, energy: GRENADE }).crack!.reach
    slab.strike('explosive', { x: 0.05, z: 0, energy: GRENADE })
    expect(slab.cracks()).toHaveLength(1)
    expect(slab.cracks()[0]!.reach).toBeGreaterThan(first)
  })

  it('the lines stay within the reach and thin towards the tips; the same crack draws the same lines', () => {
    const slab = make('concrete_slab')
    const crack = slab.strike('explosive', { x: 1, z: 2, energy: GRENADE }).crack!
    const lines = crackLines(crack)
    expect(lines.length).toBeGreaterThanOrEqual(crack.rays * 4)
    for (const segment of lines) {
      expect(Math.hypot(segment.x1 - crack.x, segment.z1 - crack.z)).toBeLessThan(crack.reach * 1.6)
      expect(segment.w1).toBeLessThanOrEqual(segment.w0 + 1e-9)
    }
    expect(crackLines(crack)).toEqual(lines)
  })

  it('cracks survive a snapshot and go with a reset', () => {
    const slab = make('concrete_slab')
    slab.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    const copy = make('concrete_slab')
    copy.load(slab.serialize())
    expect(copy.cracks()).toEqual(slab.cracks())
    slab.reset()
    expect(slab.cracks()).toHaveLength(0)
  })
})

describe('a contact charge breaks a slab right through', () => {
  it('a grenade only spalls a 12 cm slab; about 1 kg of TNT breaks it through and bares the bars', () => {
    const grenade = make('concrete_slab').strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(grenade.breached).toBeUndefined()
    expect(grenade.totalDepth).toBeLessThan(0.03)
    const charge = make('concrete_slab').strike('explosive', { x: 0, z: 0, energy: ONE_KG_TNT * 1.2 })
    expect(charge.breached).toBe(true)
    expect(charge.atLimit).toBe(true)
    expect(charge.rebarExposed).toBe(true)
    expect(charge.radius * 2).toBeGreaterThan(0.3)
    expect(charge.radius * 2).toBeLessThan(0.6)
  })

  it('a breach in a slab over a void opens the floor once the bars give way', () => {
    const terrain = make('suspended_slab')
    const result = terrain.strike('explosive', { x: 0, z: 0, energy: ONE_KG_TNT * 3 })
    expect(result.breached).toBe(true)
    expect(terrain.heightAt(0, 0)).toBeLessThan(-1)
  })
})
