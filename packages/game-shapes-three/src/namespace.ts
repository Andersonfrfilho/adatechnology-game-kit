import { box, circle, cone, cylinder, extrude, lathe, plane, ring, sphere, torus } from '@adatechnology/game-shapes'
import type { BevelSpec, PrimitiveBuffers, PrimitiveNode, ShapeOutline, Vec2 } from '@adatechnology/game-shapes'
import { buildPrimitive } from '@adatechnology/game-shapes'
import type * as THREE_NS from 'three'

import { toGeometry } from './geometry'
import type { Three } from './geometry'

/** The geometry constructors `shapeGeometries` replaces. */
export const SHAPE_GEOMETRY_TYPES = ['BoxGeometry', 'CylinderGeometry', 'ConeGeometry', 'SphereGeometry', 'PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'LatheGeometry', 'TorusGeometry', 'ExtrudeGeometry'] as const

type Curve = { isLineCurve?: boolean; v1?: { x: number; y: number }; v2?: { x: number; y: number } }
type PathLike = { curves: Curve[]; autoClose?: boolean; holes?: PathLike[] }

/** The point list of a path made only of contiguous `LineCurve`s (what `moveTo` + `lineTo` builds), or null. */
function linePoints(path: PathLike): Vec2[] | null {
  if (path.autoClose || path.curves.length === 0) return null
  const points: Vec2[] = []
  for (const [index, curve] of path.curves.entries()) {
    if (!curve.isLineCurve || !curve.v1 || !curve.v2) return null
    if (index === 0) points.push([curve.v1.x, curve.v1.y])
    else {
      const last = points[points.length - 1] as Vec2
      if (last[0] !== curve.v1.x || last[1] !== curve.v1.y) return null
    }
    points.push([curve.v2.x, curve.v2.y])
  }
  return points
}

type ExtrudeOptions = { depth?: number; steps?: number; bevelEnabled?: boolean; bevelThickness?: number; bevelSize?: number; bevelOffset?: number; bevelSegments?: number; extrudePath?: unknown; UVGenerator?: unknown; curveSegments?: number }

/** An extrusion game-shapes can make exactly: one straight-edged shape, no path, the world uvs. */
function extrudeOf(shapes: unknown, options: ExtrudeOptions = {}): PrimitiveBuffers | null {
  if (Array.isArray(shapes) || !shapes || options.extrudePath !== undefined || options.UVGenerator !== undefined) return null
  const shape = shapes as PathLike
  const outer = linePoints(shape)
  if (!outer) return null
  const holes: Vec2[][] = []
  for (const hole of shape.holes ?? []) {
    const points = linePoints(hole)
    if (!points) return null
    holes.push(points)
  }
  const outline: ShapeOutline = holes.length ? { outer, holes } : { outer }
  const bevel: false | BevelSpec =
    options.bevelEnabled === false
      ? false
      : {
          ...(options.bevelThickness !== undefined ? { thickness: options.bevelThickness } : {}),
          ...(options.bevelSize !== undefined ? { size: options.bevelSize } : {}),
          ...(options.bevelOffset !== undefined ? { offset: options.bevelOffset } : {}),
          ...(options.bevelSegments !== undefined ? { segments: options.bevelSegments } : {}),
        }
  return extrude(outline, options.depth, options.steps, bevel)
}

export interface ShapeGeometriesOptions {
  /** Go through the template cache of game-shapes (default true): the same primitive is generated once per process. */
  readonly cache?: boolean
}

const namespaces = new WeakMap<object, Map<string, Three>>()

/**
 * A three namespace whose `BoxGeometry`, `CylinderGeometry`, `ConeGeometry`, `SphereGeometry`, `PlaneGeometry`, `CircleGeometry`, `RingGeometry`,
 * `LatheGeometry`, `TorusGeometry` and (straight-edged) `ExtrudeGeometry` are made by game-shapes, bit-identical to three's and instances of three's
 * classes; everything else is three's own. Hand it to code ported from the teams as `T`, so it keeps reading `new T.CylinderGeometry(...)`.
 * An extrusion with curves, several shapes, a path or a custom uv generator falls back to three.
 */
export function shapeGeometries(THREE: Three, options: ShapeGeometriesOptions = {}): Three {
  const cache = options.cache !== false
  const key = cache ? 'cache' : 'nocache'
  let byKey = namespaces.get(THREE)
  if (!byKey) {
    byKey = new Map()
    namespaces.set(THREE, byKey)
  }
  const existing = byKey.get(key)
  if (existing) return existing
  const made = (p: PrimitiveBuffers): THREE_NS.BufferGeometry => toGeometry(THREE, p)
  const viaCache = (node: PrimitiveNode, direct: () => PrimitiveBuffers): PrimitiveBuffers => (cache ? buildPrimitive(node) : direct())
  const defined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
  const constructors: Record<(typeof SHAPE_GEOMETRY_TYPES)[number], (...args: any[]) => THREE_NS.BufferGeometry> = {
    BoxGeometry: (width?: number, height?: number, depth?: number, ws = 1, hs = 1, ds = 1) =>
      made(viaCache({ kind: 'box', size: [width ?? 1, height ?? 1, depth ?? 1], segments: [ws, hs, ds] }, () => box(width, height, depth, ws, hs, ds))),
    CylinderGeometry: (radiusTop?: number, radiusBottom?: number, height?: number, radialSegments?: number, heightSegments?: number, openEnded?: boolean, thetaStart?: number, thetaLength?: number) =>
      made(viaCache({ kind: 'cylinder', ...defined({ radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength }) }, () => cylinder(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength))),
    ConeGeometry: (radius?: number, height?: number, radialSegments?: number, heightSegments?: number, openEnded?: boolean, thetaStart?: number, thetaLength?: number) =>
      made(viaCache({ kind: 'cone', ...defined({ radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength }) }, () => cone(radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength))),
    SphereGeometry: (radius?: number, widthSegments?: number, heightSegments?: number, phiStart?: number, phiLength?: number, thetaStart?: number, thetaLength?: number) =>
      made(viaCache({ kind: 'sphere', ...defined({ radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength }) }, () => sphere(radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength))),
    PlaneGeometry: (width?: number, height?: number, widthSegments?: number, heightSegments?: number) =>
      made(viaCache({ kind: 'plane', ...defined({ width, height, widthSegments, heightSegments }) }, () => plane(width, height, widthSegments, heightSegments))),
    CircleGeometry: (radius?: number, segments?: number, thetaStart?: number, thetaLength?: number) =>
      made(viaCache({ kind: 'circle', ...defined({ radius, segments, thetaStart, thetaLength }) }, () => circle(radius, segments, thetaStart, thetaLength))),
    RingGeometry: (innerRadius?: number, outerRadius?: number, thetaSegments?: number, phiSegments?: number, thetaStart?: number, thetaLength?: number) =>
      made(viaCache({ kind: 'ring', ...defined({ innerRadius, outerRadius, thetaSegments, phiSegments, thetaStart, thetaLength }) }, () => ring(innerRadius, outerRadius, thetaSegments, phiSegments, thetaStart, thetaLength))),
    LatheGeometry: (points?: Array<{ x: number; y: number }>, segments?: number, phiStart?: number, phiLength?: number) => {
      if (!points) return new THREE.LatheGeometry(undefined, segments, phiStart, phiLength)
      const profile = points.map((p) => [p.x, p.y] as const)
      return made(viaCache({ kind: 'lathe', points: profile, ...defined({ segments, phiStart, phiLength }) }, () => lathe(profile, segments, phiStart, phiLength)))
    },
    TorusGeometry: (radius?: number, tube?: number, radialSegments?: number, tubularSegments?: number, arc?: number) =>
      made(viaCache({ kind: 'torus', ...defined({ radius, tube, radialSegments, tubularSegments, arc }) }, () => torus(radius, tube, radialSegments, tubularSegments, arc))),
    ExtrudeGeometry: (shapes?: unknown, extrudeOptions?: ExtrudeOptions) => {
      const buffers = shapes === undefined ? null : extrudeOf(shapes, extrudeOptions)
      if (!buffers) return new THREE.ExtrudeGeometry(shapes as THREE_NS.Shape, extrudeOptions as THREE_NS.ExtrudeGeometryOptions)
      const geometry = toGeometry(THREE, buffers) as THREE_NS.BufferGeometry & { parameters: unknown }
      geometry.parameters = { shapes, options: extrudeOptions ?? {} }
      return geometry
    },
  }
  const namespace: Record<string, unknown> = { ...(THREE as unknown as Record<string, unknown>) }
  for (const type of SHAPE_GEOMETRY_TYPES) {
    const make = constructors[type]
    // callable with `new` (the returned object wins), and `instanceof` checks three's prototype
    const Constructor = function (this: unknown, ...args: unknown[]) {
      return make(...args)
    } as unknown as { prototype: unknown }
    Constructor.prototype = (THREE as unknown as Record<string, { prototype: unknown }>)[type]!.prototype
    Object.defineProperty(Constructor, 'name', { value: type })
    namespace[type] = Constructor
  }
  const result = namespace as unknown as Three
  byKey.set(key, result)
  return result
}
