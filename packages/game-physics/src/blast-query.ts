import type { BodyId, QueryFilter, RayHit, SeamWorld, Vec3 } from './contract'

export interface BlastQueryOptions {
  /** Fragment rays per blast, spread evenly over the sphere. Default 300. */
  readonly fragments?: number
  /** Most bodies the overlap can hold; past it the nearest to the centre are not told apart from the rest. Default 512. */
  readonly bodiesMax?: number
}

export interface BlastParams {
  readonly origin: Vec3
  /** Reach (m) of the blast on bodies: what it overlaps, and the sight line to each. */
  readonly radius: number
  /** Reach (m) of a fragment ray. Default `radius`. */
  readonly fragmentReach?: number
  /** Turns the fragment directions about +y (radians), so one blast's fan is not the last one's. Default 0. */
  readonly spin?: number
}

/** What one blast found, reused by the next `run`: struct of arrays, valid until then. */
export interface BlastResult {
  /** Fragment rays that met something, in ray order. */
  readonly fragmentHits: number
  readonly fragmentBody: Int32Array
  readonly fragmentUser: Int32Array
  readonly fragmentTag: Int32Array
  readonly fragmentDistance: Float32Array
  /** Bodies (all but sensors) within the radius, and for each whether the blast sees it: 1 when no cover (`COVER`: fixed things, props, debris, vehicles) is first along the line from the centre to its middle. */
  readonly bodyCount: number
  readonly bodies: readonly BodyId[]
  readonly visible: Uint8Array
}

export interface BlastQuery {
  run(params: BlastParams): BlastResult
}

const DEFAULT_FRAGMENTS = 300
const DEFAULT_BODIES_MAX = 512
const GOLDEN_ANGLE = Math.PI * (1 + Math.sqrt(5))
/** A sight line that ends this far (m) short of a body's middle still ends in the body. */
const SIGHT_SLACK = 1e-3
const SOLID: QueryFilter = { layers: ['static', 'debris', 'prop', 'character', 'agent', 'vehicle', 'corpse'] }
/** What covers a body from a blast: the fixed world, props, debris and vehicles. People do not (a crowd in the open is hit all through). */
const COVER: QueryFilter = { layers: ['static', 'debris', 'prop', 'vehicle'] }

/**
 * The questions a blast asks the engine, with the buffers made once: about 300 fragment rays (first hit each, evenly over the sphere), the bodies in its radius, and a sight line
 * from the centre to each. What the blast does to what it finds is the caller's (`game-destruction`, `game-weapons`); this only finds. Nothing is made per blast but the hits the
 * engine's rays hand back.
 */
export const createBlastQuery = (world: SeamWorld, options: BlastQueryOptions = {}): BlastQuery => {
  const fragments = options.fragments ?? DEFAULT_FRAGMENTS
  const bodiesMax = options.bodiesMax ?? DEFAULT_BODIES_MAX
  const fan = new Float64Array(fragments * 3)
  for (let i = 0; i < fragments; i++) {
    const height = 1 - (2 * (i + 0.5)) / fragments
    const ring = Math.sqrt(Math.max(0, 1 - height * height))
    const turn = GOLDEN_ANGLE * i
    fan[i * 3] = ring * Math.cos(turn)
    fan[i * 3 + 1] = height
    fan[i * 3 + 2] = ring * Math.sin(turn)
  }
  const fragmentBody = new Int32Array(fragments)
  const fragmentUser = new Int32Array(fragments)
  const fragmentTag = new Int32Array(fragments)
  const fragmentDistance = new Float32Array(fragments)
  const bodies: BodyId[] = []
  const visible = new Uint8Array(bodiesMax)
  const pose = new Float64Array(7)
  const direction: [number, number, number] = [0, 0, 0]
  const result = { fragmentHits: 0, fragmentBody, fragmentUser, fragmentTag, fragmentDistance, bodyCount: 0, bodies, visible }

  const throwFragments = (origin: Vec3, reach: number, spin: number): number => {
    const cos = Math.cos(spin)
    const sin = Math.sin(spin)
    let met = 0
    for (let i = 0; i < fragments; i++) {
      const x = fan[i * 3]!
      const z = fan[i * 3 + 2]!
      direction[0] = x * cos + z * sin
      direction[1] = fan[i * 3 + 1]!
      direction[2] = z * cos - x * sin
      const hit: RayHit | null = world.rayFirst(origin, direction, reach, SOLID)
      if (!hit) continue
      fragmentBody[met] = hit.body
      fragmentUser[met] = hit.user
      fragmentTag[met] = hit.tag
      fragmentDistance[met] = hit.distance
      met++
    }
    return met
  }

  const lookAtBodies = (origin: Vec3, radius: number): number => {
    const count = Math.min(world.overlapSphere(origin, radius, bodies, SOLID), bodiesMax)
    for (let i = 0; i < count; i++) {
      const body = bodies[i]!
      world.readPose(body, pose, 0)
      const dx = pose[0]! - origin[0]
      const dy = pose[1]! - origin[1]
      const dz = pose[2]! - origin[2]
      const length = Math.hypot(dx, dy, dz)
      if (length < SIGHT_SLACK) {
        visible[i] = 1
        continue
      }
      direction[0] = dx / length
      direction[1] = dy / length
      direction[2] = dz / length
      const first = world.rayFirst(origin, direction, length, COVER)
      visible[i] = first === null || first.body === body || first.distance >= length - SIGHT_SLACK ? 1 : 0
    }
    return count
  }

  return {
    run(params) {
      result.fragmentHits = throwFragments(params.origin, params.fragmentReach ?? params.radius, params.spin ?? 0)
      result.bodyCount = lookAtBodies(params.origin, params.radius)
      return result
    },
  }
}
