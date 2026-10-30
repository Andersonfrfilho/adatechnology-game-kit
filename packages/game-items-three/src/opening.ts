import type * as THREE_NS from 'three'

import data from './data/opening.json'
import { itemFamily } from './destruction'

/**
 * How a sealed model looks once open: `cut_lid` (a tin opened with a can opener: the lid cut along the rim and bent up on a hinge, the food showing),
 * `peel_lid` (a flat tin with a ring pull: the lid rolled back along its length) and `pull_tab` (a drink can: the scored mouth pushed in under the tab).
 */
export type ItemOpeningStyle = 'cut_lid' | 'peel_lid' | 'pull_tab'

export interface ItemOpening {
  readonly style: ItemOpeningStyle
  /** Colour of what shows inside (`#rrggbb`); a dark inside when the data gives none. */
  readonly food?: string
}

type OpeningRow = { readonly style?: ItemOpeningStyle | 'none'; readonly food?: string }
const FAMILIES = data.families as Readonly<Record<string, OpeningRow>>
const MODELS = data.models as Readonly<Record<string, OpeningRow>>

/** The opened look of a model (`data/opening.json`: its family's style, the model's own entry over it), or undefined for a model that does not open. */
export const itemOpening = (modelId: string): ItemOpening | undefined => {
  const family = itemFamily(modelId)
  const row = { ...(family === undefined ? {} : FAMILIES[family]), ...MODELS[modelId] }
  if (row.style === undefined || row.style === 'none') return undefined
  return { style: row.style, ...(row.food === undefined ? {} : { food: row.food }) }
}

/** Name of the group `openItem` adds to the root. */
export const OPENING_NAME = 'opening'

const INSIDE = 0x14110e
const CUT_EDGE = 0xd9dde2
const LID = 0xb9bec4

/** Box of the drawn meshes in the root's own space (its units, whatever its pose), decals and debris left out. */
const localBox = (T: typeof THREE_NS, root: THREE_NS.Object3D): THREE_NS.Box3 => {
  root.updateMatrixWorld(true)
  const toRoot = new T.Matrix4().copy(root.matrixWorld).invert()
  const box = new T.Box3()
  const part = new T.Box3()
  const m = new T.Matrix4()
  root.traverse((o) => {
    const mesh = o as THREE_NS.Mesh
    if (!mesh.isMesh || mesh.userData.destructionDebris || mesh.name === OPENING_NAME || mesh.parent?.name === OPENING_NAME) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    part.copy(mesh.geometry.boundingBox!).applyMatrix4(m.multiplyMatrices(toRoot, mesh.matrixWorld))
    box.union(part)
  })
  return box
}

/**
 * Draws the model `modelId` opened on the root `buildItem` returned: a child group named `opening` (marked as decals, `userData.destructionDebris`, so a
 * shot and the liquid ignore it). Measured on the drawn model, so it fits any scale. Once: a second call does nothing. False for a model that does not open.
 */
export function openItem(T: typeof THREE_NS, root: THREE_NS.Object3D, modelId: string): boolean {
  const look = itemOpening(modelId)
  if (!look) return false
  if (root.userData.itemOpened) return true
  const box = localBox(T, root)
  if (box.isEmpty()) return false
  const size = box.getSize(new T.Vector3())
  const centre = box.getCenter(new T.Vector3())
  const top = box.max.y
  const lift = size.y * 0.003
  const sheet = Math.max(size.y * 0.006, 1e-4)
  const group = new T.Group()
  group.name = OPENING_NAME
  group.position.set(centre.x, top, centre.z)
  const material = (color: number | string, metal = 0): THREE_NS.MeshStandardMaterial =>
    new T.MeshStandardMaterial({ color, metalness: metal, roughness: metal ? 0.45 : 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  const add = (geometry: THREE_NS.BufferGeometry, mat: THREE_NS.Material, y: number, parent: THREE_NS.Object3D = group): THREE_NS.Mesh => {
    const mesh = new T.Mesh(geometry, mat)
    mesh.position.y = y
    mesh.renderOrder = 2
    mesh.userData.destructionDebris = true
    mesh.userData.itemOpening = true
    parent.add(mesh)
    return mesh
  }
  const flat = (geometry: THREE_NS.BufferGeometry): THREE_NS.BufferGeometry => geometry.rotateX(-Math.PI / 2)
  const food = look.food ?? INSIDE

  if (look.style === 'pull_tab') {
    // the scored mouth in front of the rivet, pushed in under the tab: a dark opening about a fifth of the lid wide
    const r = Math.min(size.x, size.z) / 2
    const mouth = add(flat(new T.CircleGeometry(r * 0.2, 24)), material(INSIDE), lift)
    mouth.scale.set(1.15, 1, 0.85)
    mouth.position.z = r * 0.52
  } else if (look.style === 'cut_lid') {
    // the opener cuts just inside the rim: a bright cut edge, the dark of the inner wall, the food a little below, and the lid bent up on the last centimetre left uncut
    const r = Math.min(size.x, size.z) / 2
    add(flat(new T.CircleGeometry(r * 0.88, 40)), material(INSIDE), lift)
    add(flat(new T.CircleGeometry(r * 0.76, 40)), material(food), lift * 2).userData.itemFood = true
    add(flat(new T.RingGeometry(r * 0.86, r * 0.9, 40)), material(CUT_EDGE, 0.9), lift * 3)
    const hinge = new T.Group()
    hinge.position.set(0, lift, -r * 0.86)
    hinge.rotation.x = -1.95
    group.add(hinge)
    const lid = add(new T.CylinderGeometry(r * 0.86, r * 0.86, sheet, 40), material(LID, 0.4), 0, hinge)
    lid.position.z = r * 0.86
  } else {
    // a flat tin: the lid rolled back from the ring end along the length, the food in the tray
    const long = size.x >= size.z ? 'x' : 'z'
    const length = Math.max(size.x, size.z)
    const width = Math.min(size.x, size.z)
    const plane = (a: number, b: number): THREE_NS.BufferGeometry => flat(long === 'x' ? new T.PlaneGeometry(a, b) : new T.PlaneGeometry(b, a))
    add(plane(length * 0.92, width * 0.86), material(INSIDE), lift)
    add(plane(length * 0.84, width * 0.76), material(food), lift * 2).userData.itemFood = true
    const hinge = new T.Group()
    const end = length * 0.46
    if (long === 'x') {
      hinge.position.set(end, lift, 0)
      hinge.rotation.z = -1.7
    } else {
      hinge.position.set(0, lift, end)
      hinge.rotation.x = 1.7
    }
    group.add(hinge)
    const lid = add(long === 'x' ? new T.BoxGeometry(length * 0.9, sheet, width * 0.84) : new T.BoxGeometry(width * 0.84, sheet, length * 0.9), material(LID, 0.4), 0, hinge)
    if (long === 'x') lid.position.x = -length * 0.45
    else lid.position.z = -length * 0.45
  }
  root.add(group)
  root.userData.itemOpened = true
  return true
}

/** Shows how much is left in an opened item: the food inside the rim shrinks with `share` (0..1 of what it held) and is gone when it is eaten up. */
export function setOpeningContents(root: THREE_NS.Object3D, share: number): void {
  const opening = root.getObjectByName(OPENING_NAME)
  if (!opening) return
  const left = Math.max(0, Math.min(1, share))
  opening.traverse((o) => {
    if (!o.userData.itemFood) return
    o.visible = left > 0.02
    // what is left lies in the middle of the bottom: a smaller patch, never less than a third of the tin
    const k = 0.35 + 0.65 * left
    o.scale.set(k, 1, k)
  })
}
