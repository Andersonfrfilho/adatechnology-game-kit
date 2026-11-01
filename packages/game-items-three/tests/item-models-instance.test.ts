import { exactSnapshot } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildItem, buildItemLod, composeThumbnailScene, createItemModels, hasItemModel, itemThumbnail, SHIPPED_MODELS } from '../src'

const SIZE: [number, number, number] = [0.1, 0.12, 0.1]
const SHIPPED_ID = SHIPPED_MODELS[0]!.entry.id
const CUSTOM_ID = 'custom_box'
const customRecord = {
  entry: { id: CUSTOM_ID, teamId: 'custom', teamBox: [1, 1, 1] as const, scale: 0.1 },
  builder: () => new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial())),
}
const itemOf = (model: string) => ({ id: model, category: 'x', size: SIZE, model })

describe('item models by instance', () => {
  it('a set with the shipped models draws exactly what the global registry draws', () => {
    const made = createItemModels()
    expect(made.list()).toEqual(SHIPPED_MODELS.map(({ entry }) => entry.id))
    for (const { entry } of SHIPPED_MODELS) {
      const global = buildItem(THREE, itemOf(entry.id))
      const local = made.build(THREE, itemOf(entry.id))
      expect(local.kind).toBe(global.kind)
      expect(exactSnapshot(local.root).hash).toBe(exactSnapshot(global.root).hash)
    }
  })

  it('two sets with different packs and removals do not leak into each other or into the global registry', () => {
    const withCustom = createItemModels({ packs: [[customRecord]], patch: { [SHIPPED_ID]: { scale: 0.5 } } })
    const withoutShipped = createItemModels({ remove: [SHIPPED_ID] })
    expect(withCustom.has(CUSTOM_ID)).toBe(true)
    expect(withoutShipped.has(CUSTOM_ID)).toBe(false)
    expect(hasItemModel(CUSTOM_ID)).toBe(false)
    expect(withCustom.build(THREE, itemOf(CUSTOM_ID)).kind).toBe('model')
    expect(withoutShipped.build(THREE, itemOf(SHIPPED_ID)).kind).toBe('shape')
    expect(withCustom.build(THREE, itemOf(SHIPPED_ID)).kind).toBe('model')
    expect(buildItem(THREE, itemOf(SHIPPED_ID)).kind).toBe('model')
    expect(withCustom.entry(SHIPPED_ID)?.scale).toBe(0.5)
    expect(createItemModels().entry(SHIPPED_ID)?.scale).not.toBe(0.5)
    withCustom.register({ ...customRecord.entry, id: 'later' }, customRecord.builder)
    expect(withoutShipped.has('later')).toBe(false)
    expect(hasItemModel('later')).toBe(false)
  })
})

describe('item models by instance: every consumer path', () => {
  it('LOD and thumbnail read the instance, not the global registry', () => {
    const withoutShipped = createItemModels({ remove: [SHIPPED_ID] })
    const withShipped = createItemModels()
    expect(withShipped.buildLod(THREE, itemOf(SHIPPED_ID)).near.kind).toBe('model')
    expect(withoutShipped.buildLod(THREE, itemOf(SHIPPED_ID)).near.kind).toBe('shape')
    expect(buildItemLod(THREE, itemOf(SHIPPED_ID)).near.kind).toBe('model')
    expect(withShipped.thumbnail(itemOf(SHIPPED_ID))).toEqual({ render: true })
    expect(withoutShipped.thumbnail(itemOf(SHIPPED_ID))).toHaveProperty('svg')
    expect(itemThumbnail(itemOf(SHIPPED_ID))).toEqual({ render: true })
    expect(composeThumbnailScene(THREE, itemOf(SHIPPED_ID), { models: withoutShipped }).scene.children.length).toBeGreaterThan(0)
  })
})
