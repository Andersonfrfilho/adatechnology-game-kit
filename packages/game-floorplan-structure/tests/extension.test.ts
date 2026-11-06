import { createDestruction, sizeStructure } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { toDestructibleSpec } from '../src'
import { engine } from './support'
import type { StructuredResult } from '../src'

describe('result extensions', () => {
  it('run in order and leave their output in the result', () => {
    const plan = engine.generate('mansion', { seed: 3, state: 'normal' }) as StructuredResult
    for (const name of ['construction', 'structureExtras', 'waterTank', 'structure', 'roof']) expect(name in plan, name).toBe(true)
    expect(plan.construction.system).toBe('masonry')
  })

  it('draw the tank from their own seeded stream: the same seed gives the same tank', () => {
    const a = engine.generate('townhouse', { seed: 9, state: 'normal' }) as StructuredResult
    const b = engine.generate('townhouse', { seed: 9, state: 'fortified' }) as StructuredResult
    expect(a.waterTank).toEqual(b.waterTank)
  })

  it('the default detail is panels: rafters and a ridge; coarse keeps the whole trusses of the Visor de casas 3D', () => {
    const panels = engine.generate('single_storey_a', { seed: 1, state: 'normal' }) as StructuredResult
    const coarse = engine.generate('single_storey_a', { seed: 1, state: 'normal', wallDetail: 'coarse' }) as StructuredResult
    expect(panels.structure.parts.some((p) => p.id.startsWith('rafter_'))).toBe(true)
    expect(coarse.structure.parts.some((p) => p.id.startsWith('truss_'))).toBe(true)
    expect(coarse.structure.parts.some((p) => p.id.startsWith('rafter_'))).toBe(false)
    const mass = (plan: StructuredResult) => plan.structure.parts.filter((p) => /^(truss|rafter)/.test(p.id)).reduce((sum, p) => sum + p.mass, 0)
    expect(Math.abs(mass(panels) - mass(coarse)) / mass(coarse)).toBeLessThan(0.02)
  })
})

describe('the spec of the structure', () => {
  it('is sized so the intact house stands at the safety of its role and nothing falls on its own', () => {
    for (const template of ['single_storey_a', 'townhouse', 'budget_slab_house', 'market', 'mansion']) {
      const plan = engine.generate(template, { seed: 5, state: 'normal' }) as StructuredResult
      const spec = toDestructibleSpec(plan.structure)
      const world = createDestruction({ seed: 1 })
      const id = world.add(spec)
      for (let t = 0; t < 60; t += 0.1) world.update(0.1)
      expect(world.state(id)!.parts.filter((p) => p.status === 'broken').map((p) => p.id), template).toEqual([])
      const stress = Math.max(...world.state(id)!.parts.map((p) => p.stress ?? 0))
      expect(stress, template).toBeLessThanOrEqual(0.97 + 1e-9)
    }
  })

  it('agrees with sizeStructure of game-destruction for houses held by bearing walls', () => {
    for (const template of ['single_storey_a', 'townhouse', 'budget_slab_house']) {
      const plan = engine.generate(template, { seed: 3, state: 'normal' }) as StructuredResult
      const sized = toDestructibleSpec(plan.structure, { wallDetail: 'coarse', slabPanels: false })
      const bare = toDestructibleSpec(plan.structure, { wallDetail: 'coarse', slabPanels: false, sized: false })
      const engineSized = sizeStructure(bare, { safety: 0.65, redundancy: 0.97, redundancyRoles: ['column', 'wall'], safetyByRole: { beam: 0.45, slab: 0.45, roof: 0.45, stair: 0.45, partition: 0.45 } })
      for (const part of sized.parts.filter((p) => p.structure?.capacity !== undefined && p.id !== 'ground')) {
        const other = engineSized.parts.find((p) => p.id === part.id)!.structure!.capacity!
        expect(Math.abs(other - part.structure!.capacity!) / part.structure!.capacity!, `${template} ${part.id}`).toBeLessThan(1e-9)
      }
    }
  })

  it('options: sized false leaves the capacity out, filter drops parts and what rested on them', () => {
    const plan = engine.generate('single_storey_a', { seed: 1, state: 'normal' }) as StructuredResult
    const bare = toDestructibleSpec(plan.structure, { sized: false })
    expect(bare.parts.every((p) => p.structure?.capacity === undefined)).toBe(true)
    const filtered = toDestructibleSpec(plan.structure, { filter: (part) => part.role !== 'roof' })
    expect(filtered.parts.some((p) => p.id.startsWith('roof_'))).toBe(false)
    expect((filtered.joints ?? []).every((j) => filtered.parts.some((p) => p.id === j.a) && filtered.parts.some((p) => p.id === j.b))).toBe(true)
  })

  it('door steps found by the structure are written on the door of the plan', () => {
    const plan = engine.generate('single_storey_a', { seed: 1, state: 'normal' }) as StructuredResult
    expect(plan.doors.every((door) => typeof door.steps === 'number')).toBe(true)
  })
})
