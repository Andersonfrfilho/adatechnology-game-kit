import type JoltNS from 'jolt-physics/wasm-compat'

import { LAYER_PAIRS, LAYERS } from '@adatechnology/game-physics'
import type { BodyId, Layer, QueryFilter, Quat, RayHit, ShapeDesc, Vec3 } from '@adatechnology/game-physics'

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

/** The body filter of a query: the world's (lets everything through) unless the query names bodies to leave out. */
const bodiesFor = (w: JoltWorldHost, filter?: QueryFilter): JoltNS.BodyFilter => {
  if (!filter?.ignore || filter.ignore.length === 0) return w.bodyFilter
  const ignoring = (w.ignoreFilter ??= new w.J.IgnoreMultipleBodiesFilter())
  ignoring.Clear()
  for (const id of filter.ignore) ignoring.IgnoreBody(w.entry(id).id)
  return ignoring
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
  w.system.GetNarrowPhaseQuery().CastRay(w.ray, w.raySettings, col, w.bpFilter, filterFor(w, filter), bodiesFor(w, filter), w.shapeFilter)
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
  w.system.GetNarrowPhaseQuery().CastRay(w.ray, w.raySettings, col, w.bpFilter, filterFor(w, filter), bodiesFor(w, filter), w.shapeFilter)
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
  w.system.GetNarrowPhaseQuery().CollideShape(shape, w.v2, m, w.collideSettings, w.r1, c, w.bpFilter, filterFor(w, filter), bodiesFor(w, filter), w.shapeFilter)
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

/** The most shapes held for `overlapShape`: a kit asks with a handful, a caller with a new description every time must not fill the heap. */
const QUERY_SHAPES_MAX = 32

const queryShape = (w: JoltWorldHost, desc: ShapeDesc): JoltNS.Shape => {
  const held = w.queryShapes.get(desc)
  if (held) return held
  if (w.queryShapes.size >= QUERY_SHAPES_MAX) {
    const [oldest, shape] = w.queryShapes.entries().next().value as [ShapeDesc, JoltNS.Shape]
    shape.Release()
    w.queryShapes.delete(oldest)
  }
  const made = w.makeShape(desc)
  w.queryShapes.set(desc, made)
  return made
}

/** The bodies a shape overlaps when put at `at` (`PhysicsWorld.overlapShape`): the shape is made for the query and let go of after it. */
export const overlapShape = (w: JoltWorldHost, at: { readonly shape: ShapeDesc; readonly position: Vec3; readonly rotation: Quat }, out: BodyId[], filter?: QueryFilter): number => {
  const J = w.J
  const shape = queryShape(w, at.shape)
  w.r1.Set(at.position[0], at.position[1], at.position[2])
  w.q1.Set(at.rotation[0], at.rotation[1], at.rotation[2], at.rotation[3])
  const m = J.RMat44.prototype.sRotationTranslation(w.q1, w.r1)
  w.v2.Set(1, 1, 1)
  const c = w.collideCollector
  c.Reset()
  w.r1.Set(0, 0, 0)
  w.system.GetNarrowPhaseQuery().CollideShape(shape, w.v2, m, w.collideSettings, w.r1, c, w.bpFilter, filterFor(w, filter), bodiesFor(w, filter), w.shapeFilter)
  J.destroy(m)
  out.length = 0
  const hits = c.mHits
  for (let i = 0; i < hits.size(); i++) {
    const k = hits.at(i).mBodyID2.GetIndexAndSequenceNumber() as BodyId
    if (!out.includes(k)) out.push(k)
  }
  return out.length
}

/** How close (m) a body must be to another for them to count as touching when it sleeps (resting bodies overlap by up to the slop, or sit at 0). */
const TOUCH_MARGIN = 0.01

/** The layers a body of `layer` meets, without sensors (they are overlapped, never touched): what its touching partners are looked for among. */
const touchableBy = (layer: Layer): QueryFilter => ({
  layers: LAYERS.filter((other) => other !== 'sensor' && LAYER_PAIRS.some(([a, b]) => (a === layer && b === other) || (b === layer && a === other))),
})

/**
 * The bodies a body touches now (`PhysicsWorld.contactBodies`). A body that sleeps has no contacts in the engine (they are dropped as it falls asleep), so its touching
 * partners are found by a query of its own shape widened by `TOUCH_MARGIN`.
 */
export const contactBodies = (w: JoltWorldHost, id: BodyId, out: BodyId[]): number => {
  out.length = 0
  const e = w.entry(id)
  if (!w.bi.IsActive(e.id)) {
    const J = w.J
    w.v2.Set(1, 1, 1)
    const c = w.collideCollector
    c.Reset()
    w.r1.Set(0, 0, 0)
    const was = w.collideSettings.mMaxSeparationDistance
    w.collideSettings.mMaxSeparationDistance = TOUCH_MARGIN
    const self = new J.IgnoreSingleBodyFilter(e.id)
    w.system.GetNarrowPhaseQuery().CollideShape(e.body.GetShape(), w.v2, e.body.GetCenterOfMassTransform(), w.collideSettings, w.r1, c, w.bpFilter, filterFor(w, touchableBy(e.layer)), self, w.shapeFilter)
    w.collideSettings.mMaxSeparationDistance = was
    J.destroy(self)
    const hits = c.mHits
    for (let i = 0; i < hits.size(); i++) {
      const k = hits.at(i).mBodyID2.GetIndexAndSequenceNumber() as BodyId
      if (!out.includes(k)) out.push(k)
    }
    return out.length
  }
  const partners = w.partners.get(id)
  if (partners) for (const other of partners.keys()) out.push(other as BodyId)
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
  w.system.GetNarrowPhaseQuery().CastShape(cast, w.castSettings, w.r1, col, w.bpFilter, filterFor(w, filter), bodiesFor(w, filter), w.shapeFilter)
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
  // with `among`, a body outside it is left out before the narrow phase, not after: the ground under a thin plate in a crater is thousands of triangle hits otherwise (5 ms)
  const bodies = among ? amongFilter(w, among, id) : new J.IgnoreSingleBodyFilter(e.id)
  w.system.GetNarrowPhaseQuery().CollideShape(e.body.GetShape(), w.v2, e.body.GetCenterOfMassTransform(), w.collideSettings, w.r1, c, w.bpFilter, filterFor(w, STATIC_ONLY), bodies, w.shapeFilter)
  if (among) {
    // the set is the caller's: not held past the query (CLAUDE.md §8)
    w.among.set = NO_BODIES
    w.among.self = -1
  } else J.destroy(bodies)
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

const NO_BODIES: ReadonlySet<BodyId> = new Set()

/**
 * The world's one body filter that lets through only the bodies of `among` but the queried body itself (made once; the set and the body are swapped in per query and cleared
 * after it). A `BodyID` is one uint32 in the heap. Shared state: only `penetration` uses it, and a query never runs inside another, so it is never reentered.
 */
const amongFilter = (w: JoltWorldHost, among: ReadonlySet<BodyId>, self: BodyId): JoltNS.BodyFilter => {
  w.among.set = among
  w.among.self = self
  if (w.among.filter) return w.among.filter
  const J = w.J
  const filter = new J.BodyFilterJS()
  filter.ShouldCollide = (pointer: number) => {
    const id = J.HEAPU32[pointer >> 2] as BodyId
    return id !== w.among.self && w.among.set.has(id)
  }
  filter.ShouldCollideLocked = () => true
  w.among.filter = filter
  return filter
}
