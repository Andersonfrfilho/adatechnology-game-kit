import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

type Body = { objectId: string; root: THREE.Object3D; velocity: number[] }
type Internals = {
  pushes: Map<Body, number[]>
  applyPushes: (dt: number) => void
  separatePair: (a: Body, b: Body, ca: number[], cb: number[], dt: number, resting: boolean) => void
}

/** A thin 1.2 x 1.2 m sheet laid over a clutter of slabs and boards that lies asleep on flat ground, by a fixed seed; what separation lifts and how much upward speed it gives anything. */
const dropOnClutter = (seed: number): { lift: number; fastestUp: number } => {
  let state = seed * 9301 + 49297
  const next = (): number => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648)
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
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
    return renderer.makePiece(id)
  }
  const internals = (renderer as unknown as { pieceSys: Internals }).pieceSys
  const lifted = new Map<Body, number>()
  let fastestUp = 0
  const applyPushes = internals.applyPushes.bind(internals)
  internals.applyPushes = (dt) => {
    const before = [...internals.pushes.keys()].map((body): [Body, number] => [body, body.root.position.y])
    applyPushes(dt)
    for (const [body, y] of before) if (body.root.position.y > y) lifted.set(body, (lifted.get(body) ?? 0) + body.root.position.y - y)
  }
  const separatePair = internals.separatePair.bind(internals)
  // the upward speed separating gives a piece, not what it already had: the sheet landing on a leaning board rocks up by itself (0.18 m/s in seed 41), with or without it;
  // a fall it stops is no speed up
  internals.separatePair = (a, b, ca, cb, dt, resting) => {
    const before = [a.velocity[1], b.velocity[1]]
    separatePair(a, b, ca, cb, dt, resting)
    fastestUp = Math.max(fastestUp, Math.max(0, a.velocity[1]) - Math.max(0, before[0]), Math.max(0, b.velocity[1]) - Math.max(0, before[1]))
  }
  for (let i = 0; i < 4; i++) box(`slab${i}`, [0.5 + next() * 0.7, 0.04 + next() * 0.04, 0.3 + next() * 0.4], [(next() - 0.5) * 1.4, 0.03, (next() - 0.5) * 1.4], [0, next() * 3, 0])
  for (let i = 0; i < 3; i++) box(`board${i}`, [0.64, 0.3, 0.04], [(next() - 0.5) * 1.6, 0.15, (next() - 0.5) * 1.6], [0, next() * 3, (next() - 0.5) * 1.2])
  for (let i = 0; i < 120; i++) renderer.update(1 / 60)
  box('sheet', [1.2, 0.04, 1.2], [(next() - 0.5) * 0.6, 0.06 + next() * 0.03, (next() - 0.5) * 0.6], [(next() - 0.5) * 0.06, next() * 3, (next() - 0.5) * 0.06])
  lifted.clear()
  fastestUp = 0
  for (let i = 0; i < 300; i++) renderer.update(1 / 60)
  return { lift: Math.max(0, ...lifted.values()), fastestUp }
}

describe('a sheet laid over clutter', () => {
  it.each([40, 41, 43])('is put apart a few centimetres in all, never sent up (seed %i)', (seed) => {
    const { lift, fastestUp } = dropOnClutter(seed)
    expect(lift).toBeLessThan(0.035)
    expect(fastestUp).toBeLessThan(0.05)
  })
})
