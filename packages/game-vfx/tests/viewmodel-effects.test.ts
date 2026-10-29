import { describe, expect, it } from 'vitest'

import { createVfx, GAME_EFFECTS, lehmer, VIEWMODEL_EFFECTS } from '../src'
import type { MeshParticle } from '../src'

// The first-person effects of the Arsenal gallery as recipes: the solids the gallery's `createEffects` and `heavy` build, with their numbers, in the mesh pool of the Workshop.
// (The flash and its smoke are also compared with the gallery's own code, frame by frame, in game-vfx-three/tests/viewmodel-flash.test.ts.)
const world = () => createVfx({ seed: 11, randomMode: 'shared' })
const particles = (vfx: ReturnType<typeof world>): readonly MeshParticle[] => vfx.workshop().meshes.particles
type Quaternion = readonly [number, number, number, number]

/** three.js's `Vector3.applyQuaternion`. */
function turned(q: Quaternion, v: readonly [number, number, number]): [number, number, number] {
  const [qx, qy, qz, qw] = q
  const ix = qw * v[0] + qy * v[2] - qz * v[1]
  const iy = qw * v[1] + qz * v[0] - qx * v[2]
  const iz = qw * v[2] + qx * v[1] - qy * v[0]
  const iw = -qx * v[0] - qy * v[1] - qz * v[2]
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]
}
/** A turn about y by `yaw` then about the new z by `pitch`, as a unit quaternion. */
const AIMED: Quaternion = (() => {
  const yaw = 0.9
  const pitch = 0.5
  const cy = Math.cos(yaw / 2)
  const sy = Math.sin(yaw / 2)
  const cp = Math.cos(pitch / 2)
  const sp = Math.sin(pitch / 2)
  return [sy * sp, sy * cp, cy * sp, cy * cp]
})()
const LEVEL: Quaternion = [0, 0, 0, 1]
const near = (actual: readonly number[], expected: readonly number[], digits = 9): void => expected.forEach((value, index) => expect(actual[index]!).toBeCloseTo(value, digits))

