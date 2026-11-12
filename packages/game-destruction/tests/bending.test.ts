import { describe, expect, it } from 'vitest'
import { MATERIALS, createDestruction } from '../src'
import { momentOfStrainEnergy, plasticBend, snapRatio, strainEnergy } from '../src/bending'
import type { DestructibleSpec } from '../src'

type V = [number, number, number]
const bendingOf = (id: string) => MATERIALS.find((m) => m.id === id)!.bending

const plate = (): DestructibleSpec => ({ parts: [{ id: 'blade', material: 'steel', shape: { kind: 'box', size: [0.3, 0.012, 0.22] }, position: [0, 0, 0], thickness: 0.002, mass: 1.1 }] })
const stick = (material = 'wood_hard'): DestructibleSpec => ({ parts: [{ id: 'handle', material, shape: { kind: 'box', size: [0.9, 0.035, 0.035] }, position: [0, 0, 0], mass: 0.9, grain: 'x' }] })
const blow = (energy: number, point: V, direction: V = [0, -1, 0]) => ({ type: 'blunt' as const, point, direction, energy, radius: 0.05 })

describe('real numbers of the bending model', () => {
  it('has the strengths of the materials in the data: mild steel yields at 250 MPa, hardwood breaks at 100 MPa', () => {
    expect(bendingOf('steel')).toMatchObject({ yieldMPa: 250, elasticGPa: 200 })
    expect(bendingOf('wood_hard')).toMatchObject({ ruptureMPa: 100, elasticGPa: 12 })
  })

  it('stores M² L / 6EI at a moment and gives the moment back from the energy', () => {
    expect(momentOfStrainEnergy(strainEnergy(55, 0.3, 29), 0.3, 29)).toBeCloseTo(55, 9)
  })

  it('a 2 mm steel plate 22 cm wide bends from 5 J of flexing and by 0.38 rad when 130 J land on it', () => {
    const steel = bendingOf('steel')
    const dims: V = [0.3, 0.012, 0.22]
    // plastic moment 250 MPa * 0.22 * 0.002^2 / 4 = 55 N m
    expect(plasticBend(dims, 0.002, steel, 25, [0, -1, 0])).toBe(0)
    expect(plasticBend(dims, 0.002, steel, 130, [0, -1, 0])).toBeCloseTo((130 * 0.2 - strainEnergy(55, 0.3, 200e9 * (0.22 * 0.002 ** 3) / 12)) / 55, 6)
    // a blow along the plate, not across it, does not bend it
    expect(plasticBend(dims, 0.002, steel, 400, [1, 0, 0])).toBe(0)
  })

  it('a 3.5 cm ash dowel 0.9 m long holds about 51 J of flexing before it snaps', () => {
    const wood = bendingOf('wood_hard')
    const dims: V = [0.9, 0.035, 0.035]
    // energy that reaches the rupture moment, divided by the share the part flexes with
    const ratio = (energy: number) => snapRatio(dims, wood, energy, [0, -1, 0], 3)
    expect(ratio(51 / 0.3)).toBeCloseTo(1, 1)
    expect(ratio(130)).toBeLessThan(1)
    expect(ratio(300)).toBeGreaterThan(1)
    // a blow along the grain does not flex it
    expect(snapRatio(dims, wood, 300, [1, 0, 0], 3)).toBe(0)
    // a short block is not a beam
    expect(snapRatio([0.1, 0.035, 0.035], wood, 300, [0, -1, 0], 3)).toBe(0)
  })
})

