import { describe, expect, it } from 'vitest'

import { createVfx } from '../src'
import { createEffectPlayer, patchEffects, WORKSHOP_EFFECTS, WorkshopEngine } from '../src'
import { lehmer } from '../src'

const view = { position: [0, 1.6, 0] as [number, number, number], forward: (local: readonly number[]) => [local[0] ?? 0, local[1] ?? 0, local[2] ?? 0] as [number, number, number] }

function run(seed: number, point: [number, number, number], direction?: [number, number, number]) {
  const engine = new WorkshopEngine({ random: lehmer(1) })
  const player = createEffectPlayer({ engine, effects: WORKSHOP_EFFECTS, view })
  const handle = player.play('muzzle_flash', point, { seed, ...(direction ? { direction } : {}) })
  for (let frame = 0; frame < 90 && engine.add.count === 0; frame++) {
    player.update(1 / 60)
    engine.update(1 / 60)
  }
  const at = (axis: 0 | 1 | 2): number => engine.add.position[axis]!
  return { engine, player, handle, x: at(0), z: at(2) }
}

describe('the effect player', () => {
  it('has the same ids as the catalogue and refuses an unknown one', () => {
    const engine = new WorkshopEngine({ random: lehmer(1) })
    const player = createEffectPlayer({ engine, effects: WORKSHOP_EFFECTS, view })
    expect(player.ids()).toEqual(Object.keys(WORKSHOP_EFFECTS))
    expect(player.play('nope', [0, 0, 0])).toBeNull()
  })

  it('repeats the same visual from the same seed and moves it with the point', () => {
    const a = run(7, [0, 0, 0])
    const b = run(7, [0, 0, 0])
    expect(a.engine.add.count).toBeGreaterThan(0)
    expect(b.engine.add.count).toBe(a.engine.add.count)
    expect(a.x).toBeCloseTo(b.x, 10)
    const moved = run(7, [10, 0, 5])
    expect(moved.x - a.x).toBeCloseTo(10, 3)
    expect(moved.z - a.z).toBeCloseTo(5, 3)
  })

  it('turns the effect toward the direction it is given', () => {
    const ahead = run(3, [0, 0, 0])
    const turned = run(3, [0, 0, 0], [1, 0, 0])
    expect(Math.hypot(turned.x, turned.z)).toBeCloseTo(Math.hypot(ahead.x, ahead.z), 3)
    expect(turned.x).not.toBeCloseTo(ahead.x, 2)
  })

  it('caps how many play at once and forgets the ones that stop', () => {
    const engine = new WorkshopEngine({ random: lehmer(1) })
    const player = createEffectPlayer({ engine, effects: WORKSHOP_EFFECTS, view, maxInstances: 2 })
    const first = player.play('muzzle_flash', [0, 0, 0])
    player.play('muzzle_flash', [1, 0, 0])
    expect(player.play('muzzle_flash', [2, 0, 0])).toBeNull()
    player.stop(first!)
    expect(player.active).toBe(1)
    player.clear()
    expect(player.active).toBe(0)
  })
})

describe('VfxWorld.play', () => {
  it('plays a recipe into the world, ages it with update and takes it away with clear', () => {
    const world = createVfx({ seed: 5 })
    expect(world.play('nope', [0, 0, 0])).toBeNull()
    expect(world.effectIds()).toContain('muzzle_flash')
    expect(world.play('muzzle_flash', [3, 1, 3], { direction: [0, 0, 1] })).not.toBeNull()
    for (let frame = 0; frame < 90 && world.workshop().add.count === 0; frame++) world.update(1 / 60)
    expect(world.workshop().add.count).toBeGreaterThan(0)
    world.clear()
    expect(world.workshop().add.count).toBe(0)
  })

  it('takes the parameter as an option id or an index', () => {
    const named = createVfx({ seed: 2 })
    const indexed = createVfx({ seed: 2 })
    expect(named.play('impact', [0, 0, 0], { param: 'metal', seed: 4 })).not.toBeNull()
    expect(indexed.play('impact', [0, 0, 0], { param: 1, seed: 4 })).not.toBeNull()
    for (let frame = 0; frame < 20; frame++) {
      named.update(1 / 60)
      indexed.update(1 / 60)
    }
    expect(named.workshop().add.count).toBe(indexed.workshop().add.count)
    expect(named.workshop().streaks.count).toBe(indexed.workshop().streaks.count)
  })

  it('takes a patched catalogue', () => {
    const effects = patchEffects(WORKSHOP_EFFECTS, { muzzle_flash: null })
    const world = createVfx({ effects })
    expect(world.play('muzzle_flash', [0, 0, 0])).toBeNull()
  })
})
