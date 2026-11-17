import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { specFromObject3D } from '@adatechnology/game-destruction-three'
import { createGoodsItems } from '@adatechnology/game-items-goods'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, makeupSpec, SHAPES, SHIPPED_MODELS } from '../src'

const goods = createGoodsItems()
const GAME_ONLY: Record<string, readonly [number, number, number]> = { survivor_diary: [0.16154, 0.21, 0.05452] }

/**
 * Debt: loose groups an item still has when it is added as bound (`makeupSpec`, else `specFromObject3D` of the destructible drawing). Some are really apart (a pair of
 * boots, a handful of nails, planks), the rest are parts drawn a little off the one they are fixed to (no contact, no joint), as the shovel's handle was. Measured
 * 2026-11-17. It only shrinks: give the part its joint (or close the gap) and lower the number; a new item starts at none.
 */
const KNOWN_LOOSE: Readonly<Record<string, number>> = {
  'model/wooden_plank': 2,
  'model/syringe': 1,
  'model/can_opener': 1,
  'model/camp_stove': 1,
  'model/car_jack': 1,
  'model/scissors': 1,
  'model/nails': 3,
  'model/combat_boots': 1,
  'model/flip_flops': 1,
  'model/military_radio': 1,
  'model/portable_generator': 3,
  'model/shopping_cart': 5,
  'model/wheelbarrow': 4,
}

const cases: [string, () => DestructibleSpec][] = [
  ...SHIPPED_MODELS.map(({ entry }): [string, () => DestructibleSpec] => [
    `model/${entry.id}`,
    () => {
      const item = { id: entry.id, category: 'x', size: (GAME_ONLY[entry.id] ?? goods.get(entry.id).size) as [number, number, number], model: entry.id }
      return makeupSpec(entry.id) ?? specFromObject3D(THREE, buildItem(THREE, item, { destructible: true }).root, { name: entry.id }).spec
    },
  ]),
  ...SHAPES.map((shape): [string, () => DestructibleSpec] => [
    `shape/${shape}`,
    () => specFromObject3D(THREE, buildItem(THREE, { id: shape, category: 'x', size: [0.32, 0.21, 0.13], shape, color: 0x8a5a3a }, { destructible: true }).root, { name: shape }).spec,
  ]),
]

// what is attached in the real world is attached in the destruction world: an item comes into the world as one group, nothing of it loose at load
describe('the item catalogue in the destruction world', () => {
  it.each(cases)('%s: is one group when added (or exactly its known debt)', (id, specOf) => {
    const spec = specOf()
    if (spec.parts.length === 0) return
    const world = createDestruction({ seed: 1 })
    expect(world.state(world.add(spec, { id: 'item' }))!.groups.length - 1, 'loose groups at load').toBe(KNOWN_LOOSE[id] ?? 0)
  })

  it('the debt names only items of the catalogue', () => {
    expect(Object.keys(KNOWN_LOOSE).filter((id) => !cases.some(([name]) => name === id))).toEqual([])
  })
})
