import type * as THREE_NS from 'three'
import type { DrawnCollider, ModuleHost, WorkerCoordinator } from '@adatechnology/game-contracts'
import { isPhysicsServices } from '@adatechnology/game-physics'
import type { BodyId, PhysicsServices, Quat, ShapeDesc, Vec3 } from '@adatechnology/game-physics'
import type { VehicleDestructible } from '@adatechnology/game-vehicles'

import { createVehicleColliders } from '../colliders'
import type { VehicleColliders } from '../colliders'
import { createCrashParts } from '../crash-parts'
import type { CrashParts } from '../crash-parts'
import { bodyMassOf } from '../crash-parts-math'
import type { HullPlanCache } from '../hull-plan-cache'

type Three = typeof THREE_NS

/** The ceiling of a model the fleet content gives none for: the largest of design 10.3 (K7). */
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

const HALF_TURN: number = Math.SQRT1_2

/** One child of the chassis compound for a drawn tyre: a cylinder as long and as wide as the box of what is drawn, its axis on the box's shortest side. */
const wheelChildOf = (size: Vec3, center: Vec3): { readonly shape: ShapeDesc; readonly position: Vec3; readonly rotation?: Quat } => {
  const axis = size[0] <= size[1] && size[0] <= size[2] ? 0 : size[2] <= size[1] ? 2 : 1
  const radius = Math.max(...size.filter((_, side) => side !== axis)) / 2
  const shape: ShapeDesc = { kind: 'cylinder', halfHeight: size[axis]! / 2, radius }
  if (axis === 1) return { shape, position: center }
  return { shape, position: center, rotation: axis === 0 ? [0, 0, HALF_TURN, HALF_TURN] : [HALF_TURN, 0, 0, HALF_TURN] }
}

/** The services the host lent, when it runs the pieces on a loop (the Jolt path); undefined on the kit's own solver. */
export const physicsServicesOf = (host: ModuleHost | null): PhysicsServices | undefined => (host && isPhysicsServices(host.physics) ? host.physics : undefined)

/** How the car's colliders are made for the engine: hulls (method B), the plan in the host's workers when it has them, shared by the cars of a model. */
export const physicalCarColliders = (THREE: Three, vehicle: VehicleDestructible, root: THREE_NS.Object3D, options: { readonly budget: number; readonly fleetKey: string; readonly hullCeilingOf?: ((id: string) => number | undefined) | undefined; readonly planCache: HullPlanCache; readonly workers: WorkerCoordinator | undefined }): VehicleColliders =>
  createVehicleColliders(THREE, vehicle, root, {
    budget: options.budget,
    hulls: true,
    maxHulls: options.hullCeilingOf?.(options.fleetKey) ?? DEFAULT_HULL_CEILING,
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
  const wheelHandles = new Map<string, number>()
  let crash: CrashParts | undefined
  let chassis: BodyId | undefined

  // the tyres are drawn but have no hull: a child each, after the hulls (their handles are the hulls' own numbers), so the car rests at the height it is drawn
  const withWheels = (hulls: ShapeDesc): ShapeDesc => {
    if (hulls.kind !== 'compound') return hulls
    const tyres = vehicle.model.parts.filter((part) => part.role === 'tyre')
    tyres.forEach((part, index) => wheelHandles.set(part.id, hulls.children.length + index))
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const drawn = new THREE.Box3()
    const piece = new THREE.Box3()
    const centre = new THREE.Vector3()
    const size = new THREE.Vector3()
    const children = tyres.map((part) => {
      drawn.makeEmpty()
      for (const object of vehicle.objectsOf(part.id)) drawn.union(piece.setFromObject(object).applyMatrix4(inverse))
      if (drawn.isEmpty()) return wheelChildOf(part.box.size, part.box.center)
      return wheelChildOf(drawn.getSize(size).toArray() as Vec3, drawn.getCenter(centre).toArray() as Vec3)
    })
    return { ...hulls, children: [...hulls.children, ...children] }
  }

  const build = (): void => {
    if (!root.parent) return
    colliders.pieces()
    if (colliders.isPending()) return
    colliders.hulls()
    if (colliders.isHullPending()) return
    root.updateWorldMatrix(true, false)
    root.matrixWorld.decompose(position, rotation, unusedScale)
    const mass = bodyMassOf(vehicle.model.parts)
    crash = createCrashParts({
      THREE, world, vehicle, frame: root, colliders, mass,
      onPartLost: (part) => {
        const handle = wheelHandles.get(part.id)
        if (handle !== undefined && chassis !== undefined) world.setChildShape(chassis, handle, null)
      },
    })
    chassis = world.createBody({
      shape: withWheels(crash.shape()), motion: 'dynamic', mass: mass.mass, inertia: mass.inertia, layer: 'vehicle', user: 0,
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
