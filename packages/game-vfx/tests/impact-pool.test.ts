import { describe, expect, it } from 'vitest'

import { createVfx } from '../src'

/**
 * The bullet spark (`impact_metal`) must not allocate anything at shot time: the Workshop's pools are made once, with a fixed buffer, and every
 * shot writes into them (the oldest particle goes when the pool is full). If the shot starts allocating again — a `new Mesh`, a `new Material`, a
 * texture, or a growing particle buffer — the pool's pre-allocated arrays would grow (or the counts would climb past the capacity), and this fails.
 */
describe('the bullet spark never allocates at shot time', () => {
  it('impact_metal recycles its pre-allocated pools across many shots', () => {
    const world = createVfx({ seed: 3 })
    const engine = world.workshop()
    const streaks = engine.streaks
    const add = engine.add
    const streakSlots = streaks.point.length / 3
    const addSlots = add.position.length / 3

    for (let shot = 0; shot < 200; shot++) {
      world.play('impact_metal', [1, 0, 2], { direction: [0, 0, 1] })
      world.update(1 / 60)
    }

    // the same pre-allocated buffers, never grown: a hundred shots drew from the pool they were given
    expect(streaks.point.length / 3).toBe(streakSlots)
    expect(add.position.length / 3).toBe(addSlots)
    expect(streaks.count).toBeLessThanOrEqual(streakSlots)
    expect(add.count).toBeLessThanOrEqual(addSlots)
  })
})
