import { describe, expect, it } from 'vitest'
import { Enclosures, createVfx } from '../src'
import type { VfxEnclosure, VfxWorld } from '../src'

/** A shut car's cabin: 2.2 m long, 1.4 m wide, 1 m tall, its middle 1.1 m up, at the origin. */
const CABIN: VfxEnclosure = { center: [0, 1.1, 0], halfSize: [1.1, 0.5, 0.7] }

function run(world: VfxWorld, seconds: number, each?: () => void): void {
  for (let frame = 0; frame < seconds * 60; frame++) {
    world.update(1 / 60)
    each?.()
  }
}

/** Live sprites of the fixed kinds (smoke, dust...) whose middle is inside the box `e` (not turned). */
function spritesInside(world: VfxWorld, e: VfxEnclosure): number {
  let n = 0
  for (const pool of [world.sprites().normal, world.sprites().additive]) {
    for (let i = 0; i < pool.capacity; i++) {
      if (pool.size[i]! <= 0) continue
      const x = pool.position[i * 3]! - e.center[0]
      const y = pool.position[i * 3 + 1]! - e.center[1]
      const z = pool.position[i * 3 + 2]! - e.center[2]
      if (Math.abs(x) <= e.halfSize[0] && Math.abs(y) <= e.halfSize[1] && Math.abs(z) <= e.halfSize[2]) n++
    }
  }
  return n
}

function puffsInside(world: VfxWorld, e: VfxEnclosure): number {
  return world.pools().puffs.items.filter((p) => Math.abs(p.x - e.center[0]) <= e.halfSize[0] && Math.abs(p.y - e.center[1]) <= e.halfSize[1] && Math.abs(p.z - e.center[2]) <= e.halfSize[2]).length
}

/** Smoke thrown at the car's side from 2.2 m off (a burst every few frames, its sprites flying at the car), the puffs carried by the wind the same way. */
function smokeAtTheSide(world: VfxWorld, seconds: number, count: (w: VfxWorld) => number): number {
  world.setWind([0, 0, -1.5])
  let worst = 0
  let frame = 0
  run(world, seconds, () => {
    if (frame++ % 4 === 0) world.burst('smoke', [0, 0.9, 2.2], [0, 0, -1], 6, 3.5)
    worst = Math.max(worst, count(world))
  })
  return worst
}

