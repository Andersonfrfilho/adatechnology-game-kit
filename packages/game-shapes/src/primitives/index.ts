import { canonicalJson } from '../hash'
import type { PrimitiveBuffers, PrimitiveNode } from '../types'
import { difference } from './difference'
import { computeVertexNormals, extrude } from './extrude'
import { box, circle, cone, cylinder, indexArray, lathe, plane, ring, sphere, torus } from './three-generators'

export { box, circle, cone, cylinder, lathe, plane, ring, sphere, torus } from './three-generators'
export { computeVertexNormals, extrude } from './extrude'
export { difference } from './difference'

/** How a level of detail changes a primitive. */
export interface DetailOptions {
  /** Multiplies the segment counts of round primitives (1 leaves them as given). */
  readonly detail?: number
  /** Floor of the scaled segment counts (default 3). */
  readonly minSegments?: number
}

const PARAMETER_KEYS: Readonly<Record<PrimitiveNode['kind'], readonly string[]>> = {
  box: ['size', 'segments'],
  cylinder: ['radiusTop', 'radiusBottom', 'height', 'radialSegments', 'heightSegments', 'openEnded', 'thetaStart', 'thetaLength'],
  cone: ['radius', 'height', 'radialSegments', 'heightSegments', 'openEnded', 'thetaStart', 'thetaLength'],
  sphere: ['radius', 'widthSegments', 'heightSegments', 'phiStart', 'phiLength', 'thetaStart', 'thetaLength'],
  plane: ['width', 'height', 'widthSegments', 'heightSegments'],
  circle: ['radius', 'segments', 'thetaStart', 'thetaLength'],
  ring: ['innerRadius', 'outerRadius', 'thetaSegments', 'phiSegments', 'thetaStart', 'thetaLength'],
  lathe: ['points', 'segments', 'phiStart', 'phiLength'],
  torus: ['radius', 'tube', 'radialSegments', 'tubularSegments', 'arc'],
  extrude: ['shape', 'depth', 'steps', 'bevel'],
  difference: ['size', 'subtract'],
  mesh: ['positions', 'normals', 'uvs', 'indices'],
}

/** The segment fields `detail` scales, per kind. */
const SEGMENT_KEYS: Readonly<Partial<Record<PrimitiveNode['kind'], readonly string[]>>> = {
  cylinder: ['radialSegments'],
  cone: ['radialSegments'],
  sphere: ['widthSegments', 'heightSegments'],
  circle: ['segments'],
  ring: ['thetaSegments'],
  lathe: ['segments'],
  torus: ['radialSegments', 'tubularSegments'],
}
/** three's defaults of the segment fields, so a scaled default is scaled from the right number. */
const SEGMENT_DEFAULTS: Readonly<Record<string, number>> = { radialSegments: 32, widthSegments: 32, heightSegments: 16, segments: 12, thetaSegments: 32, tubularSegments: 48 }
const segmentDefault = (kind: string, key: string): number => (kind === 'circle' && key === 'segments' ? 32 : kind === 'torus' && key === 'radialSegments' ? 12 : (SEGMENT_DEFAULTS[key] as number))

/** The parameters of a primitive node (no transform, colour or name), with the level of detail applied: what its geometry depends on. */
export function primitiveParameters(node: PrimitiveNode, options: DetailOptions = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const source = node as unknown as Record<string, unknown>
  for (const key of PARAMETER_KEYS[node.kind]) if (source[key] !== undefined) out[key] = source[key]
  const detail = options.detail ?? 1
  if (detail !== 1) {
    const floor = options.minSegments ?? 3
    for (const key of SEGMENT_KEYS[node.kind] ?? []) {
      const given = (out[key] as number | undefined) ?? segmentDefault(node.kind, key)
      out[key] = Math.max(floor, Math.round(given * detail))
    }
  }
  return out
}

