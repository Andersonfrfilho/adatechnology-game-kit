import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import type { Vec3 } from '../src'
import { physicsOption } from './setup-physics'

const BOARD: [number, number, number] = [1.2, 0.04, 0.6]
const LAPTOP: [number, number, number] = [0.33, 0.02, 0.23]

/**
 * A table top gone over at `degrees`, its low edge on the floor and held where it lies (asleep), with a laptop asleep on it, as both are once the top has come to rest:
 * returns how high the laptop's lowest point is after `seconds`.
 */
/** A world whose sweep meets the top a piece slides on, as the room's does (`sweepBox` against the destruction world, where the top is an object too). */
class TopSweepWorld extends FakeWorld {
  constructor(private readonly normal: Vec3) {
    super()
  }

  sweepBox(_box: { min: Vec3; max: Vec3 }, _direction: Vec3, distance: number): { object: string; part: string; point: Vec3; normal: Vec3; distance: number } | null {
    return { object: 'top', part: 'body', point: [0, 0, 0], normal: this.normal, distance: distance * 0.1 }
  }
}

const laptopOnTop = (degrees: number, seconds: number, sweptTop = false): number => {
  const scene = new THREE.Scene()
  const a0 = (degrees * Math.PI) / 180
  // the sweep meets the top's board by an edge, facing back up the slope (as the room's did, steeper than a floor): what the piece slides into
  const world = sweptTop ? new TopSweepWorld([Math.cos(a0), Math.sin(a0) * Math.cos(a0) * 1.1, 0]) : new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  const add = (id: string, size: [number, number, number], material: string, mass: number): THREE.Group => {
    world.addObject(id, [partState('body', material, { mass })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    const root = new THREE.Group()
    root.add(mesh)
    scene.add(root)
    renderer.bind(id, root, { parts: { body: mesh } })
    return root
  }
  const a = (degrees * Math.PI) / 180
  const up = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0)
  const board = add('top', BOARD, 'wood', 40)
  board.rotation.set(0, 0, a)
  board.position.set(0, (BOARD[0] / 2) * Math.sin(a) + (BOARD[1] / 2) * Math.cos(a), 0)
  board.updateMatrixWorld(true)
  const laptop = add('laptop', LAPTOP, 'aluminium', 2)
  laptop.rotation.set(0, 0, a)
  laptop.position.copy(board.position).addScaledVector(up, BOARD[1] / 2 + LAPTOP[1] / 2 + 0.001)
  laptop.updateMatrixWorld(true)
  renderer.makePiece('top').sleeping = true
  renderer.makePiece('laptop').sleeping = true
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
  laptop.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(laptop).min.y
}

describe('what lies asleep on a top steeper than its friction holds slides off', () => {
  it('a laptop asleep on a top at 42 degrees (aluminium on wood holds up to about 26) wakes and slides down to the floor', () => {
    expect(laptopOnTop(42, 3)).toBeLessThan(0.08)
  })

  it('the sweep that meets the top it lies on does not hold it there: it slides down all the same', () => {
    expect(laptopOnTop(42, 3, true)).toBeLessThan(0.08)
  })

  it('on a top at 12 degrees it stays where it lies', () => {
    expect(laptopOnTop(12, 3)).toBeGreaterThan(0.1)
  })
})

/**
 * The room's long table (4.4 x 0.9 m, a top of six boards on corner legs) with one corner leg gone: it goes over on that corner, about the line through the feet of the two
 * legs beside it, until the corner of the top meets the floor (41.6 degrees). Returns the lowest point of each thing laid on its top, after `seconds`.
 */
const tableOnItsCorner = (things: ReadonlyArray<{ id: string; size: [number, number, number]; material: string; mass: number; at: [number, number] }>, seconds: number): number[] => {
  const L = 4.4
  const D = 0.9
  const H = 0.04
  const TOP = 0.78
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  const boards = Array.from({ length: 6 }, (_, i) => `board_${i}`)
  const legs: Array<[string, number, number]> = [['leg_left_far', -L / 2 + 0.05, D / 2 - 0.05], ['leg_right_near', L / 2 - 0.05, -D / 2 + 0.05], ['leg_right_far', L / 2 - 0.05, D / 2 - 0.05]]
  world.addObject('table', [...boards.map((id) => partState(id, 'wood', { mass: 3.3 })), ...legs.map(([id]) => partState(id, 'wood', { mass: 1.4 }))])
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  boards.forEach((id, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, H, D / 6))
    m.position.set(0, TOP - H / 2, -D / 2 + (D / 6) * (i + 0.5))
    root.add(m)
    meshes[id] = m
  })
  for (const [id, x, z] of legs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, TOP - H, 0.05))
    m.position.set(x, (TOP - H) / 2, z)
    root.add(m)
    meshes[id] = m
  }
  // over on the corner of the missing leg (-x, -z), about the line through the feet of the legs beside it
  const a: THREE.Vector3 = new THREE.Vector3(legs[0]![1], 0, legs[0]![2])
  const b: THREE.Vector3 = new THREE.Vector3(legs[1]![1], 0, legs[1]![2])
  const axis = b.clone().sub(a).normalize()
  const turn = new THREE.Quaternion().setFromAxisAngle(axis, (41.6 * Math.PI) / 180)
  const corner = new THREE.Vector3(-L / 2, TOP, -D / 2).sub(a).applyQuaternion(turn).add(a)
  // the turn that brings that corner down (and not up) is the one that leaves it lowest
  if (corner.y > 0.1) turn.setFromAxisAngle(axis, (-41.6 * Math.PI) / 180)
  root.quaternion.copy(turn)
  root.position.copy(a.clone().sub(a.clone().applyQuaternion(turn)))
  root.position.y += 0.002
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('table', root, { parts: meshes })
  const roots = things.map((t) => {
    world.addObject(t.id, [partState('body', t.material, { mass: t.mass })])
    const m = new THREE.Mesh(new THREE.BoxGeometry(...t.size))
    const r = new THREE.Group()
    r.add(m)
    scene.add(r)
    r.quaternion.copy(turn)
    r.position.copy(new THREE.Vector3(t.at[0], TOP + t.size[1] / 2 + 0.002, t.at[1]).applyQuaternion(turn).add(root.position))
    r.updateMatrixWorld(true)
    renderer.bind(t.id, r, { parts: { body: m } })
    return r
  })
  renderer.makePiece('table')
  for (const t of things) renderer.makePiece(t.id).sleeping = true
  for (let t = 0; t < seconds; t += 1 / 60) renderer.update(1 / 60)
  return roots.map((r) => {
    r.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(r).min.y
  })
}

describe('the long table on the corner of a leg it lost', () => {
  it('the phone, the can and the laptop asleep on its top slide off to the floor', () => {
    const lows = tableOnItsCorner(
      [
        { id: 'phone', size: [0.075, 0.009, 0.15], material: 'plastic', mass: 0.2, at: [1.2, 0.1] },
        { id: 'can', size: [0.066, 0.12, 0.066], material: 'steel', mass: 0.35, at: [0.4, -0.15] },
        { id: 'laptop', size: [0.33, 0.02, 0.23], material: 'aluminium', mass: 2, at: [1.6, 0.05] },
      ],
      6,
    )
    for (const low of lows) expect(low).toBeLessThan(0.1)
  })
})
