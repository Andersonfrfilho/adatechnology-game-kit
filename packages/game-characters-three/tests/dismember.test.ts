import { describe, expect, it } from 'vitest'

import { GUIDE, createDoll, createRig, cutSegment, tearOff } from '@adatechnology/game-characters'
import type { Doll, DollTier } from '@adatechnology/game-characters'
import { KIT_WORLD } from '@adatechnology/game-physics'
import type { BodyId } from '@adatechnology/game-physics'
import { createJoltEngine } from '@adatechnology/game-physics-jolt'
import type { JoltWorld } from '@adatechnology/game-physics-jolt'

const rig = createRig({ body: GUIDE, height: 1.8, build: 1 })
const MASS_TOLERANCE = 0.01

const makeWorld = async (): Promise<JoltWorld> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld(KIT_WORLD) as JoltWorld
  world.createBody({ shape: { kind: 'box', half: [50, 0.5, 50] }, motion: 'static', position: [0, -0.5, 0], user: -1 })
  return world
}

const makeDoll = (world: JoltWorld, tier: DollTier): Doll => createDoll({ world, tier, rig, body: GUIDE, build: 1, at: [0, 0.4, 0] })

const massOf = (world: JoltWorld, ...dolls: readonly Doll[]): number =>
  dolls.reduce((sum, doll) => sum + doll.parts.reduce((inner, part) => inner + world.massOf(part.body), 0), 0)

const positionOf = (world: JoltWorld, body: BodyId): [number, number, number] => {
  const pose = new Float64Array(7)
  world.readPose(body, pose, 0)
  return [pose[0] ?? 0, pose[1] ?? 0, pose[2] ?? 0]
}

const speedOf = (world: JoltWorld, body: BodyId): number => {
  const velocity = new Float64Array(6)
  world.readVelocity(body, velocity, 0)
  return Math.hypot(velocity[0] ?? 0, velocity[1] ?? 0, velocity[2] ?? 0)
}

const settle = (world: JoltWorld, seconds: number): void => {
  for (let i = 0; i < seconds * 60; i++) world.step(1 / 60)
}

describe('R0: a limb torn off', () => {
  it('leaves the joint above the cut, keeps the limb\'s own bodies, joints and masses, and the total mass is the same', async () => {
    const world = await makeWorld()
    const doll = makeDoll(world, 'R0')
    settle(world, 0.5)
    const before = massOf(world, doll)
    const { remaining, severed } = tearOff(world, doll, 'upperArmL')
    expect(remaining.parts).toHaveLength(14)
    expect(severed).toHaveLength(1)
    expect(severed[0]?.parts.map((part) => part.segments[0])).toEqual(['upperArmL', 'forearmL', 'handL'])
    expect(severed[0]?.parts.map((part) => part.joint !== undefined)).toEqual([false, true, true])
    const after = massOf(world, remaining, ...severed)
    expect(Math.abs(after - before) / before).toBeLessThan(MASS_TOLERANCE)
    expect(massOf(world, remaining)).toBeLessThan(before - 1)
    const root = severed[0]?.parts[0]?.body as BodyId
    const torso = remaining.parts[1]?.body as BodyId
    world.addImpulse(root, [60, 0, 0], undefined)
    settle(world, 0.5)
    expect(Math.abs(positionOf(world, root)[0] - positionOf(world, torso)[0])).toBeGreaterThan(1)
    world.dispose()
  })
})

