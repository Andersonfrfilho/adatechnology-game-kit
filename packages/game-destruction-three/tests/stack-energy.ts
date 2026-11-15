import * as THREE from 'three'

import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { sampleOf } from './bowl-energy'
import type { BowlResult } from './bowl-energy'
import { EnergyRuler } from './energy-ruler'
import type { EnergySample } from './energy-ruler'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const BOX: [number, number, number] = [0.4, 0.2, 0.4]
const GAP = 0.01
const SETTLE_SECONDS = 3

/** Stacks of equal boxes dropped from a 1 cm gap each, no outside input: heavy on light (20:1) and five alike. Same columns as the bowl. */
export const stack = (seed: number, dt: number, masses: readonly number[]): BowlResult => {
  const started = performance.now()
  let state = seed * 9301 + 49297
  const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
  const groundAt = (): number => 0
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt })
  const pieces: Piece[] = []
  masses.forEach((mass, layer) => {
    const id = `layer${layer}`
    world.addObject(id, [partState('body', 'concrete', { mass })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...BOX))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set((next() - 0.5) * 0.04, BOX[1] / 2 + layer * (BOX[1] + GAP) + GAP, (next() - 0.5) * 0.04)
    root.rotation.set((next() - 0.5) * 0.04, next() * 3, (next() - 0.5) * 0.04)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    pieces.push(renderer.makePiece(id))
  })
  const v = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const ruler = new EnergyRuler()
  const snapshot = (): EnergySample[] => pieces.map((p) => sampleOf(p, v, q, groundAt))
  for (let i = 0; i < Math.round(SETTLE_SECONDS / dt); i++) {
    const before = snapshot()
    renderer.update(dt)
    ruler.step(before, snapshot(), dt, 'none')
    if (pieces.every((p) => p.sleeping)) break
  }
  ruler.recordFellThrough((renderer as unknown as { pieceSys: { engine: { fellThrough: number } | null } }).pieceSys.engine?.fellThrough ?? 0)
  const r = ruler.result()
  return {
    c1Excess: r.c1Excess,
    c2Gain: r.c2Gain,
    c2GainUnconditioned: r.c2GainUnconditioned,
    c3Lift: r.c3Lift,
    c4AsleepAfter: r.c4AsleepAfter,
    maxUp: r.maxUp,
    lowest: Math.min(...snapshot().map((sample) => sample.centre[1])),
    deepest: r.deepest,
    fellThrough: r.fellThrough,
    hash: '',
    ms: performance.now() - started,
  }
}
