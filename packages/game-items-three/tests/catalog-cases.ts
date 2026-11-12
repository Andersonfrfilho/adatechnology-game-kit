import { createGoodsItems } from '@adatechnology/game-items-goods'
import * as THREE from 'three'
import { buildItem, buildItemLod, mergeItem, SHAPES, SHIPPED_MODELS } from '../src'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
const goods = createGoodsItems()
const GAME_ONLY: Record<string, readonly [number, number, number]> = { survivor_diary: [0.16154, 0.21, 0.05452] }

export type Case = [string, () => THREE.Object3D]
export const cases: Case[] = []
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
