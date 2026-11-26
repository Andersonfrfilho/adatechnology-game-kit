import { performance } from 'node:perf_hooks'

import { describe, expect, it } from 'vitest'

import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec, Vec3 as DVec3 } from '@adatechnology/game-destruction'
import type { BodyId, RayHit, Vec3 } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import { expectCostAtMost, ground, report, stats } from './scenes'

/** A house shell as wall panels (1 x 1 m, 20 cm thick) on a 10 x 8 m plan, two storeys: 288 boxes, plus a slab per storey. */
const housePanels = (ox: number, oz: number): Array<{ center: Vec3; half: Vec3 }> => {
  const out: Array<{ center: Vec3; half: Vec3 }> = []
  for (let storey = 0; storey < 2; storey++) {
    for (let y = 0; y < 3; y++) {
      const cy = storey * 3 + y + 0.5
      for (let i = 0; i < 10; i++) {
        out.push({ center: [ox + i + 0.5, cy, oz], half: [0.5, 0.5, 0.1] }, { center: [ox + i + 0.5, cy, oz + 8], half: [0.5, 0.5, 0.1] })
      }
      for (let k = 0; k < 8; k++) out.push({ center: [ox, cy, oz + k + 0.5], half: [0.1, 0.5, 0.5] }, { center: [ox + 10, cy, oz + k + 0.5], half: [0.1, 0.5, 0.5] })
    }
    out.push({ center: [ox + 5, storey * 3 + 3, oz + 4], half: [5, 0.1, 4] })
  }
  return out
}

const HOUSES: Array<[number, number]> = [[-30, -20], [0, -20], [30, -20]]
const CAR = { half: [0.865, 0.36, 2.1] as Vec3 }

/** 1000 shots a frame from where a crowd stands, toward the houses and the street. */
const shots = (n: number): Array<{ from: Vec3; dir: Vec3 }> => {
  let s = 3
  const r = (): number => (s = (s * 16807) % 2147483647) / 2147483647
  return Array.from({ length: n }, () => {
    const from: Vec3 = [(r() - 0.5) * 80, 1.5, (r() - 0.5) * 30 + 5]
    const a = r() * Math.PI * 2
    const d: Vec3 = [Math.cos(a), (r() - 0.5) * 0.3, Math.sin(a)]
    const l = Math.hypot(...d)
    return { from, dir: [d[0] / l, d[1] / l, d[2] / l] }
  })
}

