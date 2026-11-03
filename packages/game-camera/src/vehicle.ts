/**
 * Cameras of a vehicle: chase (third person, behind and above, lagging on the turns and widening with speed), cockpit (first person, at the driver's eyes), hood, and the mirror
 * cameras (interior rear-view, left and right side mirrors, reversing camera). Knows nothing about any game: the host gives the vehicle's place and size every frame.
 *
 * The vehicle frame is the kit's output frame: front on +z, up +y, the driver's side (left-hand drive) on +x; `yaw` turns it about +y as `object.rotation.y` does.
 */

/** What of three.js this needs: vectors and quaternions. */
export interface VehicleThreeLib {
  Vector3: new (x?: number, y?: number, z?: number) => VehicleVector
  Quaternion: new () => VehicleQuaternion
}
export interface VehicleVector {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): VehicleVector
  copy(v: VehicleVector): VehicleVector
  applyQuaternion(q: VehicleQuaternion): VehicleVector
  add(v: VehicleVector): VehicleVector
  lerp(v: VehicleVector, t: number): VehicleVector
}
export interface VehicleQuaternion {
  setFromAxisAngle(axis: VehicleVector, angle: number): VehicleQuaternion
  setFromEuler?(e: unknown): VehicleQuaternion
  multiply(q: VehicleQuaternion): VehicleQuaternion
  copy(q: VehicleQuaternion): VehicleQuaternion
}
/** A perspective camera, as three.js has it. */
export interface VehicleCameraLike {
  position: VehicleVector
  quaternion: VehicleQuaternion
  fov: number
  near: number
  updateProjectionMatrix(): void
  lookAt(x: number, y: number, z: number): void
}

export type VehicleCameraMode = 'chase' | 'cockpit' | 'hood'
export type VehicleMirrorId = 'rear_view' | 'left' | 'right' | 'reverse'

/** Where the vehicle is now and how big it is. */
export interface VehicleFrame {
  x: number
  y: number
  z: number
  /** Turn about +y, radians (`object.rotation.y` of the vehicle). */
  yaw: number
  /** Nose up, radians (optional). */
  pitch?: number
  /** Right side down, radians (optional). */
  roll?: number
  /** Forward speed, m/s (the chase camera pulls back and widens with it). */
  speed?: number
  length: number
  width: number
  height: number
  /** The driver's eyes in the vehicle frame, when the host knows the seat. */
  eye?: readonly [number, number, number]
}

export interface VehicleCameraOptions {
  modes?: readonly VehicleCameraMode[]
  chase?: { distance: number; height: number; lookAhead: number; lag: number; speedPull: number; fov: number; fovAtSpeed: number; speedForFov: number }
  cockpit?: { fov: number; pitch: number }
  hood?: { fov: number }
}

export const VEHICLE_CAMERA_DEFAULTS = {
  modes: ['chase', 'cockpit', 'hood'] as readonly VehicleCameraMode[],
  // the chase sits 4.5 m behind the tail and 1.6 m over the roof, pulls back 0.06 s of travel per m/s and goes from 60° to 75° of field by 35 m/s
  chase: { distance: 4.5, height: 1.6, lookAhead: 0.3, lag: 5, speedPull: 0.06, fov: 60, fovAtSpeed: 75, speedForFov: 35 },
  cockpit: { fov: 70, pitch: -0.06 },
  hood: { fov: 68 },
}

/** A mirror camera's place and aim in the vehicle frame. */
export interface MirrorPose {
  id: VehicleMirrorId
  position: readonly [number, number, number]
  /** Direction it looks, in the vehicle frame. */
  look: readonly [number, number, number]
  fov: number
  /** A mirror and a reversing camera both show the world flipped, as the driver sees it. */
  mirror: boolean
}

/** Default mirror poses for a vehicle of this size (a car: the rear-view at the top of the windscreen, side mirrors at the front of the doors, the reversing camera over the plate). */
export function mirrorPoses(frame: Pick<VehicleFrame, 'length' | 'width' | 'height' | 'eye'>): MirrorPose[] {
  const { length: L, width: W, height: H } = frame
  return [
    { id: 'rear_view', position: [0, H * 0.86, L * 0.08], look: [0, -0.03, -1], fov: 32, mirror: true },
    { id: 'left', position: [W / 2 + 0.08, H * 0.6, L * 0.18], look: [0.12, -0.04, -1], fov: 24, mirror: true },
    { id: 'right', position: [-(W / 2 + 0.08), H * 0.6, L * 0.18], look: [-0.12, -0.04, -1], fov: 24, mirror: true },
    { id: 'reverse', position: [0, Math.min(1.1, H * 0.55), -L / 2 - 0.02], look: [0, -0.55, -1], fov: 110, mirror: true },
  ]
}

export interface VehicleCameraRig {
  readonly mode: VehicleCameraMode
  setMode(mode: VehicleCameraMode): void
  cycle(): VehicleCameraMode
  /** Places the main camera for the vehicle this frame. Call `reset` when the vehicle jumps (a new run) so the chase does not swing across. */
  update(camera: VehicleCameraLike, frame: VehicleFrame, dt: number): void
  reset(): void
  /** Places a mirror camera (one of `mirrorPoses`) on the vehicle this frame. */
  placeMirror(camera: VehicleCameraLike, pose: MirrorPose, frame: VehicleFrame): void
}

