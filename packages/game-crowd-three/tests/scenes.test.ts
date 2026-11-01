import { undeadCrowdPack } from '@adatechnology/game-characters-undead'
import { CROWD_PHYSICS_DEFAULTS } from '@adatechnology/game-crowd'
import type { CrowdPack } from '@adatechnology/game-crowd'
import type { BenchChange, FramePhase, HostEvent, ModuleHost } from '@adatechnology/game-contracts'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createCrowdTestModule } from '../src/testing'

const pack = undeadCrowdPack() as unknown as CrowdPack
const STEP = 1 / 60

const fakeHost = () => {
  const frames: { phase: string; run: (dt: number) => void }[] = []
  const changes: ((change: BenchChange) => void)[] = []
  const listeners: ((event: HostEvent) => void)[] = []
  const host = {
    THREE,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    locale: 'en',
    groundAt: () => 0,
    on: (listener: (event: HostEvent) => void) => (listeners.push(listener), () => {}),
    onFrame: (run: (dt: number) => void, options?: { phase?: FramePhase }) => (frames.push({ phase: options?.phase ?? 'lateSimulate', run }), () => {}),
    log: () => {},
    bench: { value: () => undefined, layer: () => true, onChange: (listener: (change: BenchChange) => void) => (changes.push(listener), () => {}), patch: () => {}, look: () => {} },
  } as unknown as ModuleHost
  const run = (phase: FramePhase, dt: number): void => frames.filter((frame) => frame.phase === phase).forEach((frame) => frame.run(dt))
  return {
    host,
    run,
    set: (id: string, value: number | string | boolean) => changes.forEach((listener) => listener({ kind: 'control', id, value } as BenchChange)),
    emit: (event: HostEvent) => listeners.forEach((listener) => listener(event)),
  }
}

const physicsModule = () => createCrowdTestModule({ pack, crowdPhysics: CROWD_PHYSICS_DEFAULTS, seed: 21 })

describe('the crowd area with physics', () => {
  it('steps the crowd in the fixed phase only, one fixed step per call', () => {
    const module = physicsModule()
    const room = fakeHost()
    module.attach!(room.host)
    room.set('scene', 'dense_wall')
    room.set('count', 40)
    const z = Array.from({ length: 40 }, (_, i) => module.crowd.store.z[i])
    room.run('lateSimulate', 1 / 30)
    expect(Array.from({ length: 40 }, (_, i) => module.crowd.store.z[i])).toEqual(z)
    for (let step = 0; step < 120; step++) room.run('fixedSimulate', STEP)
    expect(Array.from({ length: 40 }, (_, i) => module.crowd.store.z[i])).not.toEqual(z)
  })

  it('without the physics the crowd steps in the frame, as before', () => {
    const module = createCrowdTestModule({ pack, startCount: 20, seed: 3 })
    const room = fakeHost()
    module.attach!(room.host)
    const x = Array.from({ length: 20 }, (_, i) => module.crowd.store.x[i])
    room.run('fixedSimulate', STEP)
    expect(Array.from({ length: 20 }, (_, i) => module.crowd.store.x[i])).toEqual(x)
    for (let frame = 0; frame < 60; frame++) room.run('lateSimulate', 1 / 30)
    expect(Array.from({ length: 20 }, (_, i) => module.crowd.store.x[i])).not.toEqual(x)
  })

  it('applies seed, scene, physics and count in that order: the scene is in the grid before the agents are born', () => {
    const module = createCrowdTestModule({ pack, seed: 1 })
    const room = fakeHost()
    module.attach!(room.host)
    const order = module.controls!('en').map((control) => control.id)
    expect(order.slice(0, 4)).toEqual(['seed', 'scene', 'physics', 'count'])
    for (const id of order.slice(0, 4)) room.set(id, { seed: 21, scene: 'dense_wall', physics: true, count: 200 }[id as 'seed']!)
    expect(module.crowd.store.n).toBe(200)
    expect(module.crowd.doors.list).toHaveLength(1)
    expect(Math.max(...Array.from({ length: 200 }, (_, i) => module.crowd.store.z[i]!))).toBeLessThan(-45)
    const kinds = new Set<number>()
    for (let x = -14; x < 14; x += 0.25) kinds.add(module.crowd.grid.cellKind(x, -45))
    expect(kinds.has(1)).toBe(true)
  })

  it('the same bench state gives the same horde', () => {
    const born = (): string => {
      const module = physicsModule()
      const room = fakeHost()
      module.attach!(room.host)
      room.set('scene', 'dense_wall')
      room.set('count', 100)
      return Array.from({ length: 100 }, (_, i) => `${module.crowd.store.x[i]},${module.crowd.store.z[i]},${module.crowd.store.type[i]}`).join(';')
    }
    expect(born()).toBe(born())
  })

  it('a blast the host reports reaches the crowd', () => {
    const module = physicsModule()
    const room = fakeHost()
    module.attach!(room.host)
    room.set('scene', 'chain_line')
    room.set('count', 60)
    const before = module.crowd.stats.kills
    room.emit({ type: 'explosion', source: 'frag_grenade', point: [0, 0.3, -56], energy: 200000, radius: 15, cause: 'thrown', explosive: 'frag_grenade' })
    for (let step = 0; step < 4; step++) room.run('fixedSimulate', STEP)
    expect(module.crowd.stats.kills).toBeGreaterThan(before)
  })

  it('publishes the behaviour counters the perf phases read', () => {
    const module = physicsModule()
    const ids = module.metrics!('en').map((metric) => metric.id)
    for (const id of ['falls_pressure', 'falls_chain', 'falls_landing', 'climbers', 'mound_max', 'thrown_peak', 'max_overlap', 'chain_links', 'crowd_ms_p99', 'draw_calls']) expect(ids).toContain(id)
  })
})
