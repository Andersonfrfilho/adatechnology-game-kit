import { performance } from 'node:perf_hooks'

import { describe, it } from 'vitest'

import { KIT_WORLD, PhysicsCostMeter, WakeQueue, chooseForPhysics, physicsPieceCount } from '@adatechnology/game-physics'
import type { BodyDesc, BodyId, Vec3, WorldDesc } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'
import { roll, updateFriction } from '../src/friction'
import { breakJoints } from '../src/joints'
import { ground, report, stats } from './scenes'

/**
 * Where the frame goes in the B6 scene (500 bodies woken by one blast), part by part: Jolt's `Step` (the listener's own time taken out when `timed`), the listener's JS,
 * `updateFriction`, `roll`, `breakJoints`, and reading every body's pose back. Each fixed step is run by hand, as `stepFixed` runs it. Modes: `plain` is the kit's
 * world; `timed` also times each listener callback (the timers cost: read it as an upper bound); `noop` leaves the listener's four callbacks empty (what crossing into
 * JS alone costs); `none` has no listener (and so no touching, no friction work). `PROFILE=1` to run; `PROFILE_RUNS` runs each, interleaved.
 */
type Part = 'step' | 'listener' | 'friction' | 'roll' | 'joints' | 'readback' | 'wake' | 'frame'
type Mode = 'plain' | 'timed' | 'noop' | 'none'
type Frame = Record<Part, number>
const PARTS: readonly Part[] = ['step', 'listener', 'friction', 'roll', 'joints', 'readback', 'wake', 'frame']
const HEAD_FRAMES = 4
const CALLBACKS = ['OnContactAdded', 'OnContactPersisted', 'OnContactRemoved', 'OnContactValidate'] as const

const emptyFrame = (): Frame => Object.fromEntries(PARTS.map((part) => [part, 0])) as Frame

/** The player the wake queue serves first, 8 m from the blast (the bench's blast is at [0.5, 0.6, 1.2]). */
const PLAYER: Vec3 = [-6, 1, 6]

/** `budgeted`: the production recipe (the blast's count of pieces become bodies, the nearest the player first; the rest stay fixed); else all 500 are bodies. */
const scene = (world: JoltWorld, budgeted: boolean): { ids: ReturnType<JoltWorld['createBodies']>; pushes: Array<{ id: BodyId; impulse: Vec3 }> } => {
  ground(world, 100)
  const descs: BodyDesc[] = []
  const blocks: Array<{ at: Vec3; half: Vec3; mass: number; size: number; distance: number }> = []
  const block = (at: Vec3, half: Vec3, mass: number): void => {
    blocks.push({ at, half, mass, size: 2 * Math.max(...half), distance: Math.hypot(at[0] - PLAYER[0], at[1] - PLAYER[1], at[2] - PLAYER[2]) })
  }
  for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) block([c * 0.4 - 4 + (r % 2) * 0.2, 0.1 + r * 0.2, 0], [0.2, 0.1, 0.1], 38)
  for (let i = 0; i < 50; i++) block([(i % 10) - 4.5, 4.075, Math.floor(i / 10) * 0.4], [0.5, 0.075, 0.2], 150)
  for (let i = 0; i < 50; i++) block([(i % 10) * 0.8 - 4, 0.25, 2 + Math.floor(i / 10) * 0.6], [0.25, 0.25, 0.25], 20)
  const chosen = new Set(chooseForPhysics(blocks, budgeted ? physicsPieceCount({}, new PhysicsCostMeter().wakeCostPerBodyMs, 0) : blocks.length).physics)
  for (const b of blocks) {
    const dynamic = chosen.has(b)
    descs.push({ shape: { kind: 'box', half: b.half }, motion: dynamic ? 'dynamic' : 'static', ...(dynamic ? { mass: b.mass, sleeping: true } : {}), position: b.at, layer: 'debris', user: descs.length })
  }
  const ids = world.createBodies(descs).filter((_, i) => chosen.has(blocks[i] as (typeof blocks)[number]))
  for (let f = 0; f < 10; f++) world.step(1 / 60)
  const at: Vec3 = [0.5, 0.6, 1.2]
  const pose = new Float64Array(7)
  const pushes = ids.map((id) => {
    world.readPose(id, pose, 0)
    const d: Vec3 = [(pose[0] ?? 0) - at[0], (pose[1] ?? 0) - at[1] + 0.3, (pose[2] ?? 0) - at[2]]
    const l = Math.hypot(...d) || 1
    const k = 2500 * Math.max(0.05, 1 - l / 12)
    return { id, impulse: [(d[0] / l) * k, (d[1] / l) * k, (d[2] / l) * k] as Vec3 }
  })
  return { ids, pushes }
}

