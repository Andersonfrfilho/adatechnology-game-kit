import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-contracts'
import { createDestruction } from '@adatechnology/game-destruction'
import type { PhysicsWorld, Quat, RayHit, Vec3 } from '@adatechnology/game-physics'
import type { RapierWorld } from '../src/index'
import { fmt, loadEngine, stats } from './engines'

interface Box {
  readonly object: number
  readonly part: number
  readonly centre: Vec3
  readonly half: Vec3
  readonly yaw: number
}

/** 10 houses (30 boxes each: walls in 3 pieces, floor, roof, 16 furniture), 10 cars (6 boxes), 300 people (one box each, standing for a capsule), 100 debris: 820 parts. */
const scene = (): { boxes: Box[]; people: number[] } => {
  let s = 7
  const rnd = (): number => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  const boxes: Box[] = []
  let object = 0
  for (let h = 0; h < 10; h++) {
    const cx = (h % 5) * 16 - 32
    const cz = Math.floor(h / 5) * 20 - 10
    const yaw = rnd() * 0.6
    const o = object++
    let part = 0
    const add = (c: Vec3, half: Vec3): void => {
      const cs = Math.cos(yaw), sn = Math.sin(yaw)
      boxes.push({ object: o, part: part++, centre: [cx + c[0] * cs + c[2] * sn, c[1], cz - c[0] * sn + c[2] * cs], half, yaw })
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) add([side * 4, 1.4, -3 + k * 3], [0.1, 1.4, 1.5])
    }
    for (const side of [-1, 1]) {
      add([-2.7, 1.4, side * 4.5], [1.3, 1.4, 0.1])
      add([2.7, 1.4, side * 4.5], [1.3, 1.4, 0.1])
      add([0, 2.4, side * 4.5], [1.4, 0.4, 0.1])
    }
    add([0, 0.05, 0], [4, 0.05, 4.5])
    add([0, 2.85, 0], [4.2, 0.05, 4.7])
    for (let k = 0; k < 16; k++) add([(rnd() - 0.5) * 6, 0.4, (rnd() - 0.5) * 7], [0.2 + rnd() * 0.5, 0.3 + rnd() * 0.4, 0.2 + rnd() * 0.4])
  }
  for (let c = 0; c < 10; c++) {
    const o = object++
    const x = c * 6 - 30
    const z = 2
    let part = 0
    for (const [dx, dy, hx, hy] of [[0, 0.58, 2.3, 0.32], [-0.2, 1.17, 1.2, 0.27], [1.3, 0.32, 0.33, 0.33], [-1.4, 0.32, 0.33, 0.33], [2.2, 0.6, 0.1, 0.2], [-2.2, 0.6, 0.1, 0.2]]) boxes.push({ object: o, part: part++, centre: [x + dx, dy, z], half: [hx, hy, 0.89], yaw: 0 })
  }
  const people: number[] = []
  for (let p = 0; p < 300; p++) {
    people.push(object)
    boxes.push({ object: object++, part: 0, centre: [(rnd() - 0.5) * 80, 0.85, (rnd() - 0.5) * 40], half: [0.25, 0.85, 0.25], yaw: 0 })
  }
  for (let d = 0; d < 100; d++) boxes.push({ object: object++, part: 0, centre: [(rnd() - 0.5) * 80, 0.1, (rnd() - 0.5) * 40], half: [0.1, 0.1, 0.1], yaw: rnd() * 3 })
  return { boxes, people }
}

const yawQ = (yaw: number): Quat => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)]

const rays = (n: number, seed: number): Array<{ o: Vec3; d: Vec3 }> => {
  let s = seed
  const rnd = (): number => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
  return Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2
    const e = (rnd() - 0.5) * 0.2
    return { o: [(rnd() - 0.5) * 80, 0.4 + rnd() * 1.6, (rnd() - 0.5) * 40] as Vec3, d: [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)] as Vec3 }
  })
}

