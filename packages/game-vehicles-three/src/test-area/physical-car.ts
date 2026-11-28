import type * as THREE_NS from 'three'
import type { DrawnCollider, ModuleHost, WorkerCoordinator } from '@adatechnology/game-contracts'
import { isPhysicsServices } from '@adatechnology/game-physics'
import type { BodyId, PhysicsServices, Quat, ShapeDesc, Vec3 } from '@adatechnology/game-physics'
import type { PartDef, VehicleDestructible } from '@adatechnology/game-vehicles'

import { createVehicleColliders } from '../colliders'
import type { VehicleColliders } from '../colliders'
import { createCrashParts } from '../crash-parts'
import type { CrashParts } from '../crash-parts'
import { bodyMassOf, partsInFrame } from '../crash-parts-math'
import type { HullPlanCache } from '../hull-plan-cache'
import type { RunOverLink } from './run-over-link'

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
  /** The crowd the car runs over, when the host has one. */
  readonly runOver?: RunOverLink
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

/**
 * One child of the chassis compound for a drawn tyre: a cylinder as long as the box of what is drawn, its axis on the box's shortest side. A tyre on a level axle rests
 * on its lowest point: its radius is half its height (lugs and a tread ring make the box longer than it is tall, and a radius from the length would hold the car above it).
 */
const wheelChildOf = (size: Vec3, center: Vec3): { readonly shape: ShapeDesc; readonly position: Vec3; readonly rotation?: Quat } => {
  const axis = size[0] <= size[1] && size[0] <= size[2] ? 0 : size[2] <= size[1] ? 2 : 1
  const radius = axis === 1 ? Math.max(size[0], size[2]) / 2 : size[1] / 2
  const shape: ShapeDesc = { kind: 'cylinder', halfHeight: size[axis]! / 2, radius }
  if (axis === 1) return { shape, position: center }
  return { shape, position: center, rotation: axis === 0 ? [0, 0, HALF_TURN, HALF_TURN] : [HALF_TURN, 0, 0, HALF_TURN] }
}

/** The lowest point (frame y) of the chassis compound: its hulls' points and its tyres' bottoms. */
export const lowestOf = (shape: ShapeDesc): number => {
  if (shape.kind !== 'compound') return 0
  let lowest = Infinity
  for (const child of shape.children) {
    const own = child.shape
    if (own.kind === 'convex') for (let index = 1; index < own.points.length; index += 3) lowest = Math.min(lowest, own.points[index]! + child.position[1])
    else if (own.kind === 'cylinder') lowest = Math.min(lowest, child.position[1] - (child.rotation ? own.radius : own.halfHeight))
  }
  return Number.isFinite(lowest) ? lowest : 0
}

/** The box of one drawn tyre in the frame. */
export interface TyreBox {
  readonly size: Vec3
  readonly center: Vec3
}

/** The frame boxes of the drawn tyres of a part, one per drawn tyre: meshes whose boxes overlap (a tread ring round its tyre) are one tyre. */
export const tyreBoxesOf = (THREE: Three, objects: readonly THREE_NS.Object3D[], toFrame: THREE_NS.Matrix4): TyreBox[] => {
  const merged: THREE_NS.Box3[] = []
  for (const object of objects) {
    const box = frameBoxOf(THREE, object, toFrame)
    if (box.isEmpty()) continue
    const same = merged.find((other) => other.intersectsBox(box) && overlapShare(THREE, other, box) > TYRE_SAME_SHARE)
    if (same) same.union(box)
    else merged.push(box)
  }
  return merged.map((box) => ({ size: box.getSize(new THREE.Vector3()).toArray() as Vec3, center: box.getCenter(new THREE.Vector3()).toArray() as Vec3 }))
}

/** The box of what is drawn under `object` in the frame, from its vertices: a box turned with the wheel's spin would be wider than the round tyre it holds. */
const frameBoxOf = (THREE: Three, object: THREE_NS.Object3D, toFrame: THREE_NS.Matrix4): THREE_NS.Box3 => {
  const box = new THREE.Box3()
  const matrix = new THREE.Matrix4()
  const vertex = new THREE.Vector3()
  object.updateWorldMatrix(true, true)
  object.traverse((child) => {
    const position = (child as THREE_NS.Mesh).isMesh ? (child as THREE_NS.Mesh).geometry.getAttribute('position') : undefined
    if (!position) return
    matrix.multiplyMatrices(toFrame, child.matrixWorld)
    for (let index = 0; index < position.count; index++) box.expandByPoint(vertex.fromBufferAttribute(position, index).applyMatrix4(matrix))
  })
  return box
}

/** Two drawn boxes this much shared (of the smaller one's volume) are the same tyre. */
const TYRE_SAME_SHARE = 0.5

const overlapShare = (THREE: Three, a: THREE_NS.Box3, b: THREE_NS.Box3): number => {
  const shared = a.clone().intersect(b).getSize(new THREE.Vector3())
  const volume = (box: THREE_NS.Box3): number => { const size = box.getSize(new THREE.Vector3()); return size.x * size.y * size.z }
  return (shared.x * shared.y * shared.z) / Math.max(1e-9, Math.min(volume(a), volume(b)))
}

