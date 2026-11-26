import { describe, expect, it } from 'vitest'

import type { BodyDesc, BodyId, JointDesc, RagdollDesc, ShapeDesc, VehicleDesc, Vec3 } from '@adatechnology/game-physics'
import { createPhysicsLoop } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { WALKER, ground, report } from './scenes'

/**
 * Gate 0 B4: the worst scene in one world, made as the room makes its world (1/120 s, 20 passes, 8192 bodies): a city block of 2000 fixed colliders, the
 * 500-body cascade woken by a blast, 100 dead bodies piled as the engine's ragdolls, and the debris bench (160 resting pieces, 40 moving). The peak of the wasm
 * heap in use over 5 s, against the heap's fixed size; then the same made and thrown away five times, which must hand the heap back to the byte.
 */
const worst = async (): Promise<{ peak: number; total: number; before: number; after: number; bodies: number }> => {
  const engine = await createJoltEngine()
  const probe = engine.createWorld({}) as JoltWorld
  const total = probe.memoryTotal()
  probe.dispose()
  const before = (engine.createWorld({}) as JoltWorld)
  const used0 = before.memoryInUse()
  before.dispose()
  const world = engine.createWorld({ fixedStep: 1 / 120, velocityIterations: 20, sleepAfter: 0.5, sleepSpeed: 0.08, penetrationSlop: 0.002, maxPushOut: 0.002, maxBodies: 8192 }) as JoltWorld
  ground(world, 200)
  // the city block: 2000 fixed boxes (walls, slabs, posts) on a 40 x 50 grid west of the rest
  const statics: BodyDesc[] = []
  for (let i = 0; i < 2000; i++) statics.push({ shape: { kind: 'box', half: [1 + (i % 3) * 0.5, 1.5, 0.1 + (i % 2) * 0.4] }, motion: 'static', position: [-60 - (i % 40) * 3, 1.5, -75 + Math.floor(i / 40) * 3], user: -1 })
  world.createBodies(statics)
  // the cascade: wall, slab and crates asleep, a blast at 30 frames reaching all of them
  const cascade: BodyDesc[] = []
  const block = (at: Vec3, half: Vec3, mass: number): void => {
    cascade.push({ shape: { kind: 'box', half }, motion: 'dynamic', mass, position: at, sleeping: true, layer: 'debris', user: cascade.length })
  }
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) block([c * 0.4 - 4 + (r % 2) * 0.2, 0.1 + r * 0.2, 0], [0.2, 0.1, 0.1], 38)
  for (let i = 0; i < 50; i++) block([(i % 10) - 4.5, 4.075, Math.floor(i / 10) * 0.4], [0.5, 0.075, 0.2], 150)
  for (let i = 0; i < 50; i++) block([(i % 10) * 0.8 - 4, 0.25, 2 + Math.floor(i / 10) * 0.6], [0.25, 0.25, 0.25], 20)
  const cascadeIds = world.createBodies(cascade)
  // 100 dead bodies against a wall
  world.createBody({ shape: { kind: 'box', half: [6, 1.5, 0.2] }, motion: 'static', position: [30, 1.5, -0.2], user: -1 })
  for (let i = 0; i < 100; i++) {
    const at: Vec3 = [30 + ((i % 10) - 5) * 0.8, 0.3 + Math.floor(i / 10) * 0.45, 0.6 + (i % 3) * 0.3]
    world.createRagdoll({
      stabilize: true,
      parts: [
        { body: { shape: { kind: 'capsule', halfHeight: 0.25, radius: 0.17 }, mass: 40, position: [at[0], at[1] + 1.25, at[2]], layer: 'character', user: i }, parent: -1 },
        { body: { shape: { kind: 'sphere', radius: 0.11 }, mass: 5, position: [at[0], at[1] + 1.75, at[2]], layer: 'character', user: i }, parent: 0, joint: { kind: 'swingTwist', point: [at[0], at[1] + 1.62, at[2]], twistAxis: [0, 1, 0], planeAxis: [0, 0, 1], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5 } },
        { body: { shape: { kind: 'capsule', halfHeight: 0.3, radius: 0.15 }, mass: 25, position: [at[0], at[1] + 0.45, at[2]], layer: 'character', user: i }, parent: 0, joint: { kind: 'swingTwist', point: [at[0], at[1] + 0.92, at[2]], twistAxis: [0, -1, 0], planeAxis: [0, 0, 1], normalHalfCone: 1.2, planeHalfCone: 1.0, twistMin: -0.4, twistMax: 0.4 } },
      ],
    })
  }
  // the debris bench: 160 two-part pieces resting, 40 thrown
  const debris: BodyDesc[] = []
  for (let i = 0; i < 200; i++) {
    const moving = i >= 160
    debris.push({
      shape: { kind: 'compound', children: [{ shape: { kind: 'box', half: [0.08, 0.04, 0.06] }, position: [0, 0, 0], tag: 0 }, { shape: { kind: 'box', half: [0.04, 0.04, 0.04] }, position: [0.1, 0, 0], tag: 1 }] },
      motion: 'dynamic', mass: 2, position: [60 + (i % 20) * 0.4, moving ? 1 + (i % 5) * 0.3 : 0.04, Math.floor(i / 20) * 0.4], sleeping: !moving, continuous: moving,
      linearVelocity: moving ? [(i % 7) - 3, 2, (i % 5) - 2] : [0, 0, 0], layer: 'debris', user: 1000 + i,
    })
  }
  world.createBodies(debris)
  const pose = new Float64Array(7)
  let peak = world.memoryInUse()
  for (let f = 0; f < 300; f++) {
    if (f === 30) {
      for (const id of cascadeIds) {
        world.readPose(id, pose, 0)
        const d: Vec3 = [pose[0] - 0.5, pose[1] - 0.3, pose[2] - 1.2]
        const l = Math.hypot(...d) || 1
        const k = 2500 * Math.max(0.05, 1 - l / 12)
        world.addImpulse(id, [(d[0] / l) * k, (d[1] / l) * k, (d[2] / l) * k])
      }
    }
    world.step(1 / 60)
    peak = Math.max(peak, world.memoryInUse())
  }
  const bodies = world.bodyCount
  world.dispose()
  const after = engine.createWorld({}) as JoltWorld
  const used1 = after.memoryInUse()
  after.dispose()
  return { peak, total, before: used0, after: used1, bodies }
}

