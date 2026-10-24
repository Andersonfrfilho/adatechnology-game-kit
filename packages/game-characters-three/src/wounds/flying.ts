import type { Three, THREE_NS } from '../three'

const GRAVITY = 9.8
const FLOOR_OFFSET = 0.08
const BOUNCE_LIMIT = 1.2
const BOUNCE_VERTICAL = -0.25
const BOUNCE_HORIZONTAL = 0.5
const BOUNCE_SPIN = 0.4
const LAUNCH = { sideways: 1.6, up: 2.6, forward: 0.6, spin: [9, 6, 9] } as const

export type FlyingPiece = {
  readonly object: THREE_NS.Object3D
  readonly velocity: THREE_NS.Vector3
  readonly spin: THREE_NS.Vector3
  rest: boolean
  /** Whatever the caller attached (the segment id the piece came from). */
  readonly tag?: string
}

export type FlyingPiecesOptions = {
  readonly random: () => number
  /** Height of the ground under a point. Default 0. */
  readonly groundAt?: (x: number, z: number) => number
  /** Called once when a piece comes to rest: where a pool should start. */
  readonly onRest?: (piece: FlyingPiece, point: THREE_NS.Vector3) => void
  /** Pieces kept; the oldest is removed beyond it. Default 40 (the game's number). */
  readonly max?: number
}

export type FlyingPieces = {
  readonly pieces: readonly FlyingPiece[]
  /** Throws a copy of `source` (in world space, from where it is now) away from the body (Elenco `fly`). `direction` is the side or the blow, in world space. */
  launch(source: THREE_NS.Object3D, scene: THREE_NS.Object3D, direction: THREE_NS.Vector3, dress?: (clone: THREE_NS.Object3D) => void, tag?: string): FlyingPiece
  /** Adds an already-built object to the simulation with a given velocity (Arsenal `particle`). */
  throwObject(object: THREE_NS.Object3D, velocity: THREE_NS.Vector3, spin: THREE_NS.Vector3, tag?: string): FlyingPiece
  update(dt: number): void
  clear(): void
}

/** The torn-off pieces of the rich bodies: they fly, spin, bounce and lie on the ground (Elenco `fly` and the `FLY` step of `updateFx`). */
export const createFlyingPieces = (three: Three, { random, groundAt = () => 0, onRest, max = 40 }: FlyingPiecesOptions): FlyingPieces => {
  const pieces: FlyingPiece[] = []
  const quaternion = new three.Quaternion()
  const euler = new three.Euler()
  const trim = (): void => {
    while (pieces.length > max) pieces.shift()?.object.removeFromParent()
  }
  const add = (object: THREE_NS.Object3D, velocity: THREE_NS.Vector3, spin: THREE_NS.Vector3, tag?: string): FlyingPiece => {
    const piece: FlyingPiece = { object, velocity, spin, rest: false, ...(tag ? { tag } : {}) }
    pieces.push(piece)
    trim()
    return piece
  }
  return {
    pieces,
    launch(source, scene, direction, dress, tag) {
      source.updateWorldMatrix(true, true)
      const clone = source.clone(true)
      source.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale)
      scene.add(clone)
      dress?.(clone)
      return add(
        clone,
        new three.Vector3(direction.x * LAUNCH.sideways, LAUNCH.up, direction.z * LAUNCH.sideways + LAUNCH.forward),
        new three.Vector3((random() - 0.5) * LAUNCH.spin[0], (random() - 0.5) * LAUNCH.spin[1], (random() - 0.5) * LAUNCH.spin[2]),
        tag,
      )
    },
    throwObject: add,
    update(dt) {
      for (const piece of pieces) {
        if (piece.rest) continue
        piece.velocity.y -= GRAVITY * dt
        piece.object.position.addScaledVector(piece.velocity, dt)
        quaternion.setFromEuler(euler.set(piece.spin.x * dt, piece.spin.y * dt, piece.spin.z * dt))
        piece.object.quaternion.multiply(quaternion)
        const ground = groundAt(piece.object.position.x, piece.object.position.z) + FLOOR_OFFSET
        if (piece.object.position.y >= ground) continue
        piece.object.position.y = ground
        if (Math.abs(piece.velocity.y) > BOUNCE_LIMIT) {
          piece.velocity.y *= BOUNCE_VERTICAL
          piece.velocity.x *= BOUNCE_HORIZONTAL
          piece.velocity.z *= BOUNCE_HORIZONTAL
          piece.spin.multiplyScalar(BOUNCE_SPIN)
        } else {
          piece.rest = true
          const yaw = euler.setFromQuaternion(piece.object.quaternion).y
          piece.object.rotation.set((Math.PI / 2) * (random() < 0.5 ? 1 : -1), yaw, 0)
          piece.object.position.y = ground
          onRest?.(piece, piece.object.position)
        }
      }
    },
    clear() {
      pieces.splice(0).forEach((piece) => piece.object.removeFromParent())
    },
  }
}
