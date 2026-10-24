import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createGoodsItems } from '@adatechnology/game-items-goods'
import { exactSnapshot } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, buildItemLod, mergeItem, SHAPES, SHIPPED_MODELS } from '../src'

/**
 * Every bit of the 24 showcase models and the 25 simple shapes, alone, merged and as a LOD: recorded on the old path (three's own geometry
 * constructors and props3d's merge) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
// the package runs its tests in happy-dom, where import.meta.url is not a file: the fixture is found from the package folder
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-items.json')

const goods = createGoodsItems()
const GAME_ONLY: Record<string, readonly [number, number, number]> = { survivor_diary: [0.16154, 0.21, 0.05452] }

type Case = [string, () => THREE.Object3D]
const cases: Case[] = []
for (const { entry } of SHIPPED_MODELS) {
  const item = { id: entry.id, category: 'x', size: (GAME_ONLY[entry.id] ?? goods.get(entry.id).size) as [number, number, number], model: entry.id }
  cases.push([`model/${entry.id}`, () => buildItem(THREE, item).root])
  cases.push([`model/${entry.id}:merged`, () => mergeItem(THREE, buildItem(THREE, item)).root])
  cases.push([`model/${entry.id}:lod`, () => buildItemLod(THREE, item, { wear: 1 }).root])
}
for (const shape of SHAPES) {
  const item = { id: shape, category: 'x', size: [0.32, 0.21, 0.13] as [number, number, number], shape, color: 0x8a5a3a }
  cases.push([`shape/${shape}`, () => buildItem(THREE, item).root])
  cases.push([`shape/${shape}:half`, () => buildItem(THREE, item, { detail: 0.5 }).root])
  cases.push([`shape/${shape}:lod`, () => buildItemLod(THREE, item).root])
}

const recorded: Record<string, { hash: string; nodes: readonly string[] }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the items, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; nodes: readonly string[] }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, nodes }
      }
      writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n')
    })
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    if (snapshot.hash !== recorded[id]?.hash) expect(snapshot.nodes).toEqual(recorded[id]?.nodes)
    expect(snapshot.hash).toBe(recorded[id]?.hash)
  })
})
