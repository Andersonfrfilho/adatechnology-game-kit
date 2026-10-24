import { describe, expect, it } from 'vitest'

import { createVfx, GAME_EFFECTS, VIEWMODEL_EFFECTS } from '../src'

// The first-person effects of the Arsenal gallery as recipes: the numbers the gallery's `createEffects` and `heavy` give, in the pools of the Workshop.
const world = () => createVfx({ seed: 11, randomMode: 'shared' })

describe('the effects of the weapon in the hands', () => {
  it('are in the catalogue a world plays by default', () => {
    expect(VIEWMODEL_EFFECTS.map((effect) => effect.id)).toEqual(['viewmodel_muzzle_flash', 'weapon_smoke_puff', 'launcher_backblast', 'flame_jet'])
    for (const effect of VIEWMODEL_EFFECTS) expect(GAME_EFFECTS[effect.id]).toBe(effect)
  })

  it('make a flash of six additive sprites that lasts 55 ms, a light of 4 k at 2 k metres, and six puffs of smoke', () => {
    const vfx = world()
    expect(vfx.play('viewmodel_muzzle_flash', [1, 1.5, -2], { direction: [0, 0, -1], seed: 3, values: { size: 1.2 } })).not.toBeNull()
    const engine = vfx.workshop()
    expect(engine.add.count).toBe(6)
    expect(engine.normal.count).toBe(6)
    const light = engine.lights.lights.find((source) => source.intensity > 0)!
    expect(light.intensity).toBeCloseTo(4.8, 10)
    expect(light.distance).toBeCloseTo(2.4, 10)
    for (let frame = 0; frame < 5; frame++) vfx.update(0.012)
    expect(engine.add.count).toBe(0)
    expect(engine.normal.count).toBe(6)
  })

  it('draws each puff of smoke as the gallery does: a life of 1.3 to 1.9 s, an opacity of 0.45, a radius of 0.013 k, and a rise', () => {
    const lives = new Set<number>()
    for (let seed = 1; seed <= 6; seed++) {
      const vfx = world()
      vfx.play('viewmodel_muzzle_flash', [0, 0, 0], { seed, values: { size: 2 } })
      const pool = vfx.workshop().normal
      for (let index = 0; index < pool.count; index++) {
        expect(pool.life[index]).toBeGreaterThanOrEqual(1.3)
        expect(pool.life[index]).toBeLessThanOrEqual(1.9)
        expect(pool.startAlpha[index]).toBeCloseTo(0.45, 6)
        expect(pool.startSize[index]).toBeCloseTo(0.052, 6)
        expect(pool.growth[index]).toBeCloseTo(Math.exp(2.1 * pool.life[index]!), 4)
        expect(pool.gravity[index]).toBeCloseTo(-0.08, 6)
        expect(pool.drag[index]).toBeCloseTo(2.2, 6)
        lives.add(pool.life[index]!)
      }
    }
    expect(lives.size).toBeGreaterThan(20)
  })

  it('turn with the direction the weapon points: the smoke leaves along the barrel', () => {
    const vfx = world()
    vfx.play('viewmodel_muzzle_flash', [0, 0, 0], { direction: [1, 0, 0], seed: 4, values: { size: 1 } })
    const pool = vfx.workshop().normal
    for (let index = 0; index < pool.count; index++) expect(pool.velocity[index * 3]).toBeGreaterThan(0.1)
  })

  it('throw one puff of smoke with the velocity, radius, life and opacity it is given', () => {
    const vfx = world()
    vfx.play('weapon_smoke_puff', [0, 1, 0], { seed: 1, values: { vx: 0.01, vy: 0.1, vz: -0.02, radius: 0.0105, life: 2, opacity: 0.29 } })
    const pool = vfx.workshop().normal
    expect(pool.count).toBe(1)
    expect(pool.life[0]).toBeCloseTo(2, 6)
    expect(pool.startAlpha[0]).toBeCloseTo(0.29, 6)
    expect(pool.startSize[0]).toBeCloseTo(0.021, 6)
    expect(pool.growth[0]).toBeCloseTo(Math.exp(4.2), 4)
    expect(Array.from(pool.velocity.slice(0, 3))).toEqual([0.01, 0.1, -0.02].map((value) => Math.fround(value)))
  })

  it('throw 26 puffs and 14 bits of fire back from the rear of a launcher', () => {
    const vfx = world()
    vfx.play('launcher_backblast', [0, 1.5, 0], { direction: [0, 0, -1], seed: 5 })
    const engine = vfx.workshop()
    expect(engine.normal.count + engine.add.count).toBe(40)
    const backwards = Array.from({ length: engine.normal.count }, (_, index) => engine.normal.velocity[index * 3 + 2]!).filter((z) => z > 0).length
    expect(backwards).toBeGreaterThanOrEqual(30)
  })

  it('throw floor(420 dt scale) bits of fire in a frame of the flame jet, and about half the frames a puff of smoke', () => {
    let bits = 0
    let smokes = 0
    for (let seed = 1; seed <= 40; seed++) {
      const vfx = world()
      vfx.play('flame_jet', [0, 1, 0], { direction: [0, 0, -1], seed, values: { dt: 1 / 60, scale: 1 } })
      const engine = vfx.workshop()
      bits += engine.normal.count + engine.add.count
      smokes += Array.from({ length: engine.normal.count }, (_, index) => engine.normal.life[index]!).filter((life) => Math.abs(life - 1.6) < 1e-6).length
    }
    expect(bits - smokes).toBe(40 * 7)
    expect(smokes).toBeGreaterThan(8)
    expect(smokes).toBeLessThan(32)
    const small = world()
    small.play('flame_jet', [0, 1, 0], { seed: 1, values: { dt: 1 / 60, scale: 0.6 } })
    const engine = small.workshop()
    expect(engine.normal.count + engine.add.count).toBeGreaterThanOrEqual(4)
  })
})
