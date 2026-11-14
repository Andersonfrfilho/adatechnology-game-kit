import { createHash } from 'node:crypto'

import * as THREE from 'three'

import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'

const G = 9.81
const REST_SPEED = 0.05
const REST_SPIN = 0.1

/** Energy height of a piece (DECISION-fable §2): y of the centre of mass + (|v|^2 + w.Iw/m) / 2g, with the inertia of its box. */
const energyHeight = (p: Piece, v: THREE.Vector3, q: THREE.Quaternion): number => {
  p.root.updateMatrixWorld(true)
  const y = v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld).y
  const [hx, hy, hz] = p.halfExtents
  // w in the box's frame
  const w = v.set(p.angularVelocity[0], p.angularVelocity[1], p.angularVelocity[2]).applyQuaternion(q.copy(p.root.quaternion).invert())
  const k = ((hy * hy + hz * hz) * w.x * w.x + (hx * hx + hz * hz) * w.y * w.y + (hx * hx + hy * hy) * w.z * w.z) / 3
  const s = p.velocity[0] ** 2 + p.velocity[1] ** 2 + p.velocity[2] ** 2
  return y + (s + k) / (2 * G)
}

const centreY = (p: Piece, v: THREE.Vector3): number => v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld).y

export interface BowlResult {
  /** C1: most the summed m * energy height of all pieces rose in one update, over m_total g 1 mm (> 0 fails). */
  readonly c1Excess: number
  /** C2: most energy height any piece gained above its last rest (m). */
  readonly c2Gain: number
  /** C3: most centre-of-mass rise beyond its own upward speed summed per piece (spike A's `lift`, m). */
  readonly c3Lift: number
  /** C4: seconds after the last wake until every piece slept (-1: not within 3 s). */
  readonly c4AsleepAfter: number
  readonly maxUp: number
  /** Lowest centre of any piece at the end (m): under -0.5 one went through the ground. */
  readonly lowest: number
  /** Deepest any piece's centre ever was under the ground right below it, over every update after the sheet (m): above 0, one was under the ground. */
  readonly deepest: number
  /** Pieces the engine let through the ground and the kit's net put back (`EnginePieces.fellThrough`); 0 on the kit's own solver. */
  readonly fellThrough: number
  readonly hash: string
  readonly ms: number
}

/**
 * Spike A's deepening bowl (a 1.2 m sheet on four tilted plates in a bowl 0.25 m deep that deepens to 0.45 m over 2 s, every piece woken each frame), judged
 * by the energy criteria of DECISION-fable §2, then 3 s without waking for C4.
 */
export const bowl = (seed: number, dt: number): BowlResult => {
  const started = performance.now()
  let state = seed * 9301 + 49297
  const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
  let t = 0
  const groundAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z)
    const b = d < 1.2 ? -0.25 * (1 - (d / 1.2) ** 2) : 0
    return b * (1 + 0.8 * Math.min(1, t / 2))
  }
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), groundAt })
  const pieces: Piece[] = []
  const box = (id: string, size: [number, number, number], at: [number, number, number], turn: [number, number, number]): Piece => {
    world.addObject(id, [partState('body', 'concrete', { mass: size[0] * size[1] * size[2] * 2400 + 1 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(...at)
    root.rotation.set(...turn)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    const piece = renderer.makePiece(id)
    pieces.push(piece)
    return piece
  }
  const sys = (renderer as unknown as { pieceSys: { wakeRegion: (x: number, z: number, r: number) => void } }).pieceSys
  for (let i = 0; i < 4; i++) box(`plate${i}`, [0.634, 0.304, 0.04], [(next() - 0.5) * 1.2, 0, (next() - 0.5) * 1.2], [Math.PI / 2 + (next() - 0.5) * 0.9, next() * 3, (next() - 0.5) * 0.5])
  for (let i = 0; i < 2 / dt; i++) renderer.update(dt)
  box('sheet', [1.2, 0.04, 1.224], [(next() - 0.5) * 0.4, 0.5, (next() - 0.5) * 0.4], [(next() - 0.5) * 0.5, next() * 3, (next() - 0.5) * 0.5])
  for (let i = 0; i < 0.5 / dt; i++) renderer.update(dt)
  const v = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const mass = (p: Piece): number => p.mass
  const total = pieces.reduce((n, p) => n + mass(p), 0)
  const base = new Map<Piece, number>()
  const lift = new Map<Piece, number>()
  let c1Excess = -Infinity
  let c2Gain = 0
  let maxUp = 0
  let deepest = -Infinity
  const frame = (wake: boolean): void => {
    if (wake) sys.wakeRegion(0, 0, 2)
    const before = pieces.map((p) => {
      const eh = energyHeight(p, v, q)
      const atRest = Math.hypot(...p.velocity) < REST_SPEED && Math.hypot(...p.angularVelocity) < REST_SPIN
      if (atRest || !base.has(p)) base.set(p, eh)
      return { p, eh, y: centreY(p, v), vy: p.velocity[1] }
    })
    t += dt
    renderer.update(dt)
    let sum = 0
    for (const { p, eh, y, vy } of before) {
      const after = energyHeight(p, v, q)
      sum += mass(p) * (after - eh)
      c2Gain = Math.max(c2Gain, after - (base.get(p) ?? after))
      lift.set(p, (lift.get(p) ?? 0) + Math.max(0, centreY(p, v) - y - Math.max(0, vy) * dt))
      if (p.velocity[1] > Math.max(0, vy) + 1e-9) maxUp = Math.max(maxUp, p.velocity[1])
      const c = v.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld)
      deepest = Math.max(deepest, groundAt(c.x, c.z) - c.y)
    }
    c1Excess = Math.max(c1Excess, sum - total * 0.001)
  }
  for (let i = 0; i < Math.round(4 / dt); i++) frame(true)
  let asleep = -1
  for (let i = 0; i < Math.round(3 / dt); i++) {
    frame(false)
    if (pieces.every((p) => p.sleeping)) {
      asleep = (i + 1) * dt
      break
    }
  }
  const hash = createHash('sha256')
  for (const p of pieces) hash.update(`${p.root.position.toArray().join(',')};${p.root.quaternion.toArray().join(',')};`)
  const lowest = Math.min(...pieces.map((p) => centreY(p, v)))
  const fellThrough = (renderer as unknown as { pieceSys: { engine: { fellThrough: number } | null } }).pieceSys.engine?.fellThrough ?? 0
  return { c1Excess, c2Gain, c3Lift: Math.max(0, ...lift.values()), c4AsleepAfter: asleep, maxUp, lowest, deepest, fellThrough, hash: hash.digest('hex').slice(0, 16), ms: performance.now() - started }
}
