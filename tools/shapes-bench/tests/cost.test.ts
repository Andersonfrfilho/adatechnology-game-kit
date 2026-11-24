import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { compareCosts, costOf, FAILING_COST_VERDICTS, toCostBaseline } from '../src/cost'
import type { Cost, CostBaseline } from '../src/cost'

const box = (): THREE.BufferGeometry => new THREE.BoxGeometry(1, 1, 1)
const cost = (id: string, draws: number, triangles = 100, materials = 1): Cost => ({ id, draws, triangles, materials })
const baselineOf = (entries: CostBaseline['entries'], extra: Partial<CostBaseline> = {}): CostBaseline => ({ drawSlack: 0.1, triangleSlack: 0.15, limits: {}, over: {}, entries, ...extra })

describe('costOf', () => {
  it('counts one draw per mesh and material, one more when it casts a shadow, and the triangles', () => {
    const group = new THREE.Group()
    const shared = new THREE.MeshBasicMaterial()
    group.add(new THREE.Mesh(box(), shared))
    const two = new THREE.Mesh(box(), [shared, new THREE.MeshBasicMaterial()])
    two.castShadow = true
    group.add(two)
    expect(costOf('a', group)).toEqual({ id: 'a', draws: 4, triangles: 24, materials: 2 })
  })

  it('leaves out what is hidden, what is off the camera layer, and the lower levels of a LOD', () => {
    const group = new THREE.Group()
    const hiddenParent = new THREE.Group()
    hiddenParent.visible = false
    hiddenParent.add(new THREE.Mesh(box(), new THREE.MeshBasicMaterial()))
    const batched = new THREE.Mesh(box(), new THREE.MeshBasicMaterial())
    batched.layers.set(3)
    const lod = new THREE.LOD()
    lod.addLevel(new THREE.Mesh(box(), new THREE.MeshBasicMaterial()), 0)
    lod.addLevel(new THREE.Mesh(box(), new THREE.MeshBasicMaterial()), 20)
    group.add(hiddenParent, batched, lod)
    expect(costOf('a', group)).toEqual({ id: 'a', draws: 1, triangles: 12, materials: 1 })
  })

  it('counts the copies of an instanced mesh in the triangles, in one draw', () => {
    const instanced = new THREE.InstancedMesh(box(), new THREE.MeshBasicMaterial(), 5)
    expect(costOf('a', instanced)).toEqual({ id: 'a', draws: 1, triangles: 60, materials: 1 })
  })

  it('finds the object inside what a builder returns, and gives null when nothing is drawn', () => {
    const mesh = new THREE.Mesh(box(), new THREE.MeshBasicMaterial())
    expect(costOf('a', { group: mesh })?.draws).toBe(1)
    expect(costOf('a', { nested: { root: mesh } })?.draws).toBe(1)
    expect(costOf('a', { positions: new Float32Array(9) })).toBeNull()
    expect(costOf('a', { a: { b: { c: { d: mesh } } } })).toBeNull()
  })

  it('counts a geometry returned alone (a baked body) as one draw with its triangles', () => {
    expect(costOf('a', new THREE.BoxGeometry(1, 1, 1))).toEqual({ id: 'a', draws: 1, triangles: 12, materials: 0 })
    expect(costOf('a', { geo: new THREE.BoxGeometry(1, 1, 1), verts: 24 })).toEqual({ id: 'a', draws: 1, triangles: 12, materials: 0 })
  })

  it('draws the children of a LOD that are not one of its levels', () => {
    const lod = new THREE.LOD()
    lod.addLevel(new THREE.Mesh(box(), new THREE.MeshBasicMaterial()), 0)
    lod.addLevel(new THREE.Mesh(box(), new THREE.MeshBasicMaterial()), 20)
    lod.add(new THREE.Mesh(box(), new THREE.MeshBasicMaterial()))
    expect(costOf('a', lod)?.draws).toBe(2)
  })
})

describe('compareCosts', () => {
  it('passes what is within the slack and fails more draws, more triangles or more materials', () => {
    const baseline = baselineOf({ a: { draws: 20, triangles: 1000, materials: 4 }, b: { draws: 20, triangles: 1000, materials: 4 }, c: { draws: 20, triangles: 1000, materials: 4 }, d: { draws: 20, triangles: 1000, materials: 4 } })
    const verdicts = compareCosts([cost('a', 22, 1150, 4), cost('b', 23, 1000, 4), cost('c', 20, 1151, 4), cost('d', 20, 1000, 6)], baseline)
    expect(verdicts.map((v) => v.verdict)).toEqual(['ok', 'worse', 'worse', 'worse'])
    expect(verdicts[1]?.reason).toContain('draws 20 -> 23')
  })

  it('a small piece may grow by one draw, never by two', () => {
    const baseline = baselineOf({ a: { draws: 3, triangles: 10, materials: 1 }, b: { draws: 3, triangles: 10, materials: 1 } })
    expect(compareCosts([cost('a', 4, 10), cost('b', 5, 10)], baseline).map((v) => v.verdict)).toEqual(['ok', 'worse'])
  })

  it('fails a builder with no recorded cost and reports one that is gone', () => {
    const verdicts = compareCosts([cost('new', 2)], baselineOf({ gone: { draws: 1, triangles: 1, materials: 1 } }))
    expect(verdicts.map((v) => [v.id, v.verdict])).toEqual([['new', 'new'], ['gone', 'gone']])
  })

  it('fails a piece over the limit of its group unless it is recorded as over, and then only if it got worse', () => {
    const baseline = baselineOf(
      { 'items/a': { draws: 30, triangles: 100, materials: 1 }, 'items/b': { draws: 30, triangles: 100, materials: 1 }, 'items/c': { draws: 16, triangles: 100, materials: 1 } },
      { limits: { items: 15 }, over: { 'items/a': 30, 'items/b': 28 } },
    )
    const verdicts = compareCosts([cost('items/a', 30), cost('items/b', 30), cost('items/c', 16)], baseline)
    expect(verdicts.map((v) => v.verdict)).toEqual(['ok', 'over', 'over'])
  })

  it('says better when a piece got cheaper', () => {
    expect(compareCosts([cost('a', 10, 500)], baselineOf({ a: { draws: 20, triangles: 1000, materials: 1 } }))[0]?.verdict).toBe('better')
  })
})

