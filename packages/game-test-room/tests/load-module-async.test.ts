import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { TestableModule } from '@adatechnology/game-contracts'
import type { ScenarioContext } from '../src'
import { makeRoom } from './helpers'

const crate = (id: string): ReturnType<TestableModule<ScenarioContext>['items']>[number] => ({
  id,
  name: id,
  build: (T) => new (T as typeof THREE).Mesh(new (T as typeof THREE).BoxGeometry(0.4, 0.4, 0.4), new (T as typeof THREE).MeshStandardMaterial()),
  spec: { name: id, parts: [{ id: 'body', material: 'wood_hard', mass: 4, shape: { kind: 'box', size: [0.4, 0.4, 0.4] }, position: [0, 0.2, 0] }] },
})
const crates = (id: string): TestableModule<ScenarioContext> => ({ id, name: id, group: id, items: () => [crate(`${id}_a`), crate(`${id}_b`), crate(`${id}_c`)], scenarios: () => [] })

describe('loadModuleAsync: a module an item at a time', () => {
  it('awaits the host between the items (before each is built and checked) and reports what loadModule reports', async () => {
    const room = makeRoom()
    const seen: string[] = []
    const report = await room.loadModuleAsync(crates('crates'), async (itemId) => {
      // the item is not in the catalogue yet when the host is told about it
      seen.push(`${itemId}:${room.testTable.items().some((item) => item.id === itemId)}`)
      await Promise.resolve()
    })
    expect(seen).toEqual(['crates_a:false', 'crates_b:false', 'crates_c:false'])
    const sync = makeRoom().loadModule(crates('crates'))
    expect(report).toEqual(sync)
    expect(report.ok).toBe(true)
    expect(room.modules().some((module) => module.id === 'crates')).toBe(true)
  })
})