describe('gate 0 B4: wasm heap', () => {
  it('the worst scene in one world stays under half the heap, and five of them made and thrown away give the heap back', { timeout: 300000 }, async () => {
    const runs = []
    for (let i = 0; i < 5; i++) runs.push(await worst())
    const mb = (x: number): number => Math.round((x / 1048576) * 10) / 10
    report('heap-worst', { totalMB: mb(runs[0].total), bodies: runs[0].bodies, peakInUseMB: runs.map((r) => mb(r.peak)), peakShare: Math.round((runs[0].peak / runs[0].total) * 1000) / 1000, beforeBytes: runs.map((r) => r.before), afterBytes: runs.map((r) => r.after) })
    for (const r of runs) expect(r.peak).toBeLessThan(r.total * 0.5)
    // C9: after the first (which leaves Jolt's one-time allocations behind), every made-and-thrown-away world hands the heap back to the byte
    for (const r of runs.slice(1)) {
      expect(r.before).toBe(runs[0].after)
      expect(r.after).toBe(runs[0].after)
    }
    expect(runs[0].after - runs[0].before).toBeLessThan(4096)
  })
})

const CYCLES = 20

/** One warm-up pass (Jolt grows its arrays and caches once), then `CYCLES` more: the heap in use before each must be the same byte. */
const bytesPerCycle = (world: JoltWorld, cycle: (i: number) => void): number[] => {
  cycle(0)
  const before: number[] = []
  for (let i = 1; i <= CYCLES; i++) {
    before.push(world.memoryInUse())
    cycle(i)
  }
  before.push(world.memoryInUse())
  return before
}

const expectFlat = (name: string, world: JoltWorld, cycle: (i: number) => void): void => {
  const used = bytesPerCycle(world, cycle)
  report(`heap-cycles-${name}`, { cycles: CYCLES, startBytes: used[0], endBytes: used[used.length - 1], perCycle: (used[used.length - 1]! - used[0]!) / CYCLES })
  console.log(name, used.join(","))
  for (const bytes of used) expect(bytes).toBe(used[0])
}

