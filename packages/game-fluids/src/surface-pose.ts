// The pose of a surface that moves with the object it belongs to (a table top that tips over) and what that does to the liquid on it.
import { add, clamp, dot, quatConjugate, quatMultiply, quatRotate, scale, sub } from './math'
import { downhill } from './stains'
import type { Basis, StainInt } from './stains'
import type { LiquidDef, Quat, SurfacePose, Vec3 } from './types'

/** A surface as it was added: the rest the pose moves. */
export interface SurfaceRest {
  readonly point: Vec3
  readonly normal: Vec3
  readonly tangent: Vec3
}

export const IDENTITY_POSE: SurfacePose = { position: [0, 0, 0], rotation: [0, 0, 0, 1] }

/** Tilt (rad) from its rest a surface holds a water-like pool at; a thicker liquid clings longer. */
const RUNOFF_TILT = (6 * Math.PI) / 180
const RUNOFF_TILT_MAX = (60 * Math.PI) / 180
/** How far past the rim (m) and how fast (m/s) the liquid that runs off leaves it. */
const RUNOFF_CLEARANCE = 0.02
const RUNOFF_SPEED = 0.6
/** A surface whose normal points this far down holds nothing: what is on it falls straight off. */
const UPSIDE_DOWN_Y = -0.2

const applyPose = (pose: SurfacePose, point: Vec3): Vec3 => add(pose.position, quatRotate(pose.rotation, point))
const undoPose = (pose: SurfacePose, point: Vec3): Vec3 => quatRotate(quatConjugate(pose.rotation), sub(point, pose.position))

/** The point, normal and tangent of the surface at `pose`. */
export function posedFrame(rest: SurfaceRest, pose: SurfacePose): SurfaceRest {
  return { point: applyPose(pose, rest.point), normal: quatRotate(pose.rotation, rest.normal), tangent: quatRotate(pose.rotation, rest.tangent) }
}

export interface CarryStainParams {
  readonly stain: StainInt
  readonly from: SurfacePose
  readonly to: SurfacePose
}

/** The stain goes with the surface from one pose to the next: its centre, its plane and the way it ran. */
export function carryStain({ stain, from, to }: CarryStainParams): void {
  const turn: Quat = quatMultiply(to.rotation, quatConjugate(from.rotation))
  stain.center = applyPose(to, undoPose(from, stain.center))
  stain.normal = quatRotate(turn, stain.normal)
  stain.tangent = quatRotate(turn, stain.tangent)
  if (stain.flow) stain.flow = quatRotate(turn, stain.flow)
}

/** The tilt (rad) from its rest at which a pool of this liquid runs off a surface. */
export const runoffTilt = (def: LiquidDef): number => clamp(RUNOFF_TILT * Math.sqrt(Math.max(1, def.viscosity)), RUNOFF_TILT, RUNOFF_TILT_MAX)

/** The angle (rad) the surface turned from its rest. */
export const tiltOf = (rest: SurfaceRest, normal: Vec3): number => Math.acos(clamp(dot(rest.normal, normal), -1, 1))

export interface RunoffParams {
  readonly center: Vec3
  readonly surface: Basis & { readonly point: Vec3; readonly half: readonly [number, number] }
}

/** Where the pool leaves the surface and how: from the lowest rim downhill of it, or straight down from under a surface turned over. */
export function runoffStart({ center, surface }: RunoffParams): { origin: Vec3; velocity: Vec3 } {
  const { dir, slope } = downhill(surface.normal)
  if (surface.normal[1] < UPSIDE_DOWN_Y || slope < 1e-3) return { origin: add(center, scale(surface.normal, RUNOFF_CLEARANCE)), velocity: [0, -RUNOFF_SPEED, 0] }
  const rel = sub(center, surface.point)
  const room = (half: number, at: number, along: number): number => (along > 1e-6 ? (half - at) / along : along < -1e-6 ? (-half - at) / along : Infinity)
  const reach = Math.max(0, Math.min(room(surface.half[0], dot(rel, surface.t1), dot(dir, surface.t1)), room(surface.half[1], dot(rel, surface.t2), dot(dir, surface.t2))))
  const rim = add(center, scale(dir, Number.isFinite(reach) ? reach + RUNOFF_CLEARANCE : RUNOFF_CLEARANCE))
  return { origin: add(rim, scale(surface.normal, RUNOFF_CLEARANCE)), velocity: scale(dir, RUNOFF_SPEED) }
}
