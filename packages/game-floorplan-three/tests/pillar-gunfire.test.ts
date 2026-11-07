import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent, Vec3 } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { wallPiece } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { THREE } from './helpers/houses'

/**
 * Concentrated fire on one place of a reinforced concrete pillar (15 cm, the target wall's): its section wears there round by round until the pillar is cut.
 * The rounds are the game's own (energy and `penetration` of `game-weapons` ammo.json): the round goes as deep into concrete as its penetration says.
 */
const ROUNDS = {
  rifle: { energy: 2000, caliber: 7.9, penetration: { steel: 6.5, concrete: 110, brick: 220, wood: 300 } },
  fifty: { energy: 18000, caliber: 12.7, penetration: { steel: 14, concrete: 330, brick: 560, wood: 600 } },
  pistol: { energy: 500, caliber: 9, penetration: { steel: 3, concrete: 25, brick: 50, wood: 80 } },
  // one pellet of 00 buckshot: a shell is nine of them
  pellet: { energy: 350, caliber: 8.4, penetration: { steel: 0.8, concrete: 10, brick: 25, wood: 60 } },
} as const
type Round = (typeof ROUNDS)[keyof typeof ROUNDS]

const PILLAR = 'wall_column_0_1'
const BEAM = 'plate_0_0'

/** The target wall; `section` narrows its pillar under test (the kit's wall has 20 cm pillars, a house of a smaller span 15 cm ones). */
const setup = (section?: number) => {
  const { spec } = wallPiece(THREE, { w: 10, h: 3, house: { document: fakeDocument } })
  if (section !== undefined) {
    const shape = spec.parts.find((p: { id: string }) => p.id === PILLAR)!.shape as { size: number[] }
    shape.size = [section, shape.size[1]!, section]
  }
  const world = createDestruction({ seed: 1 })
  const id = world.add(spec, { id: 'w' })
  const part = spec.parts.find((p: { id: string }) => p.id === PILLAR)!
  const size = (part.shape as { size: number[] }).size
  const [x, y, z] = part.position as Vec3
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  return { world, id, x, y, z, bottom: y - size[1]! / 2, top: y + size[1]! / 2, events }
}

/** Rounds fired at one place until the pillar is cut there (its first chip), or `max`: how many it took, or null when it stood. */
const fireUntilCut = (round: Round, height: (s: ReturnType<typeof setup>) => number, max: number, perShot = 1, section?: number) => {
  const s = setup(section)
  const at = height(s)
  for (let k = 1; k <= max; k++) {
    for (let n = 0; n < perShot; n++) s.world.shoot([s.x, at, s.z + 5], [0, 0, -1], round.energy, round.caliber, 'test', { penetration: round.penetration })
    s.world.update(1 / 30)
    if (s.events.some((e) => e.type === 'chip' && e.part === PILLAR)) return { shots: k, s, at }
  }
  return { shots: null, s, at }
}

const middle = (s: ReturnType<typeof setup>): number => (s.bottom + s.top) / 2

describe('concentrated fire on a pillar', () => {
  it('a rifle cuts a 15 cm pillar in 20 to 30 rounds on the same place, a .50 in 5 to 10', () => {
    const rifle = fireUntilCut(ROUNDS.rifle, middle, 60, 1, 0.15)
    const fifty = fireUntilCut(ROUNDS.fifty, middle, 30, 1, 0.15)
    expect(rifle.shots).not.toBeNull()
    expect(rifle.shots!).toBeGreaterThanOrEqual(20)
    expect(rifle.shots!).toBeLessThanOrEqual(30)
    expect(fifty.shots).not.toBeNull()
    expect(fifty.shots!).toBeGreaterThanOrEqual(5)
    expect(fifty.shots!).toBeLessThanOrEqual(10)
  })

  it('the 20 cm pillar of the target wall takes as many more as it has more concrete (1.8 times): a rifle 35 to 50 rounds, a .50 8 to 15', () => {
    const rifle = fireUntilCut(ROUNDS.rifle, middle, 80)
    const fifty = fireUntilCut(ROUNDS.fifty, middle, 30)
    expect(rifle.shots!).toBeGreaterThanOrEqual(35)
    expect(rifle.shots!).toBeLessThanOrEqual(50)
    expect(fifty.shots!).toBeGreaterThanOrEqual(8)
    expect(fifty.shots!).toBeLessThanOrEqual(15)
  })

  it('shows its bars long before it is cut', () => {
    const s = setup()
    for (let k = 0; k < 8; k++) s.world.shoot([s.x, middle(s), s.z + 5], [0, 0, -1], ROUNDS.rifle.energy, ROUNDS.rifle.caliber, 'test', { penetration: ROUNDS.rifle.penetration })
    s.world.update(1 / 30)
    expect(s.events.some((e) => e.type === 'expose' && e.part === PILLAR)).toBe(true)
    expect(s.events.some((e) => e.type === 'chip' && e.part === PILLAR)).toBe(false)
  })

  it('a pistol or a shotgun practically never cuts it', () => {
    expect(fireUntilCut(ROUNDS.pistol, middle, 100).shots).toBeNull()
    expect(fireUntilCut(ROUNDS.pellet, middle, 60, 9).shots).toBeNull()
  })

  for (const [name, height, below] of [
    ['under its top', (s: ReturnType<typeof setup>) => s.top - 0.3, true],
    ['in the middle', middle, true],
    ['at its foot', (s: ReturnType<typeof setup>) => s.bottom + 0.15, false],
  ] as const) {
    it(`cut ${name}: what is under the cut stands, the concrete above it falls and the bond beam rests on the rest of the wall`, () => {
      const { shots, s, at } = fireUntilCut(ROUNDS.fifty, height, 30)
      expect(shots).not.toBeNull()
      for (let t = 0; t < 3; t += 1 / 30) s.world.update(1 / 30)
      const pillar = s.world.part(s.id, PILLAR)!
      const chipped = pillar.chipped ?? []
      // part space: the pillar's length is its y; nothing of its concrete is left above the cut (it would hang in the air)
      const local = at - (s.bottom + s.top) / 2
      const lowestGone = Math.min(...chipped.map((c) => c.center[1] - c.size[1] / 2))
      const highestGone = Math.max(...chipped.map((c) => c.center[1] + c.size[1] / 2))
      expect(lowestGone).toBeLessThanOrEqual(local + 0.06)
      expect(highestGone).toBeGreaterThanOrEqual((s.top - s.bottom) / 2 - 1e-3)
      // the concrete under the cut is still there, unless the cut was at the foot (there is little to keep)
      if (below) expect(lowestGone).toBeGreaterThan(-(s.top - s.bottom) / 2 + 0.2)
      // the bond beam stays up on the wall and the other pillars: nothing above the cut floats, and it does not fall either
      const beam = s.world.part(s.id, BEAM)!
      expect(['intact', 'damaged']).toContain(beam.status)
    })
  }
})
