import type * as THREE_NS from 'three'
import { sharedGeometry } from './geometry-cache'
import type { ModelKit, Parent } from './kit'
import type { RifleContext } from './rifle-context'
import { profileSolid } from './wood-profile'

// The Kalashnikov family as the reference photos show it (AK-47, AKM, AK-74, AKS-74U, RPK; Wikimedia Commons): metres in the model's frame, x from the butt to the muzzle, y up,
// z to the right.

/**
 * The stamped receiver: low and long, its belly rounding up into the stock tang, the dust cover on top rising towards the rear sight block that stands on the front trunnion,
 * the long selector lever on the right with its finger tab, and the rivets of the trunnions. The bolt and its handle on the right are the generic rifle's.
 */
export function buildKalashnikovReceiver(context: RifleContext): void {
  const { kit, group, receiverStart: x0, receiverEnd: x1, receiverWidth: wR, receiverLength: RL, receiverHeight: hR, barrelY: by } = context
  const { M, box, cylinderZ } = kit
  const bottom = -hR / 2
  profileSolid(kit, group, [[x0, 0.015, bottom + 0.012], [x0 + 0.035, 0.015, bottom], [x1, 0.015, bottom]], wR * 0.9, M.metal)
  profileSolid(kit, group, [[x0 + 0.002, 0.021, 0.012], [x0 + RL * 0.5, 0.027, 0.012], [x1 - 0.004, 0.031, 0.012]], wR * 0.8, M.metal)
  for (let i = 0; i < 4; i++) box(group, 0.004, 0.003, wR * 0.6, M.dark, x0 + 0.03 + i * 0.012, 0.024 + i * 0.0006, 0)
  box(group, 0.008, 0.008, 0.01, M.metal, x0 + 0.004, 0.02, 0)
  profileSolid(kit, group, [[x1 - 0.008, 0.034, by - 0.012], [x1 + 0.02, 0.031, by - 0.012], [x1 + 0.046, 0.024, by - 0.008]], wR * 0.7, M.metal)
  box(group, 0.036, 0.004, wR * 0.5, M.dark, x1 + 0.018, 0.037, 0, -0.04)
  box(group, 0.006, 0.008, wR * 0.5, M.dark, x1 + 0.002, 0.039, 0)
  // the selector: a long flat lever along the right side, the finger tab bent down at its front
  box(group, RL * 0.48, 0.011, 0.003, M.metal, x0 + RL * 0.36, 0.004, wR * 0.46 + 0.0015, -0.05)
  box(group, 0.012, 0.016, 0.003, M.metal, x0 + RL * 0.62, -0.006, wR * 0.46 + 0.0015, -0.3)
  for (const [x, y] of [[x0 + 0.012, -0.012], [x0 + 0.026, -0.012], [x1 - 0.03, -0.014], [x1 - 0.016, -0.014], [x1 - 0.03, 0.002]] as const) {
    cylinderZ(group, 0.002, wR * 0.9 + 0.002, M.dark, x, y, 0, 8)
  }
}

/** A curved band (a ring sector) between two radii about `centre`, from `start` to `end` (radians), extruded `depth` across the weapon and centred on z. */
const arcBand = (kit: ModelKit, parent: Parent, centre: readonly [number, number], radii: readonly [number, number], angles: readonly [number, number], depth: number, material: THREE_NS.Material): THREE_NS.Mesh => {
  const { THREE } = kit
  const geometry = sharedGeometry(kit, `arc:${JSON.stringify([centre, radii, angles, depth])}`, () => {
    const [inner, outer] = radii
    const [start, end] = angles
    const shape = new THREE.Shape()
    shape.absarc(centre[0], centre[1], outer, start, end, false)
    shape.absarc(centre[0], centre[1], inner, end, start, true)
    shape.closePath()
    const bevel = Math.min(0.0012, depth / 6)
    const extruded = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, curveSegments: 24, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 })
    extruded.translate(0, 0, -(depth - bevel * 2) / 2)
    return extruded
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

// the 30-round magazine bends forward on a radius of about 33 cm; the 40-round one of the RPK is longer on the same curve
const CURVE_RADIUS = 0.33
const MAGAZINE_DEPTH = 0.052
const MAGAZINE_WIDTH = 0.024
const LENGTH_PER_SCALE = 0.2

/**
 * The banana magazine as one smooth curved solid hanging from its pivot (the top of the well at the origin), bending forward, with the two ribs pressed along its sides, the
 * catch lug at the front of its top and the floorplate. Returns how far the reload drops it.
 */
export function buildBananaMagazine(kit: ModelKit, magazine: THREE_NS.Group, material: THREE_NS.Material, scale: number): number {
  const { M, box } = kit
  const length = LENGTH_PER_SCALE * scale
  const span = length / CURVE_RADIUS
  const centre = [CURVE_RADIUS, 0] as const
  const start = Math.PI
  const end = Math.PI + span
  const half = MAGAZINE_DEPTH / 2
  arcBand(kit, magazine, centre, [CURVE_RADIUS - half, CURVE_RADIUS + half], [start, end], MAGAZINE_WIDTH, material)
  for (const radius of [CURVE_RADIUS - half * 0.45, CURVE_RADIUS + half * 0.45]) {
    arcBand(kit, magazine, centre, [radius - 0.0025, radius + 0.0025], [start + span * 0.08, end - span * 0.06], MAGAZINE_WIDTH + 0.003, material)
  }
  box(magazine, 0.01, 0.008, MAGAZINE_WIDTH * 0.7, M.metal, half - 0.002, 0.002, 0)
  const bottom: readonly [number, number] = [centre[0] + CURVE_RADIUS * Math.cos(end), centre[1] + CURVE_RADIUS * Math.sin(end)]
  const plate = box(magazine, MAGAZINE_DEPTH + 0.006, 0.006, MAGAZINE_WIDTH + 0.004, material, bottom[0], bottom[1], 0, span)
  plate.position.x += Math.sin(span) * 0.002
  plate.position.y -= Math.cos(span) * 0.002
  return length + 0.04
}