/** The driver's eyes when the host does not know the seat: on the driver's side, a seat's length behind the wheel (an arm's reach), under the roof. */
export const defaultEye = (frame: Pick<VehicleFrame, 'length' | 'width' | 'height'>): [number, number, number] => [frame.width * 0.2, frame.height * 0.76, -frame.length * 0.12]

export function createVehicleCamera(THREE: VehicleThreeLib, options: VehicleCameraOptions = {}): VehicleCameraRig {
  const modes = options.modes ?? VEHICLE_CAMERA_DEFAULTS.modes
  const chase = { ...VEHICLE_CAMERA_DEFAULTS.chase, ...options.chase }
  const cockpit = { ...VEHICLE_CAMERA_DEFAULTS.cockpit, ...options.cockpit }
  const hood = { ...VEHICLE_CAMERA_DEFAULTS.hood, ...options.hood }
  let mode: VehicleCameraMode = modes[0] ?? 'chase'
  let chaseYaw: number | null = null
  const up = new THREE.Vector3(0, 1, 0)
  const side = new THREE.Vector3(1, 0, 0)
  const fwd = new THREE.Vector3(0, 0, 1)
  const q = new THREE.Quaternion()
  const qp = new THREE.Quaternion()
  const qr = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const smooth = new THREE.Vector3()
  let hasSmooth = false

  /** The vehicle's turn (yaw, then pitch about its side axis, then roll about its forward axis). */
  const orient = (frame: VehicleFrame, yaw = frame.yaw): VehicleQuaternion => {
    q.setFromAxisAngle(up, yaw)
    qp.setFromAxisAngle(side, -(frame.pitch ?? 0))
    qr.setFromAxisAngle(fwd, frame.roll ?? 0)
    return q.multiply(qp).multiply(qr)
  }
  const toWorld = (frame: VehicleFrame, local: readonly [number, number, number], out: VehicleVector, turn: VehicleQuaternion): VehicleVector =>
    out.set(local[0], local[1], local[2]).applyQuaternion(turn).add(v.set(frame.x, frame.y, frame.z))
  const setFov = (camera: VehicleCameraLike, fov: number, near: number): void => {
    if (Math.abs(camera.fov - fov) > 1e-3 || camera.near !== near) {
      camera.fov = fov
      camera.near = near
      camera.updateProjectionMatrix()
    }
  }
  const aim = (camera: VehicleCameraLike, frame: VehicleFrame, from: readonly [number, number, number], dir: readonly [number, number, number], turn: VehicleQuaternion): void => {
    toWorld(frame, from, camera.position, turn)
    const target = new THREE.Vector3(from[0] + dir[0], from[1] + dir[1], from[2] + dir[2])
    target.applyQuaternion(turn).add(new THREE.Vector3(frame.x, frame.y, frame.z))
    camera.lookAt(target.x, target.y, target.z)
  }

  return {
    get mode() {
      return mode
    },
    setMode(next) {
      mode = next
      hasSmooth = false
      chaseYaw = null
    },
    cycle() {
      const i = modes.indexOf(mode)
      this.setMode(modes[(i + 1) % modes.length] ?? 'chase')
      return mode
    },
    reset() {
      hasSmooth = false
      chaseYaw = null
    },
    update(camera, frame, dt) {
      const speed = Math.abs(frame.speed ?? 0)
      if (mode === 'chase') {
        // the camera's yaw trails the vehicle's (shortest way round), so it swings out on a turn and settles behind
        if (chaseYaw === null) chaseYaw = frame.yaw
        let d = frame.yaw - chaseYaw
        d = Math.atan2(Math.sin(d), Math.cos(d))
        chaseYaw += d * Math.min(1, dt * chase.lag)
        const turn = orient({ ...frame, pitch: 0, roll: 0 }, chaseYaw)
        const back = frame.length / 2 + chase.distance + speed * chase.speedPull
        const want = toWorld(frame, [0, frame.height + chase.height, -back], new THREE.Vector3(), turn)
        if (!hasSmooth) {
          smooth.copy(want)
          hasSmooth = true
        } else smooth.lerp(want, Math.min(1, dt * chase.lag * 2))
        camera.position.copy(smooth)
        const look = toWorld(frame, [0, frame.height * 0.6, frame.length * chase.lookAhead], new THREE.Vector3(), turn)
        camera.lookAt(look.x, look.y, look.z)
        setFov(camera, chase.fov + (chase.fovAtSpeed - chase.fov) * Math.min(1, speed / chase.speedForFov), 0.1)
        return
      }
      const turn = orient(frame)
      if (mode === 'cockpit') {
        const eye = frame.eye ?? defaultEye(frame)
        aim(camera, frame, eye, [0, Math.tan(cockpit.pitch), 1], turn)
        setFov(camera, cockpit.fov, 0.03)
        return
      }
      aim(camera, frame, [0, frame.height * 0.62, frame.length * 0.2], [0, -0.04, 1], turn)
      setFov(camera, hood.fov, 0.05)
    },
    placeMirror(camera, pose, frame) {
      aim(camera, frame, pose.position, pose.look, orient(frame))
      setFov(camera, pose.fov, 0.05)
    },
  }
}
