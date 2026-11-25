/** The luggage space under a lid that opens: a tub lined in carpet and the rubber seal along its sill, so the opening never shows the dark inside of the body. */
import type { Material, Mesh } from '../three-types'
import type { Three } from '../types'
import type { ZoneBox } from '../zone-core'

/** The trunk's floor stands this far over the vehicle's ground clearance, its walls this far inside the lid's zone, metres. */
const TRUNK_FLOOR_OVER_CLEARANCE = 0.12
const TRUNK_INSET = 0.05
/** The seal's section, metres. */
const TRUNK_SEAL = 0.025

export type TrunkBayParams = {
  /** The lid's zone, in the vehicle's coordinates. */
  readonly box: ZoneBox
  /** The vehicle's ground clearance, metres. */
  readonly clearance: number
  /** The carpet (seen from inside the tub) and the seal's rubber: lit materials, never black. */
  readonly carpet: Material
  readonly seal: Material
}

/** The tub and the seal, in the vehicle's coordinates, for the caller to add to the vehicle; none when the zone leaves no room for a trunk. */
export function buildTrunkBay(THREE: Three, params: TrunkBayParams): Mesh[] {
  const B = params.box
  const floor = Math.max(B.y0, params.clearance + TRUNK_FLOOR_OVER_CLEARANCE)
  const top = B.y1 - TRUNK_INSET
  const length = B.x1 - B.x0 - 2 * TRUNK_INSET
  const width = B.z1 - B.z0 - 2 * TRUNK_INSET
  if (length <= 0 || width <= 0 || top <= floor) return []
  params.carpet.side = THREE.BackSide
  // the box is seen from inside, through its open top: the top face is not drawn
  const open = new THREE.MeshBasicMaterial({ visible: false })
  const tub = new THREE.Mesh(new THREE.BoxGeometry(length, top - floor, width), [params.carpet, params.carpet, open, params.carpet, params.carpet, params.carpet])
  tub.position.set((B.x0 + B.x1) / 2, (floor + top) / 2, (B.z0 + B.z1) / 2)
  const seal = new THREE.Mesh(new THREE.BoxGeometry(TRUNK_SEAL, TRUNK_SEAL, width), params.seal)
  seal.position.set(B.x0 + TRUNK_INSET, top, (B.z0 + B.z1) / 2)
  for (const mesh of [tub, seal]) {
    mesh.castShadow = false
    mesh.userData.noFollow = true
    mesh.userData.trunkBay = true
  }
  return [tub, seal]
}
