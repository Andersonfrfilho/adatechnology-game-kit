import { markKitOrigin } from '@adatechnology/game-contracts'
import type * as THREE from 'three'
import type { CaliberDef, CartridgeDims } from '@adatechnology/game-weapons'
import type { ModelKit } from './kit'

/** The shapes the gallery draws: rimfire, straight rimless (`p`), straight rimmed (`rimp`), bottleneck rimless (`r`), bottleneck rimmed (`rr`) and shotgun shell. */
export type CartridgeShape = 'shell' | 'rim' | 'p' | 'rimp' | 'r' | 'rr'

// a bottleneck case narrows to less than this fraction of its diameter at the bullet
const BOTTLENECK_RATIO = 0.8

/** The gallery's cartridge type of a calibre, from its case type, rim and dimensions. */
export function cartridgeShape(caliber: Pick<CaliberDef, 'caseType' | 'rim'>, dims: CartridgeDims): CartridgeShape {
  if (caliber.caseType === 'shell' || caliber.rim === 'shell') return 'shell'
  if (caliber.rim === 'rimfire') return 'rim'
  const isRimmed = caliber.rim === 'rimmed'
  const isBottleneck = dims.projectileDiameter / dims.caseDiameter < BOTTLENECK_RATIO
  if (isBottleneck) return isRimmed ? 'rr' : 'r'
  return isRimmed ? 'rimp' : 'p'
}

/** Port of the gallery's `cartridge`: the round standing on its base, in millimetres (the gallery shows it enlarged), brass case and copper or lead bullet. */
export function buildCartridge(kit: ModelKit, dims: CartridgeDims, shape: CartridgeShape): THREE.Group {
  const { M, cylinderY } = kit
  const group = markKitOrigin(kit.group(), { owner: 'game-weapons-three', kind: 'ammunition', id: shape })
  const radius = dims.caseDiameter / 2
  const bulletRadius = dims.projectileDiameter / 2
  const caseLength = dims.caseLength
  if (shape === 'shell') {
    cylinderY(group, radius, caseLength * 0.8, M.shell, 0, caseLength * 0.6, 0, 14)
    cylinderY(group, radius * 1.03, caseLength * 0.22, M.brass, 0, caseLength * 0.11, 0, 14)
    cylinderY(group, radius * 1.08, 1.2, M.brass, 0, 0.6, 0, 14)
    return group
  }
  if (shape === 'rim' || shape === 'rimp' || shape === 'rr') cylinderY(group, radius * 1.15, 1.2, M.brass, 0, 0.6, 0, 14)
  const extra = dims.overallLength - caseLength
  if (shape === 'r' || shape === 'rr') {
    const bodyHeight = caseLength * 0.78
    const shoulder = caseLength * 0.08
    const neck = caseLength - bodyHeight - shoulder
    const neckRadius = bulletRadius + 0.35
    cylinderY(group, radius, bodyHeight, M.brass, 0, bodyHeight / 2, 0, 14)
    cylinderY(group, neckRadius, shoulder, M.brass, 0, bodyHeight + shoulder / 2, 0, 14, radius)
    cylinderY(group, neckRadius, neck, M.brass, 0, bodyHeight + shoulder + neck / 2, 0, 14)
    cylinderY(group, bulletRadius, extra * 0.3, M.copper, 0, caseLength + extra * 0.15, 0, 14)
    cylinderY(group, bulletRadius, extra * 0.7, M.copper, 0, caseLength + extra * 0.3 + extra * 0.35, 0, 14, bulletRadius * 0.12)
    return group
  }
  const bullet = shape === 'rim' || shape === 'rimp' ? M.lead : M.copper
  cylinderY(group, radius, caseLength, M.brass, 0, caseLength / 2, 0, 14)
  cylinderY(group, bulletRadius, extra * 0.45, bullet, 0, caseLength + extra * 0.225, 0, 14)
  cylinderY(group, bulletRadius, extra * 0.55, bullet, 0, caseLength + extra * 0.45 + extra * 0.275, 0, 14, bulletRadius * 0.45)
  return group
}

/** An empty case in metres, lying along x with the base at the origin: the brass the weapon throws out. */
export function buildCasing(kit: ModelKit, dims: CartridgeDims, shape: CartridgeShape): { group: THREE.Group; radius: number; length: number } {
  const { M, cylinderX } = kit
  const group = markKitOrigin(kit.group(), { owner: 'game-weapons-three', kind: 'ammunition', id: shape })
  const radius = dims.caseDiameter / 2000
  const length = dims.caseLength / 1000
  if (shape === 'shell') {
    const scale = length / 0.07
    cylinderX(group, 0.0105 * scale, 0.05 * scale, M.shell, 0.008 * scale, 0, 0, 14)
    cylinderX(group, 0.011 * scale, 0.016 * scale, M.brass, -0.025 * scale, 0, 0, 14)
    return { group, radius: 0.0105 * scale, length }
  }
  if (shape === 'r' || shape === 'rr') {
    cylinderX(group, radius, length * 0.75, M.brass, -length * 0.12, 0, 0, 12)
    cylinderX(group, radius * 0.62, length * 0.25, M.brass, length * 0.37, 0, 0, 12, radius * 0.55)
  } else cylinderX(group, radius, length, M.brass, 0, 0, 0, 12)
  return { group, radius, length }
}

/** A live round in metres, lying along x with the base at the origin: what is loaded into a weapon and what a clear throws out. */
export function buildRound(kit: ModelKit, dims: CartridgeDims, shape: CartridgeShape): { group: THREE.Group; radius: number } {
  const group = markKitOrigin(kit.group(), { owner: 'game-weapons-three', kind: 'ammunition', id: shape })
  const cartridge = buildCartridge(kit, dims, shape)
  cartridge.scale.setScalar(0.001)
  cartridge.rotation.z = -Math.PI / 2
  group.add(cartridge)
  return { group, radius: dims.caseDiameter / 2000 }
}
