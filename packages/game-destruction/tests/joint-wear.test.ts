import { describe, expect, it } from 'vitest'
import { createDestruction } from '../src'
import type { DestructibleSpec } from '../src'

const MAT = { slide: 'steel', plastic: 'plastic' }

/** Small pistol-like assembly: frame, slide (two clips), magazine (clip), trigger (screw). */
const pistol = (): DestructibleSpec => ({
  name: 'pistol',
  parts: [
    { id: 'frame', material: MAT.plastic, shape: { kind: 'box', size: [0.2, 0.12, 0.03] }, position: [0, 0, 0], thickness: 0.004 },
    { id: 'slide', material: MAT.slide, shape: { kind: 'box', size: [0.2, 0.03, 0.03] }, position: [0, 0.075, 0], thickness: 0.004 },
    { id: 'magazine', material: MAT.plastic, shape: { kind: 'box', size: [0.03, 0.1, 0.02] }, position: [0, -0.11, 0], thickness: 0.004 },
    { id: 'trigger', material: MAT.plastic, shape: { kind: 'box', size: [0.02, 0.04, 0.01] }, position: [0.03, -0.02, 0], thickness: 0.004 },
  ],
  joints: [
    { id: 'slide_front', a: 'slide', b: 'frame', kind: 'clip' },
    { id: 'slide_back', a: 'slide', b: 'frame', kind: 'clip' },
    { id: 'mag_clip', a: 'magazine', b: 'frame', kind: 'clip' },
    { id: 'trigger_screw', a: 'trigger', b: 'frame', kind: 'screw' },
  ],
})

describe('joint wear', () => {
  it('a 9 mm hit only wears the joints of the part it hits', () => {
    const w = createDestruction()
    const id = w.add(pistol())
    w.shoot([0, 0.075, 1], [0, 0, -1], 500, 9)
    const js = w.state(id)!.joints
    for (const j of js.filter((x) => !['slide_front', 'slide_back'].includes(x.id))) {
      expect(j.open).toBe(false)
      expect(j.hp).toBe(j.maxHp)
    }
    // the energy the slide absorbed is split over its two clips, 500 J is never applied whole
    for (const j of js.filter((x) => ['slide_front', 'slide_back'].includes(x.id))) expect(j.hp).toBeGreaterThan(0)
    expect(w.state(id)!.groups.length).toBe(1)
  })

  it('a hammer blow of 300 J on the magazine opens its clip', () => {
    const w = createDestruction()
    const id = w.add(pistol())
    w.hitPart(id, 'magazine', { type: 'blunt', point: [0, -0.11, 0.01], direction: [0, 0, -1], energy: 300, radius: 0.03 })
    const js = w.state(id)!.joints
    expect(js.find((j) => j.id === 'mag_clip')!.open).toBe(true)
    expect(js.find((j) => j.id === 'trigger_screw')!.open).toBe(false)
    expect(js.find((j) => j.id === 'slide_front')!.open).toBe(false)
  })
})
