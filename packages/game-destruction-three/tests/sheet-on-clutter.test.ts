import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'
import { measureLift } from './lift-measure'

/**
 * A thin 1.2 x 1.2 m sheet laid over a clutter of slabs and boards that lies asleep on flat ground, by a fixed seed: the most any piece is carried up beyond its own flight
 * and the fastest any is sent up by an update (`measureLift`).
 */
const dropOnClutter = (seed: number): { lift: number; fastestUp: number } => {
  let state = seed * 9301 + 49297
  const next = (): number => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648)
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
  const box = (id: string, size: [number, number, number], at: [number, number, number], turn: [number, number, number]): Piece => {
    world.addObject(id, [partState('body', 'wood', { mass: size[0] * size[1] * size[2] * 400 + 1 })])
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
  const pieces: Piece[] = []
  for (let i = 0; i < 4; i++) box(`slab${i}`, [0.5 + next() * 0.7, 0.04 + next() * 0.04, 0.3 + next() * 0.4], [(next() - 0.5) * 1.4, 0.03, (next() - 0.5) * 1.4], [0, next() * 3, 0])
  for (let i = 0; i < 3; i++) box(`board${i}`, [0.64, 0.3, 0.04], [(next() - 0.5) * 1.6, 0.15, (next() - 0.5) * 1.6], [0, next() * 3, (next() - 0.5) * 1.2])
  for (let i = 0; i < 120; i++) renderer.update(1 / 60)
  box('sheet', [1.2, 0.04, 1.2], [(next() - 0.5) * 0.6, 0.06 + next() * 0.03, (next() - 0.5) * 0.6], [(next() - 0.5) * 0.06, next() * 3, (next() - 0.5) * 0.06])
  const lifts = measureLift(() => pieces, (dt) => renderer.update(dt), 1 / 60, 300)
  let lift = 0
  let fastestUp = 0
  for (const r of lifts.values()) {
    lift = Math.max(lift, r.lift)
    fastestUp = Math.max(fastestUp, r.up)
  }
  return { lift, fastestUp }
}

describe('a sheet laid over clutter', () => {
  it.each([40, 41, 43])('is put apart a few centimetres in all, never sent up (seed %i)', (seed) => {
    const { lift, fastestUp } = dropOnClutter(seed)
    if (process.env.BOWL_REPORT) console.log(`clutter seed ${seed} lift ${lift.toFixed(4)} up ${fastestUp.toFixed(3)}`)
    expect(lift).toBeLessThan(0.035)
    expect(fastestUp).toBeLessThan(0.05)
  })
})