const ragdollDesc = (at: Vec3): RagdollDesc => ({
  stabilize: true,
  parts: [
    { body: { shape: { kind: 'capsule', halfHeight: 0.25, radius: 0.17 }, mass: 40, position: [at[0], at[1] + 1.25, at[2]], layer: 'character', user: 1 }, parent: -1 },
    { body: { shape: { kind: 'sphere', radius: 0.11 }, mass: 5, position: [at[0], at[1] + 1.75, at[2]], layer: 'character', user: 1 }, parent: 0, joint: { kind: 'swingTwist', point: [at[0], at[1] + 1.62, at[2]], twistAxis: [0, 1, 0], planeAxis: [0, 0, 1], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5 } },
    { body: { shape: { kind: 'box', half: [0.1, 0.3, 0.1] }, mass: 25, position: [at[0], at[1] + 0.45, at[2]], layer: 'character', user: 1 }, parent: 0, joint: { kind: 'hinge', point: [at[0], at[1] + 0.92, at[2]], axis: [1, 0, 0], normal: [0, 1, 0], min: -1, max: 1 } },
  ],
})

const vehicleDesc: VehicleDesc = {
  chassis: { shape: { kind: 'box', half: [0.8, 0.3, 2] }, motion: 'dynamic', position: [0, 1, 0], mass: 1000, user: 2 },
  wheels: [[0.7, 1.4], [-0.7, 1.4], [0.7, -1.4], [-0.7, -1.4]].map(([x, z], i) => ({
    position: [x!, -0.3, z!] as Vec3, radius: 0.3, width: 0.2, suspensionMin: 0.05, suspensionMax: 0.25, frequency: 1.5, damping: 0.5,
    maxSteer: i < 2 ? 0.6 : 0, driven: i < 2, maxBrakeTorque: 1500, maxHandBrakeTorque: i < 2 ? 0 : 4000,
  })),
  maxTorque: 160, minRpm: 1000, maxRpm: 6000, gears: [3.5, 2.0, 1.4], reverseGears: [-3.3], differentialRatio: 4.2, antiRoll: 1000,
}

