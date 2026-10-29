import { catenary, createCord } from '@adatechnology/game-interactables-three'
import { buildBeltBox } from './belt-box'
import type { AttachmentModel, AttachmentModelBuilder } from './types'

// the pack hangs behind and below the stock, as worn on the back; the belt runs from it to the feed of the weapon
const PACK_AT: [number, number, number] = [-0.55, -0.4, 0.1]
const PACK_SIZE: [number, number, number] = [0.3, 0.42, 0.2]
const BELT_SAG = 0.14
const BELT_POINTS = 16
const BELT_ROUND_EVERY = 2

/** The ammunition backpack worn on the back and its belt: the pack, the feed box on the weapon (the belt box of the gallery) and the belt of rounds between them on a catenary. */
export const buildAmmoBackpack: AttachmentModelBuilder = ({ kit, frame, model }): AttachmentModel => {
  const { THREE, M, box, cylinderZ } = kit
  const group = kit.group()
  const pack: [number, number, number] = [PACK_AT[0] - frame.position[0], PACK_AT[1] - frame.position[1], PACK_AT[2] - frame.position[2]]
  box(group, ...PACK_SIZE, M.olive, ...pack)
  box(group, PACK_SIZE[0] * 1.02, 0.03, PACK_SIZE[2] * 1.02, M.dark, pack[0], pack[1] + PACK_SIZE[1] / 2, pack[2])
  box(group, 0.04, PACK_SIZE[1] * 0.9, 0.012, M.tan, pack[0] + PACK_SIZE[0] / 2, pack[1], pack[2] - 0.04)
  const feed = kit.pivot(group, 0, 0, 0)
  buildBeltBox(kit, feed)
  const points = catenary([pack[0] + PACK_SIZE[0] / 2, pack[1] + PACK_SIZE[1] * 0.3, pack[2]], [0, 0, 0], BELT_SAG, BELT_POINTS)
  const strip = createCord(THREE, points, 0.0035, M.metal)
  group.add(strip)
  points.forEach((point, index) => {
    if (index % BELT_ROUND_EVERY === 0) cylinderZ(group, 0.0045, 0.02, M.brass, point[0], point[1], point[2], 8)
  })
  return {
    object: group,
    ...(model.parts.belt ? { hides: [model.parts.belt] } : {}),
    dispose() {
      strip.geometry.dispose()
    },
  }
}
