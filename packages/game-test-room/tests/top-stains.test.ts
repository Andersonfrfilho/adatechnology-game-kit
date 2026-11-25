import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { DestructibleSpec } from '@adatechnology/game-destruction'

import type { TestRoom, TestRoomItem } from '../src'
import { buildFromSpec } from '../src/build-from-spec'
import { makeRoom } from './helpers'

const TOP = 0.78
const AT: [number, number, number] = [0, 0, -2]
/** A 1.6 x 0.8 m table standing free on the floor: a top screwed on four legs. */
const tableSpec = (): DestructibleSpec => ({
  name: 'table',
  parts: [
    { id: 'top', material: 'wood_hard', mass: 14, shape: { kind: 'box', size: [1.6, 0.05, 0.8] }, position: [0, TOP - 0.025, 0] },
    ...[-0.75, 0.75].flatMap((x, i) => [-0.35, 0.35].map((z, j) => ({ id: `leg_${i}${j}`, material: 'wood_hard', mass: 1.5, shape: { kind: 'box' as const, size: [0.05, TOP - 0.05, 0.05] as [number, number, number] }, position: [x, (TOP - 0.05) / 2, z] as [number, number, number] }))),
  ],
  joints: ['00', '01', '10', '11'].map((leg) => ({ a: `leg_${leg}`, b: 'top', kind: 'screw' as const })),
})
const plateSpec: DestructibleSpec = { name: 'plate', parts: [{ id: 'body', material: 'ceramic', mass: 0.4, shape: { kind: 'box', size: [0.24, 0.025, 0.24] }, position: [0, 0.0125, 0] }], joints: [] }
const CATALOG: TestRoomItem[] = [{ id: 'plate', name: 'plate', group: 'test', build: (T) => buildFromSpec(T, plateSpec), spec: plateSpec }]

/** No frame budget on wall time: every event and its drawing run in the frame it comes in. */
const EVERY_EVENT_IN_ITS_FRAME = { frameBudgetMs: Infinity, debris: { eventBudgetMs: Infinity } } as const
const run = (room: TestRoom, seconds: number): void => {
  for (let t = 0; t < seconds; t += 1 / 60) room.update(1 / 60)
}
const bottom = (root: THREE.Object3D): number => new THREE.Box3().setFromObject(root).min.y

/** The table with two plates and coffee spilt at both ends of its top, settled. */
function setTable(): { room: TestRoom; plates: THREE.Object3D[] } {
  const room = makeRoom({ ...EVERY_EVENT_IN_ITS_FRAME, catalog: CATALOG, scenery: { shelf: null, table: { spec: tableSpec(), position: AT, free: true, pushable: true, top: { part: 'top', y: TOP } } } })
  const plates = [-0.5, 0.5].map((x) => room.spawn('plate', [x, TOP, AT[2]], 0).root as THREE.Object3D)
  room.fluids.splash('coffee', [-0.55, TOP + 0.3, AT[2] + 0.2], 0.15)
  room.fluids.splash('coffee', [0.55, TOP + 0.3, AT[2] - 0.2], 0.15)
  run(room, 1)
  return { room, plates }
}

describe('what is on a table that goes over goes with it', () => {
  it('the legs of one end shot away: the top tips, the plates come off it and the coffee runs off onto the floor, nothing stays where the top was', () => {
    const { room, plates } = setTable()
    expect(room.fluids.stains().filter((s) => s.surface === 'table')).toHaveLength(2)
    for (const leg of ['leg_00', 'leg_01']) {
      for (let i = 0; i < 40 && room.world.part('table', leg)!.status !== 'broken'; i++) {
        room.world.hitPart('table', leg, { type: 'blunt', point: [AT[0] - 0.75, 0.3, AT[2] + (leg === 'leg_00' ? -0.35 : 0.35)], direction: [1, 0, 0], energy: 3e6, radius: 0.05 })
      }
    }
    run(room, 5)
    // the top went over: what is drawn of it reaches the floor at the end whose legs went
    const boxes = room.renderer.shownBoxes('table', 'top')
    expect(Math.min(...boxes.map((b) => b[1]))).toBeLessThan(0.15)
    // every stain still on the top lies on the top where it is now; the coffee that ran off lies on the floor
    const near = (p: readonly number[]): boolean => boxes.some((b) => p[0]! > b[0] - 0.05 && p[0]! < b[3] + 0.05 && p[1]! > b[1] - 0.05 && p[1]! < b[4] + 0.05 && p[2]! > b[2] - 0.05 && p[2]! < b[5] + 0.05)
    const stains = room.fluids.stains()
    for (const s of stains.filter((x) => x.surface === 'table')) expect(near(s.center)).toBe(true)
    const floor = stains.filter((s) => s.surface !== 'table')
    expect(floor.length).toBeGreaterThan(0)
    for (const s of floor) expect(s.center[1]).toBeLessThan(0.05)
    // the plate of the end that fell is down on the floor, not in the air where the top was
    expect(bottom(plates[0]!)).toBeLessThan(0.15)
    for (const plate of plates) expect(bottom(plate)).toBeLessThan(TOP - 0.05)
  })

  it('a table left standing keeps its coffee on its top', () => {
    const { room } = setTable()
    const before = room.fluids.stains().filter((s) => s.surface === 'table')
    run(room, 2)
    const after = room.fluids.stains().filter((s) => s.surface === 'table')
    expect(after).toHaveLength(before.length)
    for (const s of after) expect(s.center[1]).toBeCloseTo(TOP, 1)
  })
})
