import { describe, expect, it } from 'vitest'

import { createArsenal, createRng, nominalFuse, sampleFuse } from '../src'
import type { ExplosiveBody, ExplosiveDef, Use, Vec3, WeaponState } from '../src'

const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const FRAME = 1 / 60
const THROWS = 200

const arsenal = createArsenal({ rules: { faults: false } })

const dynamite = arsenal.explosives.get('dynamite') as ExplosiveDef
const flashbang = arsenal.explosives.get('flashbang') as ExplosiveDef

/** What one pull and release of a throwable gives (the throw comes on the release of a cooked one). */
const throwOf = (weapon: WeaponState): Use => {
  const pulled = weapon.trigger(ORIGIN, AIM, 0, false)
  const use = (weapon.release(ORIGIN, AIM) ?? pulled).uses[0] ?? pulled.uses[0]
  if (!use) throw new Error('the throwable gave no use')
  return use
}

/** The use of the first pull of a throwable seeded with `seed`, on a fresh weapon. */
const useOf = (weaponId: string, seed: number, source = arsenal): Use => throwOf(source.create(weaponId, { seed }))

const fuseOf = (use: Use): number => (use.kind === 'throw' || use.kind === 'place' ? (use.fuse ?? 0) : 0)

const detonationTime = (body: ExplosiveBody): number | undefined => {
  for (let elapsed = 0; elapsed < 120; elapsed += FRAME) {
    for (const event of body.step(FRAME)) if (event.type === 'detonate') return event.detonation.at
  }
  return undefined
}

describe('fuse of a safety fuse: length times burn rate, scattered by the tolerance', () => {
  it('converts metres of fuse to seconds at the burn rate (0.03 m at 131 s/m is 3.93 s)', () => {
    expect(dynamite).toMatchObject({ fuseLength: 0.03, burnRate: 131, burnTolerance: 0.1 })
    expect(nominalFuse(dynamite)).toBeCloseTo(3.93, 9)
    expect(nominalFuse(dynamite, 1)).toBeCloseTo(131, 9)
    expect(sampleFuse({ ...dynamite, burnTolerance: 0 }, () => 0.9, 0.5)).toBeCloseTo(65.5, 9)
  })

  it('stays inside ±10% of the nominal fuse, uses both sides of it, and repeats with the seed', () => {
    const fuses = Array.from({ length: THROWS }, (_, index) => fuseOf(useOf('dynamite', index + 1)))
    for (const fuse of fuses) {
      expect(fuse).toBeGreaterThanOrEqual(3.93 * 0.9 - 1e-9)
      expect(fuse).toBeLessThanOrEqual(3.93 * 1.1 + 1e-9)
    }
    expect(Math.min(...fuses)).toBeLessThan(3.93 * 0.95)
    expect(Math.max(...fuses)).toBeGreaterThan(3.93 * 1.05)
    expect(fuses).toEqual(Array.from({ length: THROWS }, (_, index) => fuseOf(useOf('dynamite', index + 1))))
  })

  it('a longer fuse set by the host burns longer, and the dynamite is set down lit instead of thrown', () => {
    const weapon = arsenal.create('dynamite', { seed: 3 })
    weapon.setFuseLength(0.3)
    const use = throwOf(weapon)
    expect(use).toMatchObject({ kind: 'place', triggers: ['timer'] })
    const fuse = fuseOf(use as Use)
    expect(fuse).toBeGreaterThanOrEqual(0.3 * 131 * 0.9 - 1e-9)
    expect(fuse).toBeLessThanOrEqual(0.3 * 131 * 1.1 + 1e-9)
    const body = arsenal.explosiveBody(use as Use) as ExplosiveBody
    expect(body.fuseRemaining).toBeCloseTo(fuse, 9)
    expect(detonationTime(body)).toBeCloseTo(fuse, 1)
  })

  it('a fuse length put in the arsenal options (patch) does the same for every dynamite', () => {
    const patched = createArsenal({ rules: { faults: false }, patch: { explosives: { dynamite: { fuseLength: 0.2, burnTolerance: 0 } } } })
    const use = useOf('dynamite', 1, patched)
    expect(use).toMatchObject({ kind: 'place', fuse: 0.2 * 131 })
  })

  it('goes back to the fuse of the explosive when the host clears the length', () => {
    const weapon = arsenal.create('dynamite', { seed: 3 })
    weapon.setFuseLength(0.3)
    weapon.setFuseLength(undefined)
    expect(throwOf(weapon)).toMatchObject({ kind: 'throw' })
  })
})

describe('flashbang fuse: a seeded range of 1.0 to 2.3 s from the lever (M84)', () => {
  it('samples one fuse per throw inside the range, covering most of it', () => {
    expect(flashbang.fuseRange).toEqual([1, 2.3])
    const fuses = Array.from({ length: THROWS }, (_, index) => fuseOf(useOf('flashbang', index + 1)))
    for (const fuse of fuses) {
      expect(fuse).toBeGreaterThanOrEqual(1)
      expect(fuse).toBeLessThan(2.3)
    }
    expect(Math.min(...fuses)).toBeLessThan(1.2)
    expect(Math.max(...fuses)).toBeGreaterThan(2.1)
    expect(fuses).toEqual(Array.from({ length: THROWS }, (_, index) => fuseOf(useOf('flashbang', index + 1))))
  })

  it('the body explodes at the sampled fuse, and the successive throws of one weapon differ', () => {
    const weapon = arsenal.create('flashbang', { seed: 11 })
    const first = throwOf(weapon)
    const second = throwOf(weapon)
    expect(fuseOf(first)).not.toBe(fuseOf(second))
    expect(detonationTime(arsenal.explosiveBody(first) as ExplosiveBody)).toBeCloseTo(fuseOf(first), 1)
  })

  it('draws from a stream of its own: a fixed fuse takes none, and the spread of a firearm is the same with or without throws before', () => {
    const grenadeFuses = new Set(Array.from({ length: 20 }, (_, index) => fuseOf(useOf('frag_grenade', index + 1))))
    expect([...grenadeFuses]).toEqual([4])
    const shot = (withThrows: boolean): Vec3 => {
      const throwing = arsenal.create('flashbang', { seed: 5 })
      if (withThrows) throwOf(throwing)
      const rifle = arsenal.create('ak_47', { seed: 5 })
      rifle.draw()
      rifle.update(1)
      return rifle.trigger(ORIGIN, AIM, 0, false).shots[0]?.direction as Vec3
    }
    expect(shot(true)).toEqual(shot(false))
  })

  it('the stream is the same mulberry32 of the seed: sampling with createRng reproduces the first fuse', () => {
    const random = createRng((7 ^ 0xbb67ae85) >>> 0)
    expect(sampleFuse(flashbang, random)).toBeCloseTo(fuseOf(useOf('flashbang', 7)), 9)
  })
})

describe('the arsenal refuses a fuse that makes no sense', () => {
  it('lists every bad fuse number at once', () => {
    const bad = { ...dynamite, id: 'bad', fuseLength: -1, burnRate: 0, burnTolerance: 1.5, fuseRange: [3, 1] as const }
    expect(() => createArsenal({ explosives: [bad] })).toThrow(/fuse range[\s\S]*fuse length[\s\S]*burn rate[\s\S]*burn tolerance/)
  })
})
