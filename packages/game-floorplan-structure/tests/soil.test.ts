import { describe, expect, it } from 'vitest'
import { createDestruction, pileCapacity, SOILS } from '@adatechnology/game-destruction'
import type { DestructionEvent, SoilProfile } from '@adatechnology/game-destruction'

import { GROUND, PILE_AREA, RAFT_THICKNESS, buildStructure, toDestructibleSpec } from '../src'
import { rectangularHouse } from './synthetic-plan'

const run = (w: ReturnType<typeof createDestruction>, seconds: number): DestructionEvent[] => {
  const out: DestructionEvent[] = []
  for (let t = 0; t < seconds; t += 0.1) out.push(...w.update(0.1))
  return out
}

/** The ground under the houses (game-destruction `soil`, design T10-estrutura-real.md). */
describe('houses on the soil', () => {
  const structure = (floors = 2) => buildStructure(rectangularHouse({ width: 8, depth: 6, floors }), { wallDetail: 'coarse' })

  it('without soil the spec is the one it always was', () => {
    const spec = toDestructibleSpec(structure(), { wallDetail: 'coarse' })
    expect(spec.soil).toBeUndefined()
    expect(spec.parts.find((p) => p.id === GROUND)!.tags).toEqual(['terrain'])
  })

  it('a house on a raft on firm ground is unaffected', () => {
    const plain = toDestructibleSpec(structure(), { wallDetail: 'coarse' })
    const spec = toDestructibleSpec(structure(), { wallDetail: 'coarse', soil: 'clay_stiff', foundation: 'raft' })
    const raft = spec.parts.find((p) => p.id === GROUND)!
    expect(raft.tags).toEqual(['raft'])
    expect(raft.shape).toEqual({ kind: 'box', size: [expect.closeTo(8 + 0.15 + 0.3, 1), RAFT_THICKNESS, expect.closeTo(6 + 0.15 + 0.3, 1)] })
    const w = createDestruction()
    const id = w.add(spec)
    const st = w.state(id)!.soil!
    expect(st.status).toBe('stable')
    expect(st.bearing).toBeLessThan(0.1)
    expect(st.settlement).toBeLessThan(0.01)
    expect(st.tilt).toBeLessThan(0.01)
    // the house itself carries what it carried on the terrain
    const bare = createDestruction()
    const b = bare.add(plain)
    const stress = (world: typeof w, oid: string) => world.state(oid)!.parts.filter((p) => p.id !== GROUND).map((p) => p.stress)
    expect(stress(w, id)).toEqual(stress(bare, b))
    expect(run(w, 5).filter((e) => e.type === 'settle' || e.type === 'collapse')).toHaveLength(0)
  })

  it('a strip footing house keeps the terrain and bears on a footing under each wall', () => {
    const spec = toDestructibleSpec(structure(), { wallDetail: 'coarse', soil: 'clay_medium', foundation: 'strip_footing' })
    expect(spec.parts.find((p) => p.id === GROUND)!.tags).toEqual(['terrain'])
    const w = createDestruction()
    const st = w.state(w.add(spec))!.soil!
    expect(st.status).toBe('stable')
    expect(st.bearing).toBeGreaterThan(0)
    expect(st.bearing).toBeLessThan(0.5)
  })

  it('piles under the raft go down to firm ground and carry the house', () => {
    const site: SoilProfile = { layers: [{ soil: 'clay_very_soft', thickness: 8 }, { soil: 'sand_dense' }] }
    const spec = toDestructibleSpec(structure(3), { wallDetail: 'coarse', soil: site, foundation: 'raft', piles: true })
    const pile = spec.parts.find((p) => p.id === GROUND)!.structure!.pile!
    expect(pile.diameter).toBe(0.4)
    const size = (spec.parts.find((p) => p.id === GROUND)!.shape as { size: number[] }).size
    expect(pile.count).toBe(Math.max(4, Math.ceil((size[0] * size[2]) / PILE_AREA)))
    // the piles go through the very soft clay into the sand
    expect(pile.length + RAFT_THICKNESS).toBeGreaterThan(8)
    const soils = new Map(SOILS.map((s) => [s.id, s]))
    expect(pileCapacity(site, pile, RAFT_THICKNESS, soils).ultimate).toBeGreaterThan(0)
    const w = createDestruction()
    const id = w.add(spec)
    expect(w.state(id)!.soil!.status).toBe('stable')
    expect(w.state(id)!.soil!.bearing).toBeLessThan(0.5)
    // a given length is kept
    expect(toDestructibleSpec(structure(), { wallDetail: 'coarse', soil: site, piles: { length: 12, count: 6 } }).parts.find((p) => p.id === GROUND)!.structure!.pile).toEqual({ length: 12, diameter: 0.4, count: 6, method: 'bored' })
  })
})
