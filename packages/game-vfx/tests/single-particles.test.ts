import { describe, expect, it } from 'vitest'

import { createVfx, GAME_EFFECTS } from '../src'

const values = { vx: 0.5, vy: 1.1, vz: -0.2, life: 2.8, size: 0.6, grow: 8, color: 0x55595c, alpha: 0.5, gravity: -0.08, drag: 0.9 }

describe('single particle effects', () => {
  it('are in the default catalogue', () => {
    for (const id of ['particle_puff', 'particle_glow', 'particle_streak']) expect(GAME_EFFECTS[id]).toBeDefined()
  })

  it('play one sprite at the point with the numbers of the request', () => {
    const vfx = createVfx({ seed: 3, effects: GAME_EFFECTS })
    expect(vfx.play('particle_puff', [4, 2, -3], { values })).not.toBeNull()
    const pool = vfx.workshop().normal
    expect(pool.count).toBe(1)
    expect([pool.position[0], pool.position[1], pool.position[2]]).toEqual([4, 2, -3])
    expect(pool.life[0]).toBeCloseTo(2.8, 6)
  })

  it('count one particle per play, however often it is asked', () => {
    const vfx = createVfx({ seed: 3, effects: GAME_EFFECTS })
    for (let k = 0; k < 10; k++) {
      vfx.play('particle_puff', [k, 0, 0], { values })
      vfx.update(1 / 60)
    }
    expect(vfx.workshop().normal.count).toBe(10)
  })
})
