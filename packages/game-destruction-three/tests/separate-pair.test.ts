import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '../src/renderer'
import { shapeContact, type ContactShape } from '../src/piece-contacts'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'

const IDENTITY = new THREE.Matrix4().elements

/** One box as a contact shape: centre, rotation about z (rad) and half extents. */
const boxShape = (c: Vec3, half: Vec3, turnZ = 0): ContactShape => ({
  kind: 'boxes',
  boxes: [{ c, e: turnZ === 0 ? IDENTITY : new THREE.Matrix4().makeRotationZ(turnZ).elements, half }],
})

describe('two boxes meet by their separating axes', () => {
  it('two thin slabs overlapping flat meet along their thin axis, by the overlap, not by their width', () => {
    // 20 x 0.2 x 16 m slabs, the upper one sunk 0.15 m into the lower
    const hit = shapeContact(boxShape([0.5, 0.15, 0.3], [10, 0.1, 8]), boxShape([0, 0.1, 0], [10, 0.1, 8]))
    expect(hit).not.toBeNull()
    expect(hit!.normal[1]).toBeCloseTo(1, 6)
    expect(hit!.depth).toBeCloseTo(0.15, 6)
  })

  it('a board leaning into the side of a box meets it along the face of the box', () => {
    // a 2 m board at 120 degrees (rising to the left), its upper end 1 cm into the +x face of a 1 m box
    const turn = (2 * Math.PI) / 3
    const reach = Math.abs(Math.cos(turn)) * 1 + Math.abs(Math.sin(turn)) * 0.02
    const board = boxShape([0.49 + reach, 0.8 - Math.sin(turn), 0], [1, 0.02, 0.2], turn)
    const hit = shapeContact(board, boxShape([0, 0.5, 0], [0.5, 0.5, 0.5]))
    expect(hit).not.toBeNull()
    expect(hit!.normal[0]).toBeCloseTo(1, 6)
    expect(hit!.depth).toBeCloseTo(0.01, 6)
  })

  it('two boxes apart on any axis do not meet', () => {
    expect(shapeContact(boxShape([1.01, 0, 0], [0.5, 0.5, 0.5]), boxShape([0, 0, 0], [0.5, 0.5, 0.5]))).toBeNull()
    // turned 45 degrees, the corners reach 0.707 m: apart along the cube's own axis though their bounding circles overlap
    expect(shapeContact(boxShape([1.25, 0, 0], [0.5, 0.5, 0.5], Math.PI / 4), boxShape([0, 0, 0], [0.5, 0.5, 0.5]))).toBeNull()
  })
})

const setup = () => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
  const box = (id: string, size: [number, number, number], at: [number, number, number]): Piece => {
    world.addObject(id, [partState('body', 'wood', { mass: 2 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(...at)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    return renderer.makePiece(id)
  }
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
  }
  return { box, run }
}

const bounds = (p: Piece): THREE.Box3 => {
  p.root.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(p.root)
}

describe('two loose boxes overlapping are put apart by their real overlap', () => {
  it('two thin 6 m slabs standing 10 cm into each other end side by side along their thin axis, where they were, at rest', () => {
    const { box, run } = setup()
    const a = box('a', [0.4, 1.2, 6], [0, 0.6, 0])
    // of different heights: one whose top is level with the other's counts as resting on it (`restsOn`) and is left to its support
    const b = box('b', [0.4, 1, 6], [0.3, 0.5, 1])
    run(4)
    // apart along the thin axis by the overlap: 0.4 m between centres (the bounding circles shoved them to 4.8 m, mostly along their length)
    const gap = b.root.position.x - a.root.position.x
    expect(gap).toBeGreaterThan(0.39)
    expect(gap).toBeLessThan(0.42)
    expect(b.root.position.z - a.root.position.z).toBeCloseTo(1, 2)
    for (const p of [a, b]) {
      expect(bounds(p).min.y).toBeGreaterThan(-0.01)
      expect(bounds(p).min.y).toBeLessThan(0.02)
      expect(Math.hypot(...p.velocity)).toBeLessThan(0.05)
    }
  })

  it('two compact boxes overlapping side by side end side by side, touching, on the ground', () => {
    const { box, run } = setup()
    const a = box('a', [0.4, 0.4, 0.4], [0, 0.2, 0])
    const b = box('b', [0.4, 0.3, 0.4], [0.3, 0.15, 0.05])
    run(3)
    const gap = Math.abs(b.root.position.x - a.root.position.x)
    // the bounding circles stopped them at 0.32 m apart, still 8 cm into each other; the boxes end touching
    expect(gap).toBeGreaterThan(0.39)
    expect(gap).toBeLessThan(0.42)
    // put apart along x, their face axis: the side offset stays
    expect(b.root.position.z - a.root.position.z).toBeCloseTo(0.05, 2)
    for (const p of [a, b]) {
      expect(bounds(p).min.y).toBeGreaterThan(-0.01)
      expect(bounds(p).min.y).toBeLessThan(0.02)
    }
  })

  it('a board leaning into the side of a crate settles without either inside the other', () => {
    const { box, run } = setup()
    const crate = box('crate', [0.5, 0.8, 0.5], [0, 0.4, 0])
    // a 1.2 m board at 30 degrees to the ground, its upper end 2 cm into the crate's +x face
    const turn = (5 * Math.PI) / 6
    const reach = Math.abs(Math.cos(turn)) * 0.6 + Math.abs(Math.sin(turn)) * 0.02
    const board = box('board', [1.2, 0.04, 0.3], [0.23 + reach, 0.35, 0])
    board.root.rotation.z = turn
    run(3)
    const shapeOf = (p: Piece): ContactShape => {
      p.root.updateMatrixWorld(true)
      const c = new THREE.Vector3(...p.localCenter).applyMatrix4(p.root.matrixWorld)
      return { kind: 'boxes', boxes: [{ c: [c.x, c.y, c.z], e: new THREE.Matrix4().makeRotationFromQuaternion(p.root.quaternion).elements, half: p.halfExtents }] }
    }
    const overlap = shapeContact(shapeOf(board), shapeOf(crate))
    expect(overlap?.depth ?? 0).toBeLessThan(0.01)
    for (const p of [board, crate]) expect(bounds(p).min.y).toBeGreaterThan(-0.01)
  })
})
