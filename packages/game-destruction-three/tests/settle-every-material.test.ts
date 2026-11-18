import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { MATERIALS } from '@adatechnology/game-destruction'

import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/** Seconds a heap gets to come to rest (a can it threw may roll on for 10 s across the floor), and the last seconds in which nothing may still move. */
const SETTLE_SECONDS = 15
const WATCH_SECONDS = 1
/** How far (m) a piece may still travel in the watched seconds: rounding, never a piece shaking between its neighbours. */
const MOST_PATH = 0.003

type Shape = { readonly kind: 'box'; readonly size: [number, number, number] } | { readonly kind: 'round'; readonly radius: number; readonly length: number }

/** What a broken thing leaves: books, boards, plates, chunks, rods and a can or a bottle, by their sizes (m). */
const DEBRIS: readonly Shape[] = [
  { kind: 'box', size: [0.05, 0.24, 0.26] },
  { kind: 'box', size: [0.04, 0.22, 0.17] },
  { kind: 'box', size: [0.9, 0.02, 0.3] },
  { kind: 'box', size: [0.6, 0.018, 0.25] },
  { kind: 'box', size: [0.3, 0.012, 0.3] },
  { kind: 'box', size: [0.14, 0.1, 0.12] },
  { kind: 'box', size: [0.25, 0.08, 0.18] },
  { kind: 'box', size: [0.6, 0.012, 0.012] },
  { kind: 'round', radius: 0.035, length: 0.12 },
  { kind: 'round', radius: 0.012, length: 0.5 },
]

const random = (seed: number): (() => number) => {
  let state = seed * 9301 + 49297
  return () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
}

const densityOf = (material: string): number => MATERIALS.find((m) => m.id === material)?.density ?? 800

const geometryOf = (shape: Shape): THREE.BufferGeometry =>
  shape.kind === 'box' ? new THREE.BoxGeometry(...shape.size) : new THREE.CylinderGeometry(shape.radius, shape.radius, shape.length, 16)

const volumeOf = (shape: Shape): number => (shape.kind === 'box' ? shape.size[0] * shape.size[1] * shape.size[2] : Math.PI * shape.radius * shape.radius * shape.length)

/**
 * A fallen case of `caseMaterial` (a base and two uprights 1 cm apart inside, asleep on the floor) and the debris of a break over it, each piece of the material `pick`
 * gives it, dropped in a heap that overlaps as the pieces of a break are made; how far each piece moved in the last `WATCH_SECONDS` and whether it sleeps.
 */
const settleHeap = (seed: number, caseMaterial: string, pick: (next: () => number) => string): Array<{ id: string; material: string; path: number; sleeping: boolean }> => {
  const next = random(seed)
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  world.materials = new Map(MATERIALS.map((m) => [m.id, m]))
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  const add = (id: string, root: THREE.Group, parts: Record<string, THREE.Mesh>): Piece => {
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts })
    return renderer.makePiece(id)
  }
  const caseDensity = densityOf(caseMaterial)
  const boards: Record<string, { size: [number, number, number]; at: [number, number, number] }> = {
    base: { size: [0.5, 0.02, 0.3], at: [0, 0.01, 0] },
    left: { size: [0.02, 0.3, 0.3], at: [-0.015, 0.17, 0] },
    right: { size: [0.02, 0.3, 0.3], at: [0.015, 0.17, 0] },
  }
  const caseParts: Record<string, THREE.Mesh> = {}
  for (const [id, { size, at }] of Object.entries(boards)) {
    caseParts[id] = new THREE.Mesh(new THREE.BoxGeometry(...size))
    caseParts[id].position.set(...at)
  }
  world.addObject('case', Object.entries(boards).map(([id, { size }]) => partState(id, caseMaterial, { mass: caseDensity * volumeOf({ kind: 'box', size }) })))
  const caseRoot = new THREE.Group()
  caseRoot.add(...Object.values(caseParts))
  add('case', caseRoot, caseParts)
  for (let t = 0; t < 1.5; t += 1 / 60) renderer.update(1 / 60)
  const pieces: Array<{ id: string; material: string; piece: Piece }> = []
  for (let i = 0; i < DEBRIS.length; i++) {
    const shape = DEBRIS[i] as Shape
    const material = pick(next)
    const id = `debris_${i}`
    world.addObject(id, [partState('body', material, { mass: Math.max(0.01, densityOf(material) * volumeOf(shape)) })])
    const mesh = new THREE.Mesh(geometryOf(shape))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set((next() - 0.5) * 0.5, 0.05 + next() * 0.9, (next() - 0.5) * 0.4)
    root.rotation.set((next() - 0.5) * Math.PI, next() * Math.PI, (next() - 0.5) * Math.PI)
    const piece = add(id, root, { body: mesh })
    renderer.impulse(id, [(next() - 0.5) * piece.mass, -piece.mass * next(), (next() - 0.5) * piece.mass])
    pieces.push({ id, material, piece })
  }
  for (let t = 0; t < SETTLE_SECONDS - WATCH_SECONDS; t += 1 / 60) renderer.update(1 / 60)
  const paths = new Map<string, number>()
  const last = new Map(pieces.map(({ id, piece }) => [id, piece.root.position.clone()]))
  for (let t = 0; t < WATCH_SECONDS; t += 1 / 60) {
    renderer.update(1 / 60)
    for (const { id, piece } of pieces) {
      const before = last.get(id) as THREE.Vector3
      paths.set(id, (paths.get(id) ?? 0) + piece.root.position.distanceTo(before))
      before.copy(piece.root.position)
    }
  }
  return pieces.map(({ id, material, piece }) => ({ id, material, path: paths.get(id) ?? 0, sleeping: piece.sleeping }))
}

const shaking = (heap: ReturnType<typeof settleHeap>): string[] => heap.filter((p) => !p.sleeping || p.path > MOST_PATH).map((p) => `${p.id} (${p.material}): ${(p.path * 1000).toFixed(1)} mm, ${p.sleeping ? 'asleep' : 'awake'}`)

describe('the debris of every material comes to rest', () => {
  it.each(MATERIALS.map((m) => m.id))('a heap of %s debris over a fallen case sleeps, none shaking between its neighbours', (material) => {
    expect(shaking(settleHeap(7, material, () => material))).toEqual([])
  })

  it.each([1, 2, 3, 4, 5, 6])('a heap of mixed materials sleeps, none shaking (seed %i)', (seed) => {
    const ids = MATERIALS.map((m) => m.id)
    expect(shaking(settleHeap(seed, ids[seed % ids.length] as string, (next) => ids[Math.floor(next() * ids.length)] as string))).toEqual([])
  })
})