describe('the effects of the weapon in the hands', () => {
  it('are in the catalogue a world plays by default', () => {
    expect(VIEWMODEL_EFFECTS.map((effect) => effect.id)).toEqual(['viewmodel_muzzle_flash', 'weapon_smoke_puff', 'launcher_backblast', 'flame_jet'])
    for (const effect of VIEWMODEL_EFFECTS) expect(GAME_EFFECTS[effect.id]).toBe(effect)
  })

  it('make a flash of one open cone, four small cones and a core, two thin spheres of smokeless smoke by default, and a light of 4 k at 2 k metres', () => {
    const vfx = world()
    expect(vfx.play('viewmodel_muzzle_flash', [1, 1.5, -2], { orientation: LEVEL, seed: 3, values: { size: 1.2 } })).not.toBeNull()
    const all = particles(vfx)
    expect(all.map((piece) => piece.shape)).toEqual(['cone_open', 'cone', 'cone', 'cone', 'cone', 'sphere', 'sphere', 'sphere'])
    const [cone, ...rest] = all
    expect([cone!.radius, cone!.height, cone!.segments, cone!.segments2]).toEqual([0.013 * 1.2, 0.085 * 1.2, 10, 1])
    for (const spike of rest.slice(0, 4)) expect([spike.radius, spike.height, spike.segments, spike.segments2]).toEqual([0.005 * 1.2, 0.04 * 1.2, 6, 1])
    const core = rest[4]!
    expect([core.radius, core.segments, core.segments2, core.color, core.additive]).toEqual([0.016 * 1.2, 12, 8, 0xfff1c0, true])
    for (const puff of rest.slice(5)) expect([puff.radius, puff.segments, puff.segments2, puff.color, puff.lit, puff.additive, puff.startOpacity, puff.grow]).toEqual([0.01 * 1.2, 10, 8, 0x8a8a86, true, false, 0.14, 2.1])
    const light = vfx.workshop().lights.lights.find((source) => source.intensity > 0)!
    expect(light.intensity).toBeCloseTo(4.8, 10)
    expect(light.distance).toBeCloseTo(2.4, 10)
    expect(light.steady).toBe(true)
    expect(light.color).toBe(0xffb060)
  })

  it('drives the puffs and flash scale from values (black powder, suppressed, none)', () => {
    const bp = world()
    bp.play('viewmodel_muzzle_flash', [0, 0, 0], {
      orientation: LEVEL,
      seed: 3,
      values: { size: 1, puffs: 8, radius: 0.022, opacity: 0.55, life: 5.5, drift: 0.12, rise: 0.04, growth: 2.8, flash: 1 },
    })
    const bpPuffs = particles(bp).slice(6)
    expect(bpPuffs).toHaveLength(8)
    for (const puff of bpPuffs) expect([puff.radius, puff.startOpacity, puff.grow]).toEqual([0.022, 0.55, 2.8])

    const sup = world()
    sup.play('viewmodel_muzzle_flash', [0, 0, 0], {
      orientation: LEVEL,
      seed: 3,
      values: { size: 1, puffs: 1, radius: 0.006, opacity: 0.08, life: 0.5, drift: 0.15, rise: 0.05, growth: 2.1, flash: 0.15 },
    })
    expect(particles(sup)).toHaveLength(7)
    expect(particles(sup)[0]!.radius).toBeCloseTo(0.013 * 0.15, 10)
    expect(sup.workshop().lights.lights.find((source) => source.intensity > 0)!.intensity).toBeCloseTo(4 * 0.15, 10)
    expect(particles(sup)[6]!.startOpacity).toBe(0.08)

    const none = world()
    none.play('viewmodel_muzzle_flash', [0, 0, 0], {
      orientation: LEVEL,
      seed: 3,
      values: { size: 1, puffs: 0, radius: 0, opacity: 0, life: 0, drift: 0, rise: 0, growth: 0, flash: 0 },
    })
    expect(particles(none)).toHaveLength(0)
    expect(none.workshop().lights.lights.every((source) => source.intensity === 0)).toBe(true)
  })

  it('grows the flash from 0.6 by 0.9 over 55 ms and ends it with the ramp; the light holds and goes out with it', () => {
    const vfx = world()
    vfx.play('viewmodel_muzzle_flash', [0, 0, 0], { orientation: LEVEL, seed: 3, values: { size: 1 } })
    const flashes = (): MeshParticle[] => particles(vfx).filter((piece) => piece.additive)
    const engine = vfx.workshop()
    vfx.update(0.0275)
    expect(flashes()).toHaveLength(6)
    for (const piece of flashes()) expect(piece.scale).toBeCloseTo(0.6 + 0.5 * 0.9, 10)
    expect(engine.lights.lights.find((source) => source.intensity > 0)!.intensity).toBeCloseTo(4, 10)
    vfx.update(0.0275)
    expect(flashes()).toHaveLength(0)
    expect(engine.lights.lights.every((source) => source.intensity === 0)).toBe(true)
    expect(particles(vfx)).toHaveLength(2)
  })

  it('draws the flash numbers in the gallery order: the angle of each small cone, the roll of the group, then the velocity and life of each puff', () => {
    const vfx = world()
    const seed = 21
    vfx.play('viewmodel_muzzle_flash', [0, 0, 0], { orientation: LEVEL, seed, values: { size: 1 } })
    const stream = lehmer(seed)
    const angles = [0, 1, 2, 3].map((index) => (index * Math.PI) / 2 + stream.next() * 0.6)
    const roll = stream.next() * Math.PI
    const [, ...rest] = particles(vfx)
    angles.forEach((angle, index) => {
      expect(rest[index]!.rz).toBeCloseTo(-Math.PI / 2, 12)
      expect(rest[index]!.rx).toBeCloseTo(angle, 12)
      expect(rest[index]!.at[1]).toBeCloseTo(Math.cos(angle) * 0.016, 12)
      expect(rest[index]!.at[2]).toBeCloseTo(Math.sin(angle) * 0.016, 12)
    })
    const rolled = rest[0]!.frame
    near(rolled, [Math.sin(roll / 2), 0, 0, Math.cos(roll / 2)], 12)
    for (const puff of rest.slice(5)) {
      const velocity = [0.2 + stream.next() * 0.1, 0.06 + stream.next() * 0.04, (stream.next() - 0.5) * 0.06]
      const life = 0.7 + stream.next() * (0.7 * 0.3)
      near([puff.vx, puff.vy, puff.vz], velocity, 12)
      expect(puff.life).toBeCloseTo(life, 12)
    }
  })

  it('sends the smoke along the barrel it is turned to, pitch and all', () => {
    const vfx = world()
    vfx.play('viewmodel_muzzle_flash', [0, 0, 0], { orientation: AIMED, direction: turned(AIMED, [1, 0, 0]), seed: 4, values: { size: 1 } })
    const reference = lehmer(4)
    for (let index = 0; index < 5; index++) reference.next()
    for (const puff of particles(vfx).slice(6)) {
      const local: [number, number, number] = [0.2 + reference.next() * 0.1, 0.06 + reference.next() * 0.04, (reference.next() - 0.5) * 0.06]
      reference.next()
      near([puff.vx, puff.vy, puff.vz], turned(AIMED, local), 12)
    }
  })

  it('throws one puff of smoke with the velocity, radius, life and opacity it is given: a sphere that fades, rises, slows and grows by 2.1 a second', () => {
    const vfx = world()
    vfx.play('weapon_smoke_puff', [0, 1, 0], { seed: 1, values: { vx: 0.01, vy: 0.1, vz: -0.02, radius: 0.0105, life: 2, opacity: 0.29 } })
    const [puff, ...others] = particles(vfx)
    expect(others).toHaveLength(0)
    expect([puff!.shape, puff!.radius, puff!.segments, puff!.segments2, puff!.life, puff!.startOpacity, puff!.fade, puff!.gravity, puff!.drag, puff!.grow]).toEqual(['sphere', 0.0105, 10, 8, 2, 0.29, true, -0.08, 2.2, 2.1])
    expect([puff!.vx, puff!.vy, puff!.vz]).toEqual([0.01, 0.1, -0.02])
  })

  it('moves a puff as the gallery moves its particles: age, fade, gravity, drag, move, grow, in that order', () => {
    const vfx = world()
    vfx.play('weapon_smoke_puff', [0, 1, 0], { seed: 1, values: { vx: 0, vy: 0.1, vz: 0, radius: 0.01, life: 2, opacity: 0.4 } })
    const puff = particles(vfx)[0]!
    vfx.update(0.1)
    const vy = (0.1 - -0.08 * 0.1) * (1 - 2.2 * 0.1)
    expect(puff.vy).toBeCloseTo(vy, 12)
    expect(puff.y).toBeCloseTo(1 + vy * 0.1, 12)
    expect(puff.scale).toBeCloseTo(1 + 2.1 * 0.1, 12)
    expect(puff.opacity).toBeCloseTo(0.4 * (1 - 0.1 / 2), 12)
  })

  for (const [name, orientation] of [['level', LEVEL], ['aimed', AIMED]] as const) {
    it(`throws the backblast as heavy.ts drew it, number for number: 26 spheres of smoke and 14 icosahedra of fire, ${name}`, () => {
      const vfx = world()
      const seed = 5
      vfx.play('launcher_backblast', [0, 1.5, 0], { orientation, direction: turned(orientation, [1, 0, 0]), seed })
      const all = particles(vfx)
      expect(all).toHaveLength(40)
      const random = lehmer(seed).next
      const forward = turned(orientation, [1, 0, 0])
      const spread = (x: number, y: number, z: number): [number, number, number] => [(random() - 0.5) * x, (random() - 0.5) * y, (random() - 0.5) * z]
      for (let index = 0; index < 26; index++) {
        const back = -(1.5 + random() * 3)
        const loose = spread(1.4, 0.8, 1.4)
        const velocity = [forward[0] * back + loose[0], forward[1] * back + loose[1], forward[2] * back + loose[2]]
        const radius = 0.03 + random() * 0.03
        const life = 1.8 + random() * 1.4
        const puff = all[index]!
        expect(puff.shape).toBe('sphere')
        near([puff.vx, puff.vy, puff.vz], velocity, 11)
        expect(puff.radius).toBeCloseTo(radius, 12)
        expect(puff.life).toBeCloseTo(life, 12)
        expect(puff.startOpacity).toBe(0.5)
        near([puff.x, puff.y, puff.z], [0, 1.5, 0], 12)
      }
      const palette = [0xff7a22, 0xffc040, 0xc8361a, 0xfff0b0]
      for (let index = 0; index < 14; index++) {
        const back = -(2 + random() * 2)
        const loose = spread(1, 0.6, 1)
        const velocity = [forward[0] * back + loose[0], forward[1] * back + loose[1], forward[2] * back + loose[2]]
        const colour = Math.floor(random() * 4)
        const bit = all[26 + index]!
        expect(bit.shape).toBe('icosahedron')
        near([bit.vx, bit.vy, bit.vz], velocity, 11)
        expect([bit.radius, bit.life, bit.segments, bit.color, bit.additive]).toEqual([0.02, 0.25, 1, palette[colour], colour === 3])
        expect(bit.rx).toBeCloseTo(random() * 3, 12)
        expect(bit.ry).toBeCloseTo(random() * 3, 12)
        expect([bit.spin, bit.gravity, bit.drag, bit.grow, bit.startOpacity]).toEqual([[3, 4, 2], -1.4, 1.4, 2.2, 0.9])
      }
    })
  }

  it('throws floor(420 dt scale) bits of fire in a frame of the flame jet, as heavy.ts drew them, and about half the frames a puff of smoke', () => {
    const palette = [0xff7a22, 0xffc040, 0xc8361a, 0xfff0b0]
    let smokes = 0
    for (let seed = 1; seed <= 12; seed++) {
      const vfx = world()
      const dt = 1 / 60
      const scale = 0.6
      const point: [number, number, number] = [0, 1, 0]
      vfx.play('flame_jet', point, { orientation: AIMED, direction: turned(AIMED, [1, 0, 0]), seed, values: { dt, scale } })
      const all = particles(vfx)
      const random = lehmer(seed).next
      const forward = turned(AIMED, [1, 0, 0])
      const count = Math.floor(dt * 420 * scale)
      for (let index = 0; index < count; index++) {
        const speed = (2.2 + random() * 1.1) * scale
        const reach = random() * speed * Math.min(dt, 0.3)
        const loose: [number, number, number] = [(random() - 0.5) * 0.35, (random() - 0.3) * 0.3, (random() - 0.5) * 0.35]
        const radius = 0.02 + random() * 0.022
        const life = 0.4 + random() * 0.35
        const colour = Math.floor(random() * 4)
        const bit = all[index]!
        near([bit.x, bit.y, bit.z], [point[0] + forward[0] * reach, point[1] + forward[1] * reach, point[2] + forward[2] * reach], 11)
        near([bit.vx, bit.vy, bit.vz], [forward[0] * speed + loose[0], forward[1] * speed + loose[1], forward[2] * speed + loose[2]], 11)
        expect(bit.radius).toBeCloseTo(radius, 12)
        expect(bit.life).toBeCloseTo(life, 12)
        expect([bit.color, bit.additive]).toEqual([palette[colour], colour === 3])
        expect(bit.rx).toBeCloseTo(random() * 3, 12)
        expect(bit.ry).toBeCloseTo(random() * 3, 12)
      }
      expect(all.filter((piece) => piece.shape === 'icosahedron')).toHaveLength(count)
      if (random() < 0.5) {
        const reach = 1.1 * scale + random() * 0.4
        const puff = all[count]!
        expect(puff.shape).toBe('sphere')
        near([puff.x, puff.y, puff.z], [point[0] + forward[0] * reach, point[1] + forward[1] * reach, point[2] + forward[2] * reach], 11)
        near([puff.vx, puff.vy, puff.vz], [forward[0] * 0.6, 0.35, forward[2] * 0.6], 11)
        expect([puff.radius, puff.life, puff.startOpacity]).toEqual([0.03, 1.6, 0.4])
        smokes++
      } else expect(all).toHaveLength(count)
    }
    expect(smokes).toBeGreaterThan(1)
    expect(smokes).toBeLessThan(11)
  })
})
