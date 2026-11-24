import { describe, expect, it } from 'vitest'

import type { ParticleEffectRequest, ParticleEffects } from '../src'
import { makeKit } from './helpers/kit'

function makeTestKit(effects?: ParticleEffects) {
  const kit = makeKit(effects ? { effects: () => effects } : {}, false)
  kit.register({ key: 'test_car', name: 'Test Car', group: 'cars' }, (c) => {
    c.meta.front = 2
    c.meta.rear = -2
    c.meta.clearance = 0.3
    c.meta.bodyHeight = 1.1
    c.roundBox(4, 1, 1.8, 0.05, c.paint('#336699'), 0, 0.8, 0)
  })
  kit.register({ key: 'test_tanker', name: 'Test Tanker', group: 'heavy' }, (c) => {
    c.meta.front = 3
    c.meta.rear = -3
    c.meta.clearance = 0.5
    c.meta.bodyHeight = 2.0
    c.meta.bigBlast = true
    c.roundBox(6, 2, 2.4, 0.05, c.paint('#888888'), 0, 1.5, 0)
  })
  return kit
}

describe('vehicle explosion and fire routed to 3D VFX SDK (no 2D sprite duplication)', () => {
  it('delegates car explosion and lingering fire to car_fuel_tank + volumetric_fire without 2D flash/shock/particle_glow', () => {
    const played: ParticleEffectRequest[] = []
    const stopped: unknown[] = []
    let nextHandle = 1
    const effects: ParticleEffects = {
      play(req) {
        played.push(req)
        return nextHandle++
      },
      stop(handle) {
        stopped.push(handle)
      },
    }

    const kit = makeTestKit(effects)
    const c = kit.build('test_car', 'intact')
    kit.explode(c, { now: true })
    kit.tick(c, 0.05)

    expect(c.exploded).toBe(true)
    expect(c.blast.flash).toBeUndefined()
    expect(c.blast.shock).toBeUndefined()
    expect(played.some((r) => r.effect === 'car_fuel_tank')).toBe(true)
    expect(played.filter((r) => r.effect === 'volumetric_fire').length).toBeGreaterThanOrEqual(2)
    expect(played.some((r) => r.effect === 'particle_glow')).toBe(false)

    kit.dispose(c)
    expect(stopped.length).toBeGreaterThanOrEqual(2)
  })

  it('delegates bigBlast tanker explosions to fuel_station_tank without legacy bigFx 2D mushroom', () => {
    const played: ParticleEffectRequest[] = []
    const effects: ParticleEffects = {
      play(req) {
        played.push(req)
        return 1
      },
    }
    const kit = makeTestKit(effects)
    const c = kit.build('test_tanker', 'intact')
    kit.explode(c, { now: true })
    kit.tick(c, 0.05)

    expect(c.exploded).toBe(true)
    expect(c.bigFx).toBeUndefined()
    expect(played.some((r) => r.effect === 'fuel_station_tank')).toBe(true)
    expect(played.some((r) => r.effect === 'particle_glow')).toBe(false)
    kit.dispose(c)
  })

  it('respects skipBlastEffect when destructible already emitted explode to the host', () => {
    const played: ParticleEffectRequest[] = []
    const effects: ParticleEffects = {
      play(req) {
        played.push(req)
        return 1
      },
    }
    const kit = makeTestKit(effects)
    const c = kit.build('test_car', 'intact')
    kit.explode(c, { delay: 0.1, skipBlastEffect: true })
    kit.tick(c, 0.15)

    expect(c.exploded).toBe(true)
    expect(played.some((r) => r.effect === 'car_fuel_tank')).toBe(false)
    expect(played.some((r) => r.effect === 'volumetric_fire')).toBe(true)
    kit.dispose(c)
  })
})
