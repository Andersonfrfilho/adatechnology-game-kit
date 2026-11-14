import { quat, quatFromEuler, toWorld } from './math'
import type { DestructibleSpec, ObjectState, PartSpec, Quat, Vec3 } from './types'

/** One part of a hosted body as a box turned as the body holds it (world): what a physics engine collides with in its place. */
export interface HostedSolid {
  readonly center: Vec3
  readonly half: Vec3
  readonly rotation: Quat
}

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
