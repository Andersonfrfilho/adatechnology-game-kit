import { quat, quatFromEuler, toWorld } from './math'
import type { DestructibleImpl, DestructibleSpec, HostedSolid, ObjectState, PartSpec, Quat, Vec3 } from './types'

export type { HostedSolid } from './types'

/** Where a hosted body is and how its parts are posed (object-local overrides of `setPartPose`). */
export interface HostedPose {
  readonly position: Vec3
  readonly rotation: Quat
  readonly poses: ReadonlyMap<string, { readonly pos: Vec3; readonly q: Quat }>
}

const GONE = new Set(['broken', 'melted', 'ashes'])

const halfOf = (shape: PartSpec['shape']): Vec3 => {
  if (shape.kind === 'box') return [shape.size[0] / 2, shape.size[1] / 2, shape.size[2] / 2]
  if (shape.kind === 'cylinder') return [shape.radius, shape.height / 2, shape.radius]
  return [shape.radius, shape.radius, shape.radius]
}

/**
 * The parts of a hosted body (a vehicle) still on it, as the boxes its own `describe()` gives them (the same boxes the world's raycast and sweep meet), posed and
 * placed as the world holds them. A part that broke, melted, burnt away or came off the body (`group` other than 0) is not there: nothing collides where
 * nothing is drawn.
 */
export const hostedSolids = (spec: DestructibleSpec, state: Readonly<ObjectState> | null, pose: HostedPose): HostedSolid[] => {
  const byId = new Map((state?.parts ?? []).map((p) => [p.id, p]))
  const out: HostedSolid[] = []
  for (const ps of spec.parts) {
    const st = byId.get(ps.id)
    if (st && (GONE.has(st.status) || st.group !== 0)) continue
    const ov = pose.poses.get(ps.id)
    const center = toWorld(pose.position, pose.rotation, ov?.pos ?? ps.position)
    const rotation = quat.mul(pose.rotation, ov?.q ?? quatFromEuler(...(ps.rotation ?? [0, 0, 0])))
    out.push({ center, half: halfOf(ps.shape), rotation })
  }
  return out
}

/** The drawn pieces of a hosted body (`DestructibleImpl.colliders`, in its frame) as the world holds them: each box placed with the body, the triangles of a piece carried along. */
export const hostedPieces = (pieces: ReturnType<NonNullable<DestructibleImpl['colliders']>>, pose: Pick<HostedPose, 'position' | 'rotation'>): HostedSolid[] =>
  pieces.map((piece, index) => {
    const base = { center: toWorld(pose.position, pose.rotation, piece.center), half: piece.half, rotation: quat.mul(pose.rotation, piece.rotation), key: piece.key ?? `${piece.id}:${index}` }
    if (!piece.mesh) return base
    const source = piece.mesh.vertices
    const vertices = new Float32Array(source.length)
    for (let i = 0; i < source.length; i += 3) {
      const world = toWorld(pose.position, pose.rotation, [source[i] as number, source[i + 1] as number, source[i + 2] as number])
      vertices[i] = world[0]
      vertices[i + 1] = world[1]
      vertices[i + 2] = world[2]
    }
    return { ...base, mesh: { vertices, indices: piece.mesh.indices } }
  })
