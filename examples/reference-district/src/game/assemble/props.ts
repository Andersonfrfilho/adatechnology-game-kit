import type * as THREE_NS from 'three'

import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import { furnitureSpec } from '@adatechnology/game-floorplan-three'
import { listTypes } from '@adatechnology/game-props3d'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { createVehiclesThree } from '@adatechnology/game-vehicles-three'
import type { BuiltVehicle } from '@adatechnology/game-vehicles-three'
import type { PlanRect } from '@adatechnology/game-urban'

import { seedOf } from '../seed'
import type { Prop, Site } from '../site'

export type Props = {
  /** What stands on the ground and blocks the way, as rectangles (the nav grid of the horde and the player reads them). */
  readonly footprints: readonly PlanRect[]
  dispose(): void
}

type FurnitureType = Parameters<typeof furnitureSpec>[1]

const propTypes = new Map<string, ReturnType<typeof listTypes>[number]>(listTypes().map((type) => [type.id, type]))

/** A turn about y as the quaternion `game-destruction` takes. */
const turnOf = (ry: number): [number, number, number, number] => [0, Math.sin(ry / 2), 0, Math.cos(ry / 2)]

/** The rectangle a thing of `width` x `depth` turned by `ry` takes on the ground (a quarter-turn grid is enough for the nav grid). */
function footprintOf({ x, z, width, depth, ry }: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly ry: number }): PlanRect {
  const isSideways = Math.abs(Math.sin(ry)) > Math.SQRT1_2
  const [w, d] = isSideways ? [depth, width] : [width, depth]
  return [x - w / 2, z - d / 2, x + w / 2, z + d / 2]
}

/**
 * The loose pieces of the site: a prop of `game-props3d` made by the house renderer's furniture (`furnitureSpec`: the destructible spec and its drawing, registered in the world's destruction), a
 * vehicle of the fleet (`game-vehicles-fleet` through `game-vehicles-three`, the lite build: parked cars are scenery until a driver boards one).
 */
export function createProps({ THREE, world, scene, site }: { readonly THREE: typeof THREE_NS; readonly world: KitWorld; readonly scene: THREE_NS.Object3D; readonly site: Site }): Props {
  const kit = createVehicleKit({ THREE, locale: 'pt-BR' })
  installFleet(kit)
  const vehicles = createVehiclesThree(THREE, { kit, fleet: defaultVehicleFleet() })
  const built: BuiltVehicle[] = []
  const footprints: PlanRect[] = []
  const bound: string[] = []
  const place = (prop: Prop): void => {
    const ry = prop.ry ?? 0
    if (prop.kind === 'vehicle') {
      const vehicle = vehicles.build(prop.ref, { quality: 'lite', seed: seedOf(site.seed, prop.id) })
      vehicle.group.position.set(prop.at[0], prop.y ?? 0, prop.at[1])
      vehicle.group.rotation.y = ry
      scene.add(vehicle.group)
      built.push(vehicle)
      footprints.push(footprintOf({ x: prop.at[0], z: prop.at[1], width: vehicle.width, depth: vehicle.length, ry }))
      return
    }
    const type = propTypes.get(prop.ref)
    if (!type) throw new Error(`site prop ${prop.id}: game-props3d has no type "${prop.ref}"`)
    const piece = furnitureSpec(THREE, prop.ref as FurnitureType, { w: type.w, d: type.d, h: type.h, seed: seedOf(site.seed, prop.id) })
    const mesh = piece.build(THREE)
    mesh.position.set(prop.at[0], prop.y ?? 0, prop.at[1])
    mesh.rotation.y = ry
    scene.add(mesh)
    world.destruction.world.add(piece.spec, { id: prop.id, position: [prop.at[0], prop.y ?? 0, prop.at[1]], rotation: turnOf(ry) })
    world.destruction.renderer.bind(prop.id, mesh)
    bound.push(prop.id)
    footprints.push(footprintOf({ x: prop.at[0], z: prop.at[1], width: type.w, depth: type.d, ry }))
  }
  site.props.forEach(place)
  return {
    footprints,
    dispose() {
      for (const id of bound) world.destruction.renderer.unbind(id)
      for (const vehicle of built) vehicle.dispose()
    },
  }
}