const run = async (desc: WorldDesc, mode: Mode, queued: boolean): Promise<{ head: Frame[]; rest: Record<Part, number[]> }> => {
  const engine = await createJoltEngine()
  const world = engine.createWorld(desc) as JoltWorld
  const { ids, pushes } = scene(world, queued)
  let listenerMs = 0
  const listener = world.listener as unknown as Record<string, (...args: unknown[]) => unknown>
  for (const name of CALLBACKS) {
    const original = listener[name] as (...args: unknown[]) => unknown
    if (mode === 'noop') listener[name] = () => (name === 'OnContactValidate' ? 0 : undefined)
    if (mode === 'timed') {
      listener[name] = (...args: unknown[]) => {
        const t = performance.now()
        const result = original(...args)
        listenerMs += performance.now() - t
        return result
      }
    }
  }
  if (mode === 'none') world.system.SetContactListener(null as never)
  const h = world.fixedStep
  const steps = Math.round(1 / 60 / h)
  const pose = new Float64Array(7)
  const head: Frame[] = []
  const rest = Object.fromEntries(PARTS.map((part) => [part, [] as number[]])) as Record<Part, number[]>
  const queue = new WakeQueue<() => void>()
  const meter = new PhysicsCostMeter()
  let lastStepMs = 0
  const poseOf = new Float64Array(7)
  if (queued) {
    for (const p of pushes) {
      world.readPose(p.id, poseOf, 0)
      queue.push(Math.hypot((poseOf[0] ?? 0) - PLAYER[0], (poseOf[1] ?? 0) - PLAYER[1], (poseOf[2] ?? 0) - PLAYER[2]), () => world.addImpulse(p.id, p.impulse))
    }
  }
  for (let f = 0; f < 180; f++) {
    const frame = emptyFrame()
    const wakeStart = performance.now()
    if (queued) for (const apply of queue.release(1 / 60, lastStepMs, meter.wakeCostPerBodyMs)) apply()
    else if (f === 0) for (const p of pushes) world.addImpulse(p.id, p.impulse)
    frame.wake = performance.now() - wakeStart
    listenerMs = 0
    const frameStart = performance.now()
    world.clearEvents()
    for (let s = 0; s < steps; s++) {
      world.stepCount++
      let t = performance.now()
      world.iface.Step(h, 1)
      frame.step += performance.now() - t
      t = performance.now()
      updateFriction(world)
      frame.friction += performance.now() - t
      t = performance.now()
      if (world.rollers.size > 0) roll(world, h)
      frame.roll += performance.now() - t
      t = performance.now()
      breakJoints(world, h)
      frame.joints += performance.now() - t
    }
    const readStart = performance.now()
    for (const id of ids) world.readPose(id, pose, 0)
    frame.readback = performance.now() - readStart
    frame.frame = performance.now() - frameStart
    lastStepMs = frame.frame - frame.readback
    meter.observe(lastStepMs, world.activeCount)
    frame.listener = listenerMs
    frame.step -= listenerMs
    if (f < HEAD_FRAMES) head.push(frame)
    else for (const part of PARTS) rest[part].push(frame[part])
  }
  world.dispose()
  return { head, rest }
}

const mean = (xs: readonly number[]): number => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 1000) / 1000
const VARIANTS: ReadonlyArray<readonly [string, WorldDesc, Mode, boolean]> = [
  ['kit 120 Hz, listener', KIT_WORLD, 'plain', false],
  ['kit 120 Hz, listener, wake queue', KIT_WORLD, 'plain', true],
  ['kit 120 Hz, listener timed', KIT_WORLD, 'timed', false],
  ['kit 120 Hz, listener empty', KIT_WORLD, 'noop', false],
  ['kit 120 Hz, no listener', KIT_WORLD, 'none', false],
  ['60 Hz, listener', { ...KIT_WORLD, fixedStep: 1 / 60 }, 'plain', false],
]

describe.runIf(process.env.PROFILE === '1')('step profile (B6 scene)', () => {
  it('per part: the first four frames, then the mean and p99 of the rest', { timeout: 900000 }, async () => {
    for (const [, desc, mode, queued] of VARIANTS) for (let i = 0; i < 2; i++) await run(desc, mode, queued)
    const results = VARIANTS.map(() => ({ heads: [] as Frame[][], rest: Object.fromEntries(PARTS.map((part) => [part, [] as number[]])) as Record<Part, number[]> }))
    for (let i = 0; i < Number(process.env.PROFILE_RUNS ?? 10); i++) {
      for (const [v, [, desc, mode, queued]] of VARIANTS.entries()) {
        const r = await run(desc, mode, queued)
        const into = results[v]
        if (!into) continue
        into.heads.push(r.head)
        for (const part of PARTS) into.rest[part].push(...r.rest[part])
      }
    }
    for (const [v, [name]] of VARIANTS.entries()) {
      const into = results[v]
      if (!into) continue
      const row: Record<string, unknown> = { variant: name }
      for (const part of PARTS) {
        const frames = [0, 1, 2, 3].map((f) => mean(into.heads.map((head) => head[f]?.[part] ?? 0)))
        row[part] = { frames, restMean: mean(into.rest[part]), restP99: stats(into.rest[part]).p99 }
      }
      report('step-profile', row)
    }
  })
})
