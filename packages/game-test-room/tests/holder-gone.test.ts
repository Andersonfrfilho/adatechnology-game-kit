import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import type { TestableModule } from '@adatechnology/game-contracts'
import type { ScenarioContext, SpawnedObject, TestRoom } from '../src'
import { makeRoom } from './helpers'

const BENCH_TOP = 0.9
const STICKS = ['a', 'b', 'c', 'd', 'e'] as const

const board = (name: string, size: [number, number, number], anchored: boolean): DestructibleSpec => ({
  name,
  parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size }, position: [0, size[1] / 2, 0], anchored }],
  joints: [],
})
const mesh = (size: [number, number, number]) => (T: unknown) => {
  const three = T as typeof THREE
  const m = new three.Mesh(new three.BoxGeometry(...size), new three.MeshStandardMaterial())
  m.name = 'body'
  m.position.y = size[1] / 2
  const g = new three.Group()
  g.add(m)
  return g
}

/** A bench laid as a holder of the area (its top is a surface) and sticks laid asleep across it, as the shelves and stands of the item areas are. */
const benchModule = (): TestableModule<ScenarioContext> => ({
  id: 'holder_module',
  name: 'Holder module',
  group: 'Holder',
  items: () => [
    { id: 'bench', name: 'Bench', build: mesh([1.6, BENCH_TOP, 4]), spec: board('bench', [1.6, BENCH_TOP, 4], true), movable: false },
    ...STICKS.map((s) => ({ id: `stick_${s}`, name: `Stick ${s}`, build: mesh([1.1, 0.05, 0.08]), spec: board(`stick ${s}`, [1.1, 0.05, 0.08], false), movable: true })),
  ],
  area: () => ({
    placements: [
      ...STICKS.map((s, i) => ({ item: `stick_${s}`, position: [-8, BENCH_TOP + 0.01, -1.6 + i * 0.3] as [number, number, number], asleep: true })),
      { item: 'bench', position: [-8, 0, -1], surface: { halfSize: [0.8, 2], height: BENCH_TOP } },
    ],
  }),
  attach: () => () => undefined,
})

/** No frame budget on wall time: every event and every slice of its drawing run in the frame it comes in, so a busy machine does not leave the bench's top for a later frame. */
const EVERY_EVENT_IN_ITS_FRAME = { frameBudgetMs: Infinity, debris: { eventBudgetMs: Infinity } } as const

const run = (room: TestRoom, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) room.update(1 / 60)
}
const bottom = (o: SpawnedObject): number => new THREE.Box3().setFromObject(o.root).min.y

const openBench = (): { room: TestRoom; bench: SpawnedObject; sticks: SpawnedObject[] } => {
  const room = makeRoom(EVERY_EVENT_IN_ITS_FRAME)
  room.loadModule(benchModule())
  const placed = room.openArea('holder_module')
  run(room, 1)
  return { room, bench: placed.find((o) => o.itemId === 'bench')!, sticks: placed.filter((o) => o.itemId.startsWith('stick_')) }
}

describe('what lay on a holder of the area falls when the holder is gone', () => {
  it('sticks asleep on a bench whose top is broken off fall to the floor, not stay where the top was', () => {
    const { room, bench, sticks } = openBench()
    expect(Math.min(...sticks.map(bottom))).toBeGreaterThan(BENCH_TOP - 0.05)
    room.world.hitPart(bench.objectId, 'body', { type: 'blunt', point: [-8, BENCH_TOP / 2, -1], energy: 3e7, radius: 1 })
    room.update(1 / 60)
    expect(room.renderer.shownBoxes(bench.objectId)).toHaveLength(0)
    run(room, 3)
    for (const stick of sticks) expect(bottom(stick)).toBeLessThan(0.1)
  })

  it('a blast that wrecks the bench leaves nothing in the air where its top was', () => {
    const { room, bench, sticks } = openBench()
    room.world.explode([-8, 0.4, -1], 4e6, 4, 'player', room.blast())
    room.renderer.explode([-8, 0.4, -1], 4e6, 4)
    run(room, 6)
    const top = room.renderer.shownBoxes(bench.objectId).reduce((most, b) => Math.max(most, b[4]), 0)
    // each stick rests on the floor or on what is still drawn of the bench, never above both
    for (const stick of sticks) expect(bottom(stick)).toBeLessThan(Math.max(0.1, top + 0.05))
  })

  it('while the bench stands, what lies on it stays on its top', () => {
    const { room, sticks } = openBench()
    run(room, 3)
    expect(Math.min(...sticks.map(bottom))).toBeGreaterThan(BENCH_TOP - 0.05)
  })
})

describe('what is thrown falls and rests', () => {
  it('a thing let go in the air falls to the floor and stays there', () => {
    const room = makeRoom(EVERY_EVENT_IN_ITS_FRAME)
    room.loadModule(benchModule())
    const stick = room.spawn('stick_a', [3, 2.5, -3])
    run(room, 3)
    expect(bottom(stick)).toBeLessThan(0.05)
    expect(bottom(stick)).toBeGreaterThan(-0.05)
  })
})
