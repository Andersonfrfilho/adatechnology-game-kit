import type * as THREE_NS from 'three'
import type { DestructibleSpec, Vec3 } from '@adatechnology/game-contracts'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { WeaponDef } from '@adatechnology/game-weapons'
import { mergeByMaterial } from '@adatechnology/game-shapes-three'

import type { ItemModels } from './item-models'
import { buildWeaponModelById } from './models'
import { buildTripodLegs } from './models/attachments/tripod'
import { modelKit } from './models/kit'
import { defaultWeaponProps } from './weapon-item-model'
import type { WeaponProps } from './weapon-item-model'

const MODEL_BODY = 'body'

/**
 * The prop of a weapon the gallery drew (or that an item model draws, `buildItemWeaponModel`), for a counter or the floor: its model lying on the side, centred on the footprint with its underside on the floor, joined into one mesh per
 * material (the hands keep the model with its pivots, `buildWeaponModelById`), every mesh naming the one rigid part (`body`) that moves it. The size of that part is left in
 * `userData.footprint` for `modeledPropSpec`.
 */
export function buildModeledProp(THREE: typeof THREE_NS, def: Pick<WeaponDef, 'id'>, name: string, decorate?: (root: THREE_NS.Object3D) => void, items?: ItemModels, props: WeaponProps = defaultWeaponProps()): THREE_NS.Group | undefined {
  const model = buildWeaponModelById(THREE, def.id) ?? (() => {
    const root = props.buildItemModel(THREE, def, items)
    return root ? { root } : undefined
  })()
  if (!model) return undefined
  decorate?.(model.root)
  const group = markKitOrigin(new THREE.Group(), { owner: 'game-weapons-three', kind: 'weapon', id: def.id })
  group.name = name
  const box = new THREE.Box3().setFromObject(model.root)
  const center = box.getCenter(new THREE.Vector3())
  model.root.position.set(-center.x, -box.min.y, -center.z)
  group.add(model.root)
  group.updateMatrixWorld(true)
  for (const mesh of mergeByMaterial(THREE, model.root, group)) {
    mesh.userData.destructionPart = MODEL_BODY
    group.add(mesh)
  }
  group.remove(model.root)
  const size = box.getSize(new THREE.Vector3())
  group.userData.footprint = [size.x, size.y, size.z]
  return group
}

// where the tripod joins the gun (along it, under it)
const TRIPOD_HEAD = { x: 0.4, y: -0.1 }

/** A modeled weapon on a tripod of three steel legs under its middle (the same legs the `tripod` accessory draws in the hands). */
export function buildTripodMountedProp(THREE: typeof THREE_NS, def: Pick<WeaponDef, 'id'>, name: string, items?: ItemModels, props?: WeaponProps): THREE_NS.Group | undefined {
  return buildModeledProp(
    THREE,
    def,
    name,
    (root) => {
      const kit = modelKit(THREE)
      buildTripodLegs(kit, kit.pivot(root, TRIPOD_HEAD.x, TRIPOD_HEAD.y, 0))
    },
    items,
    props,
  )
}

/** The destruction spec of a modeled prop: one steel box of its measures, with the real mass of the weapon. */
export function modeledPropSpec(root: unknown, def: Pick<WeaponDef, 'mass'>, name: string): DestructibleSpec {
  const footprint = ((root as THREE_NS.Object3D).userData.footprint ?? [0.3, 0.1, 0.1]) as Vec3
  const size: Vec3 = [Math.max(0.02, footprint[0]), Math.max(0.02, footprint[1]), Math.max(0.02, footprint[2])]
  return { name, parts: [{ id: MODEL_BODY, material: 'steel', shape: { kind: 'box', size }, position: [0, size[1] / 2, 0], mass: def.mass }], joints: [], tags: ['weapon'] }
}
