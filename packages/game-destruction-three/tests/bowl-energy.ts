import { createHash } from 'node:crypto'

import * as THREE from 'three'

import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { EnergyRuler, energyHeightOf } from './energy-ruler'
import type { EnergySample } from './energy-ruler'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/** A piece at this instant, for the ruler: the centre in the world, the energy height with the inertia of its box (DECISION-fable §2). */
const sampleOf = (p: Piece, scratch: THREE.Vector3, turn: THREE.Quaternion, groundY: (x: number, z: number) => number): EnergySample => {
  p.root.updateMatrixWorld(true)
  const centre = scratch.set(p.localCenter[0], p.localCenter[1], p.localCenter[2]).applyMatrix4(p.root.matrixWorld)
  const at: [number, number, number] = [centre.x, centre.y, centre.z]
  const w = scratch.set(p.angularVelocity[0], p.angularVelocity[1], p.angularVelocity[2]).applyQuaternion(turn.copy(p.root.quaternion).invert())
  const [hx, hy, hz] = p.halfExtents
  return {
    id: p.objectId,
    mass: p.mass,
    centre: at,
    radius: Math.hypot(hx, hy, hz),
    energyHeight: energyHeightOf({ centreY: at[1], velocity: p.velocity, bodyAngularVelocity: [w.x, w.y, w.z], halfExtents: p.halfExtents }),
    velocityY: p.velocity[1],
    speed: Math.hypot(...p.velocity),
    spin: Math.hypot(...p.angularVelocity),
    sleeping: p.sleeping,
    groundY: groundY(at[0], at[2]),
  }
}

export interface BowlResult {
  /** C1: most the summed m * energy height of an island rose in one update, over m_island g 1 mm (> 0 fails). */
  readonly c1Excess: number
  /** C2 with the C1 condition: most energy height a piece gained above its last rest, in an episode where its island also broke C1 (m). */
  readonly c2Gain: number
  /** C2 without the condition, the gate 0 column: most energy height any piece gained above its last rest (m). */
  readonly c2GainUnconditioned: number
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
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt })
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
  // the ground deepening and the wake are the bowl's own doing, not an outside input to forgive: every update counts for C1, C2 and C3, stricter than the spec
  const ruler = new EnergyRuler()
  const snapshot = (): EnergySample[] => pieces.map((p) => sampleOf(p, v, q, groundAt))
  const frame = (wake: boolean): void => {
    if (wake) sys.wakeRegion(0, 0, 2)
    const before = snapshot()
    t += dt
    renderer.update(dt)
    ruler.step(before, snapshot(), dt, wake ? 'wake' : 'none')
  }
  for (let i = 0; i < Math.round(4 / dt); i++) frame(true)
  for (let i = 0; i < Math.round(3 / dt); i++) {
    frame(false)
    if (pieces.every((p) => p.sleeping)) break
  }
  const hash = createHash('sha256')
  for (const p of pieces) hash.update(`${p.root.position.toArray().join(',')};${p.root.quaternion.toArray().join(',')};`)
  const lowest = Math.min(...snapshot().map((sample) => sample.centre[1]))
  ruler.recordFellThrough((renderer as unknown as { pieceSys: { engine: { fellThrough: number } | null } }).pieceSys.engine?.fellThrough ?? 0)
  const r = ruler.result()
  return {
    c1Excess: r.c1Excess,
    c2Gain: r.c2Gain,
    c2GainUnconditioned: r.c2GainUnconditioned,
    c3Lift: r.c3Lift,
    c4AsleepAfter: r.c4AsleepAfter,
    maxUp: r.maxUp,
    lowest,
    deepest: r.deepest,
    fellThrough: r.fellThrough,
    hash: hash.digest('hex').slice(0, 16),
    ms: performance.now() - started,
  }
}