describe('C9: every Jolt object the adapter makes is destroyed (heap in cycles)', () => {
  const made = async (): Promise<{ engine: Awaited<ReturnType<typeof createJoltEngine>>; world: JoltWorld }> => {
    const engine = await createJoltEngine()
    const world = engine.createWorld() as JoltWorld
    ground(world, 50)
    return { engine, world }
  }
  const pair = (world: JoltWorld): [BodyId, BodyId] => [
    world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'static', position: [10, 1, 0], user: 0 }),
    world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 5, position: [10.5, 1, 0], user: 0 }),
  ]

  it('ragdoll create and remove', async () => {
    const { world } = await made()
    expectFlat('ragdoll', world, () => {
      const doll = world.createRagdoll(ragdollDesc([0, 0, 0]))
      world.step(1 / 30)
      world.removeRagdoll(doll.id)
    })
    world.dispose()
  })

  it('vehicle create and remove', async () => {
    const { world } = await made()
    expectFlat('vehicle', world, () => {
      const car = world.createVehicle(vehicleDesc)
      world.driveVehicle(car, { forward: 1, right: 0.2, brake: 0, handBrake: 0 })
      world.step(1 / 30)
      world.removeVehicle(car)
    })
    world.dispose()
  })

  it('each joint kind, create and remove', async () => {
    const { world } = await made()
    const joints = (a: BodyId, b: BodyId): JointDesc[] => [
      { kind: 'fixed', a, b, point: [10, 1, 0], breakImpulse: 100 },
      { kind: 'hinge', a, b, point: [10, 1, 0], axis: [0, 1, 0], normal: [1, 0, 0], min: -1, max: 1, friction: 1 },
      { kind: 'swingTwist', a, b, point: [10, 1, 0], twistAxis: [1, 0, 0], planeAxis: [0, 1, 0], normalHalfCone: 0.5, planeHalfCone: 0.5, twistMin: -0.5, twistMax: 0.5, friction: 1 },
      { kind: 'slider', a, b, point: [10, 1, 0], axis: [1, 0, 0], min: 0, max: 0.4, friction: 1 },
    ]
    for (const kind of ['fixed', 'hinge', 'swingTwist', 'slider'] as const) {
      expectFlat(`joint-${kind}`, world, () => {
        const [a, b] = pair(world)
        const desc = joints(a, b).find((j) => j.kind === kind)!
        const id = world.createJoint(desc)
        world.step(1 / 30)
        world.removeJoint(id)
        world.removeBody(b)
        world.removeBody(a)
      })
    }
    world.dispose()
  })

  it('collision group create and release, with bodies in it, and the index is reused', async () => {
    const { world } = await made()
    let firstId = -1
    expectFlat('group', world, () => {
      const group = world.createGroup(3, [[0, 1], [1, 2]])
      if (firstId < 0) firstId = group
      expect(group).toBe(firstId)
      const bodies = [0, 1, 2].map((sub) => world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 1, position: [10 + sub, 3, 0], group: { id: group, sub }, user: 6 }))
      world.step(1 / 30)
      for (const body of bodies) world.removeBody(body)
      world.releaseGroup(group)
    })
    world.dispose()
  })

  it('sensor create and remove', async () => {
    const { world } = await made()
    expectFlat('sensor', world, () => {
      const sensor = world.createBody({ shape: { kind: 'sphere', radius: 1 }, motion: 'static', layer: 'sensor', position: [0, 1, 0], user: 3 })
      const probe = world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 1, position: [0, 1, 0], user: 4 })
      world.step(1 / 30)
      world.removeBody(probe)
      world.removeBody(sensor)
    })
    world.dispose()
  })

  it('setShape on a dynamic body, repeatedly', async () => {
    const { world } = await made()
    const piece = world.createBody({ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, motion: 'dynamic', mass: 2, position: [0, 3, 0], user: 5 })
    const box: ShapeDesc = { kind: 'box', half: [0.1, 0.1, 0.1] }
    const compound: ShapeDesc = { kind: 'compound', children: [{ shape: { kind: 'box', half: [0.1, 0.05, 0.1] }, position: [0, 0, 0], tag: 0 }] }
    // the heap holds a compound 8 bytes above a box, so a cycle ends on the shape it began with
    expectFlat('setShape', world, () => {
      world.setShape(piece, compound)
      world.setShape(piece, box, { mass: 2, inertia: [0.01, 0.02, 0.03] })
      world.setShape(piece, compound, { mass: 3 })
      world.setShape(piece, box, { mass: 2 })
    })
    world.dispose()
  })

  it('character create and dispose', async () => {
    const { world } = await made()
    expectFlat('character', world, () => {
      const character = world.createCharacter(WALKER)
      world.moveCharacter(character, 1, 0, 1 / 60)
      world.step(1 / 60)
      world.removeCharacter(character)
      world.removeCharacter(character)
    })
    world.dispose()
  })

  it('a physics loop made, given a phase, stepped, and let go', async () => {
    const { engine, world } = await made()
    expectFlat('loop', world, () => {
      const other = engine.createWorld() as JoltWorld
      const loop = createPhysicsLoop(other)
      const remove = loop.add({ beforeStep: () => undefined }, 'actors')
      loop.step(1 / 30)
      remove()
      other.dispose()
    })
    world.dispose()
  })

  it('saveState and restoreState', async () => {
    const { world } = await made()
    world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 5, position: [0, 2, 0], user: 6 })
    expectFlat('state', world, () => {
      const saved = world.saveState()
      world.step(1 / 30)
      expect(world.restoreState(saved)).toBe(true)
    })
    world.dispose()
  })

  it('a world made and disposed gives the heap back to the byte', async () => {
    const engine = await createJoltEngine()
    const holder = engine.createWorld() as JoltWorld
    expectFlat('world', holder, () => {
      const world = engine.createWorld() as JoltWorld
      ground(world, 10)
      world.createRagdoll(ragdollDesc([0, 0, 0]))
      world.createVehicle(vehicleDesc)
      world.createCharacter({ ...WALKER, position: [4, 0, 0] })
      world.step(1 / 30)
      world.dispose()
    })
    holder.dispose()
  })
})

/**
 * The cycles of a body whose shape or mass is changed again and again: the allocator's overhead moves by a block header (8 to 16 bytes) with the order things were freed
 * in, up and down, so a sample may sit that far from the first. A leak only goes up: every sample stays within 32 bytes of the first, after three warm-up passes.
 */
const expectNoGrowth = (name: string, world: JoltWorld, cycle: (i: number) => void): void => {
  for (let i = 0; i < 3; i++) cycle(i)
  const used = bytesPerCycle(world, cycle)
  report(`heap-cycles-${name}`, { cycles: CYCLES, startBytes: used[0], endBytes: used[used.length - 1], lowest: Math.min(...used), highest: Math.max(...used) })
  for (const bytes of used) expect(Math.abs(bytes - used[0]!)).toBeLessThanOrEqual(32)
}

const parkedHulls: ShapeDesc = {
  kind: 'compound',
  children: Array.from({ length: 12 }, (_, i) => ({ shape: { kind: 'box', half: [0.2, 0.2, 0.4] } as ShapeDesc, position: [(i % 3) * 0.5 - 0.5, 0.2, Math.floor(i / 3) * 0.9 - 1.3] as Vec3, tag: i })),
}

