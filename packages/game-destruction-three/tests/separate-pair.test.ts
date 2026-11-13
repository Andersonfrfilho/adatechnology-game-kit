import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Vec3 } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '../src/renderer'
import { boxesAlongGround, shapeContact, type ContactShape } from '../src/piece-contacts'
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

  it('two turned boxes overlapping meet along their true least axis: the face of the turned one, not a world axis', () => {
    // a cube turned 30 degrees about y and 20 about z, a unit box pushed 4 cm into the face its own x axis points out of
    const turn = new THREE.Matrix4().makeRotationY(Math.PI / 6).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 9))
    const e = turn.elements
    const x: Vec3 = [e[0], e[1], e[2]]
    const turned: ContactShape = { kind: 'boxes', boxes: [{ c: [0, 0, 0], e, half: [0.5, 0.5, 0.5] }] }
    // the other box turned the same way, its centre along that axis 0.96 m away: 4 cm into each other along x, nowhere near on the others
    const other: ContactShape = { kind: 'boxes', boxes: [{ c: [x[0] * 0.96, x[1] * 0.96, x[2] * 0.96], e, half: [0.5, 0.5, 0.5] }] }
    const hit = shapeContact(other, turned)
    expect(hit).not.toBeNull()
    for (let k = 0; k < 3; k++) expect(hit!.normal[k]).toBeCloseTo(x[k], 6)
    expect(hit!.depth).toBeCloseTo(0.04, 6)
    // no direction overlaps less: every one of a sweep of the sphere needs at least as much to put them apart
    const reach = (l: Vec3): number => 0.5 * (Math.abs(e[0] * l[0] + e[1] * l[1] + e[2] * l[2]) + Math.abs(e[4] * l[0] + e[5] * l[1] + e[6] * l[2]) + Math.abs(e[8] * l[0] + e[9] * l[1] + e[10] * l[2]))
    for (let i = 0; i <= 40; i++) {
      for (let j = 0; j < 80; j++) {
        const t = (Math.PI * i) / 40
        const f = (2 * Math.PI * j) / 80
        const l: Vec3 = [Math.sin(t) * Math.cos(f), Math.cos(t), Math.sin(t) * Math.sin(f)]
        const overlap = 2 * reach(l) - Math.abs((x[0] * l[0] + x[1] * l[1] + x[2] * l[2]) * 0.96)
        expect(overlap).toBeGreaterThan(hit!.depth - 1e-9)
      }
    }
  })

  it('put apart along the ground only, two boxes go by their least level overlap', () => {
    // a 1 m cube sunk 0.6 m into the top of a 3 x 1 x 3 m slab, 1.3 m off its centre along x: 0.7 m to go along x, 0.6 m up
    const hit = boxesAlongGround(boxShape([1.3, 1.1, 0.2], [0.5, 0.5, 0.5]), boxShape([0, 0.5, 0], [1.5, 0.5, 1.5]))
    expect(hit).not.toBeNull()
    expect(hit!.normal).toEqual([1, 0, 0])
    expect(hit!.depth).toBeCloseTo(0.7, 6)
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

/** The highest each piece's centre has been over its start, sampled every step of `seconds`. */
const riseWhile = (pieces: Piece[], run: (seconds: number) => void, seconds: number): number[] => {
  const start = pieces.map((p) => p.root.position.y)
  const rise = pieces.map(() => 0)
  for (let t = 0; t < seconds; t += 1 / 60) {
    run(1 / 60)
    pieces.forEach((p, i) => (rise[i] = Math.max(rise[i], p.root.position.y - start[i])))
  }
  return rise
}

/** Whether a piece stands on the ground or on the top of another piece under it (within `gap`): nothing ends in the air. */
const standsOnSomething = (p: Piece, others: Piece[], gap: number): boolean => {
  const own = bounds(p)
  if (own.min.y < gap) return true
  return others.some((o) => {
    if (o === p) return false
    const b = bounds(o)
    const across = b.min.x < own.max.x && b.max.x > own.min.x && b.min.z < own.max.z && b.max.z > own.min.z
    return across && Math.abs(b.max.y - own.min.y) < gap
  })
}

/** A collapse's pile: blocks of a wall dropped on each other from 0.2-1.4 m, many born inside each other, by a fixed seed. */
const collapse = (): { pieces: Piece[]; run: (seconds: number) => void } => {
  const { box, run } = setup()
  let seed = 7
  const next = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const pieces: Piece[] = []
  for (let i = 0; i < 14; i++) {
    const size: [number, number, number] = [0.3 + next() * 0.9, 0.2 + next() * 0.4, 0.3 + next() * 0.6]
    pieces.push(box(`block${i}`, size, [(next() - 0.5) * 1.6, size[1] / 2 + 0.2 + next() * 1.2, (next() - 0.5) * 1.2]))
  }
  return { pieces, run }
}

describe('overlapping boxes are not launched', () => {
  it('a chunk made 0.6 m deep inside another is not lifted out of it: it slides out along the ground and falls, never climbs', () => {
    const { box, run } = setup()
    const lower = box('lower', [3, 1, 3], [0, 0.5, 0])
    // born inside it (chunks of one wall): its bottom 0.6 m under the lower chunk's top, its centre under that top. The least axis is the vertical one (0.6 m against
    // 2.2 m along x), so by the separating axes alone it would be lifted 0.6 m onto the top: energy nothing in the scene supplied
    const upper = box('upper', [2, 1, 2], [0.3, 0.9, 0.2])
    const [, riseUpper] = riseWhile([lower, upper], run, 4)
    expect(riseUpper).toBeLessThan(0.03)
    // out of it along +x (its least level overlap: 2.2 m), the two of equal mass each going half the way, and down on the ground beside it, at rest, touching
    const gap = upper.root.position.x - lower.root.position.x
    expect(gap).toBeGreaterThan(2.49)
    expect(gap).toBeLessThan(2.52)
    expect(upper.root.position.z - lower.root.position.z).toBeCloseTo(0.2, 3)
    expect(lower.root.position.y).toBeCloseTo(0.5, 2)
    expect(bounds(upper).min.y).toBeLessThan(0.02)
    expect(bounds(upper).min.y).toBeGreaterThan(-0.01)
    expect(Math.hypot(...upper.velocity)).toBeLessThan(0.05)
    const shape = (p: Piece): ContactShape => ({
      kind: 'boxes',
      boxes: [{ c: [p.root.position.x, p.root.position.y, p.root.position.z], e: new THREE.Matrix4().makeRotationFromQuaternion(p.root.quaternion).elements, half: p.halfExtents }],
    })
    expect(shapeContact(shape(upper), shape(lower))?.depth ?? 0).toBeLessThan(0.01)
  })

  it('a stack of resting blocks stays a stack: none rises more than a few centimetres', () => {
    const { box, run } = setup()
    // three slabs on each other, each 1 cm into the one under it (a pile come to rest)
    const stack = [box('s0', [1, 0.3, 1], [0, 0.15, 0]), box('s1', [0.8, 0.3, 0.8], [0.05, 0.44, 0]), box('s2', [0.6, 0.3, 0.6], [0, 0.73, 0.05])]
    const start = stack.map((p) => [p.root.position.x, p.root.position.z])
    const rise = riseWhile(stack, run, 3)
    for (const r of rise) expect(r).toBeLessThan(0.03)
    stack.forEach((p, i) => {
      expect(Math.hypot(p.root.position.x - start[i][0], p.root.position.z - start[i][1])).toBeLessThan(0.05)
      expect(standsOnSomething(p, stack, 0.03)).toBe(true)
    })
  })

  it('after a collapse the pile settles: no block rises more than a few centimetres over where it was dropped, none ends in the air, the same every run', () => {
    const first = collapse()
    const rise = riseWhile(first.pieces, first.run, 6)
    // a block born a few centimetres into the one under it is lifted out of that overlap, and the one under it out of its own: a few centimetres, never a metre
    for (const r of rise) expect(r).toBeLessThan(0.1)
    for (const p of first.pieces) {
      expect(standsOnSomething(p, first.pieces, 0.04)).toBe(true)
      expect(Math.hypot(...p.velocity)).toBeLessThan(0.1)
    }
    const again = collapse()
    again.run(6)
    again.pieces.forEach((p, i) => expect(p.root.position.toArray()).toEqual(first.pieces[i].root.position.toArray()))
  })
})
