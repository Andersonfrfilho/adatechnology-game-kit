import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { DEFAULT_TRIALS, fitRow, rowCentres, trialView } from '../src'
import { makeRoom } from './helpers'

/** A plain 2 x 0.8 m table: a top on four legs, the top 0.78 m up. */
const tableSpec = (): DestructibleSpec => ({
  name: 'test_table',
  parts: [
    { id: 'top', material: 'wood_hard', shape: { kind: 'box', size: [2, 0.05, 0.8] }, position: [0, 0.755, 0] },
    ...[-0.9, 0.9].flatMap((x, i) => [-0.35, 0.35].map((z, j) => ({ id: `leg_${i}${j}`, material: 'wood_hard', shape: { kind: 'box' as const, size: [0.06, 0.73, 0.06] as [number, number, number] }, position: [x, 0.365, z] as [number, number, number], anchored: true }))),
  ],
  joints: ['00', '01', '10', '11'].map((leg) => ({ a: `leg_${leg}`, b: 'top', kind: 'screw' as const })),
})

const roomWithTable = () => makeRoom({ scenery: { test_table: { spec: tableSpec(), position: [-7, 0, 3], top: { part: 'top', y: 0.78 } } } })

describe('test table layout', () => {
  it('fits what the table holds, at least one item, and centres the row', () => {
    const widths = [0.5, 0.5, 0.5, 3]
    expect(fitRow((i) => widths[i], 0, 4, 1.6, 0.1)).toBe(2)
    expect(fitRow((i) => widths[i], 2, 4, 1.6, 0.1)).toBe(1)
    expect(fitRow((i) => widths[i], 3, 4, 1.6, 0.1)).toBe(1)
    const xs = rowCentres([0.5, 0.5], 0, 0.1)
    expect(xs[0]).toBeCloseTo(-0.3)
    expect(xs[1]).toBeCloseTo(0.3)
  })

  it('puts the eye in front of the object (+z) for a blow and further back to watch a blast', () => {
    const near = trialView(DEFAULT_TRIALS.stab, 'stab', [0, 1, 0], [0.2, 1.2, 0.2])
    expect(near.eye[2]).toBeCloseTo(0.2 + DEFAULT_TRIALS.stab.distance)
    expect(near.target).toEqual([0.1, 1.1, 0.1])
    expect(trialView(DEFAULT_TRIALS.blast, 'blast', [0, 1, 0], [0.2, 1.2, 0.2]).eye[2]).toBeGreaterThan(5)
  })
})

describe('room.testTable', () => {
  it('lays a group on the table top in pages, and the pages cover the whole group', () => {
    const room = roomWithTable()
    const group = room.testTable.groups()[0]
    const first = room.testTable.open(group)!
    expect(first.objects.length).toBeGreaterThan(0)
    expect(first.selected).toBe(first.objects[0].objectId)
    for (const o of first.objects) {
      const root = room.spawned().find((s) => s.objectId === o.objectId)!.root
      expect(root.position.x).toBeGreaterThan(-8)
      expect(root.position.x).toBeLessThan(-6)
      expect(root.position.y).toBeGreaterThanOrEqual(0.77)
    }
    const seen = first.objects.map((o) => o.itemId)
    let page = first
    while (page.hasNext) {
      page = room.testTable.next()!
      seen.push(...page.objects.map((o) => o.itemId))
    }
    expect(seen.length).toBe(first.total)
    expect(room.testTable.prev()!.page).toBe(page.page - (page.page > 0 ? 1 : 0))
  })

  it('find lays the page that holds the item and picks it', () => {
    const room = roomWithTable()
    const last = room.testTable.items().at(-1)!
    const page = room.testTable.find(last.id)!
    expect(page.group).toBe(last.group)
    const picked = page.objects.find((o) => o.objectId === page.selected)!
    expect(picked.itemId).toBe(last.id)
    expect(room.testTable.find('nope')).toBeNull()
  })

  it('a room without the piece lays nothing', () => {
    const room = makeRoom()
    expect(room.testTable.open(room.testTable.groups()[0])).toBeNull()
    expect(room.testTable.trial('shot')).toBe(false)
  })

  it('runs each trial on the picked item with its tool, and the blow reaches it', () => {
    const room = roomWithTable()
    const group = room.testTable.groups().find((g) => room.testTable.open(g)!.objects.some((o) => o.itemId === 'wooden_crate'))!
    expect(room.testTable.select('nope')).toBe(false)
    for (const kind of ['shot', 'punch', 'stab', 'fire', 'blast'] as const) {
      const page = room.testTable.relay()!
      const target = page.objects.find((o) => o.itemId === 'wooden_crate')!.objectId
      expect(room.testTable.select(target)).toBe(true)
      const before = room.log.entries().length
      expect(room.testTable.trial(kind)).toBe(true)
      expect(room.tool.def.id).toBe(DEFAULT_TRIALS[kind].weapon)
      for (let i = 0; i < 60; i++) room.update(1 / 60)
      const after = room.log.entries().slice(before)
      expect(after.find((e) => e.type === 'trial')?.data?.kind).toBe(kind)
      if (kind === 'blast') expect(after.some((e) => e.type === 'explode')).toBe(true)
      expect(after.some((e) => e.objectId === target && e.type !== 'spawn'), `${kind} reached the crate`).toBe(true)
    }
    // put back: the table and the page are as they were
    room.testTable.relay()
    expect(room.world.state('test_table')!.parts.every((p) => p.status === 'intact')).toBe(true)
    expect(group).toBeTruthy()
  })
})