const buildEngine = (w: PhysicsWorld, boxes: readonly Box[], people: readonly number[]): Map<number, number> => {
  const byObject = new Map<number, Box[]>()
  for (const b of boxes) byObject.set(b.object, [...(byObject.get(b.object) ?? []), b])
  const bodies = new Map<number, number>()
  const peopleSet = new Set(people)
  for (const [object, parts] of byObject) {
    const kinematic = peopleSet.has(object)
    const first = parts[0]
    const body = w.createBody({
      kind: kinematic ? 'kinematic' : parts.length === 1 && first.half[0] < 0.2 ? 'dynamic' : 'fixed',
      position: kinematic || parts.length === 1 ? first.centre : [0, 0, 0],
      colliders: parts.map((b) =>
        kinematic
          ? { shape: { kind: 'capsule' as const, halfHeight: 0.6, radius: 0.25 }, tag: object * 512 + b.part }
          : { shape: { kind: 'box' as const, half: b.half }, offset: parts.length === 1 ? undefined : b.centre, rotation: yawQ(b.yaw), tag: object * 512 + b.part },
      ),
    })
    bodies.set(object, body)
  }
  return bodies
}

const hits = (n: number): RayHit[] => Array.from({ length: n }, () => ({ tag: 0, body: 0, distance: 0, normal: [0, 0, 0] }))

