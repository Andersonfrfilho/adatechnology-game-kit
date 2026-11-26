import type JoltNS from 'jolt-physics/wasm-compat'

import type { BodyId, Quat, ShapeDesc, SharedShapeId, Vec3 } from '@adatechnology/game-physics'

import type { BodyEntry } from './entries'
import type { JoltWorldHost } from './world-host'

/** A shape the engine holds for bodies to share: the one reference the world keeps, until `releaseSharedShape`. */
export const createSharedShape = (w: JoltWorldHost, shape: ShapeDesc): SharedShapeId => {
  if (shape.kind === 'shared') throw new Error('game-physics-jolt: a shared shape is made from a shape, not from another shared shape')
  const id = w.nextShared++
  w.sharedShapes.set(id, w.makeShape(shape))
  return id as SharedShapeId
}

export const releaseSharedShape = (w: JoltWorldHost, id: SharedShapeId): void => {
  w.sharedShapes.get(id)?.Release()
  w.sharedShapes.delete(id)
}

/**
 * The body's compound as one whose children can change. A compound that is already mutable is itself; a static one (a shape shared by many bodies, or one made with
 * the plain `compound`) is copied first into a mutable compound of the same children, which share their hulls: the copy is this body's own, so the other bodies keep
 * the whole shape. The children keep their order, and a child's handle is its index in the compound as it was made.
 */
const mutableOf = (w: JoltWorldHost, id: BodyId, e: BodyEntry): JoltNS.MutableCompoundShape => {
  if (e.mutable) return e.mutable
  const J = w.J
  const shape = e.body.GetShape()
  const type = shape.GetSubType()
  if (type !== J.EShapeSubType_MutableCompound && type !== J.EShapeSubType_StaticCompound) throw new Error(`game-physics-jolt: body ${id} has no compound shape to change`)
  if (type === J.EShapeSubType_StaticCompound) copyAsMutable(w, e, shape)
  const mutable = J.castObject(e.body.GetShape(), J.MutableCompoundShape)
  e.mutable = mutable
  e.handles ??= Array.from({ length: mutable.GetNumSubShapes() }, (_, i) => i)
  return mutable
}

const copyAsMutable = (w: JoltWorldHost, e: BodyEntry, shape: JoltNS.Shape): void => {
  const J = w.J
  const source = J.castObject(shape, J.CompoundShape)
  const com = shape.GetCenterOfMass()
  const centre: Vec3 = [com.GetX(), com.GetY(), com.GetZ()]
  const settings = new J.MutableCompoundShapeSettings()
  const at = w.v1
  const count = source.GetNumSubShapes()
  for (let i = 0; i < count; i++) {
    const sub = source.GetSubShape(i)
    const p = sub.GetPositionCOM()
    at.Set(p.GetX() + centre[0], p.GetY() + centre[1], p.GetZ() + centre[2])
    settings.AddShapeShape(at, sub.GetRotation(), sub.mShape, sub.mUserData)
  }
  const result = settings.Create()
  if (result.HasError()) {
    const message = result.GetError().c_str()
    J.destroy(result)
    J.destroy(settings)
    throw new Error(`game-physics-jolt: copy of a shared compound: ${message}`)
  }
  const copy = result.Get()
  copy.AddRef()
  J.destroy(result)
  J.destroy(settings)
  // the same children in the same places: the centre of mass and the kit's mass stay
  w.bi.SetShape(e.id, copy, false, J.EActivation_DontActivate)
  copy.Release()
}

