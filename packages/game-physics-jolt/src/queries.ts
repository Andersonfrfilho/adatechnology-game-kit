import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyId, QueryFilter, RayHit, Vec3 } from '@adatechnology/game-physics'

import { layerOf } from './constants'
import type { JoltWorldHost } from './world-host'

/** A ray or a sphere swept: where from, which way (unit), how far. */
export interface Cast {
  readonly from: Vec3
  readonly direction: Vec3
  readonly length: number
}

const filterFor = (w: JoltWorldHost, filter?: QueryFilter): JoltNS.ObjectLayerFilter => {
  if (!filter?.layers) return w.objFilter
  const key = [...filter.layers].sort().join(',')
  let f = w.layerFilters.get(key)
  if (!f) {
    const allowed = new Set(filter.layers.map((l) => layerOf(l)))
    f = new w.J.ObjectLayerFilterJS()
    f.ShouldCollide = (layer: number) => allowed.has(layer)
    w.layerFilters.set(key, f)
  }
  return f
}

const hitOf = (w: JoltWorldHost, bodyKey: number, sub: JoltNS.SubShapeID, distance: number): RayHit => {
  const e = w.bodies.get(bodyKey)
  const tag = e ? e.body.GetShape().GetSubShapeUserData(sub) | 0 : -1
  return { body: bodyKey as BodyId, user: e?.user ?? -1, tag, distance }
}

const aimRay = (w: JoltWorldHost, c: Cast): void => {
  w.ray.mOrigin.Set(c.from[0], c.from[1], c.from[2])
  w.ray.mDirection.Set(c.direction[0] * c.length, c.direction[1] * c.length, c.direction[2] * c.length)
}

export const rayAll = (w: JoltWorldHost, c: Cast, out: RayHit[], filter?: QueryFilter): number => {
  aimRay(w, c)
  const col = w.rayCollector
  col.Reset()
  w.system.GetNarrowPhaseQuery().CastRay(w.ray, w.raySettings, col, w.bpFilter, filterFor(w, filter), w.bodyFilter, w.shapeFilter)
  col.Sort()
  out.length = 0
  const hits = col.mHits
  for (let i = 0; i < hits.size(); i++) {
    const h = hits.at(i)
    out.push(hitOf(w, h.mBodyID.GetIndexAndSequenceNumber(), h.mSubShapeID2, h.mFraction * c.length))
  }
  return out.length
}

export const rayFirst = (w: JoltWorldHost, c: Cast, filter?: QueryFilter): RayHit | null => {
  aimRay(w, c)
  const col = w.rayClosest
  col.Reset()
  w.system.GetNarrowPhaseQuery().CastRay(w.ray, w.raySettings, col, w.bpFilter, filterFor(w, filter), w.bodyFilter, w.shapeFilter)
  if (!col.HadHit()) return null
  return hitOf(w, col.mHit.mBodyID.GetIndexAndSequenceNumber(), col.mHit.mSubShapeID2, col.mHit.mFraction * c.length)
}

const sphere = (w: JoltWorldHost, radius: number): JoltNS.Shape => {
  const key = Math.round(radius * 1000)
  let s = w.sphereShapes.get(key)
  if (!s) {
    s = w.makeShape({ kind: 'sphere', radius: key / 1000 })
    w.sphereShapes.set(key, s)
  }
  return s
}

export const overlapSphere = (w: JoltWorldHost, at: { readonly center: Vec3; readonly radius: number }, out: BodyId[], filter?: QueryFilter): number => {
  const J = w.J
  const shape = sphere(w, at.radius)
  w.r1.Set(at.center[0], at.center[1], at.center[2])
  const m = J.RMat44.prototype.sTranslation(w.r1)
  w.v2.Set(1, 1, 1)
  const c = w.collideCollector
  c.Reset()
  w.r1.Set(0, 0, 0)
  w.system.GetNarrowPhaseQuery().CollideShape(shape, w.v2, m, w.collideSettings, w.r1, c, w.bpFilter, filterFor(w, filter), w.bodyFilter, w.shapeFilter)
  out.length = 0
  const hits = c.mHits
  const seen = new Set<number>()
  for (let i = 0; i < hits.size(); i++) {
    const k = hits.at(i).mBodyID2.GetIndexAndSequenceNumber()
    if (!seen.has(k)) {
      seen.add(k)
      out.push(k as BodyId)
    }
  }
  return out.length
}

export const sphereCastAll = (w: JoltWorldHost, c: Cast & { readonly radius: number }, out: RayHit[], filter?: QueryFilter): number => {
  const J = w.J
  const shape = sphere(w, c.radius)
  w.r1.Set(c.from[0], c.from[1], c.from[2])
  const m = J.RMat44.prototype.sTranslation(w.r1)
  w.v1.Set(c.direction[0] * c.length, c.direction[1] * c.length, c.direction[2] * c.length)
  w.v2.Set(1, 1, 1)
  const cast = new J.RShapeCast(shape, w.v2, m, w.v1)
  const col = w.castCollector
  col.Reset()
  w.r1.Set(0, 0, 0)
  w.system.GetNarrowPhaseQuery().CastShape(cast, w.castSettings, w.r1, col, w.bpFilter, filterFor(w, filter), w.bodyFilter, w.shapeFilter)
  J.destroy(cast)
  col.Sort()
  out.length = 0
  const hits = col.mHits
  for (let i = 0; i < hits.size(); i++) {
    const h = hits.at(i)
    out.push(hitOf(w, h.mBodyID2.GetIndexAndSequenceNumber(), h.mSubShapeID2, h.mFraction * c.length))
  }
  return out.length
}

/** The deepest overlap of a body with the fixed bodies where it stands, and the way out of it (`PhysicsWorld.penetration`). */
export const penetration = (w: JoltWorldHost, id: BodyId, out: Float64Array, among?: ReadonlySet<BodyId>): number => {
  const J = w.J
  const e = w.entry(id)
  w.v2.Set(1, 1, 1)
  const c = w.collideCollector
  c.Reset()
  w.r1.Set(0, 0, 0)
  const self = new J.IgnoreSingleBodyFilter(e.id)
  w.system.GetNarrowPhaseQuery().CollideShape(e.body.GetShape(), w.v2, e.body.GetCenterOfMassTransform(), w.collideSettings, w.r1, c, w.bpFilter, filterFor(w, STATIC_ONLY), self, w.shapeFilter)
  J.destroy(self)
  let depth = 0
  const hits = c.mHits
  for (let i = 0; i < hits.size(); i++) {
    const h = hits.at(i)
    if (h.mPenetrationDepth <= depth || (among && !among.has(h.mBodyID2.GetIndexAndSequenceNumber() as BodyId))) continue
    const a = h.mPenetrationAxis
    const l = Math.hypot(a.GetX(), a.GetY(), a.GetZ())
    if (l < 1e-9) continue
    depth = h.mPenetrationDepth
    // the axis moves the fixed body out of the query's shape: the query's body goes the other way
    out[0] = -a.GetX() / l
    out[1] = -a.GetY() / l
    out[2] = -a.GetZ() / l
  }
  return depth
}

const STATIC_ONLY: QueryFilter = { layers: ['static'] }
