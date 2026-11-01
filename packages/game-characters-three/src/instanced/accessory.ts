import { createRng } from '@adatechnology/game-characters'

import { EXTRAS } from '../rich/accessories/extras'
import { HATS } from '../rich/accessories/hats'
import { createPersonKit } from '../rich/person-kit'
import type { Three, THREE_NS } from '../three'

import { ACCESSORY_BIT } from './identity-layout'

export type AccessoryAttach = 'head' | 'torso'

/** One accessory drawn by the kit's own survivor builder: a hat of `HATS` (`hat`) or a piece of gear of `EXTRAS` (`extra`), in one colour. */
export type KitAccessory = {
  readonly id: string
  /** The bit of `iD.y` that says a body carries it (`ACCESSORY_BIT`). */
  readonly bit: number
  readonly attach: AccessoryAttach
  readonly hat?: string
  readonly extra?: string
  readonly color: number
}

/** The four accessory batches of the kit: a cap, a helmet, a backpack and a hood. */
export const KIT_ACCESSORIES: readonly KitAccessory[] = [
  { id: 'cap', bit: ACCESSORY_BIT.CAP, attach: 'head', hat: 'cap', color: 0x2f4a6a },
  { id: 'helmet', bit: ACCESSORY_BIT.HELMET, attach: 'head', hat: 'helmet', color: 0x4a5238 },
  { id: 'backpack', bit: ACCESSORY_BIT.BACKPACK, attach: 'torso', extra: 'backpack', color: 0x6a4a2a },
  { id: 'hood', bit: ACCESSORY_BIT.EXTRA, attach: 'head', extra: 'hood', color: 0x3a3a40 },
]

/** Where the survivor builder puts the head and the torso (its own frame): the accessory is normalised against these. */
const HEAD_REFERENCE = { center: [0, 1.8, 0], height: 0.363, pivot: [0, 1.64, 0] } as const
const TORSO_REFERENCE = { center: [0, 1.23, 0], height: 0.74, pivot: [0, 0.9, 0] } as const
const ATTACH_BONE: Readonly<Record<AccessoryAttach, number>> = { head: 1, torso: 0 }
const MATERIAL_OWN_COLOR = 6

type Vec3 = readonly [number, number, number]

/**
 * The accessory geometry in a unit frame (the reference head or torso at the origin, one unit tall), tagged for the body shader: `bone`, `vcol` (own colour),
 * `refPivot` and `ppivot`. A batch moves and scales it per variant with `iAcc` (`accessoryPlacement`): baked once, never per variant.
 */
export const buildKitAccessory = (host: Three, accessory: KitAccessory): THREE_NS.BufferGeometry => {
  const kit = createPersonKit(host, { random: createRng(77), createCanvas: () => { throw new Error('game-characters-three: an accessory needs no canvas') } })
  const { THREE, PI, Bx, add, cmat, cap } = kit
  const group = new THREE.Group()
  const color = cmat(accessory.color, undefined)
  if (accessory.hat) HATS.find((hat) => hat.kinds.includes(accessory.hat as string))?.apply({ THREE, PI, Hd: group, add, Bx, cmat, cap, c: color, k: accessory.hat, sp: { hat: {} } })
  if (accessory.extra) EXTRAS[accessory.extra]?.({ THREE, PI, U: group, Hd: group, root: group, add, Bx, cmat, m: color, k: accessory.extra } as never)
  group.updateMatrixWorld(true)
  const reference = accessory.attach === 'head' ? HEAD_REFERENCE : TORSO_REFERENCE
  const parts: THREE_NS.BufferGeometry[] = []
  group.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    const source = geometry.index ? geometry.toNonIndexed() : geometry
    const paint = (mesh.material as THREE_NS.MeshStandardMaterial).color
    parts.push(tag(host, source, { reference, bone: ATTACH_BONE[accessory.attach], paint: [paint.r, paint.g, paint.b] }))
  })
  return merge(host, parts)
}

