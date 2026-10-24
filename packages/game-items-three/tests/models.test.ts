import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createGoodsItems } from '@adatechnology/game-items-goods'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, checkBudget, createItemKit, hasItemModel, listItemModels, MODEL_BUDGET_DEVIATIONS, SHIPPED_MODELS } from '../src'

const catalog = createGoodsItems()
// the diary is an item of the game (the story), not of the goods catalog: its model ships here and the game points an item to it
const GAME_ONLY: Record<string, readonly [number, number, number]> = { survivor_diary: [0.16154, 0.21, 0.05452] }
const sizeOf = (id: string): readonly [number, number, number] => GAME_ONLY[id] ?? catalog.get(id).size

describe('the shipped models', () => {
  it('are the 24 of the page, registered by catalog id, and 23 of them are the model of an item of the goods catalog', () => {
    expect(SHIPPED_MODELS).toHaveLength(24)
    expect(listItemModels()).toEqual(SHIPPED_MODELS.map(({ entry }) => entry.id))
    const modeled = catalog.list().filter((item) => item.model !== undefined)
    expect(modeled.map((item) => item.id).sort()).toEqual(SHIPPED_MODELS.map(({ entry }) => entry.id).filter((id) => !(id in GAME_ONLY)).sort())
    for (const item of modeled) expect(hasItemModel(item.model as string), item.id).toBe(true)
  })

  it('measure, times the scale of models.json, the size of their item (the box of the page is the box of the builder)', () => {
    for (const { entry, builder } of SHIPPED_MODELS) {
      const box = new THREE.Box3().setFromObject(builder(createItemKit(THREE))).getSize(new THREE.Vector3())
      box.toArray().forEach((side, axis) => {
        expect(side, `${entry.id} team box ${axis}`).toBeCloseTo(entry.teamBox[axis]!, 3)
        expect(Math.abs(side * entry.scale - sizeOf(entry.id)[axis]!) / sizeOf(entry.id)[axis]!, `${entry.id} real size axis ${axis}`).toBeLessThan(0.02)
      })
    }
  })

  it('draw at the size of the item once built, with the base on the origin', () => {
    for (const { entry } of SHIPPED_MODELS) {
      const size = sizeOf(entry.id)
      const model = buildItem(THREE, { id: entry.id, category: 'x', size, model: entry.id })
      expect(model.kind).toBe('model')
      const box = new THREE.Box3().setFromObject(model.root)
      expect(box.min.y, entry.id).toBeCloseTo(0, 6)
      box.getSize(new THREE.Vector3()).toArray().forEach((side, axis) => expect(Math.abs(side - size[axis]!) / size[axis]!, `${entry.id} axis ${axis}`).toBeLessThan(0.02))
    }
  })

  it('keep their models.json as the generator writes it: the ids and boxes of decisions.json', () => {
    const file = JSON.parse(readFileSync(join(process.cwd(), 'src/data/models.json'), 'utf8')) as Array<{ id: string; teamId: string }>
    expect(file.map((row) => row.teamId)).toEqual(SHIPPED_MODELS.map(({ entry }) => entry.teamId))
  })

  it('stay inside the triangle budget of their class, or are listed as known deviations of the team with the count they have', () => {
    const over: Record<string, number> = {}
    for (const { entry } of SHIPPED_MODELS) {
      const size = sizeOf(entry.id)
      const report = checkBudget(buildItem(THREE, { id: entry.id, category: 'x', size, model: entry.id }).root, size)
      if (!report.ok) over[entry.id] = report.triangles
    }
    expect(over).toEqual(MODEL_BUDGET_DEVIATIONS)
  })

  it('wear the simple shape inside the budget once the second level of detail takes over', () => {
    for (const id of Object.keys(MODEL_BUDGET_DEVIATIONS)) {
      const size = sizeOf(id)
      const far = buildItem(THREE, { id, category: 'x', size, model: id, shape: 'box' }, { simple: true, detail: 0.5 })
      expect(checkBudget(far.root, size).ok, id).toBe(true)
    }
  })
})
