import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

// a table top 0.78 m high for x < 0 (from x = -1), the floor elsewhere: the ground under a piece is a step at the table's edge
const TOP = 0.78
const groundAt = (x: number, z: number): number => (x < 0 && x > -1 && Math.abs(z) < 0.5 ? TOP : 0)

const onEdge = (x: number, opts: { velocity?: [number, number, number]; size?: [number, number, number]; mass?: number; seconds?: number; floor?: boolean } = {}) => {
  const size = opts.size ?? [0.3, 0.2, 0.25]
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), groundAt })
  world.addObject('box', [partState('body', 'paper', { mass: opts.mass ?? 0.4 })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
  const root = new THREE.Group()
  root.add(mesh)
  root.position.set(x, (opts.floor ? 0 : TOP) + size[1] / 2 + 0.002, 0)
  scene.add(root)
  renderer.bind('box', root, { parts: { body: mesh } })
  const piece = renderer.makePiece('box', opts.velocity ? { velocity: opts.velocity } : {})
  let t = 0
  let ups = 0
  let lastY = root.position.y
  let rising = false
  const ys: number[] = []
  while (t < (opts.seconds ?? 6)) {
    renderer.update(1 / 60)
    t += 1 / 60
    const y = root.position.y
    // a hop on the edge: the piece goes up by more than 5 mm in a frame while it is still up at the table (a pop out of the table's side); a bounce on
    // the floor after the fall is no hop
    const up = y - lastY > 0.005 && y > TOP / 2
    if (up && !rising) ups++
    rising = up
    lastY = y
    ys.push(y)
  }
  return { piece, root, ups, ys }
}

describe('a piece on the edge of a table', () => {
  it('with its centre of mass over the top it rests on the table and sleeps', () => {
    const { piece, root, ups } = onEdge(-0.08)
    expect(ups).toBe(0)
    expect(root.position.y).toBeGreaterThan(TOP)
    expect(piece.sleeping).toBe(true)
  })

  it('a narrow box standing with 2 cm over the edge and its centre of mass 2 cm inside stays on the table', () => {
    const { piece, root, ups } = onEdge(-0.02, { size: [0.08, 0.3, 0.2] })
    expect(ups).toBe(0)
    expect(root.position.y).toBeGreaterThan(TOP)
    expect(Math.abs(root.position.x + 0.02)).toBeLessThan(0.005)
    expect(piece.sleeping).toBe(true)
  })

  it('with its centre of mass past the edge it tips over the edge, falls to the floor and sleeps there, without hopping on the edge', () => {
    const { piece, root, ups } = onEdge(0.04)
    expect(ups).toBeLessThanOrEqual(1)
    expect(root.position.y).toBeLessThan(0.3)
    expect(piece.sleeping).toBe(true)
  })

  it('slid off the edge it falls to the floor', () => {
    // 3 m/s: the paper's grip on the wood (0.7) stops it after about 0.65 m, past the 0.3 m to the edge
    const { piece, root, ups } = onEdge(-0.3, { velocity: [3, 0, 0] })
    expect(ups).toBeLessThanOrEqual(1)
    expect(root.position.y).toBeLessThan(0.3)
    expect(piece.sleeping).toBe(true)
  })

  it('slid back toward the table from the floor it is stopped by the side of the table, not lifted onto the top', () => {
    const { piece, root, ys } = onEdge(0.6, { velocity: [-4, 0, 0], floor: true })
    // the blow on its side may rock it a little (a box hitting a wall at 4 m/s), never up to the top 0.78 m above
    expect(Math.max(...ys)).toBeLessThan(0.2)
    expect(root.position.y).toBeLessThan(0.2)
    // its near side stops at the table's side (x = 0), half its width from the centre
    expect(root.position.x).toBeGreaterThan(0.14)
    expect(piece.sleeping).toBe(true)
  })
})

describe('a piece under a table top', () => {
  it('a box on the floor half under the table stays on the floor, neither lifted onto the top nor through the floor', () => {
    const { piece, root, ys } = onEdge(0.05, { floor: true })
    expect(Math.max(...ys)).toBeLessThan(0.2)
    expect(root.position.y).toBeGreaterThan(0.05)
    expect(piece.sleeping).toBe(true)
  })
})
