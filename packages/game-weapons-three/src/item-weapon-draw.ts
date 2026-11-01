import type * as THREE_NS from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { WeaponDef } from '@adatechnology/game-weapons'

import { DEFAULT_ITEM_MODELS } from './item-models'
import type { ItemModels } from './item-models'

export type DrawItemWeaponParams = {
  readonly THREE: typeof THREE_NS
  readonly def: Pick<WeaponDef, 'id'>
  readonly items: ItemModels | undefined
  /** The item model id that draws the weapon. */
  readonly itemId: string
  readonly turn: number
  readonly flip: boolean
}

type Context = { readonly THREE: typeof THREE_NS; readonly group: THREE_NS.Group; readonly root: THREE_NS.Object3D }

const sizeOf = ({ THREE, group, root }: Context): THREE_NS.Vector3 => {
  group.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
}

// the long axis along x, the thinnest along y, then the quarter turns the data asks for
function layFlat(context: Context, turn: number): void {
  const { THREE, root } = context
  let size = sizeOf(context)
  if (size.y > size.x && size.y >= size.z) root.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -Math.PI / 2)
  else if (size.z > size.x && size.z > size.y) root.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.PI / 2)
  size = sizeOf(context)
  if (size.z < size.y) root.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2)
  if (turn) root.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), (turn * Math.PI) / 2)
}

// the reach across the floor (z) of each half of the item, split at the middle of its length
function reachOfHalves({ THREE, root }: Context): number[] {
  const box = new THREE.Box3().setFromObject(root)
  const middle = (box.min.x + box.max.x) / 2
  const span = [
    [Infinity, -Infinity],
    [Infinity, -Infinity],
  ]
  const point = new THREE.Vector3()
  root.traverse((node) => {
    const mesh = node as THREE_NS.Mesh
    const position = mesh.isMesh ? mesh.geometry.getAttribute('position') : undefined
    if (!position) return
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
      const half = span[point.x > middle ? 1 : 0]
      half[0] = Math.min(half[0], point.z)
      half[1] = Math.max(half[1], point.z)
    }
  })
  return span.map(([low, high]) => high - low)
}

// the head is the wider end: it goes to +x
function headToPositiveX(context: Context, flip: boolean): void {
  const reach = reachOfHalves(context)
  if (reach[0] > reach[1] !== flip) context.root.rotateOnWorldAxis(new context.THREE.Vector3(0, 1, 0), Math.PI)
}

// origin at the bottom centre, an empty `handle` at the narrow end where the hand closes
function restOnFloor({ THREE, group, root }: Context): void {
  group.updateMatrixWorld(true)
  const laid = new THREE.Box3().setFromObject(root)
  const centre = laid.getCenter(new THREE.Vector3())
  root.position.sub(new THREE.Vector3(centre.x, laid.min.y, centre.z))
  const length = laid.max.x - laid.min.x
  const handle = new THREE.Object3D()
  handle.name = 'handle'
  handle.position.set(-length * 0.35, 0, 0)
  group.add(handle)
  root.traverse((node) => {
    const mesh = node as THREE_NS.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
}

export function drawItemWeapon({ THREE, def, items, itemId, turn, flip }: DrawItemWeaponParams): THREE_NS.Group {
  const { root } = (items ?? DEFAULT_ITEM_MODELS).build(THREE, { id: itemId, category: 'weapon', size: [0, 0, 0], model: itemId })
  const group = markKitOrigin(new THREE.Group(), { owner: 'game-weapons-three', kind: 'weapon', id: def.id })
  group.name = def.id
  group.add(root)
  const context: Context = { THREE, group, root }
  layFlat(context, turn)
  headToPositiveX(context, flip)
  restOnFloor(context)
  return group
}