/** The model's parts with their boxes in the root's frame (the chassis body's): the drawn vehicle is turned inside the root, and its parts are in its own space. */
export const framePartsOf = (THREE: Three, vehicle: VehicleDestructible, root: THREE_NS.Object3D): PartDef[] => {
  const drawn = vehicle.vehicle.vehicle as THREE_NS.Object3D
  root.updateWorldMatrix(true, false)
  drawn.updateWorldMatrix(true, false)
  const toFrame = new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(drawn.matrixWorld)
  return partsInFrame(vehicle.model.parts, toFrame.elements)
}

/** The box the run-over sweeps for the car: the parts' reach to each side and the height of the top (the box is centred on the chassis origin, at the ground, so it spans the car's height above it). */
const runOverHalfOf = (parts: readonly { readonly box: { readonly center: Vec3; readonly size: Vec3 } }[]): Vec3 => {
  const half: [number, number, number] = [0, 0, 0]
  for (const { box } of parts) {
    half[0] = Math.max(half[0], Math.abs(box.center[0]) + box.size[0] / 2)
    half[1] = Math.max(half[1], box.center[1] + box.size[1] / 2)
    half[2] = Math.max(half[2], Math.abs(box.center[2]) + box.size[2] / 2)
  }
  return half
}

/** The services the host lent, when it runs the pieces on a loop (the engine path); undefined on the kit's own solver. */
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
export const createPhysicalCar = ({ THREE, services, vehicle, root, colliders, runOver }: PhysicalCarOptions): PhysicalCar => {
  const { world } = services
  const pose = new Float64Array(7)
  const matrix = new THREE.Matrix4()
  const parentInverse = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const unusedScale = new THREE.Vector3()
  const wheelHandles = new Map<string, readonly number[]>()
  let crash: CrashParts | undefined
  let chassis: BodyId | undefined
  let stopRunOver: (() => void) | undefined

  /** The drawn tyres of each tyre part, in the frame: measured once, when the root is first in the scene. */
  let tyres: ReadonlyMap<PartDef, readonly TyreBox[]> | undefined
  const tyresOf = (): ReadonlyMap<PartDef, readonly TyreBox[]> => {
    if (tyres) return tyres
    root.updateWorldMatrix(true, true)
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
    tyres = new Map(vehicle.model.parts.filter((part) => part.role === 'tyre').map((part) => [part, tyreBoxesOf(THREE, vehicle.objectsOf(part.id), inverse)]))
    return tyres
  }

  // the root stands where the vehicle meets the ground: a tyre drawn lower than that (a tractor's, a 6x6's) would sit in the floor while the hulls are made
  const standOnTyres = (): void => {
    let lowest = 0
    for (const boxes of tyresOf().values()) for (const box of boxes) lowest = Math.min(lowest, box.center[1] - box.size[1] / 2)
    if (lowest === 0) return
    root.position.add(new THREE.Vector3(0, -lowest, 0).applyQuaternion(root.quaternion))
    root.updateMatrixWorld(true)
  }

  // the tyres are drawn but have no hull: a cylinder each, after the hulls (their handles are the hulls' own numbers), so the car rests at the height it is drawn.
  // One per drawn tyre, never one round a part: a part may hold every tyre of an axle (a bus) or of a side (a 6x6), and the box round them all is not a wheel
  const withWheels = (hulls: ShapeDesc): ShapeDesc => {
    if (hulls.kind !== 'compound') return hulls
    const children: { readonly shape: ShapeDesc; readonly position: Vec3; readonly rotation?: Quat }[] = []
    for (const [part, boxes] of tyresOf()) {
      const handles: number[] = []
      for (const box of boxes.length > 0 ? boxes : [{ size: part.box.size, center: part.box.center }]) {
        handles.push(hulls.children.length + children.length)
        children.push(wheelChildOf(box.size, box.center))
      }
      wheelHandles.set(part.id, handles)
    }
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
    const parts = framePartsOf(THREE, vehicle, root)
    const mass = bodyMassOf(parts)
    crash = createCrashParts({
      THREE, world, vehicle, frame: root, colliders, mass,
      onPartLost: (part) => {
        if (chassis === undefined) return
        for (const handle of wheelHandles.get(part.id) ?? []) world.setChildShape(chassis, handle, null)
      },
    })
    const shape = withWheels(crash.shape())
    // the root stands where the vehicle meets the ground: a tyre drawn lower than that would start inside the floor, be thrown out of it and dent the car on its first step
    const lift = new THREE.Vector3(0, Math.max(0, -lowestOf(shape)), 0).applyQuaternion(rotation)
    chassis = world.createBody({
      shape, motion: 'dynamic', mass: mass.mass, inertia: mass.inertia, layer: 'vehicle', user: 0,
      position: [position.x + lift.x, position.y + lift.y, position.z + lift.z], rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
    })
    crash.bind(chassis)
    stopRunOver = runOver?.track({ body: chassis, half: runOverHalfOf(parts) })
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
      if (!chassis && root.parent && !tyres) standOnTyres()
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
      stopRunOver?.()
      stopRunOver = undefined
      crash?.dispose()
      if (chassis !== undefined && world.has(chassis)) world.removeBody(chassis)
      crash = undefined
      chassis = undefined
    },
  }
}