describe('a thin ductile plate takes a plastic bend', () => {
  it('under a heavy blunt blow, kept in the part state and growing with each blow up to a fold', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add(plate())
    w.hitPart(id, 'blade', blow(25, [0, 0.006, 0]))
    expect(w.part(id, 'blade')!.bend).toBeUndefined()
    w.hitPart(id, 'blade', blow(130, [0.1, 0.006, 0]))
    const first = w.part(id, 'blade')!.bend!
    expect(first).toBeGreaterThan(0.3)
    w.hitPart(id, 'blade', blow(130, [0.1, 0.006, 0]))
    expect(w.part(id, 'blade')!.bend).toBeGreaterThan(first)
    for (let n = 0; n < 10; n++) w.hitPart(id, 'blade', blow(1000, [0.1, 0.006, 0]))
    expect(w.part(id, 'blade')!.bend).toBe(1.5)
    expect(w.part(id, 'blade')!.status).not.toBe('broken')
  })

  it('survives a save and a load', () => {
    const a = createDestruction({ seed: 1 })
    const id = a.add(plate(), { id: 'p' })
    a.hitPart(id, 'blade', blow(400, [0, 0.006, 0]))
    const b = createDestruction({ seed: 1 })
    b.load(a.serialize())
    expect(b.part('p', 'blade')!.bend).toBe(a.part('p', 'blade')!.bend)
  })

  it('does not happen to a thick plate, to a brittle one, or to a material that says nothing about bending', () => {
    const thick = createDestruction()
    const thickId = thick.add({ parts: [{ id: 'slab', material: 'steel', shape: { kind: 'box', size: [0.3, 0.05, 0.22] }, position: [0, 0, 0] }] })
    thick.hitPart(thickId, 'slab', blow(400, [0, 0.025, 0]))
    expect(thick.part(thickId, 'slab')!.bend).toBeUndefined()
    const glass = createDestruction()
    const glassId = glass.add({ parts: [{ id: 'pane', material: 'glass', shape: { kind: 'box', size: [0.3, 0.004, 0.22] }, position: [0, 0, 0] }] })
    glass.hitPart(glassId, 'pane', blow(400, [0, 0.002, 0]))
    expect(glass.part(glassId, 'pane')!.bend).toBeUndefined()
  })
})

describe('a long wooden part snaps in bending', () => {
  it('when a blow flexes it past the moment its section holds: two stubs, cut at the blow', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add(stick())
    const events = w.hitPart(id, 'handle', blow(300, [-0.2, 0.0175, 0])).events
    expect(w.part(id, 'handle')!.status).toBe('broken')
    const fracture = events.find((e) => e.type === 'fracture')
    expect(fracture).toBeDefined()
    expect(fracture!.type === 'fracture' && fracture!.fragments.filter((f) => f.shape === 'slab')).toHaveLength(2)
  })

  it('not under a punch or a kick, which the same handle takes with a dent in its hit points only', () => {
    for (const energy of [25, 130]) {
      const w = createDestruction({ seed: 1 })
      const id = w.add(stick())
      w.hitPart(id, 'handle', blow(energy, [-0.2, 0.0175, 0]))
      expect(w.part(id, 'handle')!.status).not.toBe('broken')
    }
  })

  it('a thicker handle takes more: 5 cm of the same wood holds a blow that snaps 3.5 cm', () => {
    const w = createDestruction({ seed: 1 })
    const id = w.add({ parts: [{ id: 'handle', material: 'wood_hard', shape: { kind: 'box', size: [0.9, 0.05, 0.05] }, position: [0, 0, 0], mass: 1.7, grain: 'x' }] })
    w.hitPart(id, 'handle', blow(300, [-0.2, 0.025, 0]))
    expect(w.part(id, 'handle')!.status).not.toBe('broken')
  })

  it('a blow along the grain, or on a material with no rupture strength, does not snap it', () => {
    const along = createDestruction({ seed: 1 })
    const alongId = along.add(stick())
    along.hitPart(alongId, 'handle', blow(300, [0.45, 0, 0], [-1, 0, 0]))
    expect(along.part(alongId, 'handle')!.status).not.toBe('broken')
    const pine = createDestruction({ seed: 1 })
    const pineId = pine.add(stick('wood_soft'))
    pine.hitPart(pineId, 'handle', blow(300, [-0.2, 0.0175, 0]))
    // soft wood is cut by its band of hit points as before, the bending model leaves it alone
    expect(pine.part(pineId, 'handle')!.hp).toBeGreaterThan(0)
  })
})

describe('the hinge a bent plate keeps', () => {
  it('lies across the blade at the blow, folds the nearer end and goes the way the blow went', () => {
    const w = createDestruction({ seed: 1 })
    const events: Array<{ angle: number }> = []
    w.on('bend', (event) => {
      if (event.type === 'bend') events.push(event)
    })
    const id = w.add(plate())
    w.hitPart(id, 'blade', blow(130, [0.1, 0.006, 0]))
    const hinge = w.part(id, 'blade')!.bendHinge!
    // the blade is 0.3 m long on x, struck 0.1 m from its middle: the hinge is there, the +x end (0.05 m away) folds over, downwards
    expect(hinge.point[0]).toBeCloseTo(0.1, 6)
    expect(hinge.side).toEqual([1, 0, 0])
    // rotating the free end (+x) about the axis turns it towards -y: axis = side x way = (1,0,0) x (0,-1,0) = (0,0,-1)
    expect(hinge.axis[2]).toBe(-1)
    expect(events).toHaveLength(1)
    expect(events[0]!.angle).toBeCloseTo(w.part(id, 'blade')!.bend!, 9)
  })
})
