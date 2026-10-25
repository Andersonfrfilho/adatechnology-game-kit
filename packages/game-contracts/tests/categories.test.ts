import { describe, expect, it } from 'vitest'

import { checkCategorized, defineCategories, resolveEntry } from '../src'
import type { CategoryDef, ContractChecker } from '../src'

interface Item {
  id: string
  kind: string
  leftover?: { despawnSeconds?: number; pieces?: string[] }
  mass?: number
}

const TREE: CategoryDef[] = [
  { id: 'container', abstract: true, defaults: { leftover: { despawnSeconds: 60, pieces: ['lid'] }, mass: 1 }, requires: ['leftover'] },
  { id: 'can', extends: 'container', defaults: { mass: 0.4 }, requires: ['mass'] },
  { id: 'bean_can', extends: 'can', defaults: { leftover: { pieces: ['lid', 'label'] } } },
]

const leftover: ContractChecker<Item> = {
  id: 'leftover',
  check: (entry) => (entry.leftover?.despawnSeconds === undefined ? ['missing leftover.despawnSeconds'] : []),
}
const mass: ContractChecker<Item> = { id: 'mass', check: (entry) => ((entry.mass ?? 0) > 0 ? [] : ['missing mass']) }

describe('category registry', () => {
  const registry = defineCategories(TREE)

  it('builds the chain root first and answers isA', () => {
    expect(registry.chain('bean_can')).toEqual(['container', 'can', 'bean_can'])
    expect(registry.isA('bean_can', 'container')).toBe(true)
    expect(registry.isA('can', 'bean_can')).toBe(false)
    expect(registry.ids()).toEqual(['container', 'can', 'bean_can'])
  })

  it('merges defaults along the chain: objects deep, arrays replace', () => {
    expect(registry.defaults('bean_can')).toEqual({ leftover: { despawnSeconds: 60, pieces: ['lid', 'label'] }, mass: 0.4 })
  })

  it('unions requires along the chain without duplicates', () => {
    const more = defineCategories(TREE, { patches: { bean_can: { requires: ['mass', 'extra'] } } })
    expect(registry.requires('bean_can')).toEqual(['leftover', 'mass'])
    expect(more.requires('bean_can')).toEqual(['leftover', 'mass', 'extra'])
  })

  it('lets the entry win over the defaults', () => {
    const resolved = resolveEntry(registry, { id: 'a', kind: 'bean_can', mass: 0.5, leftover: { despawnSeconds: 5 } } as Item)
    expect(resolved.mass).toBe(0.5)
    expect(resolved.leftover).toEqual({ despawnSeconds: 5, pieces: ['lid', 'label'] })
  })

  it('reports an unknown parent and throws on chain', () => {
    const broken = defineCategories([{ id: 'a', extends: 'ghost' }])
    expect(broken.check()).toEqual(['category "a" extends unknown "ghost"'])
    expect(() => broken.chain('a')).toThrow('unknown parent "ghost"')
  })

  it('reports cycles and duplicate ids', () => {
    expect(defineCategories([{ id: 'a' }, { id: 'a' }]).check()).toEqual(['duplicate category "a"'])
    const cyclic = defineCategories([{ id: 'a', extends: 'b' }, { id: 'b', extends: 'a' }])
    const problems = cyclic.check()
    expect(problems.some((problem) => problem.includes('cycle'))).toBe(true)
    expect(() => cyclic.chain('b')).toThrow('cycle')
    expect(cyclic.isA('b', 'a')).toBe(false)
  })

  it('lets a game add, patch, replace and remove categories', () => {
    const game = defineCategories(TREE, {
      extra: [{ id: 'jar', extends: 'container', requires: ['mass'] }, { id: 'can', extends: 'container', defaults: { mass: 0.3 } }],
      remove: ['bean_can', 'jar'],
    })
    const patched = defineCategories(TREE, { extra: [{ id: 'can', extends: 'container', defaults: { mass: 0.3 } }], patches: { bean_can: { defaults: { mass: 0.45 } } } })
    expect(patched.defaults('bean_can').mass).toBe(0.45)
    expect(patched.get('can')?.requires).toBeUndefined()
    expect(game.ids()).toEqual(['container', 'can'])
    expect(game.has('bean_can')).toBe(false)
    expect(defineCategories(TREE, { remove: ['container'] }).check()).toContain('category "can" extends unknown "container"')
  })
})

