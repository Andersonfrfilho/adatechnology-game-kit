import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

type Size = [number, number, number]

/** A crater 1.2 m across and 0.4 m deep at (2, 0): the ground a grenade leaves. */
const craterGround = (x: number, z: number): number => {
  const d = Math.hypot(x - 2, z)
  return d < 0.6 ? -0.4 * (1 - (d / 0.6) ** 2) : 0
}

interface Drop {
  readonly size: Size
  /** Turn about z (rad): the long axis (x) from level. */
  readonly tilt: number
  readonly x?: number
  readonly yaw?: number
  readonly dt?: number
  readonly ground?: (x: number, z: number) => number
  readonly material?: string
  readonly mass?: number
}

/** One piece dropped on its lower end, tilted, and run for 12 s: how it ends (up extent of its box, speed, asleep, how far it is held over the ground). */
function drop(o: Drop): { up: number; speed: number; sleeping: boolean; gap: number } {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const groundAt = o.ground ?? ((): number => 0)
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt })
  world.addObject('lath', [partState('body', o.material ?? 'wood_soft', { mass: o.mass ?? 1.2 })])
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...o.size))
  const root = new THREE.Group()
  root.add(mesh)
  root.rotation.set(0, o.yaw ?? 0, o.tilt, 'YXZ')
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const x = o.x ?? 0
  root.position.set(x, groundAt(x, 0) - box.min.y + 0.005, 0)
  scene.add(root)
  renderer.bind('lath', root, { parts: { body: mesh } })
  const piece = renderer.makePiece('lath')
  const dt = o.dt ?? 1 / 60
  for (let t = 0; t < 12; t += dt) renderer.update(dt)
  root.updateMatrixWorld(true)
  const end = new THREE.Box3().setFromObject(root)
  // at rest an end of it lies on the ground under it unless a hole is there (a lath over a crater's edge may hang over it): an end held up over ground no lower than
  // under its centre of mass is a lath balanced in the air
  const along = o.size.indexOf(Math.max(...o.size))
  const pointAt = (fraction: number): THREE.Vector3 => new THREE.Vector3().setComponent(along, (fraction * o.size[along]!) / 2).applyMatrix4(root.matrixWorld)
  const middle = pointAt(0)
  const underMiddle = groundAt(middle.x, middle.z)
  const gaps = [-1, 1].map((sign) => {
    const tip = pointAt(sign)
    const under = groundAt(tip.x, tip.z)
    return under < underMiddle - 0.05 ? 0 : tip.y - under - (Math.min(...o.size) / 2) * 1.5
  })
  const gap = Math.max(...gaps)
  return { up: end.max.y - end.min.y, speed: Math.hypot(...piece.velocity), sleeping: piece.sleeping, gap }
}

const LATH: Size = [1.5, 0.025, 0.07]
const SHELF_BOARD: Size = [1.16, 0.018, 0.33]
const SIDE: Size = [0.018, 1.95, 0.33]

describe('long and thin debris lies down', () => {
  it.each([
    ['a 1.5 m lath at 45 degrees on one end', { size: LATH, tilt: Math.PI / 4 }],
    ['a 1.5 m lath at 70 degrees on one end', { size: LATH, tilt: (70 * Math.PI) / 180 }],
    ['a lath at 45 degrees turned 30 degrees about the vertical', { size: LATH, tilt: Math.PI / 4, yaw: Math.PI / 6 }],
    ['a lath at 45 degrees on its edge (thin side down)', { size: [1.5, 0.07, 0.025] as Size, tilt: Math.PI / 4 }],
    ['a shelf board at 45 degrees on one end', { size: SHELF_BOARD, tilt: Math.PI / 4, mass: 3 }],
    ['a bookcase side standing on its end, a little off plumb', { size: SIDE, tilt: 0.12, mass: 6 }],
    ['a lath at 45 degrees with its lower end in a crater', { size: LATH, tilt: Math.PI / 4, x: 1.7, ground: craterGround }],
    ['a lath at 45 degrees with its lower end on the rim of a crater', { size: LATH, tilt: -Math.PI / 4, x: 1.4, ground: craterGround }],
    ['a lath at 45 degrees stepped at 20 frames a second (a loaded machine)', { size: LATH, tilt: Math.PI / 4, dt: 1 / 20 }],
    ['a lath at 45 degrees stepped at 12 frames a second', { size: LATH, tilt: Math.PI / 4, dt: 1 / 12 }],
  ])('%s: it ends lying on the ground, still and asleep', (_name, o) => {
    const end = drop(o)
    expect(end.speed).toBeLessThan(0.05)
    expect(end.sleeping).toBe(true)
    expect(end.gap).toBeLessThan(0.05)
  })
})
