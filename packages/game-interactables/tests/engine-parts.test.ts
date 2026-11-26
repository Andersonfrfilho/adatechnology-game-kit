import { describe, expect, it, vi } from 'vitest'

import { KIT_WORLD, createPhysicsLoop } from '@adatechnology/game-physics'
import type { BodyId, PhysicsWorld, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'

import { buildChain, chainPoints, createEnginePartPhysics, createWorld } from '../src'
import type { EnginePartOptions, ObjectSpec, PartSpec, WorldEvent } from '../src'

const FRAME = 1 / 60

const door: PartSpec = { id: 'door', pivot: [-0.4, 0, 0.3], motion: { kind: 'hinge', angle: -Math.PI / 2 }, bounds: [-0.4, 0, 0.28, 0.4, 1.8, 0.32], label: 'prompt.door' }
const drawer: PartSpec = { id: 'drawer', pivot: [0, 0.3, 0.27], motion: { kind: 'slide', axis: [0, 0, 1], distance: 0.4 }, bounds: [-0.3, 0.2, -0.2, 0.3, 0.4, 0.27] }
const cabinet: ObjectSpec = { type: 'cabinet', parts: [door, drawer] }
const curtain: ObjectSpec = { type: 'curtain', soft: [{ id: 'veil', kind: 'curtain', anchor: [0, 2, 0], size: [1, 1.5, 0.05] }] }

/** An interactables world over a Jolt world with a floor, stepped the way a game does: the loop's fixed steps, then the world's `update`. */
const scene = async (options: EnginePartOptions = {}) => {
  const engine = await createJoltEngine()
  const physics: PhysicsWorld = engine.createWorld(KIT_WORLD)
  physics.createBody({ shape: { kind: 'box', half: [20, 0.5, 20] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  const loop = createPhysicsLoop(physics)
  const partPhysics = createEnginePartPhysics(physics, options)
  const events: WorldEvent[] = []
  const w = createWorld({ partPhysics, onEvent: (event) => events.push(event) })
  const stepsPerFrame = Math.round(FRAME / (KIT_WORLD.fixedStep ?? 1 / 120))
  const run = (seconds: number): void => {
    for (let i = 0; i < Math.round(seconds / FRAME); i++) {
      loop.stepFixed(stepsPerFrame)
      w.update(FRAME)
    }
  }
  const poseOf = (body: BodyId): Float64Array => {
    const pose = new Float64Array(7)
    physics.readPose(body, pose, 0)
    return pose
  }
  const leaf = (object: string, part: string): BodyId => {
    const body = partPhysics.leafOf(object, part)
    if (body === undefined) throw new Error(`no leaf for ${object}:${part}`)
    return body
  }
  const dispose = (): void => {
    partPhysics.dispose()
    physics.dispose()
  }
  return { physics, w, run, events, poseOf, leaf, dispose }
}

describe('doors and drawers on the engine joints (spec 008 T4.4)', () => {
  it('a door on a hinge with a limit opens to t = 1 by the engine and closes back, with a part event on arrival', { timeout: 60000 }, async () => {
    const { w, run, events, dispose } = await scene()
    w.add('c', cabinet, { x: 2, y: 0, z: 3, ry: 0.5 })
    w.setPart('c', 'door', 1)
    run(2)
    expect(w.partT('c', 'door')).toBeGreaterThan(0.97)
    expect(w.partT('c', 'door')).toBeLessThan(1.03)
    expect(events.some((e) => e.type === 'part' && e.part === 'door' && e.target > 0.9)).toBe(true)
    w.setPart('c', 'door', 0)
    run(2)
    expect(Math.abs(w.partT('c', 'door'))).toBeLessThan(0.03)
    dispose()
  })

  it('a drawer on a slider goes 0.4 m along its axis, turned with the object, and back', { timeout: 60000 }, async () => {
    const { w, run, poseOf, leaf, dispose } = await scene()
    w.add('c', cabinet, { x: 0, y: 0, z: 0, ry: Math.PI / 2 })
    w.setPart('c', 'door', 1, true)
    const closed = poseOf(leaf('c', 'drawer'))
    w.setPart('c', 'drawer', 1)
    run(2)
    const open = poseOf(leaf('c', 'drawer'))
    // the drawer slides along +z of the object, which a quarter turn about y makes +x of the world
    expect(open[0]! - closed[0]!).toBeGreaterThan(0.38)
    expect(open[0]! - closed[0]!).toBeLessThan(0.42)
    expect(Math.abs(open[2]! - closed[2]!)).toBeLessThan(0.01)
    expect(w.partT('c', 'drawer')).toBeGreaterThan(0.97)
    w.setPart('c', 'drawer', 0)
    run(2)
    expect(Math.abs(w.partT('c', 'drawer'))).toBeLessThan(0.03)
    dispose()
  })

  it('a push opens a door that is left alone, the limit stops it, and the next interaction starts from where it is', { timeout: 60000 }, async () => {
    const { physics, w, run, leaf, dispose } = await scene()
    w.add('c', cabinet, { x: 0, y: 0, z: 0, ry: 0 })
    run(0.5)
    expect(w.partT('c', 'door')).toBeLessThan(0.03)
    // the hinge turns by -90 degrees about y: the door opens toward +z, so the far edge pushed to +z opens it
    physics.wake(leaf('c', 'door'))
    physics.addImpulse(leaf('c', 'door'), [0, 0, 6], [0.4, 0.9, 0.3])
    run(1.5)
    const pushed = w.partT('c', 'door')
    expect(pushed).toBeGreaterThan(0.05)
    expect(pushed).toBeLessThan(1.06)
    physics.wake(leaf('c', 'door'))
    physics.addImpulse(leaf('c', 'door'), [0, 0, 400], [0.4, 0.9, 0.3])
    run(1.5)
    expect(w.partT('c', 'door')).toBeLessThan(1.06)
    expect(w.partT('c', 'door')).toBeGreaterThan(0.9)
    // left open by a push, the interaction closes it (it toggles from where the joint is)
    expect(w.act('c:part.door')).toBe(true)
    run(2)
    expect(Math.abs(w.partT('c', 'door'))).toBeLessThan(0.03)
    dispose()
  })

  it('a door whose joint breaks over its impulse leaves the part, stays where it broke and flies as a loose body', { timeout: 60000 }, async () => {
    const { physics, w, run, events, poseOf, leaf, dispose } = await scene({ breakImpulse: () => 5 })
    w.add('c', cabinet, { x: 0, y: 0, z: 0, ry: 0 })
    run(0.3)
    const body = leaf('c', 'door')
    const before = poseOf(body)
    physics.addImpulse(body, [0, 0, 300], [0.4, 0.9, 0.3])
    run(1.5)
    expect(events.filter((e) => e.type === 'broke' && e.part === 'door')).toHaveLength(1)
    const frozen = w.partT('c', 'door')
    const after = poseOf(body)
    // loose: it left the hinge (the hinge end was at x = -0.4)
    expect(Math.hypot(after[0]! - before[0]!, after[2]! - before[2]!)).toBeGreaterThan(0.5)
    run(2)
    expect(w.partT('c', 'door')).toBe(frozen)
    dispose()
  })

  it('a part without bounds, or a world without the engine, keeps the world stepping t at the motion speed', { timeout: 60000 }, async () => {
    const { w, run, dispose } = await scene()
    w.add('c', { type: 'plain', parts: [{ id: 'lid', pivot: [0, 0, 0], motion: { kind: 'hinge', angle: 1 } }] }, { x: 0, y: 0, z: 0, ry: 0 })
    w.setPart('c', 'lid', 1)
    w.update(0.2)
    expect(w.partT('c', 'lid')).toBeCloseTo(0.5)
    run(1)
    expect(w.partT('c', 'lid')).toBe(1)
    const plain = createWorld()
    plain.add('c', cabinet, { x: 0, y: 0, z: 0, ry: 0 })
    plain.setPart('c', 'door', 1)
    plain.update(0.2)
    expect(plain.partT('c', 'door')).toBeCloseTo(0.5)
    dispose()
  })

  it('a load puts the door at the saved t at rest', { timeout: 60000 }, async () => {
    const { w, run, dispose } = await scene()
    w.add('c', cabinet, { x: 0, y: 0, z: 0, ry: 0 })
    w.setPart('c', 'door', 0.6, true)
    expect(w.partT('c', 'door')).toBeCloseTo(0.6, 2)
    run(1)
    expect(w.partT('c', 'door')).toBeGreaterThan(0.55)
    expect(w.partT('c', 'door')).toBeLessThan(0.65)
    dispose()
  })
})

describe('curtains and cables on swing-twist chains (spec 008 T4.4)', () => {
  it('a curtain sways when an actor pushes through it and settles', { timeout: 60000 }, async () => {
    const { w, run, dispose } = await scene()
    w.add('k', curtain, { x: 0, y: 0, z: 0, ry: 0 })
    run(1)
    expect(Math.abs(w.sway('k', 'veil').ax)).toBeLessThan(0.02)
    w.push([0, 1.2, 0.1], 0.3, [0, 0, -1.5])
    let peak = 0
    for (let i = 0; i < 60; i++) {
      run(1 / 30)
      peak = Math.max(peak, Math.abs(w.sway('k', 'veil').ax))
    }
    expect(peak).toBeGreaterThan(0.05)
    expect(Math.abs(w.sway('k', 'veil').az)).toBeLessThan(peak)
    run(8)
    expect(Math.abs(w.sway('k', 'veil').ax)).toBeLessThan(peak / 3)
    dispose()
  })

  it('a cable tied at both ends sags under its weight and stays tied', { timeout: 60000 }, async () => {
    const { physics, run, dispose } = await scene()
    const from: Vec3 = [0, 2, 0]
    const to: Vec3 = [3, 2, 0]
    const left = physics.createBody({ shape: { kind: 'box', half: [0.02, 0.02, 0.02] }, motion: 'static', position: from, user: -3 })
    const right = physics.createBody({ shape: { kind: 'box', half: [0.02, 0.02, 0.02] }, motion: 'static', position: to, user: -3 })
    const links = 12
    const points = Array.from({ length: links + 1 }, (_, i): Vec3 => [(3 * i) / links, 2 - 0.3 * Math.sin((Math.PI * i) / links), 0])
    const chain = buildChain(physics, { points, halfWidth: 0.01, halfDepth: 0.01, totalMass: 0.6, startBody: left, endBody: right, halfCone: 1.2, twist: 0.3, jointFriction: 0.001, damping: 0.5 })
    run(4)
    const out = new Float64Array((links + 1) * 3)
    chainPoints(physics, chain, out)
    let lowest = Infinity
    for (let i = 0; i <= links; i++) lowest = Math.min(lowest, out[i * 3 + 1]!)
    expect(2 - lowest).toBeGreaterThan(0.1)
    expect(Math.hypot(out[0]! - from[0], out[1]! - from[1], out[2]! - from[2])).toBeLessThan(0.05)
    expect(Math.hypot(out[links * 3]! - to[0], out[links * 3 + 1]! - to[1], out[links * 3 + 2]! - to[2])).toBeLessThan(0.05)
    expect(lowest).toBeGreaterThan(0)
    dispose()
  })
})

describe('what the world does each frame with everything asleep (spec 008 review, §15)', () => {
  it('does not read a joint or a pose for a door, a drawer or a curtain that rests', { timeout: 60000 }, async () => {
    const { physics, w, run, leaf, dispose } = await scene()
    w.add('c', cabinet, { x: 0, y: 0, z: 0, ry: 0 })
    w.add('d', cabinet, { x: -6, y: 0, z: 0, ry: 0 })
    w.add('k', curtain, { x: 4, y: 0, z: 0, ry: 0 })
    w.setPart('c', 'door', 1)
    w.setPart('d', 'drawer', 1)
    run(4)
    w.push([4, 1.2, 0.1], 0.3, [0, 0, -1.5])
    run(14)
    expect(physics.isSleeping(leaf('c', 'door'))).toBe(true)
    expect(physics.isSleeping(leaf('d', 'drawer'))).toBe(true)
    const door = w.partT('c', 'door')
    const sway = w.sway('k', 'veil')
    const jointAngles = vi.spyOn(physics, 'jointAngles')
    const readPose = vi.spyOn(physics, 'readPose')
    for (let i = 0; i < 30; i++) w.update(FRAME)
    expect(jointAngles).not.toHaveBeenCalled()
    expect(readPose).not.toHaveBeenCalled()
    expect(w.partT('c', 'door')).toBe(door)
    expect(w.sway('k', 'veil')).toEqual(sway)
    // woken by a push, the same door is read again
    jointAngles.mockRestore()
    physics.addImpulse(leaf('c', 'door'), [0, 0, -50], [0.4, 0.9, 0.3])
    run(0.5)
    expect(w.partT('c', 'door')).not.toBe(door)
    dispose()
  })
})