describe('case 6: ballistics and queries', () => {
  it('1000 multi-hit rays a frame and one blast, in a street of 3 houses, 10 cars and 300 crowd agents; against our own ray path', async () => {
    const engine = await createJoltEngine()
    const world = engine.createWorld({ fixedStep: 1 / 60, maxBodies: 8192 })
    ground(world, 200)
    // one static body per house, its panels as children: the tag of a child is our part id
    let part = 0
    const partOf = new Map<number, string>()
    for (const [ox, oz] of HOUSES) {
      const panels = housePanels(ox, oz)
      world.createBody({
        shape: { kind: 'compound', children: panels.map((p) => { partOf.set(part, `house${ox}:${part}`); return { shape: { kind: 'box', half: p.half }, position: p.center, tag: part++ } }) },
        motion: 'static', position: [0, 0, 0], user: 1,
      })
    }
    const cars: BodyId[] = []
    for (let i = 0; i < 10; i++) {
      cars.push(world.createBody({ shape: { kind: 'compound', children: [{ shape: { kind: 'box', half: CAR.half }, position: [0, 0, 0], tag: 0 }, { shape: { kind: 'box', half: [0.75, 0.27, 1] }, position: [0, 0.63, -0.2], tag: 1 }] }, motion: 'dynamic', mass: 1034, position: [-35 + i * 7, 0.5, 2], layer: 'vehicle', user: 100 + i }))
    }
    const agents: BodyId[] = []
    for (let i = 0; i < 300; i++) agents.push(world.createBody({ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, motion: 'kinematic', position: [(i % 30) * 2.5 - 37, 0.85, Math.floor(i / 30) * 2 + 8], layer: 'agent', user: 1000 + i }))
    for (let i = 0; i < 60; i++) world.step(1 / 60)
    // the same street for our own ray path (game-destruction's world: its own broad phase over the parts)
    const dw = createDestruction()
    for (const [ox, oz] of HOUSES) {
      const spec: DestructibleSpec = { parts: housePanels(ox, oz).map((p, i) => ({ id: `p${i}`, material: 'brick', shape: { kind: 'box', size: [p.half[0] * 2, p.half[1] * 2, p.half[2] * 2] }, position: p.center as DVec3 })), joints: [] }
      dw.add(spec)
    }
    for (let i = 0; i < 10; i++) dw.add({ parts: [{ id: 'body', material: 'steel', shape: { kind: 'box', size: [1.73, 0.72, 4.2] }, position: [0, 0, 0] }, { id: 'cabin', material: 'glass', shape: { kind: 'box', size: [1.5, 0.54, 2] }, position: [0, 0.63, -0.2] }], joints: [] }, { position: [-35 + i * 7, 0.5, 2] })
    for (let i = 0; i < 300; i++) dw.add({ parts: [{ id: 'body', material: 'wood_soft', shape: { kind: 'box', size: [0.5, 1.7, 0.5] }, position: [0, 0, 0] }], joints: [] }, { position: [(i % 30) * 2.5 - 37, 0.85, Math.floor(i / 30) * 2 + 8] })

    const list = shots(1000)
    const hits: RayHit[] = []
    const frames = 20
    const all: number[] = []
    const first: number[] = []
    const ours: number[] = []
    let totalHits = 0
    let multi = 0
    for (let f = 0; f < frames; f++) {
      // the crowd moves every frame (kinematic, driven by game-crowd): the queries see it where it is
      for (const [k, a] of agents.entries()) world.moveKinematic(a, [(k % 30) * 2.5 - 37 + Math.sin(f / 10 + k) * 0.5, 0.85, Math.floor(k / 30) * 2 + 8], [0, 0, 0, 1], 1 / 60)
      world.step(1 / 60)
      let t0 = performance.now()
      for (const s of list) {
        const n = world.rayAll(s.from, s.dir, 60, hits)
        totalHits += n
        if (n > 1) multi++
      }
      all.push(performance.now() - t0)
      t0 = performance.now()
      for (const s of list) world.rayFirst(s.from, s.dir, 60)
      first.push(performance.now() - t0)
      t0 = performance.now()
      for (const s of list) dw.raycast(s.from as DVec3, s.dir as DVec3, 60)
      ours.push(performance.now() - t0)
    }
    // one blast: 300 Mott fragment rays, the parts in its radius, and a line of sight to each of them
    const blastAt: Vec3 = [5, 1, -10]
    const blast: number[] = []
    const near: BodyId[] = []
    let fragmentHits = 0
    for (let f = 0; f < frames; f++) {
      const t0 = performance.now()
      for (let i = 0; i < 300; i++) {
        const u = (i + 0.5) / 300
        const phi = Math.acos(1 - 2 * u)
        const th = Math.PI * (1 + Math.sqrt(5)) * i
        if (world.rayFirst(blastAt, [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)], 40)) fragmentHits++
      }
      const n = world.overlapSphere(blastAt, 8, near)
      for (let i = 0; i < n; i++) world.rayFirst(blastAt, [0, 1, 0], 8)
      blast.push(performance.now() - t0)
    }
    // buckshot and fragment thickness: a 1 cm sphere swept
    const sweep: RayHit[] = []
    const sphere: number[] = []
    for (let f = 0; f < 5; f++) {
      const t0 = performance.now()
      for (const s of list.slice(0, 200)) world.sphereCastAll(s.from, s.dir, 60, 0.01, sweep)
      sphere.push(performance.now() - t0)
    }
    // through several: a shot along the crowd's first row passes every agent in it and reports each, nearest first, with its user value
    const row: RayHit[] = []
    world.rayAll([-40, 0.85, 8], [1, 0, 0], 80, row, { layers: ['agent'] })
    // a body made this frame (debris of the very shot) and one asleep are found too
    const fresh = world.createBody({ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 5, position: [0, 5, 30], user: 9999 })
    const seesFresh = world.rayFirst([0, 10, 30], [0, -1, 0], 20)?.user === 9999
    const sleepingCar = world.isSleeping(cars[0])
    const seesSleeping = world.rayFirst([-35, 5, 2], [0, -1, 0], 10)?.user === 100
    // smoke: a sensor sphere the crowd walks through, entering and leaving
    const smoke = world.createBody({ shape: { kind: 'sphere', radius: 3 }, motion: 'static', position: [-30, 1, 10], layer: 'sensor', user: 7777 })
    let entered = 0
    let left = 0
    for (let f = 0; f < 120; f++) {
      for (const [k, a] of agents.entries()) world.moveKinematic(a, [(k % 30) * 2.5 - 37 + f * 0.1, 0.85, Math.floor(k / 30) * 2 + 8], [0, 0, 0, 1], 1 / 60)
      world.step(1 / 60)
      for (const e of world.sensorEvents) {
        if (e.sensor !== smoke) continue
        if (e.entered) entered++
        else left++
      }
    }
    const inSmoke: BodyId[] = []
    const inside = world.overlapSphere([-30, 1, 10], 3, inSmoke, { layers: ['agent'] })
    report('queries', {
      rays1000All: stats(all), rays1000First: stats(first), ours1000First: stats(ours), meanHitsPerRay: totalHits / (frames * 1000), raysWithMoreThanOneHit: multi / frames,
      blast300PlusOverlapLos: stats(blast), fragmentHitsPerBlast: fragmentHits / frames, partsInBlastRadius: near.length, sphereCast200: stats(sphere),
      rowAgentsHit: row.length, rowSorted: row.every((h, i) => i === 0 || h.distance >= row[i - 1].distance), rowUsers: row.slice(0, 3).map((h) => h.user),
      seesFresh, sleepingCar, seesSleeping, smokeEntered: entered, smokeLeft: left, agentsInSmokeNow: inside, bodies: world.bodyCount,
    })
    // spec.md 6: 1 000 first-hit rays in 2 ms (the cost lane), the spike's number being 1.6 ms
    expectCostAtMost(stats(first).median, 2)
    expect(row.length).toBe(30)
    expect(seesFresh && seesSleeping).toBe(true)
    expect(entered).toBeGreaterThan(0)
    world.removeBody(fresh)
    world.dispose()
  })
})

