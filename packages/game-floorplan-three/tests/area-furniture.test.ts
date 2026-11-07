import { createDestruction } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { DEFAULT_AREA_FURNITURE, furnitureItems } from '../src/test-area/furniture-items'
import { fakeDocument } from './helpers/fake-document'
import { THREE } from './helpers/houses'

describe('the furniture of the houses area', () => {
  const items = furnitureItems({ types: DEFAULT_AREA_FURNITURE, document: fakeDocument, nameOf: (type) => type })

  it('offers each table as a catalogue item with every leg a part of its own', () => {
    expect(items.map((item) => item.id)).toEqual(DEFAULT_AREA_FURNITURE.map((type) => `furniture_${type}`))
    for (const item of items) {
      const root = item.build(THREE) as InstanceType<typeof THREE.Object3D>
      const spec = typeof item.spec === 'function' ? item.spec(root) : item.spec
      if (!spec) throw new Error(`${item.id} has no spec`)
      expect(spec.parts.length, item.id).toBeGreaterThan(4)
      const world = createDestruction({ seed: 1 })
      const id = world.add(spec, { id: item.id })
      expect(world.state(id)!.parts.filter((part) => part.status === 'intact').length, item.id).toBe(spec.parts.length)
    }
  })
})
