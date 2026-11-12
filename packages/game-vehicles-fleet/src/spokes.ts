import type { VehicleContext } from '@adatechnology/game-vehicles'
import type { Mesh } from 'three'

const THICKNESS_STEP = 0.0625
const THINNEST = 0.15
const CLEARANCE = 0.0015
const SPOKE_HALF_THICKNESS = 0.02
const DISH_HALF_THICKNESS = 0.025

function sharesPlaneWithDish(reach: number, scale: number): boolean {
  const dishReach = reach * 0.9
  const outer = Math.abs(reach + SPOKE_HALF_THICKNESS * scale - (dishReach + DISH_HALF_THICKNESS))
  const inner = Math.abs(reach - SPOKE_HALF_THICKNESS * scale - (dishReach - DISH_HALF_THICKNESS))
  return outer < CLEARANCE || inner < CLEARANCE
}

/** The spokes of a kit wheel cross at the hub: each is a little thinner than the one before (about its own centre, so the wheel keeps its width), so no two of their faces share a plane. */
export function separateSpokes(context: VehicleContext): void {
  for (const wheel of context.wheels) {
    let previous = 1 + THICKNESS_STEP
    for (const child of wheel.children) {
      const mesh = child as Mesh
      const type = mesh.geometry?.type
      if (!mesh.isMesh || (type !== 'BufferGeometry' && type !== 'BoxGeometry') || mesh.position.z === 0) continue
      const reach = Math.abs(mesh.position.z)
      let scale = previous - THICKNESS_STEP
      while (sharesPlaneWithDish(reach, scale) && scale > THINNEST) scale -= THICKNESS_STEP / 2
      mesh.scale.z = Math.max(scale, THINNEST)
      previous = scale
    }
  }
}