describe('closed spaces (enclose): smoke does not go through a shut car', () => {
  it('without the space, smoke blown at the car goes through it (the bug)', () => {
    const world = createVfx({ seed: 3, profile: 'high' })
    expect(smokeAtTheSide(world, 4, (w) => spritesInside(w, CABIN))).toBeGreaterThan(8)
  })

  it('a sealed space keeps all of the smoke out', () => {
    const world = createVfx({ seed: 3, profile: 'high' })
    world.enclose('car', CABIN)
    expect(smokeAtTheSide(world, 4, (w) => spritesInside(w, CABIN))).toBe(0)
    // and the smoke is still there, piled against the side and flowing round
    expect(world.sprites().live).toBeGreaterThan(50)
  })

  it('the gaps of a shut door let a little in, slowly', () => {
    const world = createVfx({ seed: 3, profile: 'high' })
    world.enclose('car', { ...CABIN, leak: 0.6 })
    const leaked = smokeAtTheSide(world, 6, (w) => spritesInside(w, CABIN))
    expect(leaked).toBeGreaterThan(0)
    const open = createVfx({ seed: 3, profile: 'high' })
    open.enclose('car', { ...CABIN, openings: [{ center: [0, 0.1, 0.7], halfSize: [0.5, 0.35, 0.2] }] })
    const through = smokeAtTheSide(open, 6, (w) => spritesInside(w, CABIN))
    // an open window lets in many times what the gaps do
    expect(through).toBeGreaterThan(leaked * 3)
  })

  it('an open window on the side the smoke comes from lets it in; one on the far side does not', () => {
    const near = createVfx({ seed: 3, profile: 'high' })
    near.enclose('car', { ...CABIN, openings: [{ center: [0, 0.1, 0.7], halfSize: [0.5, 0.35, 0.2] }] })
    expect(smokeAtTheSide(near, 4, (w) => spritesInside(w, CABIN))).toBeGreaterThan(4)
    const far = createVfx({ seed: 3, profile: 'high' })
    far.enclose('car', { ...CABIN, openings: [{ center: [0, 0.1, -0.7], halfSize: [0.5, 0.35, 0.2] }] })
    expect(smokeAtTheSide(far, 4, (w) => spritesInside(w, CABIN))).toBe(0)
  })

  /** The smoke of a stun grenade going off 3 m from the car's side, pushed at it by the wind: the most puffs inside at once over 6 s. */
  const blastSmoke = (enclosure: VfxEnclosure | null): number => {
    const world = createVfx({ seed: 9, profile: 'high', areaCap: false })
    if (enclosure) world.enclose('car', enclosure)
    world.setWind([0, 0, -2])
    world.explosion('flashbang', [0, 0.1, 3])
    let most = 0
    run(world, 6, () => {
      most = Math.max(most, puffsInside(world, CABIN))
    })
    return most
  }

  it('holds out the smoke of a blast (puffs), which went through before', () => {
    expect(blastSmoke(null)).toBeGreaterThan(3)
    expect(blastSmoke(CABIN)).toBe(0)
  })

  it('a bullet hole lets in only part of the smoke an open window does', () => {
    const side = { center: [0, 0, 0.7] as const, halfSize: [1.1, 0.5, 0.15] as const }
    const viaOpen = blastSmoke({ ...CABIN, openings: [side] })
    const viaHole = blastSmoke({ ...CABIN, openings: [{ ...side, rate: 1 }] })
    expect(viaOpen).toBeGreaterThan(3)
    expect(viaHole).toBeLessThan(viaOpen)
  })

  it('smoke that starts inside a shut car stays inside', () => {
    const world = createVfx({ seed: 5, profile: 'high' })
    world.enclose('car', CABIN)
    world.setWind([2, 0, 0])
    world.burst('smoke', [0, 1, 0], [0, 1, 0], 40, 2)
    run(world, 0.05)
    const start = spritesInside(world, CABIN)
    expect(start).toBeGreaterThan(20)
    run(world, 1.5)
    expect(spritesInside(world, CABIN)).toBe(world.sprites().live)
  })

  it('follows a car turned on the ground (the box is turned by its quaternion)', () => {
    const half = Math.SQRT1_2
    // turned 90° about y: its 2.2 m length now runs along z
    const turned: VfxEnclosure = { ...CABIN, orientation: [0, half, 0, half] }
    const world = createVfx({ seed: 3, profile: 'high' })
    world.enclose('car', turned)
    let frame = 0
    let worst = 0
    const along: VfxEnclosure = { center: [0, 1.1, 0], halfSize: [0.7, 0.5, 1.1] }
    run(world, 4, () => {
      if (frame++ % 4 === 0) world.burst('smoke', [2.2, 0.9, 0], [-1, 0, 0], 6, 3.5)
      worst = Math.max(worst, spritesInside(world, along))
    })
    expect(worst).toBe(0)
  })

  it('holds the Workshop smoke sprites inside a shut car, not its falling drops', () => {
    /** Workshop sprites outside the cabin after smoke (rising) and drops (falling) started in it, 3 s on. */
    const outside = (enclose: boolean): { smoke: number; drops: number } => {
      const world = createVfx({ seed: 9, profile: 'high' })
      if (enclose) world.enclose('car', CABIN)
      const pool = world.workshop().normal
      for (let k = 0; k < 30; k++) pool.spawn({ p: [0, 1.0, 0], dir: [0, 1, 0], cone: 0.4, sp: [1, 2], drag: 0.6, life: 6, size: [0.2, 0.3], grow: 4, c0: 0x6a6a68, a: 0.4, g: -0.35 })
      for (let k = 0; k < 10; k++) pool.spawn({ p: [0, 1.0, 0], dir: [0, 1, 0], cone: 0.4, sp: [1, 2], life: 6, size: 0.02, c0: 0x880000, g: 9.8 })
      run(world, 3)
      let smoke = 0
      let drops = 0
      for (let i = 0; i < pool.count; i++) {
        const out = Math.abs(pool.position[i * 3]!) > 1.1 || Math.abs(pool.position[i * 3 + 1]! - 1.1) > 0.5 || Math.abs(pool.position[i * 3 + 2]!) > 0.7
        if (!out) continue
        if (pool.gravity[i]! > 3) drops++
        else smoke++
      }
      return { smoke, drops }
    }
    expect(outside(false).smoke).toBeGreaterThan(10)
    const held = outside(true)
    expect(held.smoke).toBe(0)
    // the drops fall through to the ground: the solid floor of the car is the host's collision, not the air's
    expect(held.drops).toBeGreaterThan(0)
  })

  it('ending the space lets the smoke through again; clear keeps the spaces', () => {
    const world = createVfx({ seed: 3, profile: 'high' })
    world.enclose('car', CABIN)
    world.clear()
    expect(world.enclosures().size).toBe(1)
    world.enclose('car', null)
    expect(world.enclosures().size).toBe(0)
    expect(smokeAtTheSide(world, 4, (w) => spritesInside(w, CABIN))).toBeGreaterThan(8)
  })

  it('stops a step into a wall on the wall, with the normal pointing back the way it came', () => {
    const e = new Enclosures(1)
    e.set('box', CABIN)
    expect(e.inside(0, 1.1, 0)).toBe(true)
    expect(e.inside(0, 1.7, 0)).toBe(false)
    // from above into the roof: stopped on the roof, the normal up
    expect(e.confine(0, 1.8, 0, 0, 1.5, 0, 0, 1 / 60)).toBe(true)
    expect(e.out.y).toBeCloseTo(1.6, 2)
    expect(e.out.ny).toBeCloseTo(1, 5)
    // from inside out through the side: back inside, the normal pointing in
    expect(e.confine(0, 1.1, 0.6, 0, 1.1, 0.8, 0, 1 / 60)).toBe(true)
    expect(e.out.z).toBeLessThan(0.7)
    expect(e.out.nz).toBeCloseTo(-1, 5)
    // a step that stays outside, or one through an opening, is left alone
    expect(e.confine(0, 2.5, 0, 0.1, 2.5, 0, 0, 1 / 60)).toBe(false)
    e.set('box', { ...CABIN, openings: [{ center: [0, 0.5, 0], halfSize: [0.4, 0.15, 0.3] }] })
    expect(e.confine(0, 1.8, 0, 0, 1.5, 0, 0, 1 / 60)).toBe(false)
  })
})
