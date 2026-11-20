import { buildFrame } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import type { Scheduler } from '@adatechnology/game-runtime'

import { buildFromSpec } from '../src/build-from-spec'
import type { TestRoomItem } from '../src'
import { demoItems } from './fixtures/demo-items'
import { makeRoom } from './helpers'

// Spec 017 T2.2: the structural events apply after the pose trail committed the step. An event that rewrote the root of a piece already in the trail would be undone by the next
// `restore()` (it copies the committed pose back). Reading what `present(1)` draws (the committed pose) after the events must give the roots the events left.
const STRIKE_TICK = 30
const sobradoSpec = () => ({ ...buildFrame({ spanX: 6, spanZ: 5, columnsX: 3, columnsZ: 2, height: 2.7, floors: 2, walls: true, roof: true }), name: 'sobrado' })
const SOBRADO: TestRoomItem = { id: 'sobrado', name: 'Sobrado', group: 'structure', spec: sobradoSpec(), movable: false, build: (T) => buildFromSpec(T, sobradoSpec()) }

type SchedulerHolder = { readonly frameParts: { readonly scheduler: Scheduler } }

describe('the pose trail after the structural events of a tick', () => {
  it('holds the roots the events left: a piece pushed by the blast keeps its pose and velocity into the next tick', () => {
    const room = makeRoom({ catalog: [...demoItems('en'), SOBRADO], worldOptions: { seed: 7 } })
    const { scheduler } = (room as unknown as SchedulerHolder).frameParts
    room.spawn('sobrado', [0, 0, -9])
    const crate = room.spawn('wooden_crate', [4, 0, -5]).objectId
    const mismatches: string[] = []
    let velocityAfterBlast = 0
    scheduler.add(
      (context) => {
        if (context.tick === STRIKE_TICK) room.world.explode([0, 1, -6.4], 4_000_000, 14, 'c4')
      },
      { phase: 'fixedSimulate', order: -1_000_000, id: 'strike' },
    )
    scheduler.add(
      (context) => {
        if (context.tick < STRIKE_TICK || context.tick > STRIKE_TICK + 6) return
        const roots = room.renderer.pieces().map((piece) => [piece.objectId, piece.root.position.toArray(), piece.root.quaternion.toArray()] as const)
        room.renderer.present(1)
        const committed = room.renderer.pieces().map((piece) => [piece.objectId, piece.root.position.toArray(), piece.root.quaternion.toArray()] as const)
        room.renderer.restoreStepPose()
        if (JSON.stringify(roots) !== JSON.stringify(committed)) mismatches.push(`tick ${context.tick}`)
        const pushed = room.renderer.pieces().find((piece) => piece.objectId === crate)
        if (pushed && context.tick === STRIKE_TICK + 1) velocityAfterBlast = Math.hypot(...(pushed.velocity as [number, number, number]))
      },
      { phase: 'fixedSimulate', order: 3000, id: 'trail-probe' },
    )
    for (let frame = 0; frame < 400 && room.renderer.pieces().length >= 0; frame++) {
      room.update(1 / 60, { live: true })
      if (mismatches.length > 0 || velocityAfterBlast > 0) break
    }
    for (let frame = 0; frame < 20; frame++) room.update(1 / 60, { live: true })
    room.dispose()
    expect(mismatches).toEqual([])
    expect(velocityAfterBlast).toBeGreaterThan(0)
  }, 120_000)
})
