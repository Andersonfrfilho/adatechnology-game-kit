import { describe, expect, it } from 'vitest'

import { corpseBodyKit, createRig, GUIDE } from '@adatechnology/game-characters'
import { CROWD_DYING_VELOCITY_CHANNEL } from '@adatechnology/game-physics'
import type { CorpseBodiesState, DyingVelocity, Layer, PhysicsWorld } from '@adatechnology/game-physics'

import { crowdHash, crowdRoom, dropPile, drawing, killAt, step, torsoOf } from './room-corpses-support'

/** Spec 008, TS.7: the dead of the crowd module are bodies of the room's engine (T5.4b, T5.4c, T5.4d). */

const SLEEP_LIMIT_S = 14
const CORPSE_LAYER: readonly Layer[] = ['corpse']
const corpsesIn = (world: PhysicsWorld): number => world.overlapShape({ kind: 'box', half: [500, 200, 500] }, [0, 0, 0], [0, 0, 0, 1], [], { layers: CORPSE_LAYER })
const kit = corpseBodyKit({ rig: createRig({ body: GUIDE, height: 1.8, build: 1 }), body: GUIDE, build: 1 })

describe('the dead of the crowd in the engine of the room (spec 008, TS.7)', () => {
  it('an agent that dies becomes a body, falls on the ground the room lays, sleeps there and never goes under it', { timeout: 120000 }, async () => {
    const { room, module, world, services } = await crowdRoom('engine')
    const id = killAt(module, 0, 0)
    const corpses = services()!.corpses()
    expect(corpses.rungOf(id)).toBe('r0')
    const pose = new Float64Array(7)
    let lowest = Infinity
    for (let frame = 0; frame < 8 * 60; frame++) {
      room.update(1 / 60)
      for (const body of corpses.partsOf(id)) {
        world!.readPose(body, pose, 0)
        lowest = Math.min(lowest, pose[1] as number)
      }
    }
    expect(corpses.partsOf(id).every((body) => world!.isSleeping(body))).toBe(true)
    const lies = torsoOf(services()!, id)
    expect(lies[1]).toBeGreaterThan(0.05)
    expect(lies[1]).toBeLessThan(0.5)
    expect(lowest).toBeGreaterThan(-0.02)
    expect(module.crowd.corpses.count).toBe(1)
    room.dispose()
    world!.dispose()
  })

  it('a body a car kills starts at the speed the car lends, and the crowd is not told it was pushed', { timeout: 120000 }, async () => {
    const { room, module, world, services } = await crowdRoom('engine')
    const velocity = [0, 0, 6] as const
    const stopLending = services()!.channel<DyingVelocity>(CROWD_DYING_VELOCITY_CHANNEL).publish(() => velocity)
    const id = killAt(module, 0, 0)
    stopLending()
    step(room, 6 * 60)
    const lies = torsoOf(services()!, id)
    const told = module.crowd.corpses.entries.find((entry) => entry.id === id)!.data
    expect(lies[2]).toBeGreaterThan(1.5)
    expect(told.z).toBeCloseTo(0, 5)
    room.dispose()
    world!.dispose()
  })

  it('a corpse pushed far enough tells the crowd where it lies, and the ledger keeps its id', { timeout: 120000 }, async () => {
    const { room, module, world, services } = await crowdRoom('engine', {}, false)
    const id = killAt(module, 0, 0)
    step(room, 5 * 60)
    const corpses = services()!.corpses()
    const before = module.crowd.corpses.entries.find((entry) => entry.id === id)!.data
    for (const body of corpses.partsOf(id)) world!.setVelocity(body, [8, 0, 0], [0, 0, 0])
    step(room, 6 * 60)
    const lies = torsoOf(services()!, id)
    const told = module.crowd.corpses.entries.find((entry) => entry.id === id)!.data
    expect(lies[0]).toBeGreaterThan(2)
    expect(before.x).toBeCloseTo(0, 5)
    expect(Math.hypot(told.x - lies[0], told.z - lies[2])).toBeLessThan(0.05)
    expect(module.crowd.corpses.count).toBe(1)
    room.dispose()
    world!.dispose()
  })

  it('with nothing pushing a body the crowd holds the same state with and without the engine, bit for bit', { timeout: 120000 }, async () => {
    const hashes: string[] = []
    for (const physics of ['engine', 'own'] as const) {
      const { room, module, world } = await crowdRoom(physics)
      for (const [x, z] of [[-6, 3], [-3, 5], [0, 4], [3, 6], [6, 3]] as const) killAt(module, x, z)
      step(room, 8 * 60)
      hashes.push(crowdHash(module))
      room.dispose()
      world?.dispose()
    }
    expect(JSON.parse(hashes[0] as string).corpses).toHaveLength(5)
    expect(hashes[0]).toBe(hashes[1])
  })

  it('room.clear() and the detach take every body out of the world', { timeout: 120000 }, async () => {
    const { room, module, world, services } = await crowdRoom('engine')
    for (let i = 0; i < 5; i++) killAt(module, i * 2 - 4, 3)
    step(room, 60)
    expect(corpsesIn(world!)).toBeGreaterThan(0)
    room.clear()
    expect(module.crowd.corpses.count).toBe(0)
    expect(corpsesIn(world!)).toBe(0)
    expect(services()!.corpses().counts().rigidBodies).toBe(0)
    for (let i = 0; i < 3; i++) killAt(module, i * 2 - 2, 3)
    step(room, 30)
    expect(corpsesIn(world!)).toBeGreaterThan(0)
    room.dispose()
    expect(corpsesIn(world!)).toBe(0)
    world!.dispose()
  })

  it("`own`: the module is lent no engine, makes no body, and the dead are still on the ground", { timeout: 120000 }, async () => {
    const { room, module, services } = await crowdRoom('own')
    expect(services()).toBeUndefined()
    for (let i = 0; i < 5; i++) killAt(module, i * 2 - 4, 3)
    step(room, 120)
    expect(module.crowd.corpses.count).toBe(5)
    room.clear()
    expect(module.crowd.corpses.count).toBe(5)
    room.dispose()
  })

  it('restored in a new world after the world was thrown away: the same rungs and torso poses, asleep', { timeout: 180000 }, async () => {
    const first = await crowdRoom('engine')
    const ids = [[-6, 3], [-3, 5], [0, 4], [3, 6], [6, 3], [0, 6.5]].map(([x, z]) => killAt(first.module, x as number, z as number))
    step(first.room, 8 * 60)
    const saved = JSON.parse(JSON.stringify(first.services()!.corpses().saveState())) as CorpseBodiesState
    const poses = ids.map((id) => torsoOf(first.services()!, id))
    const rungs = ids.map((id) => first.services()!.corpses().rungOf(id))
    first.room.dispose()
    first.world!.dispose()

    const second = await crowdRoom('engine')
    const corpses = second.services()!.corpses()
    expect(corpses.restoreFresh(saved, () => kit)).toBe(true)
    // a ragdoll (R0) is made only by a death: it comes back as its chain
    expect(ids.map((id) => corpses.rungOf(id))).toEqual(rungs.map((rung) => (rung === 'r0' ? 'r1' : rung)))
    step(second.room, 4 * 60)
    expect(ids.map((id) => corpses.rungOf(id))).toEqual(rungs.map((rung) => (rung === 'r0' ? 'r1' : rung)))
    ids.forEach((id, index) => {
      const now = torsoOf(second.services()!, id)
      const was = poses[index]!
      expect(Math.hypot(now[0] - was[0], now[1] - was[1], now[2] - was[2])).toBeLessThan(0.05)
    })
    expect(ids.every((id) => corpses.partsOf(id).every((body) => second.world!.isSleeping(body)))).toBe(true)
    second.room.dispose()
    second.world!.dispose()
  })

  it('100 dead in a pile against a wall sleep within the owner’s 14 s and leave no ragdoll in the pile', { timeout: 180000 }, async () => {
    const pile = await crowdRoom('engine', {}, true)
    const run = dropPile(pile, 16)
    const counts = pile.services()!.corpses().counts()
    const awake = run.ids.filter((id) => pile.services()!.corpses().partsOf(id).some((body) => !pile.world!.isSleeping(body)))
    console.info(`[TS.7] pile ${JSON.stringify({ asleepAtS: run.asleepAtS, counts, awake: awake.length, awakeRungs: awake.map((id) => pile.services()!.corpses().rungOf(id)), pos: awake.slice(0, 5).map((id) => torsoOf(pile.services()!, id)) })}`)
    expect(run.ids).toHaveLength(100)
    expect(run.asleepAtS).toBeGreaterThan(0)
    expect(run.asleepAtS).toBeLessThanOrEqual(SLEEP_LIMIT_S)
    expect(counts.r0).toBe(0)
    pile.room.dispose()
    pile.world!.dispose()
  })

  it('the body on the ground is drawn where the engine has it: an oriented instance whose feet put the torso at its torso', { timeout: 180000 }, async () => {
    const { room, module, world, services } = await crowdRoom('engine', drawing())
    const ids = [[-2, 3], [0, 3], [2, 3]].map(([x, z]) => killAt(module, x as number, z as number))
    step(room, 6 * 60)
    const batches = (module.renderer!.group.children as unknown as { geometry: { getAttribute(name: string): { array: Float32Array } | undefined }; count: number }[]).filter((mesh) => mesh.geometry?.getAttribute('iQ') && mesh.count > 0)
    expect(batches.reduce((sum, mesh) => sum + mesh.count, 0)).toBe(ids.length)
    for (const mesh of batches) {
      const q = mesh.geometry.getAttribute('iQ')!.array
      for (let i = 0; i < mesh.count; i++) expect(Math.hypot(q[i * 4]!, q[i * 4 + 1]!, q[i * 4 + 2]!, q[i * 4 + 3]!)).toBeCloseTo(1, 4)
    }
    expect(services()!.corpses().counts().r0 + services()!.corpses().counts().r1).toBeGreaterThan(0)
    room.dispose()
    world!.dispose()
  })
})