/** Replaces, moves or takes out one child of a compound body (see `PhysicsWorld.setChildShape`). */
export const setChildShape = (w: JoltWorldHost, id: BodyId, child: number, shape: ShapeDesc | null, pose?: { readonly position: Vec3; readonly rotation?: Quat }): void => {
  const J = w.J
  const e = w.entry(id)
  const mutable = mutableOf(w, id, e)
  const handles = e.handles as number[]
  const index = handles.indexOf(child)
  if (index < 0) throw new Error(`game-physics-jolt: body ${id} has no child ${child}`)
  const centre = mutable.GetCenterOfMass()
  const before: Vec3 = [centre.GetX(), centre.GetY(), centre.GetZ()]
  if (shape === null) {
    mutable.RemoveShape(index)
    handles.splice(index, 1)
  } else {
    const sub = mutable.GetSubShape(index)
    const p = sub.GetPositionCOM()
    const position = pose?.position ?? ([p.GetX() + before[0], p.GetY() + before[1], p.GetZ() + before[2]] as const)
    const q = sub.GetRotation()
    const rotation = pose?.rotation ?? ([q.GetX(), q.GetY(), q.GetZ(), q.GetW()] as const)
    const tag = sub.mUserData
    const made = w.makeShape(shape)
    made.SetUserData(tag)
    w.v1.Set(position[0], position[1], position[2])
    w.q1.Set(rotation[0], rotation[1], rotation[2], rotation[3])
    mutable.ModifyShape(index, w.v1, w.q1, made)
    made.Release()
  }
  // the kit's mass and inertia are kept (`setMassProperties` changes them) and the centre of mass has not moved: putting the body where it is brings its bounds and the
  // broadphase up to date. `NotifyShapeChanged` does the same and leaves 8 bytes in the wasm heap a call (jolt-physics 1.1.1), which the heap tests do not allow
  w.bi.SetPositionAndRotation(e.id, e.body.GetPosition(), e.body.GetRotation(), J.EActivation_DontActivate)
}

/**
 * Puts the body's centre of mass at `centre` (its shape's frame) and keeps the shape where it is in the world: the centre of mass is the shape's own, so the shape is
 * wrapped in an offset (or the wrapper this made before is made again; Jolt moves the body's position by what the centre of mass moved), and its speed is that of the new point.
 */
export const moveCentreOfMass = (w: JoltWorldHost, e: BodyEntry, centre: Vec3): void => {
  const J = w.J
  const body = e.body
  const shape = body.GetShape()
  const wrapped = shape.GetSubType() === J.EShapeSubType_OffsetCenterOfMass
  const inner = wrapped ? J.castObject(shape, J.DecoratedShape).GetInnerShape() : shape
  // each getter answers with the same temporary vector: read before the next call
  const own = inner.GetCenterOfMass()
  const ownCentre: Vec3 = [own.GetX(), own.GetY(), own.GetZ()]
  const old = shape.GetCenterOfMass()
  const oldCentre: Vec3 = [old.GetX(), old.GetY(), old.GetZ()]
  w.v1.Set(centre[0] - ownCentre[0], centre[1] - ownCentre[1], centre[2] - ownCentre[2])
  const wrapper = new J.OffsetCenterOfMassShape(inner, w.v1)
  wrapper.AddRef()
  const q = body.GetRotation()
  const velocity = body.GetLinearVelocity()
  const spin = body.GetAngularVelocity()
  const start = { velocity: [velocity.GetX(), velocity.GetY(), velocity.GetZ()] as Vec3, spin: [spin.GetX(), spin.GetY(), spin.GetZ()] as Vec3 }
  w.bi.SetShape(e.id, wrapper, false, J.EActivation_DontActivate)
  wrapper.Release()
  // Jolt moves the body's position (its centre of mass) by R (new - old) itself, so the shape's origin stays; the speed of that point is what is left to carry over
  w.v2.Set(centre[0] - oldCentre[0], centre[1] - oldCentre[1], centre[2] - oldCentre[2])
  const shift = rotateBy(q, [w.v2.GetX(), w.v2.GetY(), w.v2.GetZ()])
  const lever = [start.spin[1] * shift[2] - start.spin[2] * shift[1], start.spin[2] * shift[0] - start.spin[0] * shift[2], start.spin[0] * shift[1] - start.spin[1] * shift[0]]
  w.v2.Set(start.velocity[0] + lever[0], start.velocity[1] + lever[1], start.velocity[2] + lever[2])
  w.bi.SetLinearVelocity(e.id, w.v2)
}

const rotateBy = (q: JoltNS.Quat, v: Vec3): Vec3 => {
  const [x, y, z, w] = [q.GetX(), q.GetY(), q.GetZ(), q.GetW()]
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]
}