describe('R0: a segment cut in the middle', () => {
  it('shrinks the stump with setShape, gives the rest of the mass to a new body, and the total mass holds', async () => {
    const world = await makeWorld()
    const doll = makeDoll(world, 'R0')
    settle(world, 0.5)
    const forearm = doll.parts.find((part) => part.segments[0] === 'forearmL')
    const before = massOf(world, doll)
    const forearmMass = world.massOf(forearm?.body as BodyId)
    const { remaining, severed } = cutSegment(world, doll, 'forearmL', 0.5)
    const stump = remaining.parts.find((part) => part.segments[0] === 'forearmL')
    expect(stump?.shape.kind === 'capsule' && forearm?.shape.kind === 'capsule' && stump.shape.halfHeight < forearm.shape.halfHeight).toBe(true)
    const piece = severed[0]?.parts[0]
    expect(world.massOf(stump?.body as BodyId)).toBeCloseTo(forearmMass / 2, 6)
    expect(world.massOf(piece?.body as BodyId)).toBeCloseTo(forearmMass / 2, 6)
    expect(severed.map((doll) => doll.parts[0]?.segments[0])).toEqual(['forearmL', 'handL'])
    settle(world, 0.1)
    for (const part of [...remaining.parts, ...severed.flatMap((doll) => doll.parts)]) expect(speedOf(world, part.body)).toBeLessThan(3)
    const after = massOf(world, remaining, ...severed)
    expect(Math.abs(after - before) / before).toBeLessThan(MASS_TOLERANCE)
    settle(world, 1)
    expect(positionOf(world, piece?.body as BodyId).every(Number.isFinite)).toBe(true)
    world.dispose()
  })
})

describe('R1: a chain that loses a member', () => {
  it('draws the arm from the designed pose on the torso, which gives up its mass; the total holds and nothing starts inside the ground', async () => {
    const world = await makeWorld()
    const doll = makeDoll(world, 'R1')
    settle(world, 0.5)
    const before = massOf(world, doll)
    const torsoBefore = world.massOf(doll.parts[0]?.body as BodyId)
    const { remaining, severed } = tearOff(world, doll, 'upperArmR')
    expect(severed).toHaveLength(1)
    expect(severed[0]?.parts).toHaveLength(3)
    const torsoAfter = world.massOf(remaining.parts[0]?.body as BodyId)
    expect(torsoAfter).toBeLessThan(torsoBefore - 1)
    expect(remaining.parts[0]?.segments).not.toContain('upperArmR')
    const after = massOf(world, remaining, ...severed)
    expect(Math.abs(after - before) / before).toBeLessThan(MASS_TOLERANCE)
    const out = new Float64Array(3)
    for (const part of severed[0]?.parts ?? []) expect(world.penetration(part.body, out)).toBe(0)
    // born inside nothing: no body is pushed out of anything, so nothing is thrown
    settle(world, 0.1)
    for (const part of [...remaining.parts, ...(severed[0]?.parts ?? [])]) expect(speedOf(world, part.body)).toBeLessThan(3)
    settle(world, 1)
    world.dispose()
  })

  it('lets the head, a body of its own, go with its joint cut', async () => {
    const world = await makeWorld()
    const doll = makeDoll(world, 'R1')
    const before = massOf(world, doll)
    const { remaining, severed } = tearOff(world, doll, 'head')
    expect(remaining.parts).toHaveLength(2)
    expect(severed.map((piece) => piece.parts[0]?.segments)).toEqual([['head', 'jaw']])
    expect(Math.abs(massOf(world, remaining, ...severed) - before) / before).toBeLessThan(MASS_TOLERANCE)
    world.dispose()
  })
})

describe('what comes off is freed when it goes (CLAUDE.md §8)', () => {
  it('hands the heap back to the byte over cycles of make, tear off, cut, step, remove', async () => {
    const world = await makeWorld()
    const cycle = (tier: DollTier): void => {
      const doll = makeDoll(world, tier)
      const torn = tearOff(world, doll, 'upperArmL')
      const cut = tier === 'R0' ? cutSegment(world, torn.remaining, 'shinR', 0.4) : torn
      settle(world, 0.2)
      const ragdolls = new Set([doll.ragdoll, torn.remaining.ragdoll, ...torn.severed.map((piece) => piece.ragdoll), ...cut.severed.map((piece) => piece.ragdoll)])
      for (const id of ragdolls) world.removeRagdoll(id)
    }
    cycle('R0')
    cycle('R1')
    const before = world.memoryInUse()
    for (let i = 0; i < 10; i++) {
      cycle('R0')
      cycle('R1')
    }
    expect(world.memoryInUse()).toBe(before)
    world.dispose()
  })
})
