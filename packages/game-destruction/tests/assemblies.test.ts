import { describe, expect, it } from 'vitest'
import { checkSpec } from '@adatechnology/game-contracts'
import { assemblyDepth, assemblyPart, ASSEMBLIES, createAssemblies, createDestruction, defaultAssemblies, getAssembly, MATERIALS, registerAssembly } from '../src'
import type { AssemblyDef } from '../src'

const IDS = ['brick_wall_plastered', 'concrete_block_wall', 'reinforced_concrete', 'drywall', 'wood_frame_wall', 'log_wall', 'sheet_metal_shack', 'glass_pane']

describe('assemblies', () => {
  it('ships the eight wall assemblies', () => {
    expect(IDS.every((id) => getAssembly(id) !== undefined)).toBe(true)
    expect(ASSEMBLIES.length).toBeGreaterThanOrEqual(IDS.length)
  })

  it('plastered brick is a 0.09 m brick core under two 0.02 m coats, laid in running bond', () => {
    const def = getAssembly('brick_wall_plastered')!
    expect(def.core).toEqual({ material: 'brick', thickness: 0.09 })
    expect(def.layers).toEqual([{ material: 'plaster', thickness: 0.02, faces: 'both' }])
    expect(def.units).toMatchObject({ size: [0.23, 0.075, 0.11], bond: 'running' })
    expect(assemblyDepth(def)).toBeCloseTo(0.13, 10)
  })

  it('block and reinforced concrete carry the sizes of the team artifacts', () => {
    expect(getAssembly('concrete_block_wall')!.units!.size).toEqual([0.39, 0.19, 0.14])
    const rc = getAssembly('reinforced_concrete')!
    expect(rc.reinforcement).toMatchObject({ material: 'steel', spacing: 0.18 })
    expect(rc.units!.size).toEqual([0.6, 0.42, 0.2])
  })

  it('turns an assembly into a part: box, core thickness, coats, mass of core plus coats', () => {
    const part = assemblyPart('brick_wall_plastered', { id: 'w', width: 2, height: 2.5, position: [0, 1.25, 0] })
    expect(part.shape).toEqual({ kind: 'box', size: [2, 2.5, 0.13] })
    expect(part.thickness).toBe(0.09)
    expect(part.layers).toHaveLength(1)
    const density = (id: string) => MATERIALS.find((m) => m.id === id)!.density
    expect(part.mass).toBeCloseTo(5 * (0.09 * density('brick') + 0.04 * density('plaster')), 6)
  })

  it('hollow blocks and round logs scale the core by their solid fraction', () => {
    const block = assemblyPart('concrete_block_wall', { id: 'b', width: 1, height: 1, position: [0, 0, 0] })
    expect(block.thickness).toBeCloseTo(0.14 * 0.55, 10)
    expect(block.mass).toBeCloseTo(0.14 * 0.55 * 2300, 6)
  })

  it('builds parts the contract check and the world accept, one per assembly', () => {
    const parts = IDS.map((id) => assemblyPart(id, { id, width: 1, height: 1, position: [0, 0, 0] }))
    const report = checkSpec({ parts }, { materials: MATERIALS.map((m) => m.id) })
    expect(report.problems).toEqual([])
    for (const part of parts) expect(() => createDestruction().add({ parts: [part] })).not.toThrow()
  })

  it('registers a game assembly and lets it replace a built-in one by id', () => {
    const adobe: AssemblyDef = { id: 'adobe_wall', name: 'Adobe', core: { material: 'soil', thickness: 0.3 }, breach: { area: 0.4 } }
    registerAssembly(adobe)
    expect(assemblyPart('adobe_wall', { id: 'a', width: 1, height: 1, position: [0, 0, 0] }).breach).toEqual({ area: 0.4 })
    registerAssembly({ ...adobe, breach: { area: 0.6 } })
    expect(ASSEMBLIES.filter((a) => a.id === 'adobe_wall')).toHaveLength(1)
    expect(getAssembly('adobe_wall')!.breach).toEqual({ area: 0.6 })
  })

  it('refuses an unknown assembly', () => {
    expect(() => assemblyPart('nope', { id: 'x', width: 1, height: 1, position: [0, 0, 0] })).toThrow(/unknown assembly/)
  })
})

describe('assemblies by instance', () => {
  const wall = { id: 'only_here', name: 'Only here', core: { material: 'concrete', thickness: 0.2 } } as AssemblyDef
  const options = { id: 'w', width: 3, height: 2.5, position: [0, 1.25, 0] as [number, number, number] }

  it('the global functions and defaultAssemblies() give the same results as an instance with the built-in set', () => {
    const made = createAssemblies()
    expect(defaultAssemblies().list()).toBe(ASSEMBLIES)
    for (const id of IDS) expect(made.part(id, options)).toEqual(assemblyPart(id, options))
    expect(IDS.every((id) => made.get(id) !== undefined)).toBe(true)
  })

  it('two sets with different packs, patches and removals do not leak into each other or into the global one', () => {
    const first = createAssemblies({ packs: [[wall]], remove: ['drywall'], patch: { glass_pane: { name: 'Patched' } } })
    const second = createAssemblies()
    expect(first.get('only_here')).toBeDefined()
    expect(second.get('only_here')).toBeUndefined()
    expect(getAssembly('only_here')).toBeUndefined()
    expect(first.get('drywall')).toBeUndefined()
    expect(second.get('drywall')).toBeDefined()
    expect(first.get('glass_pane')?.name).toBe('Patched')
    expect(second.get('glass_pane')?.name).not.toBe('Patched')
    expect(getAssembly('glass_pane')?.name).not.toBe('Patched')
    expect(() => first.part('drywall', options)).toThrow('unknown assembly')
    second.register({ ...wall, id: 'later' })
    expect(first.get('later')).toBeUndefined()
    expect(first.part('only_here', options).material).toBe('concrete')
  })
})
