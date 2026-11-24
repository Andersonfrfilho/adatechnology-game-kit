import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { compareCosts, costOf, toCostBaseline } from '../src/cost'
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
    expect(costOf('a', new THREE.BoxGeometry(1, 1, 1))).toBeNull()
    expect(costOf('a', { positions: new Float32Array(9) })).toBeNull()
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
  it('records every cost, keeps the limits, and lowers what is recorded as over', () => {
    const previous = baselineOf({}, { limits: { items: 15 }, over: { 'items/a': 30, 'items/fixed': 20 } })
    const result = toCostBaseline([cost('items/a', 25), cost('items/fixed', 10), cost('items/ok', 5)], previous, [])
    expect(result.refused).toEqual([])
    expect(result.baseline.over).toEqual({ 'items/a': 25 })
    expect(Object.keys(result.baseline.entries)).toEqual(['items/a', 'items/fixed', 'items/ok'])
  })

  it('refuses a piece newly over the limit, or worse than recorded, unless accepted by id', () => {
    const previous = baselineOf({}, { limits: { items: 15 }, over: { 'items/a': 30 } })
    const costs = [cost('items/a', 31), cost('items/new', 40)]
    expect(toCostBaseline(costs, previous, []).refused).toEqual(['items/a', 'items/new'])
    const accepted = toCostBaseline(costs, previous, ['items/a', 'items/new'])
    expect(accepted.refused).toEqual([])
    expect(accepted.baseline.over).toEqual({ 'items/a': 31, 'items/new': 40 })
  })
})