const tag = (host: Three, source: THREE_NS.BufferGeometry, { reference, bone, paint }: { readonly reference: typeof HEAD_REFERENCE | typeof TORSO_REFERENCE; readonly bone: number; readonly paint: Vec3 }): THREE_NS.BufferGeometry => {
  const position = source.attributes.position as THREE_NS.BufferAttribute
  const normal = source.attributes.normal as THREE_NS.BufferAttribute
  const count = position.count
  const unit = new Float32Array(count * 3)
  const pivot = new Float32Array(count * 3)
  const colors = new Float32Array(count * 4)
  const bones = new Float32Array(count).fill(bone)
  const anchor = reference.pivot.map((value, axis) => (value - reference.center[axis]!) / reference.height)
  for (let index = 0; index < count; index++) {
    unit[index * 3] = (position.getX(index) - reference.center[0]) / reference.height
    unit[index * 3 + 1] = (position.getY(index) - reference.center[1]) / reference.height
    unit[index * 3 + 2] = (position.getZ(index) - reference.center[2]) / reference.height
    pivot.set(anchor, index * 3)
    colors.set([paint[0], paint[1], paint[2], MATERIAL_OWN_COLOR], index * 4)
  }
  const geometry = new host.BufferGeometry()
  geometry.setAttribute('position', new host.BufferAttribute(unit, 3))
  geometry.setAttribute('normal', new host.BufferAttribute(Float32Array.from(normal.array), 3))
  geometry.setAttribute('bone', new host.BufferAttribute(bones, 1))
  geometry.setAttribute('vcol', new host.BufferAttribute(colors, 4))
  geometry.setAttribute('refPivot', new host.BufferAttribute(pivot, 3))
  geometry.setAttribute('ppivot', new host.BufferAttribute(new Float32Array(count * 3), 3))
  return geometry
}

const MERGED: readonly (readonly [string, number])[] = [['position', 3], ['normal', 3], ['bone', 1], ['vcol', 4], ['refPivot', 3], ['ppivot', 3]]

const merge = (host: Three, parts: readonly THREE_NS.BufferGeometry[]): THREE_NS.BufferGeometry => {
  const total = parts.reduce((sum, part) => sum + part.attributes.position!.count, 0)
  const merged = new host.BufferGeometry()
  for (const [name, size] of MERGED) {
    const array = new Float32Array(total * size)
    let offset = 0
    for (const part of parts) {
      array.set(part.attributes[name]!.array as Float32Array, offset)
      offset += part.attributes[name]!.array.length
    }
    merged.setAttribute(name, new host.BufferAttribute(array, size))
  }
  return merged
}

/** Materials of the bone's vertices that count for the placement: a baked body marks skin, hair and trousers as one own-colour material (6), only the eyes and the shirt apart. */
const EYE_MATERIAL = 3
const HIDDEN_PLACEMENT = [0, 0, 0, 0] as const

/**
 * The `iAcc` of a baked body for an accessory: where the accessory goes (the centre of the head, or of the torso) and how big (its height), read from the variant's
 * own geometry, so the same accessory sits right on every one of the 20 variants. The head is the bone-1 vertices without the eyes, the torso the bone-0 ones;
 * a body without them gets a zero scale, so the accessory is not drawn instead of showing up unscaled at the feet.
 */
export const accessoryPlacement = (body: THREE_NS.BufferGeometry, attach: AccessoryAttach): readonly [number, number, number, number] => {
  const position = body.attributes.position as THREE_NS.BufferAttribute
  const bone = body.attributes.bone as THREE_NS.BufferAttribute
  const paint = body.attributes.vcol as THREE_NS.BufferAttribute
  const wanted = ATTACH_BONE[attach]
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let index = 0; index < position.count; index++) {
    if (bone.getX(index) !== wanted || paint.getW(index) === EYE_MATERIAL) continue
    for (let axis = 0; axis < 3; axis++) {
      const value = axis === 0 ? position.getX(index) : axis === 1 ? position.getY(index) : position.getZ(index)
      if (value < min[axis]!) min[axis] = value
      if (value > max[axis]!) max[axis] = value
    }
  }
  if (!Number.isFinite(min[0])) return HIDDEN_PLACEMENT
  return [(min[0]! + max[0]!) / 2, (min[1]! + max[1]!) / 2, (min[2]! + max[2]!) / 2, max[1]! - min[1]!]
}