describe('T6.1b: what a car needs of the contract leaves the heap as it found it (heap in cycles)', () => {
  const made = async (): Promise<JoltWorld> => {
    const world = (await createJoltEngine()).createWorld() as JoltWorld
    ground(world, 50)
    return world
  }

  it('a shared shape, many bodies from it, taken away (released while bodies still use it)', async () => {
    const world = await made()
    expectFlat('shared-shape', world, () => {
      const shared = world.createSharedShape(parkedHulls)
      const cars = Array.from({ length: 20 }, (_, i) => world.createBody({ shape: { kind: 'shared', id: shared }, motion: 'dynamic', mass: 800, position: [(i % 5) * 4, 1, Math.floor(i / 5) * 6], sleeping: true, user: i }))
      world.step(1 / 30)
      world.releaseSharedShape(shared)
      for (const car of cars) world.removeBody(car)
    })
    world.dispose()
  })

  it('children of a damaged car taken out, replaced and moved again and again', async () => {
    const world = await made()
    const shared = world.createSharedShape(parkedHulls)
    // the first damage (the copy of the shared shape) is the warm-up pass; a body that had its shape changed and then goes leaves 8 bytes in the wasm heap (`setShape` does the
    // same, jolt-physics 1.1.1), so the car stays: what a cycle must not do is grow
    const car = world.createBody({ shape: { kind: 'shared', id: shared }, motion: 'dynamic', mass: 800, position: [0, 1, 0], sleeping: true, user: 1 })
    expectNoGrowth('child-shape', world, (i) => {
      world.setChildShape(car, 3 + (i % 2), { kind: 'box', half: [0.2, 0.1 + 0.01 * (i % 2), 0.4] }, { position: [0, 0.2, 0] })
      world.setChildShape(car, 7, { kind: 'box', half: [0.2, 0.2, 0.4] })
      // two steps: the broadphase frees what the changes left behind on the next one
      world.step(1 / 30)
      world.step(1 / 30)
    })
    world.dispose()
  })

  it('200 parked cars from one shared shape, and the same 200 each with a shape of its own, then all gone', async () => {
    const world = await made()
    const used = (): number => world.memoryInUse()
    const base = used()
    const shared = world.createSharedShape(parkedHulls)
    const afterShape = used()
    const cars = Array.from({ length: 200 }, (_, i) => world.createBody({ shape: { kind: 'shared', id: shared }, motion: 'dynamic', mass: 800, position: [(i % 20) * 4, 1, Math.floor(i / 20) * 6], sleeping: true, user: i }))
    const sharedBytes = used() - afterShape
    for (const car of cars) world.removeBody(car)
    world.releaseSharedShape(shared)
    const own = Array.from({ length: 200 }, (_, i) => world.createBody({ shape: parkedHulls, motion: 'dynamic', mass: 800, position: [(i % 20) * 4, 1, Math.floor(i / 20) * 6], sleeping: true, user: i }))
    const ownBytes = used() - base
    for (const car of own) world.removeBody(car)
    report('heap-parked-cars', { carsSharing: 200, bytesPerCarSharing: Math.round(sharedBytes / 200), bytesPerCarOwnShape: Math.round(ownBytes / 200) })
    // sharing the shape, a car costs its body: the 12 hulls are not made again
    expect(sharedBytes / 200).toBeLessThan(ownBytes / 200 / 2)
    expect(used()).toBe(base)
    world.dispose()
  })

  it('mass properties with a moved centre of mass, set again and again', async () => {
    const world = await made()
    const car = world.createBody({ shape: { ...parkedHulls, mutable: true } as ShapeDesc, motion: 'dynamic', mass: 800, inertia: [200, 300, 250], position: [0, 2, 0], user: 1 })
    expectNoGrowth('mass-properties', world, () => {
      world.setMassProperties(car, { mass: 700, inertia: [200, 300, 250], centreOfMass: [0.05, 0.2, 0] })
      world.step(1 / 30)
      world.setMassProperties(car, { mass: 800, inertia: [200, 300, 250], centreOfMass: [0, 0.25, 0] })
      world.step(1 / 30)
      world.step(1 / 30)
    })
    world.dispose()
  })

  it('watching contacts, reading them and not watching, and a vehicle made again, its wheels read', async () => {
    const world = await made()
    const box = world.createBody({ shape: { kind: 'box', half: [0.4, 0.4, 0.4] }, motion: 'dynamic', mass: 10, position: [8, 0.5, 0], user: 4 })
    const out = new Float32Array(7 * 16)
    const wheels = new Float64Array(11 * 4)
    expectFlat('watch-and-rebuild', world, () => {
      world.watchContacts(box, true)
      world.step(1 / 30)
      world.readContacts(box, out)
      world.watchContacts(box, false)
      const car = world.createVehicle(vehicleDesc)
      world.step(1 / 30)
      world.vehicleWheels(car, wheels)
      world.rebuildVehicle(car, { ...vehicleDesc, wheels: vehicleDesc.wheels.slice(0, 3) })
      world.step(1 / 30)
      world.vehicleWheels(car, wheels)
      world.removeVehicle(car)
    })
    world.dispose()
  })
})

