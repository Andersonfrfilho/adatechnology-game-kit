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

type DrawnPiece = ReturnType<NonNullable<DestructibleImpl['colliders']>>[number]
/** The solid last made of a drawn piece, with the place and the list index it was made at: the same piece at the same place is the very same solid (no vertex walked again). */
const placedPieces = new WeakMap<DrawnPiece, { readonly position: Vec3; readonly rotation: Quat; readonly index: number; readonly solid: HostedSolid }>()

type PlacedPose = { readonly known: { readonly position: Vec3; readonly rotation: Quat }; readonly position: Vec3; readonly rotation: Quat }
const isSamePose = ({ known, position, rotation }: PlacedPose): boolean =>
  known.position[0] === position[0] && known.position[1] === position[1] && known.position[2] === position[2] &&
  known.rotation[0] === rotation[0] && known.rotation[1] === rotation[1] && known.rotation[2] === rotation[2] && known.rotation[3] === rotation[3]

/**
 * The drawn pieces of a hosted body (`DestructibleImpl.colliders`, in its frame) as the world holds them: each box placed with the body, the triangles of a piece carried along.
 * A piece the impl hands back unchanged at the same place gives back the solid made of it last time, so an engine finds it unchanged by identity (`EngineStatics`).
 */
export const hostedPieces = (pieces: ReturnType<NonNullable<DestructibleImpl['colliders']>>, pose: Pick<HostedPose, 'position' | 'rotation'>): HostedSolid[] =>
  pieces.map((piece, index) => {
    const known = placedPieces.get(piece)
    const p = pose.position, q = pose.rotation
    // a keyless piece is named by its index, so it is the same solid only at the same index
    const isSamePlace = known !== undefined && (piece.key !== undefined || known.index === index) && isSamePose({ known, position: p, rotation: q })
    if (known && isSamePlace) return known.solid
    const solid = placedPiece(piece, index, pose)
    placedPieces.set(piece, { position: [p[0], p[1], p[2]], rotation: [q[0], q[1], q[2], q[3]], index, solid })
    return solid
  })

const placedPiece = (piece: DrawnPiece, index: number, pose: Pick<HostedPose, 'position' | 'rotation'>): HostedSolid => {
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
}
