import { describe, expect, it } from 'vitest'
import { CALIBERS, muzzleEnergy } from '@adatechnology/game-weapons'
import { bulletHoleShape, type BulletHoleShape } from '../src'

/** The mark a round of the SDK's calibre table leaves in a car door (steel), square on or at a slant, with or without its mass (a world's shot has none). */
function markOf(caliberId: string, options: { cos?: number; through?: boolean; withMass?: boolean } = {}): BulletHoleShape {
  const caliber = CALIBERS.find((entry) => entry.id === caliberId)
  if (!caliber) throw new Error(`no calibre ${caliberId} in the SDK`)
  return bulletHoleShape({
    caliberMm: caliber.diameter,
    energy: muzzleEnergy(caliber),
    ...(options.withMass ? { massGrams: caliber.bulletGrams } : {}),
    cosIncidence: options.cos ?? 1,
    through: options.through ?? true,
    material: 'steel',
    boreDiameter: caliber.diameter / 1000,
  })
}

describe('a round leaves the mark of its calibre in a car door (SDK calibre data, no table per weapon)', () => {
  it('9 mm: a small clean round hole with a tight dimple', () => {
    for (const withMass of [true, false]) {
      const mark = markOf('9x19', { withMass })
      expect(mark.style).toBe('round')
      expect(mark.boreDiameter).toBeCloseTo(0.009, 4)
      expect(mark.markDiameter / mark.boreDiameter).toBeLessThan(2.5)
      expect(mark.petals).toBe(0)
      expect(mark.elongation).toBe(1)
    }
  })

  it('rifle rounds (5.56, 7.62x39): a smaller, sharper hole with torn petals and a wider ring of chipped paint than a pistol round', () => {
    const pistol = markOf('9x19')
    for (const id of ['5_56x45', '7_62x39', '7_62x51']) {
      for (const withMass of [true, false]) {
        const mark = markOf(id, { withMass })
        expect(mark.style, `${id} ${withMass ? 'with' : 'without'} its mass`).toBe('petalled')
        expect(mark.petals).toBeGreaterThan(0)
        expect(mark.boreDiameter).toBeLessThan(pistol.boreDiameter)
        expect(mark.markDiameter / mark.boreDiameter).toBeGreaterThan(pistol.markDiameter / pistol.boreDiameter)
      }
    }
  })

  it('strong pistol rounds (.44 Magnum, .45 ACP) are still pistol rounds: no petals', () => {
    expect(markOf('44mag').style).toBe('round')
    expect(markOf('45acp').style).toBe('round')
  })

  it('a 12 ga slug and a .50 BMG: a big ragged hole with the sheet pushed in hard', () => {
    const pistol = markOf('9x19')
    for (const id of ['12ga_slug', '50bmg']) {
      const mark = markOf(id)
      expect(mark.style).toBe('ragged')
      expect(mark.boreDiameter).toBeGreaterThan(0.012)
      expect(mark.dentDepth).toBeGreaterThan(pistol.dentDepth * 2)
    }
  })

  it('a buckshot pellet that stops in the sheet leaves a dimple, no bore', () => {
    const mark = markOf('12ga_00buck', { through: false })
    expect(mark.style).toBe('dimple')
    expect(mark.boreDiameter).toBe(0)
    expect(mark.dentDepth).toBeGreaterThan(0)
  })

  it('a round at a slant scrapes a gouge along its path, longer the flatter it comes', () => {
    const steep = markOf('9x19', { cos: 0.4, through: false })
    const flat = markOf('9x19', { cos: 0.2, through: false })
    expect(steep.style).toBe('gouge')
    expect(flat.style).toBe('gouge')
    expect(steep.elongation).toBeGreaterThanOrEqual(1.5)
    expect(flat.elongation).toBeGreaterThan(steep.elongation)
    expect(flat.boreDiameter).toBe(0)
    // square on it is a hole, not a gouge
    expect(markOf('9x19', { cos: 0.9 }).style).toBe('round')
  })

  it('glass does not gouge: a pane takes the round as a hole whatever the angle', () => {
    const shape = bulletHoleShape({ caliberMm: 9, energy: 500, cosIncidence: 0.2, through: true, material: 'glass', boreDiameter: 0.0126 })
    expect(shape.style).toBe('round')
  })
})
