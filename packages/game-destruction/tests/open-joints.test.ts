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

describe('open joints stay listed', () => {
  it('disassemble + splitGroup keeps the opened joint in the original with open and openedBy', () => {
    const w = createDestruction()
    const id = w.add(pistol())
    w.disassemble(id, 'mag_clip', 'hand', 10)
    const g = w.state(id)!.groups.findIndex((x) => x.includes('magazine'))
    const nid = w.splitGroup(id, g)
    const j = w.state(id)!.joints.find((x) => x.id === 'mag_clip')!
    expect(j.open).toBe(true)
    expect(j.openedBy).toBe('tool')
    expect(w.state(nid)!.joints.find((x) => x.id === 'mag_clip')).toBeUndefined()
    expect(w.state(id)!.groups.length).toBe(1)
    expect(w.state(id)!.parts.map((p) => p.id)).not.toContain('magazine')
    // survives a save/load round trip and a later split
    const w2 = createDestruction()
    w2.load(w.serialize())
    expect(w2.state(id)!.joints.find((x) => x.id === 'mag_clip')!.open).toBe(true)
  })

  it('a break keeps the joint listed after the split, and joints with both parts moved go with the new object', () => {
    const w = createDestruction()
    const spec = pistol()
    spec.joints!.push({ id: 'trigger_mag', a: 'trigger', b: 'magazine', kind: 'clip' })
    const id = w.add(spec)
    for (const j of ['mag_clip', 'trigger_screw']) w.disassemble(id, j, j === 'mag_clip' ? 'hand' : 'screwdriver', 10)
    const st = w.state(id)!
    const g = st.groups.findIndex((x) => x.includes('magazine'))
    expect(st.groups[g]).toContain('trigger')
    const nid = w.splitGroup(id, g)
    const kept = w.state(id)!.joints
    expect(kept.filter((j) => j.open).map((j) => j.id).sort()).toEqual(['mag_clip', 'trigger_screw'])
    const moved = w.state(nid)!.joints
    expect(moved.map((j) => j.id)).toEqual(['trigger_mag'])
    expect(moved[0].open).toBe(false)
  })

  it('a worn-out joint (break) is listed as open with openedBy break after the split', () => {
    const w = createDestruction()
    const id = w.add(pistol())
    w.hitPart(id, 'magazine', { type: 'blunt', point: [0, -0.11, 0.01], direction: [0, 0, -1], energy: 300, radius: 0.03 })
    const g = w.state(id)!.groups.findIndex((x) => x.includes('magazine'))
    w.splitGroup(id, g)
    const j = w.state(id)!.joints.find((x) => x.id === 'mag_clip')!
    expect(j.open).toBe(true)
    expect(j.openedBy).toBe('break')
  })
})
