import { appendFileSync } from 'node:fs'
import { PerformanceObserver } from 'node:perf_hooks'

import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const stats = (xs: number[]): { median: number; p90: number; p99: number } => {
  const s = [...xs].sort((a, b) => a - b)
  const at = (q: number): number => Math.round((s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0) * 1000) / 1000
  return { median: at(0.5), p90: at(0.9), p99: at(0.99) }
}

// spike bench: BENCH=1 to run (node timing, not a gate)
describe.runIf(process.env.BENCH === '1')('debris cost', () => {
  it('160 pieces at rest + 40 moving: ms per renderer.update', { timeout: 120000 }, async () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
    let seed = 7
    const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
    const ids: string[] = []
    for (let i = 0; i < 200; i++) {
      const id = `p${i}`
      const size: [number, number, number] = [0.1 + rnd() * 0.3, 0.05 + rnd() * 0.15, 0.1 + rnd() * 0.3]
      world.addObject(id, [partState('body', 'concrete', { mass: size[0] * size[1] * size[2] * 2400 })])
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
      const root = new THREE.Group()
      root.add(mesh)
      // 160 spread over the floor, 40 in a heap that keeps moving
      if (i < 160) root.position.set((i % 16) * 0.8 - 6, size[1] / 2 + 0.001, Math.floor(i / 16) * 0.8 - 4)
      else root.position.set(8 + rnd(), 0.2 + (i - 160) * 0.25, rnd())
      root.rotation.set(0, rnd() * 3, 0)
      scene.add(root)
      root.updateMatrixWorld(true)
      renderer.bind(id, root, { parts: { body: mesh } })
      renderer.makePiece(id)
      ids.push(id)
    }
    for (let i = 0; i < 180; i++) renderer.update(1 / 60)
    const times: number[] = []
    // the collector's pauses in the measured updates (minor and major), by duration
    const pauses: number[] = []
    const gc = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) pauses.push(e.duration)
    })
    gc.observe({ entryTypes: ['gc'] })
    for (let i = 0; i < 200; i++) {
      // the 40 are kicked about so they never settle
      if (i % 20 === 0) for (let k = 160; k < 200; k++) renderer.impulse(ids[k], [(rnd() - 0.5) * 20, 10 + rnd() * 10, (rnd() - 0.5) * 20])
      const t0 = performance.now()
      renderer.update(1 / 60)
      times.push(performance.now() - t0)
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
    gc.disconnect()
    const sleeping = ids.slice(0, 160).filter((id) => renderer.piece(id)?.sleeping).length
    const line = JSON.stringify({ name: 'debris-160-40', solver: process.env.PIECE_SOLVER ?? 'own', sleepingOf160: sleeping, update: stats(times), gc: { pauses: pauses.length, over1ms: pauses.filter((d) => d > 1).length, max: Math.round(Math.max(0, ...pauses) * 1000) / 1000 } })
    console.log(line)
    if (process.env.SPIKE_OUT) appendFileSync(process.env.SPIKE_OUT, `${line}\n`)
    expect(times.length).toBe(200)
  })
})
