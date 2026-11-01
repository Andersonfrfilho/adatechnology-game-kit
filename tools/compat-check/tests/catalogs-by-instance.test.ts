import { ASSEMBLIES, assemblyPart, createAssemblies, getAssembly, registerAssembly } from '@adatechnology/game-destruction'
import { createFloorplan, engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { describe, expect, it } from 'vitest'

describe('T5.2 floorplan: the old global engine, called as before, matches an engine made by instance', () => {
  registerResidential(engine, { region: 'br' })
  const made = createFloorplan({ packs: [(target) => registerResidential(target, { region: 'br' })] })

  it('generates the same plans for the same seeds', () => {
    for (const seed of [1, 7, 42]) {
      const options = { seed, locale: 'en' }
      expect(JSON.stringify(made.generate('single_storey_a', options))).toBe(JSON.stringify(engine.generate('single_storey_a', options)))
    }
  })

  it('shares nothing with the global engine', () => {
    const lonely = createFloorplan()
    expect(Object.keys(lonely.templates)).toEqual([])
    expect(Object.keys(engine.templates).length).toBeGreaterThan(0)
  })
})

describe('T5.2 destruction: the old global assembly calls match a set made by instance', () => {
  const options = { id: 'wall', width: 4, height: 2.7, position: [0, 1.35, 0] as [number, number, number] }

  it('give the same wall for every shipped assembly', () => {
    const made = createAssemblies()
    for (const assembly of ASSEMBLIES) expect(made.part(assembly.id, options)).toEqual(assemblyPart(assembly.id, options))
  })

  it('registerAssembly on the global list does not reach a set made before or after', () => {
    const before = createAssemblies()
    registerAssembly({ id: 'compat_wall', name: 'Compat', core: { material: 'concrete', thickness: 0.1 } })
    expect(getAssembly('compat_wall')).toBeDefined()
    expect(before.get('compat_wall')).toBeUndefined()
    expect(createAssemblies().get('compat_wall')).toBeUndefined()
  })
})
