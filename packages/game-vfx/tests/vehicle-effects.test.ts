import { describe, expect, it } from 'vitest'

import { createVfx, GAME_EFFECTS } from '../src'

// The Garagem's recipes written around a car: played at a point of the world they land there (the Workshop keeps the car at (5.6, 0, 0.8)).
const world = () => createVfx({ seed: 5, randomMode: 'shared', effects: GAME_EFFECTS })
const run = (vfx: ReturnType<typeof world>, seconds: number): void => {
  for (let i = 0; i < seconds * 30; i++) vfx.update(1 / 30)
}

describe('vehicle effects', () => {
  it('keeps the aliases next to the Workshop recipes and the point-based entries the vehicles use', () => {
    for (const id of ['vehicle_fire', 'vehicle_exhaust', 'vehicle_leak_ignited']) expect(GAME_EFFECTS[id]?.anchor).toEqual([5.6, 0, 0.8])
    // the leak lands on the hole: its anchor is the hole of the Workshop's tank
    expect(GAME_EFFECTS.vehicle_leak?.anchor).not.toEqual([5.6, 0, 0.8])
    expect(GAME_EFFECTS.engine_smoke?.anchor).toBeUndefined()
    const vfx = world()
    expect(vfx.catalog()).toContain('car_fuel_tank')
    for (const id of ['impact_metal', 'glass_burst']) expect(vfx.effectIds()).toContain(id)
  })

  it('plays the engine fire where the vehicle stands, and its light follows', () => {
    const vfx = world()
    const handle = vfx.play('vehicle_fire', [20, 0, -4])
    expect(handle).not.toBeNull()
    run(vfx, 2)
    const smoke = vfx.workshop().normal
    expect(smoke.count).toBeGreaterThan(0)
    for (let i = 0; i < smoke.count; i++) {
      expect(Math.abs((smoke.position[i * 3] ?? 0) - 20)).toBeLessThan(6)
      expect(Math.abs((smoke.position[i * 3 + 2] ?? 0) + 4)).toBeLessThan(6)
    }
  })

  it('plays the exhaust for a short stretch and the leak with the page numbers', () => {
    const vfx = world()
    expect(vfx.play('vehicle_exhaust', [0, 0.3, 0])).not.toBeNull()
    run(vfx, 0.5)
    expect(vfx.workshop().normal.count).toBeGreaterThan(0)
    run(vfx, 1)
    expect(vfx.workshop().normal.count).toBeGreaterThanOrEqual(0)
    expect(vfx.play('vehicle_leak', [3, 0, 3])).not.toBeNull()
    run(vfx, 4)
    expect(() => run(vfx, 8)).not.toThrow()
  })

  it('keeps the leak without fire or blast and the whole sequence as another id', () => {
    const only = GAME_EFFECTS.vehicle_leak
    const full = GAME_EFFECTS.vehicle_leak_ignited
    expect(only).toBeDefined()
    expect(full).toBeDefined()
    // the leak is the drips: no light (fire), no cue of the blast, and no pool of its own (the host's fluid world lays what leaks)
    expect(only?.budget.lights).toBe(0)
    expect(only?.timeline).toHaveLength(0)
    expect(full?.timeline.length).toBeGreaterThan(only?.timeline.length ?? 0)
    expect(full?.budget.lights).toBeGreaterThan(0)
    // 9 s is past the 7.2 s of the blast of the whole sequence: the leak is still a few drips, the whole sequence is a fire with its smoke
    const vfx = world()
    expect(vfx.play('vehicle_leak', [3, 0, 3])).not.toBeNull()
    run(vfx, 9)
    expect(vfx.workshop().normal.count).toBeLessThan(10)
    const second = world()
    expect(second.play('vehicle_leak_ignited', [3, 0, 3])).not.toBeNull()
    run(second, 9)
    expect(second.workshop().normal.count).toBeGreaterThan(100)
  })

  it('blows a car up at a point with the catalogue entry of the Garagem', () => {
    const vfx = world()
    expect(vfx.explosion('car_fuel_tank', [4, 0.6, 4], { scale: 1 })).not.toBeNull()
    run(vfx, 1)
    expect(vfx.stats().puffs).toBeGreaterThan(0)
  })
})

describe('a leak drips from the hole and draws no pool of its size', () => {
  const pools = (vfx: ReturnType<typeof createVfx>) => vfx.workshop().decals.decals.filter((d) => d.on)

  it('a hole in a tank half a metre up: drips start at the hole, and no 2 m pool is drawn at once', () => {
    const vfx = world()
    expect(vfx.play('vehicle_leak', [1.6, 0.45, -1.3])).not.toBeNull()
    run(vfx, 0.5)
    expect(pools(vfx)).toHaveLength(0)
    const drips = vfx.workshop().normal
    expect(drips.count).toBeGreaterThan(0)
    for (let i = 0; i < drips.count; i++) {
      expect(Math.hypot((drips.position[i * 3] ?? 0) - 1.6, (drips.position[i * 3 + 2] ?? 0) + 1.3)).toBeLessThan(0.15)
      expect(drips.position[i * 3 + 1] ?? 0).toBeLessThanOrEqual(0.46)
    }
  })

  it('the leak that caught fire lays its burning pool on the floor under it, not at the height of the hole', () => {
    const vfx = createVfx({ seed: 5, randomMode: 'shared', effects: GAME_EFFECTS, groundAt: () => 1.2 })
    vfx.play('vehicle_leak_ignited', [0, 1.7, 0])
    run(vfx, 1)
    expect(pools(vfx).length).toBeGreaterThan(0)
    for (const d of pools(vfx)) expect(d.y).toBeCloseTo(1.2, 1)
  })
})

describe('a round into a car skin (impact_bodywork)', () => {
  /** Plays one round at the side of a car (normal -x, the round going +x and back), `bore` metres across, and runs a few frames. */
  const shoot = (bore: number) => {
    const vfx = world()
    const handle = vfx.play('impact_bodywork', [2, 0.7, 1], { normal: [-1, 0, 0], values: { bore, paint: 0x8a1c1c, dx: 0.8, dy: -0.2, dz: -0.56 } })
    expect(handle).not.toBeNull()
    for (let i = 0; i < 3; i++) vfx.update(1 / 60)
    const engine = vfx.workshop()
    const debris = engine.debris.pieces.filter((piece) => piece.on)
    const decals = engine.decals.decals.filter((decal) => decal.on)
    return { debris, decals }
  }

  it('leaves no mark of its own: the hole is the vehicle’s, on the panel that goes with the door', () => {
    expect(shoot(0.009).decals).toHaveLength(0)
  })

  it('throws paint flakes and sheet slivers off the hit, out of the panel, as the debris pieces a shot wall throws', () => {
    const { debris } = shoot(0.009)
    expect(debris.length).toBeGreaterThan(0)
    expect(debris.some((piece) => piece.color === 0x8a1c1c)).toBe(true)
    for (const piece of debris) {
      // off the side of the car (normal -x): nothing flies into the panel
      expect(piece.vx).toBeLessThan(0.5)
      expect(Math.hypot(piece.x - 2, piece.y - 0.7, piece.z - 1)).toBeLessThan(0.5)
    }
  })

  it('throws more and bigger pieces the bigger the round (a slug against a 9 mm)', () => {
    const pistol = shoot(0.009).debris
    const slug = shoot(0.0185).debris
    expect(slug.length).toBeGreaterThan(pistol.length)
    const biggest = (pieces: typeof pistol) => Math.max(...pieces.map((piece) => Math.max(piece.sx, piece.sz)))
    expect(biggest(slug)).toBeGreaterThan(biggest(pistol))
  })
})