describe('T6.1b part 2: controllers, curves and buoyancy leave the heap as they found it (heap in cycles)', () => {
  const made = async (): Promise<JoltWorld> => {
    const world = (await createJoltEngine()).createWorld() as JoltWorld
    ground(world, 50)
    return world
  }

  const tracked: VehicleDesc = {
    ...vehicleDesc,
    controller: 'tracked',
    wheels: [-1, 1].flatMap((side) => [1.2, 0.4, -0.4, -1.2].map((z) => ({ position: [side * 1.2, -0.3, z] as Vec3, radius: 0.35, width: 0.5, suspensionMin: 0.05, suspensionMax: 0.3, frequency: 1.2, damping: 0.6, maxSteer: 0, driven: false, maxBrakeTorque: 3000, maxHandBrakeTorque: 0 }))),
    tracks: [{ wheels: [0, 1, 2, 3], drivenWheel: 3 }, { wheels: [4, 5, 6, 7], drivenWheel: 7 }],
  }
  const motorcycle: VehicleDesc = {
    ...vehicleDesc,
    controller: 'motorcycle',
    motorcycle: { maxLeanAngle: 0.6, leanSpring: 500, leanDamping: 50 },
    wheels: [0.7, -0.7].map((z) => ({ position: [0, 0.1, z] as Vec3, radius: 0.3, width: 0.12, suspensionMin: 0.1, suspensionMax: 0.3, frequency: 2, damping: 0.5, maxSteer: z > 0 ? 0.5 : 0, driven: z < 0, maxBrakeTorque: 500, maxHandBrakeTorque: 0 })),
  }
  const curved: VehicleDesc = {
    ...vehicleDesc,
    torqueCurve: [[0, 0.6], [0.5, 1], [1, 0.75]],
    transmission: { shiftUpRpm: 5000, shiftDownRpm: 2000, switchTime: 0.3 },
    differentials: [{ left: 0, right: 1, limitedSlip: 1.4, torqueShare: 0.5 }, { left: 2, right: 3, torqueShare: 0.5 }],
    wheels: vehicleDesc.wheels.map((wheel) => ({ ...wheel, longitudinalFriction: [[0, 0], [0.06, 1.2], [1, 1]] as const, lateralFriction: [[0, 0], [3, 1.2], [20, 1], [90, 0.8]] as const })),
  }

  for (const [name, desc] of [['tracked', tracked], ['motorcycle', motorcycle], ['curves, transmission and differentials', curved]] as const) {
    it(`a ${name} vehicle made, driven, made again and removed`, async () => {
      const world = await made()
      expectFlat(`controller-${name}`, world, () => {
        const vehicle = world.createVehicle(desc)
        world.driveVehicle(vehicle, { forward: 1, right: 0.3, brake: 0, handBrake: 0 })
        world.step(1 / 30)
        world.rebuildVehicle(vehicle, desc)
        world.step(1 / 30)
        world.removeVehicle(vehicle)
      })
      world.dispose()
    })
  }

  it('buoyancy applied to a floating body, repeatedly', async () => {
    const world = await made()
    const body = world.createBody({ shape: { kind: 'box', half: [1, 0.25, 2] }, motion: 'dynamic', mass: 500, position: [8, -0.1, 0], user: 7 })
    expectFlat('buoyancy', world, () => {
      for (let i = 0; i < 4; i++) {
        world.applyBuoyancy(body, { surface: [0, 0, 0], normal: [0, 1, 0], buoyancy: 1.1, linearDrag: 0.5, angularDrag: 0.5, flow: [1, 0, 0] })
        world.step(1 / 60)
      }
    })
    world.dispose()
  })
})
