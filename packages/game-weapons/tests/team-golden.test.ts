import { describe, expect, it } from 'vitest'
import { createArsenal } from '../src'
import type { Vec3, WeaponState } from '../src'
import gallery from './fixtures/team-golden/gallery-heat.json'

// Recorded from the Galeria 3D do Arsenal with tools/golden/captures/arsenal-gallery.js (seed 1, page frames of 1/60 s, no jams).
type Entry = { type: 'selected' | 'fire' | 'burst'; data: { weapon: string; heatPercent: number; ammo: number } }

const IDS: Record<string, string> = { 'Glock 17': 'glock_17', 'AK-47': 'ak_47', 'Remington 870': 'remington_870', 'Browning M2 .50': 'browning_m2' }
const ORIGIN: Vec3 = [0, 1.5, 0]
const AIM: Vec3 = [0, 0, -1]
const FRAME = 1 / 60
const FRAMES_BETWEEN_SHOTS = 40
const FRAMES_AFTER_BURST = 90
const BURST_ROUNDS = 10

const percent = (weapon: WeaponState): number => Math.round(weapon.heatLevel * 100)

/** The page counts the round in the chamber inside the ammo; the SDK keeps it apart, so what is compared is how many rounds were spent. */
const spent = (weapon: WeaponState, start: number): number => start - weapon.ammo

const frames = (weapon: WeaponState, count: number): void => {
  for (let frame = 0; frame < count; frame++) weapon.update(FRAME)
}

/** Rajada: one round every 60/rpm seconds from a held trigger, then the barrel cools for the rest of the frames. */
const burst = (weapon: WeaponState): void => {
  let fired = 0
  for (let frame = 0; frame < FRAMES_AFTER_BURST; frame++) {
    if (fired < BURST_ROUNDS) fired += weapon.trigger(ORIGIN, AIM, FRAME, true).rounds
    weapon.update(FRAME)
  }
}

describe('Galeria 3D do Arsenal: heat and ammunition', () => {
  const entries = gallery.events as Entry[]
  const arsenal = createArsenal({ rules: { faults: false } })
  for (const [name, id] of Object.entries(IDS)) {
    it(`${name} heats and spends rounds like the page after Atirar and Rajada`, () => {
      const weapon = arsenal.create(id, { reserve: 0 })
      const recorded = entries.filter((entry) => entry.data.weapon === name)
      expect(recorded.length, `${name} has no recorded steps: the name in IDS drifted from the fixture`).toBeGreaterThan(1)
      expect(recorded[0]?.type).toBe('selected')
      const start = recorded[0]?.data.ammo ?? 0
      for (const entry of recorded) {
        if (entry.type === 'fire') {
          weapon.trigger(ORIGIN, AIM, 0, false)
          frames(weapon, FRAMES_BETWEEN_SHOTS)
        } else if (entry.type === 'burst') {
          weapon.release()
          burst(weapon)
        }
        expect({ step: entry.type, heat: percent(weapon), spent: spent(weapon, weapon.capacity) }).toEqual({
          step: entry.type,
          heat: entry.data.heatPercent,
          spent: start - entry.data.ammo,
        })
      }
    })
  }
})