describe('toCostBaseline', () => {
  const recorded = { draws: 10, triangles: 1000, materials: 2 }

  it('records a new builder and a cheaper one, and lists both as changed', () => {
    const previous = baselineOf({ 'items/a': recorded, 'items/same': recorded })
    const result = toCostBaseline({ costs: [cost('items/a', 8, 900, 2), cost('items/same', 10, 1000, 2), cost('items/new', 5)], previous, accepted: [] })
    expect(result.refused).toEqual([])
    expect(result.baseline.entries['items/a']).toEqual({ draws: 8, triangles: 900, materials: 2 })
    expect(result.baseline.entries['items/new']).toEqual({ draws: 5, triangles: 100, materials: 1 })
    expect(result.changed.map((change) => change.id)).toEqual(['items/a', 'items/new'])
  })

  it('refuses a builder that got worse past the slack, in a group with no limit too, unless accepted by id', () => {
    const previous = baselineOf({ 'houses/a': recorded })
    const costs = [cost('houses/a', 23, 2300, 2)]
    expect(toCostBaseline({ costs, previous, accepted: [] }).refused.map((refusal) => [refusal.id, refusal.verdict])).toEqual([['houses/a', 'worse']])
    const accepted = toCostBaseline({ costs, previous, accepted: ['houses/a'] })
    expect(accepted.refused).toEqual([])
    expect(accepted.baseline.entries['houses/a']?.draws).toBe(23)
  })

  it('refuses to drop a recorded builder that is gone, unless accepted by id', () => {
    const previous = baselineOf({ 'items/gone': recorded, 'items/a': recorded })
    const costs = [cost('items/a', 10, 1000, 2)]
    expect(toCostBaseline({ costs, previous, accepted: [] }).refused.map((refusal) => refusal.verdict)).toEqual(['gone'])
    expect(Object.keys(toCostBaseline({ costs, previous, accepted: ['items/gone'] }).baseline.entries)).toEqual(['items/a'])
  })

  it('refuses a piece newly over the limit of its group, or worse than accepted, unless accepted by id', () => {
    const previous = baselineOf({ 'items/a': { draws: 30, triangles: 100, materials: 1 }, 'items/b': { draws: 14, triangles: 100, materials: 1 } }, { limits: { items: 15 }, over: { 'items/a': 30 } })
    const costs = [cost('items/a', 31), cost('items/b', 16)]
    expect(toCostBaseline({ costs, previous, accepted: [] }).refused.map((refusal) => refusal.verdict)).toEqual(['over', 'over'])
    const accepted = toCostBaseline({ costs, previous, accepted: ['items/a', 'items/b'] })
    expect(accepted.refused).toEqual([])
    expect(accepted.baseline.over).toEqual({ 'items/a': 31, 'items/b': 16 })
  })

  it('refuses a new piece over the limit of its group, a renamed one too, unless accepted by id', () => {
    const previous = baselineOf({ 'items/old': { draws: 30, triangles: 100, materials: 1 } }, { limits: { items: 15 }, over: { 'items/old': 30 } })
    const costs = [cost('items/renamed', 40)]
    expect(toCostBaseline({ costs, previous, accepted: ['items/old'] }).refused.map((refusal) => [refusal.id, refusal.verdict])).toEqual([['items/renamed', 'over']])
    const accepted = toCostBaseline({ costs, previous, accepted: ['items/old', 'items/renamed'] })
    expect(accepted.refused).toEqual([])
    expect(accepted.baseline.over).toEqual({ 'items/renamed': 40 })
    expect(compareCosts(costs, previous).map((comparison) => comparison.verdict)).toEqual(['over', 'gone'])
  })

  it('lowers what is recorded as over and takes out what came under the limit', () => {
    const previous = baselineOf({ 'items/a': { draws: 30, triangles: 100, materials: 1 }, 'items/fixed': { draws: 20, triangles: 100, materials: 1 } }, { limits: { items: 15 }, over: { 'items/a': 30, 'items/fixed': 20 } })
    const result = toCostBaseline({ costs: [cost('items/a', 25), cost('items/fixed', 10)], previous, accepted: [] })
    expect(result.refused).toEqual([])
    expect(result.baseline.over).toEqual({ 'items/a': 25 })
  })
})

describe('what fails the check', () => {
  it('is a builder worse, over the limit, new or gone', () => {
    expect([...FAILING_COST_VERDICTS].sort()).toEqual(['gone', 'new', 'over', 'worse'])
  })

  it('a piece accepted over the limit still fails when its triangles grow', () => {
    const baseline = baselineOf({ 'items/a': { draws: 30, triangles: 1000, materials: 1 } }, { limits: { items: 15 }, over: { 'items/a': 30 } })
    expect(compareCosts([cost('items/a', 30, 1200)], baseline)[0]?.verdict).toBe('worse')
  })
})
