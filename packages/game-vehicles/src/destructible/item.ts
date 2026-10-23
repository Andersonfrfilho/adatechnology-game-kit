import type { VehicleContext, VehicleKit } from '../api'
import type { BuildState } from '../api'

export interface VehicleItemOptions {
  state?: BuildState
}

export interface VehicleItem {
  /** Add this to the scene: origin at the centre of the footprint on the floor, front facing +z. */
  root: any
  /** The built vehicle inside it. */
  vehicle: VehicleContext
}

/**
 * Builds vehicle `key` as an item for a viewer that expects the origin at the centre of the footprint on the floor and the front facing +z
 * (the test room). The vehicle itself keeps the kit axes (+x front) inside a turned, centred group. Pass `root` as `frame` to
 * `createVehicleDestructible` so `describe()` answers in the item's space.
 */
export function buildVehicleItem(kit: VehicleKit, key: string, options: VehicleItemOptions = {}): VehicleItem {
  const THREE = kit.THREE
  const vehicle = kit.build(key, options.state ?? 'intact')
  const m = vehicle.meta
  const root = new THREE.Group()
  root.name = key
  const turn = new THREE.Group()
  turn.rotation.y = -Math.PI / 2
  root.add(turn)
  vehicle.root.position.x = -(((m.front ?? 1) + (m.rear ?? -1)) / 2)
  turn.add(vehicle.root)
  root.userData.vehicle = vehicle
  return { root, vehicle }
}