describe('case 6: ballistics and queries', () => {
  it('multi-hit rays, a blast, sphere casts and smoke sensors over houses, cars and 300 people; against the kit ray path', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0] }) as RapierWorld
    const { boxes, people } = scene()
    const t0 = performance.now()
    const bodies = buildEngine(w, boxes, people)
    const buildMs = performance.now() - t0
    w.step(1 / 60)
    // let the debris sleep: queries must still see it
    for (let f = 0; f < 120; f++) w.step(1 / 60)
    const list = rays(1000, 3)
    const out = hits(16)
    // 1 000 rays a frame, every hit along each (a shot through people, a wall, a car), sorted, each hit's tag the kit's object and part
    const frame: number[] = []
    let total = 0
    let withMany = 0
    for (let rep = 0; rep < 20; rep++) {
      const ta = performance.now()
      for (const r of list) {
        const n = w.rayAll(r.o, r.d, 60, out)
        if (rep === 0) {
          total += n
          if (n >= 3) withMany++
        }
      }
      frame.push(performance.now() - ta)
    }
    // one blast: 300 fragment rays (first hit), every part within 8 m, 50 lines of sight
    const blastAt: Vec3 = [-30, 1, -10]
    const fr = rays(300, 9).map((r) => ({ o: blastAt, d: r.d }))
    const blast: number[] = []
    const ids = new Int32Array(1024)
    let inRadius = 0
    for (let rep = 0; rep < 20; rep++) {
      const ta = performance.now()
      for (const r of fr) w.rayFirst(r.o, r.d, 40, out[0])
      inRadius = w.overlapSphere(blastAt, 8, ids)
      for (let k = 0; k < 50; k++) w.rayFirst(blastAt, list[k].d, 30, out[0])
      blast.push(performance.now() - ta)
    }
    // buckshot thickness: 100 sphere casts of 4 mm
    const cast: number[] = []
    for (let rep = 0; rep < 20; rep++) {
      const ta = performance.now()
      for (let k = 0; k < 100; k++) w.sphereCast(list[k].o, list[k].d, 0.004, 60)
      cast.push(performance.now() - ta)
    }
    // the kit's own ray path (game-destruction raycastInternal), the same parts, first hit only
    const kit = createDestruction({ seed: 1 })
    const byObject = new Map<number, Box[]>()
    for (const b of boxes) byObject.set(b.object, [...(byObject.get(b.object) ?? []), b])
    for (const [object, parts] of byObject) {
      const spec: DestructibleSpec = { name: `o${object}`, parts: parts.map((b) => ({ id: `p${b.part}`, material: 'concrete', shape: { kind: 'box', size: [b.half[0] * 2, b.half[1] * 2, b.half[2] * 2] }, position: [...b.centre], rotation: [0, b.yaw, 0] as Vec3, anchored: true })) }
      kit.add(spec, { id: `o${object}`, position: [0, 0, 0], rotation: [0, 0, 0, 1] })
    }
    const kitFrame: number[] = []
    for (let rep = 0; rep < 5; rep++) {
      const ta = performance.now()
      for (const r of list) kit.raycast(r.o, r.d, 60)
      kitFrame.push(performance.now() - ta)
    }
    const engineFirst: number[] = []
    for (let rep = 0; rep < 20; rep++) {
      const ta = performance.now()
      for (const r of list) w.rayFirst(r.o, r.d, 60, out[0])
      engineFirst.push(performance.now() - ta)
    }
    // agreement: the engine's nearest hit and the kit's are the same object
    let agree = 0
    let both = 0
    for (const r of list.slice(0, 300)) {
      const k = kit.raycast(r.o, r.d, 60)
      const n = w.rayFirst(r.o, r.d, 60, out[0])
      if (!k && !n) continue
      both++
      if (k && n && k.object === `o${Math.floor(out[0].tag / 512)}`) agree++
      else if (process.env.QUERY_TRACE) console.log('disagree', k?.object, k?.distance.toFixed(3), n ? `o${Math.floor(out[0].tag / 512)} ${out[0].distance.toFixed(3)}` : 'none')
    }
    console.log(
      `queries: ${boxes.length} parts (build ${fmt(buildMs, 1)} ms); 1000 multi-hit rays ${fmt(stats(frame).median)} ms/frame (p90 ${fmt(stats(frame).p90)}), ${fmt(total / 1000, 2)} hits/ray, ${withMany} rays with >=3 hits; first-hit castRay x1000 ${fmt(stats(engineFirst).median)} ms; kit raycast x1000 ${fmt(stats(kitFrame).median)} ms; nearest-object agreement ${agree}/${both}`,
    )
    console.log(`queries: blast (300 fragment rays + sphere overlap r 8 m (${inRadius} colliders) + 50 sight lines) ${fmt(stats(blast).median)} ms; 100 sphere casts r 4 mm ${fmt(stats(cast).median)} ms`)
    expect(bodies.size).toBeGreaterThan(0)
  }, 120000)

  it('what queries see: sleeping, kinematic, made or removed this frame; smoke sensors and sight', async () => {
    const { engine } = await loadEngine()
    const w = engine.createWorld({ gravity: [0, -9.81, 0] }) as RapierWorld
    w.createBody({ kind: 'fixed', position: [0, -0.5, 0], colliders: [{ shape: { kind: 'box', half: [50, 0.5, 50] }, tag: 1 }] })
    const sleeper = w.createBody({ kind: 'dynamic', position: [5, 0.2, 0], colliders: [{ shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, tag: 2 }] })
    const agent = w.createBody({ kind: 'kinematic', position: [10, 0.85, 0], colliders: [{ shape: { kind: 'capsule', halfHeight: 0.6, radius: 0.25 }, tag: 3 }] })
    const smoke = w.createBody({ kind: 'fixed', position: [20, 1.5, 0], colliders: [{ shape: { kind: 'sphere', radius: 3 }, tag: 4, sensor: true }] })
    for (let f = 0; f < 120; f++) w.step(1 / 60)
    const out = hits(8)
    const tagsAlong = (): number[] => {
      const n = w.rayAll([0, 0.3, 0], [1, 0, 0], 40, out)
      return out.slice(0, n).map((h) => h.tag)
    }
    const asleep = w.isSleeping(sleeper)
    const seen = tagsAlong()
    // made this frame, before any step: does the ray find it?
    w.createBody({ kind: 'dynamic', position: [2, 0.3, 0], colliders: [{ shape: { kind: 'box', half: [0.1, 0.1, 0.1] }, tag: 5 }] })
    const freshSeen = tagsAlong().includes(5)
    w.removeBody(sleeper)
    const removedSeen = tagsAlong().includes(2)
    w.step(1 / 60)
    const freshAfterStep = tagsAlong().includes(5)
    // smoke: a kinematic agent walking into a fixed sensor; Rapier reports kinematic-fixed pairs only when asked (ActiveCollisionTypes)
    let enters = 0
    for (let f = 0; f < 240; f++) {
      w.moveKinematic(agent, [10 + f * 0.05, 0.85, 0], [0, 0, 0, 1])
      w.step(1 / 60)
      w.drainSensorEvents((_s, _o, entered) => {
        if (entered) enters++
      })
    }
    const sight = w.rayAll([14, 1.5, 0], [1, 0, 0], 20, out)
    const sightBlocked = out.slice(0, sight).some((h) => h.tag === 4)
    console.log(
      `queries see: sleeping ${asleep ? 'asleep' : 'awake'} body hit ${seen.includes(2)}; kinematic hit ${seen.includes(3)}; sensor hit by a plain ray ${seen.includes(4)}; body made this frame hit before a step ${freshSeen}, after ${freshAfterStep}; removed body still hit ${removedSeen}; kinematic agent entering fixed smoke sensor events ${enters}; a sight line through smoke meets it ${sightBlocked}`,
    )
    expect(smoke).toBeGreaterThanOrEqual(0)
  }, 60000)
})