describe('deep hierarchies', () => {
  const DEEP: CategoryDef[] = [
    { id: 'item', defaults: { mass: 1, tags: ['item'] }, requires: ['mass'] },
    { id: 'consumable', extends: 'item', defaults: { leftover: { despawnSeconds: 30 } } },
    { id: 'food', extends: 'consumable', defaults: { spoils: true }, requires: ['leftover'] },
    { id: 'canned_food', extends: 'food', defaults: { mass: 0.4, leftover: { pieces: ['lid'] } } },
  ]
  const entry = { id: 'beans', kind: 'canned_food' } as Item

  it('resolves a 4-level chain and isA across levels', () => {
    const registry = defineCategories(DEEP)
    expect(registry.chain('canned_food')).toEqual(['item', 'consumable', 'food', 'canned_food'])
    expect(resolveEntry(registry, entry)).toEqual({ id: 'beans', kind: 'canned_food', mass: 0.4, tags: ['item'], spoils: true, leftover: { despawnSeconds: 30, pieces: ['lid'] } })
    expect(registry.requires('canned_food')).toEqual(['mass', 'leftover'])
    expect(registry.isA('canned_food', 'item')).toBe(true)
    expect(registry.isA('canned_food', 'consumable')).toBe(true)
    expect(registry.isA('food', 'canned_food')).toBe(false)
  })

  it('inserts a new parent in the middle by patch without touching items', () => {
    const registry = defineCategories(DEEP, {
      extra: [{ id: 'preserved', extends: 'food', defaults: { spoils: false, shelfLifeDays: 900 }, requires: ['shelf'] }],
      patches: { canned_food: { extends: 'preserved' } },
    })
    expect(registry.chain('canned_food')).toEqual(['item', 'consumable', 'food', 'preserved', 'canned_food'])
    expect(registry.check()).toEqual([])
    expect(resolveEntry(registry, entry)).toMatchObject({ mass: 0.4, spoils: false, shelfLifeDays: 900, leftover: { despawnSeconds: 30, pieces: ['lid'] } })
    expect(registry.requires('canned_food')).toEqual(['mass', 'leftover', 'shelf'])
    expect(registry.isA('canned_food', 'preserved')).toBe(true)
    const report = checkCategorized<Item>([entry], registry, [mass, { id: 'leftover', check: () => [] }])
    expect(report.problems).toEqual(['kind "canned_food" requires contract "shelf" but no checker is registered'])
  })

  it('adds a child under an existing type', () => {
    const registry = defineCategories(DEEP, { extra: [{ id: 'bean_can', extends: 'canned_food', defaults: { leftover: { pieces: ['lid', 'label'] } } }] })
    expect(registry.chain('bean_can')).toEqual(['item', 'consumable', 'food', 'canned_food', 'bean_can'])
    expect(registry.defaults('bean_can')).toMatchObject({ mass: 0.4, leftover: { despawnSeconds: 30, pieces: ['lid', 'label'] } })
    expect(registry.isA('bean_can', 'food')).toBe(true)
    expect(registry.defaults('canned_food').leftover).toEqual({ despawnSeconds: 30, pieces: ['lid'] })
  })
})

describe('checkCategorized', () => {
  const registry = defineCategories(TREE)
  const checkers = [leftover, mass]

  it('passes complete entries', () => {
    const report = checkCategorized<Item>([{ id: 'beans', kind: 'bean_can' }], registry, checkers)
    expect(report).toEqual({ ok: true, problems: [], allowed: [] })
  })

  it('reports unknown and abstract kinds', () => {
    const report = checkCategorized<Item>([{ id: 'x', kind: 'nope' }, { id: 'y', kind: 'container' }], registry, checkers)
    expect(report.ok).toBe(false)
    expect(report.problems).toEqual(['"x" has unknown kind "nope"', '"y" has abstract kind "container"'])
  })

  it('reports a required contract without a checker', () => {
    const report = checkCategorized<Item>([{ id: 'beans', kind: 'bean_can' }], registry, [leftover])
    expect(report.problems).toEqual(['kind "bean_can" requires contract "mass" but no checker is registered'])
  })

  it('attributes a problem to the category that introduced the contract', () => {
    const bare = defineCategories([{ id: 'container', requires: ['leftover'] }, { id: 'can', extends: 'container', requires: ['mass'] }])
    const report = checkCategorized<Item>([{ id: 'c1', kind: 'can' }], bare, checkers)
    expect(report.problems).toEqual([
      '"c1" (can): missing leftover.despawnSeconds, required by container',
      '"c1" (can): missing mass, required by can',
    ])
  })

  it('moves allowed problems to allowed', () => {
    const bare = defineCategories([{ id: 'container', requires: ['leftover'] }, { id: 'can', extends: 'container', requires: ['mass'] }])
    const report = checkCategorized<Item>([{ id: 'c1', kind: 'can' }], bare, checkers, { allow: { c1: ['missing leftover'] } })
    expect(report.ok).toBe(false)
    expect(report.allowed).toEqual(['"c1" (can): missing leftover.despawnSeconds, required by container'])
    expect(report.problems).toEqual(['"c1" (can): missing mass, required by can'])
    const clean = checkCategorized<Item>([{ id: 'c1', kind: 'can' }], bare, checkers, { allow: { c1: ['missing leftover', 'missing mass'] } })
    expect(clean.ok).toBe(true)
  })

  it('includes tree problems and honors kindField', () => {
    const broken = defineCategories([{ id: 'a', extends: 'ghost' }])
    const report = checkCategorized([{ id: 'e', type: 'a' }], broken, [], { kindField: 'type' })
    expect(report.problems).toContain('category "a" extends unknown "ghost"')
    expect(report.problems.some((problem) => problem.startsWith('"e" (a):'))).toBe(true)
  })
})