function mesh(p: Record<string, unknown>): PrimitiveBuffers {
  const positions = new Float32Array(p.positions as number[])
  const indices = p.indices ? indexArray(p.indices as number[]) : undefined
  return {
    type: 'BufferGeometry',
    parameters: {},
    positions,
    normals: p.normals ? new Float32Array(p.normals as number[]) : computeVertexNormals(positions, indices),
    uvs: p.uvs ? new Float32Array(p.uvs as number[]) : new Float32Array((positions.length / 3) * 2),
    ...(indices ? { indices } : {}),
    groups: [],
  }
}

function make(kind: PrimitiveNode['kind'], p: Record<string, any>): PrimitiveBuffers {
  switch (kind) {
    case 'box': {
      const size = (p.size ?? [1, 1, 1]) as number[]
      const segments = (p.segments ?? [1, 1, 1]) as number[]
      return box(size[0], size[1], size[2], segments[0], segments[1], segments[2])
    }
    case 'cylinder':
      return cylinder(p.radiusTop, p.radiusBottom, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength)
    case 'cone':
      return cone(p.radius, p.height, p.radialSegments, p.heightSegments, p.openEnded, p.thetaStart, p.thetaLength)
    case 'sphere':
      return sphere(p.radius, p.widthSegments, p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength)
    case 'plane':
      return plane(p.width, p.height, p.widthSegments, p.heightSegments)
    case 'circle':
      return circle(p.radius, p.segments, p.thetaStart, p.thetaLength)
    case 'ring':
      return ring(p.innerRadius, p.outerRadius, p.thetaSegments, p.phiSegments, p.thetaStart, p.thetaLength)
    case 'lathe':
      return lathe(p.points, p.segments, p.phiStart, p.phiLength)
    case 'torus':
      return torus(p.radius, p.tube, p.radialSegments, p.tubularSegments, p.arc)
    case 'extrude':
      return extrude(p.shape, p.depth, p.steps, p.bevel)
    case 'difference':
      return difference(p.size, p.subtract ?? [])
    case 'mesh':
      return mesh(p)
    default:
      throw new Error(`game-shapes: unknown primitive kind "${String(kind)}"`)
  }
}

/** Templates by their parameter text: the same cylinder is generated once per process. Read-only by contract. */
const templates = new Map<string, PrimitiveBuffers>()
let templateLimit = 4096
const stats = { hits: 0, misses: 0 }

/** Sets how many primitive templates are kept (least recently used out; 0 turns the cache off). */
export function setTemplateCacheSize(size: number): void {
  templateLimit = Math.max(0, Math.floor(size))
  while (templates.size > templateLimit) templates.delete(templates.keys().next().value as string)
}
export function clearTemplateCache(): void {
  templates.clear()
  stats.hits = 0
  stats.misses = 0
}
export const templateCacheStats = (): { size: number; hits: number; misses: number } => ({ size: templates.size, ...stats })

/**
 * The geometry of one primitive on its own, not baked: the arrays three's generator of the same kind builds, bit for bit (meshes and differences
 * are `BufferGeometry`). The result comes from a shared template cache and must not be written to (copy it with `clonePrimitive`).
 */
export function buildPrimitive(node: PrimitiveNode, options: DetailOptions = {}): PrimitiveBuffers {
  const parameters = primitiveParameters(node, options)
  // raw meshes are not worth a key of their whole arrays; they are cheap to wrap
  if (node.kind === 'mesh' || templateLimit === 0) return make(node.kind, parameters)
  const key = `${node.kind}:${canonicalJson(parameters)}`
  const cached = templates.get(key)
  if (cached) {
    stats.hits++
    templates.delete(key)
    templates.set(key, cached)
    return cached
  }
  stats.misses++
  const built = make(node.kind, parameters)
  templates.set(key, built)
  if (templates.size > templateLimit) templates.delete(templates.keys().next().value as string)
  return built
}

/** A copy that owns its arrays. */
export function clonePrimitive(p: PrimitiveBuffers): PrimitiveBuffers {
  return {
    type: p.type,
    parameters: p.parameters,
    positions: p.positions.slice(),
    normals: p.normals.slice(),
    uvs: p.uvs.slice(),
    ...(p.indices ? { indices: p.indices.slice() } : {}),
    groups: p.groups.map((group) => ({ ...group })),
  }
}
