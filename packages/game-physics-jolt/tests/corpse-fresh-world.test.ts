import { describe, expect, it } from 'vitest'

import { allAsleep, kit, pileOf, scatter, sceneOf, seconds, torsoOf } from './lod-scenes'

/** Spec 008, T5.4d: the corpses of a save laid in a world that never held their bodies (the world's own `restoreState` needs the same bodies in the same order). */
/** A body laid where it lay is lifted at most `LIFT_MAX` (5 cm) to clear what it touches. */
const TORSO_TOLERANCE_M = 0.06

describe('restoring the corpses in a new world (T5.4d)', () => {
  it('a ragdoll comes back as its chain, at the same torso pose, asleep', { timeout: 120000 }, async () => {
    const before = await sceneOf({ lod: { ragdollsMax: 1 } })
    expect(before.corpses.add({ id: 7, kit, position: [0, 0.05, 0], yaw: 0.3 })).toBe('r0')
    seconds(before.loop, 6)
    const saved = JSON.parse(JSON.stringify(before.corpses.saveState())) as ReturnType<typeof before.corpses.saveState>
    const lies = torsoOf(before, 7)
    before.world.dispose()
    const after = await sceneOf({ lod: { ragdollsMax: 1 } })
    expect(after.corpses.restoreFresh(saved, () => kit)).toBe(true)
    expect(after.corpses.rungOf(7)).toBe('r1')
    const now = torsoOf(after, 7)
    expect(Math.hypot(now[0] - lies[0], now[1] - lies[1], now[2] - lies[2])).toBeLessThan(TORSO_TOLERANCE_M)
    seconds(after.loop, 3)
    expect(allAsleep(after, [7])).toBe(true)
    after.world.dispose()
  })

  it('a pile and a scatter of sleepers come back with the same rungs and torso poses, and stay asleep', { timeout: 180000 }, async () => {
    const before = await sceneOf({ lod: { ragdollsMax: 0 } }, true)
    const pile = pileOf(before, 40)
    const alone = scatter(before, 10, 101)
    seconds(before.loop, 6)
    const saved = JSON.parse(JSON.stringify(before.corpses.saveState())) as ReturnType<typeof before.corpses.saveState>
    const ids = [...pile, ...alone]
    const poses = ids.map((id) => torsoOf(before, id))
    const counts = before.corpses.counts()
    const hash = before.corpses.rungHash()
    expect(counts.piles).toBeGreaterThan(0)
    before.world.dispose()

    const after = await sceneOf({ lod: { ragdollsMax: 0 } }, true)
    expect(after.corpses.restoreFresh(saved, () => kit)).toBe(true)
    const restored = after.corpses.counts()
    expect(after.corpses.rungHash()).toBe(hash)
    expect({ r0: restored.r0, r1: restored.r1, r2: restored.r2, r2f: restored.r2f, r3: restored.r3 }).toEqual({ r0: counts.r0, r1: counts.r1, r2: counts.r2, r2f: counts.r2f, r3: counts.r3 })
    // the frozen are the same bodies; neighbouring saved piles may join in one compound when frozen again
    expect(restored.piles).toBeGreaterThan(0)
    expect(restored.piles).toBeLessThanOrEqual(counts.piles)
    const moved = ids.map((id, index) => {
      const now = torsoOf(after, id)
      const was = poses[index] as readonly number[]
      return Math.hypot(now[0] - (was[0] as number), now[1] - (was[1] as number), now[2] - (was[2] as number))
    })
    console.info(`[T5.4d] torso moved by the restore: max ${Math.max(...moved).toFixed(4)} m, median ${[...moved].sort((a, b) => a - b)[Math.floor(moved.length / 2)]!.toFixed(4)} m`)
    expect(Math.max(...moved)).toBeLessThan(TORSO_TOLERANCE_M)
    seconds(after.loop, 4)
    // the policy looks at the sleepers again: it may freeze a chain into a pile the first run had left alone (the same body in another rung), never wake or lose one
    const later = after.corpses.counts()
    console.info(`[T5.4d] after 4 s more: ${JSON.stringify({ r1: later.r1, r2f: later.r2f })} against ${JSON.stringify({ r1: counts.r1, r2f: counts.r2f })}`)
    expect(later.r1 + later.r2f).toBe(counts.r1 + counts.r2f)
    expect(later.r2f).toBeGreaterThanOrEqual(counts.r2f)
    expect(later.r0 + later.r2 + later.r3).toBe(0)
    expect(allAsleep(after, ids)).toBe(true)
    after.world.dispose()
  })

  it('refuses a world that already holds corpses, and a save with a corpse whose kit is unknown', { timeout: 60000 }, async () => {
    const scene = await sceneOf()
    scatter(scene, 3)
    const saved = scene.corpses.saveState()
    expect(scene.corpses.restoreFresh(saved, () => kit)).toBe(false)
    const empty = await sceneOf()
    expect(empty.corpses.restoreFresh(saved, () => undefined)).toBe(false)
    expect(empty.corpses.counts().rigidBodies).toBe(0)
    scene.world.dispose()
    empty.world.dispose()
  })
})
