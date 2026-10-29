import type { Vec3 } from '@adatechnology/game-contracts'

import { createBodySpec } from '../../src'
import type { BodySpec, JointId } from '../../src'

type Matrix = readonly [Vec3, Vec3, Vec3]
type Node = { readonly joint: JointId; readonly parent?: JointId; readonly position: Vec3; readonly rotation?: Vec3 }

const IDENTITY: Matrix = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]

const multiply = (a: Matrix, b: Matrix): Matrix =>
  [0, 1, 2].map((row) => [0, 1, 2].map((column) => a[row]![0] * b[0]![column]! + a[row]![1] * b[1]![column]! + a[row]![2] * b[2]![column]!)) as unknown as Matrix

const apply = (m: Matrix, v: Vec3): Vec3 => [0, 1, 2].map((row) => m[row]![0] * v[0] + m[row]![1] * v[1] + m[row]![2] * v[2]) as Vec3

/** three.js Euler order XYZ: R = Rx · Ry · Rz. */
const euler = ([x, y, z]: Vec3): Matrix => {
  const rx: Matrix = [
    [1, 0, 0],
    [0, Math.cos(x), -Math.sin(x)],
    [0, Math.sin(x), Math.cos(x)],
  ]
  const ry: Matrix = [
    [Math.cos(y), 0, Math.sin(y)],
    [0, 1, 0],
    [-Math.sin(y), 0, Math.cos(y)],
  ]
  const rz: Matrix = [
    [Math.cos(z), -Math.sin(z), 0],
    [Math.sin(z), Math.cos(z), 0],
    [0, 0, 1],
  ]
  return multiply(multiply(rx, ry), rz)
}

const sideNodes = (side: 1 | -1): Node[] => {
  const L = side > 0 ? 'L' : 'R'
  return [
    { joint: `hip${L}`, parent: 'hip', position: [side * 0.1, -0.06, 0], rotation: [side > 0 ? 0.12 : -0.14, 0, 0] },
    { joint: `knee${L}`, parent: `hip${L}`, position: [0, -0.42, 0], rotation: [0.12, 0, 0] },
    { joint: `ankle${L}`, parent: `knee${L}`, position: [0, -0.42, 0] },
    { joint: `shoulder${L}`, parent: 'spine', position: [side * 0.27, 0.44, 0], rotation: [-1.25, 0, side * 0.1] },
    { joint: `elbow${L}`, parent: `shoulder${L}`, position: [0, -0.3, 0], rotation: [-0.25, 0, 0] },
    { joint: `wrist${L}`, parent: `elbow${L}`, position: [0, -0.29, 0] },
  ]
}

/** The zombie of the Galeria 3D do Arsenal (`buildZombie`, arsenal:870), its segment groups as joints, in the order the page nests them. */
const ARSENAL_NODES: readonly Node[] = [
  { joint: 'hip', position: [0, 0.95, 0] },
  { joint: 'spine', parent: 'hip', position: [0, 0.09, 0], rotation: [0.25, 0, 0] },
  { joint: 'neck', parent: 'spine', position: [0, 0.53, 0] },
  { joint: 'head', parent: 'neck', position: [0, 0.09, 0.01] },
  { joint: 'jaw', parent: 'head', position: [0, 0, 0.035] },
  ...sideNodes(1),
  ...sideNodes(-1),
]

/** World positions of the Arsenal's segment pivots (the root is not moved by `show`): what `grenadeAt` measures the blast from. */
export const arsenalJoints = (): Record<JointId, Vec3> => {
  const world = new Map<JointId, { position: Vec3; rotation: Matrix }>()
  for (const node of ARSENAL_NODES) {
    const parent = node.parent ? world.get(node.parent) : { position: [0, 0, 0] as Vec3, rotation: IDENTITY }
    if (!parent) throw new Error(`parent of ${node.joint} not built yet`)
    const offset = apply(parent.rotation, node.position)
    world.set(node.joint, {
      position: [parent.position[0] + offset[0], parent.position[1] + offset[1], parent.position[2] + offset[2]],
      rotation: multiply(parent.rotation, node.rotation ? euler(node.rotation) : IDENTITY),
    })
  }
  return Object.fromEntries([...world].map(([joint, entry]) => [joint, entry.position])) as Record<JointId, Vec3>
}

export const ARSENAL_BODY: BodySpec = createBodySpec({ id: 'arsenal', heightMetres: 1.8, joints: arsenalJoints() })
