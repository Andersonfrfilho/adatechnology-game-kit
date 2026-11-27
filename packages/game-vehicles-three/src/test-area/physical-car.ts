import type * as THREE_NS from 'three'
import type { DrawnCollider, ModuleHost, WorkerCoordinator } from '@adatechnology/game-contracts'
import { isPhysicsServices } from '@adatechnology/game-physics'
import type { BodyId, PhysicsServices } from '@adatechnology/game-physics'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'
import { fleetGroupOf } from '@adatechnology/game-vehicles-fleet'

import { createVehicleColliders } from '../colliders'
import type { VehicleColliders } from '../colliders'
import { createCrashParts } from '../crash-parts'
import type { CrashParts } from '../crash-parts'
import { bodyMassOf } from '../crash-parts-math'
import type { HullPlanCache } from '../hull-plan-cache'

type Three = typeof THREE_NS

/** Hulls a car of each class may have (design 10.3, K7); a model of no class of the fleet takes the largest. */
const HULL_CEILING: Readonly<Record<string, number>> = { motorcycles: 64, cars: 256, suvs: 256, pickups: 256, vans: 300, heavy: 550, agricultural: 150, military: 500, air: 500, water: 450 }
const DEFAULT_HULL_CEILING = 550

export interface PhysicalCarOptions {
  readonly THREE: Three
  readonly services: PhysicsServices
  readonly vehicle: VehicleDestructible
  /** The vehicle's root: the frame of the hulls and of the drawing, its pose the chassis body's. */
  readonly root: THREE_NS.Object3D
  /** Made with `physicalCarColliders`. */
  readonly colliders: VehicleColliders
}

export interface PhysicalCar {
  /** What the engine's fixed world collides with in place of the drawing: nothing, the chassis body holds it. */
  colliders(): DrawnCollider[]
  /** The chassis is in the world (the pieces are all made and the hull plan is back). */
  isBuilt(): boolean
  chassis(): BodyId | undefined
  parts(): CrashParts | undefined
  /** Takes the chassis and the bodies of the parts out of the world and stops following the loop. */
  dispose(): void
}

/** The services the host lent, when it runs the pieces on a loop (the Jolt path); undefined on the kit's own solver. */
export const physicsServicesOf = (host: ModuleHost | null): PhysicsServices | undefined => (host && isPhysicsServices(host.physics) ? host.physics : undefined)

/** How the car's colliders are made for the engine: hulls (method B), the plan in the host's workers when it has them, shared by the cars of a model. */
export const physicalCarColliders = (THREE: Three, vehicle: VehicleDestructible, root: THREE_NS.Object3D, options: { readonly budget: number; readonly fleetKey: string; readonly planCache: HullPlanCache; readonly workers: WorkerCoordinator | undefined }): VehicleColliders =>
  createVehicleColliders(THREE, vehicle, root, {
    budget: options.budget,
    hulls: true,
    maxHulls: HULL_CEILING[fleetGroupOf(options.fleetKey) ?? ''] ?? DEFAULT_HULL_CEILING,
    planCache: options.planCache,
    ...(options.workers ? { workers: options.workers } : {}),
  })

/** The car as a dynamic body of the loop's world: made once its root is in the scene and its hulls are ready, followed by its drawing and fed its damage after every frame of the loop. */
export const createPhysicalCar = ({ THREE, services, vehicle, root, colliders }: PhysicalCarOptions): PhysicalCar => {
  const { world } = services
  const pose = new Float64Array(7)
  const matrix = new THREE.Matrix4()
  const parentInverse = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const unusedScale = new THREE.Vector3()
  let crash: CrashParts | undefined
  let chassis: BodyId | undefined

  const build = (): void => {
    if (!root.parent) return
    colliders.pieces()
    if (colliders.isPending()) return
    colliders.hulls()
    if (colliders.isHullPending()) return
    root.updateWorldMatrix(true, false)
    root.matrixWorld.decompose(position, rotation, unusedScale)
    const mass = bodyMassOf(vehicle.model.parts)
    crash = createCrashParts({ THREE, world, vehicle, frame: root, colliders, mass })
    chassis = world.createBody({
      shape: crash.shape(), motion: 'dynamic', mass: mass.mass, inertia: mass.inertia, layer: 'vehicle', user: 0,
      position: [position.x, position.y, position.z], rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    })
    crash.bind(chassis)
  }

  const follow = (): void => {
    world.readPose(chassis!, pose, 0)
    matrix.compose(position.set(pose[0]!, pose[1]!, pose[2]!), rotation.set(pose[3]!, pose[4]!, pose[5]!, pose[6]!), unusedScale.set(1, 1, 1))
    root.parent!.updateWorldMatrix(true, false)
    matrix.premultiply(parentInverse.copy(root.parent!.matrixWorld).invert())
    matrix.decompose(root.position, root.quaternion, unusedScale)
    root.updateMatrixWorld(true)
    crash!.step()
  }

  const stopPhase = services.loop.add({
    afterSteps: (_dt, frame) => {
      if (!chassis) return build()
      if (frame.steps > 0 && root.parent) follow()
    },
  }, 'contacts')

  return {
    colliders: () => [],
    isBuilt: () => chassis !== undefined,
    chassis: () => chassis,
    parts: () => crash,
    dispose: () => {
      stopPhase()
      crash?.dispose()
      if (chassis !== undefined && world.has(chassis)) world.removeBody(chassis)
      crash = undefined
      chassis = undefined
    },
  }
}
