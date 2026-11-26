import type JoltNS from 'jolt-physics/wasm-compat'

import { DEFAULT_MATERIAL } from '@adatechnology/game-physics'
import type { BodyId, JointDesc, JointId, RagdollDesc, RagdollId, RagdollJoint, Vec3 } from '@adatechnology/game-physics'

import { layerOf } from './constants'
import type { BodyEntry } from './entries'
import type { JoltWorldHost } from './world-host'

export const createGroup = (w: JoltWorldHost, subCount: number, disabledPairs: ReadonlyArray<readonly [number, number]>): number => {
  const table = new w.J.GroupFilterTable(subCount)
  for (const [a, b] of disabledPairs) table.DisableCollision(a, b)
  // the bodies hold references to the filter; the world keeps one for itself
  table.AddRef()
  const free = w.freeGroups.pop()
  if (free === undefined) return w.groups.push(table) - 1
  w.groups[free] = table
  return free
}

/** The world lets go of the table; it is destroyed once the last body that holds it is gone, and its index is the next one given out. */
export const releaseGroup = (w: JoltWorldHost, id: number): void => {
  const table = w.groups[id]
  if (!table) return
  table.Release()
  w.groups[id] = undefined
  w.freeGroups.push(id)
}

/** Any unit vector perpendicular to `axis`: the slider's normal axis, which only has to be off the slide. */
const perpendicularTo = (axis: Vec3): Vec3 => {
  const [x, y, z] = axis
  const raw: Vec3 = Math.abs(x) < 0.9 ? [0, z, -y] : [-z, 0, x]
  const length = Math.hypot(raw[0], raw[1], raw[2])
  return [raw[0] / length, raw[1] / length, raw[2] / length]
}

const sliderSettings = (w: JoltWorldHost, desc: Extract<JointDesc, { kind: 'slider' }>): JoltNS.TwoBodyConstraintSettings => {
  const s = new w.J.SliderConstraintSettings()
  const length = Math.hypot(desc.axis[0], desc.axis[1], desc.axis[2])
  const axis: Vec3 = [desc.axis[0] / length, desc.axis[1] / length, desc.axis[2] / length]
  const normal = perpendicularTo(axis)
  s.mAutoDetectPoint = false
  s.mPoint1.Set(desc.point[0], desc.point[1], desc.point[2])
  s.mPoint2.Set(desc.point[0], desc.point[1], desc.point[2])
  s.mSliderAxis1.Set(axis[0], axis[1], axis[2])
  s.mSliderAxis2.Set(axis[0], axis[1], axis[2])
  s.mNormalAxis1.Set(normal[0], normal[1], normal[2])
  s.mNormalAxis2.Set(normal[0], normal[1], normal[2])
  s.mLimitsMin = desc.min
  s.mLimitsMax = desc.max
  if (desc.friction !== undefined) s.mMaxFrictionForce = desc.friction
  return s
}

/** Jolt's settings for a joint, in world space as given (the two bodies are added by whoever creates it). */
const constraintSettings = (w: JoltWorldHost, desc: JointDesc | RagdollJoint): JoltNS.TwoBodyConstraintSettings => {
  const J = w.J
  if (desc.kind === 'hinge' || desc.kind === 'fixed') {
    // a fixed joint that can break is a hinge locked at 0: Jolt exposes the hinge's impulses, not the fixed one's
    const axis = desc.kind === 'hinge' ? desc.axis : ([0, 1, 0] as Vec3)
    const normal = desc.kind === 'hinge' ? desc.normal : ([1, 0, 0] as Vec3)
    const s = new J.HingeConstraintSettings()
    s.mPoint1.Set(desc.point[0], desc.point[1], desc.point[2])
    s.mPoint2.Set(desc.point[0], desc.point[1], desc.point[2])
    s.mHingeAxis1.Set(axis[0], axis[1], axis[2])
    s.mHingeAxis2.Set(axis[0], axis[1], axis[2])
    s.mNormalAxis1.Set(normal[0], normal[1], normal[2])
    s.mNormalAxis2.Set(normal[0], normal[1], normal[2])
    s.mLimitsMin = desc.kind === 'hinge' ? desc.min : 0
    s.mLimitsMax = desc.kind === 'hinge' ? desc.max : 0
    if (desc.kind === 'hinge' && desc.friction !== undefined) s.mMaxFrictionTorque = desc.friction
    return s
  }
  if (desc.kind === 'slider') return sliderSettings(w, desc)
  const s = new J.SwingTwistConstraintSettings()
  s.mPosition1.Set(desc.point[0], desc.point[1], desc.point[2])
  s.mPosition2.Set(desc.point[0], desc.point[1], desc.point[2])
  s.mTwistAxis1.Set(desc.twistAxis[0], desc.twistAxis[1], desc.twistAxis[2])
  s.mTwistAxis2.Set(desc.twistAxis[0], desc.twistAxis[1], desc.twistAxis[2])
  s.mPlaneAxis1.Set(desc.planeAxis[0], desc.planeAxis[1], desc.planeAxis[2])
  s.mPlaneAxis2.Set(desc.planeAxis[0], desc.planeAxis[1], desc.planeAxis[2])
  s.mNormalHalfConeAngle = desc.normalHalfCone
  s.mPlaneHalfConeAngle = desc.planeHalfCone
  s.mTwistMinAngle = desc.twistMin
  s.mTwistMaxAngle = desc.twistMax
  if (desc.friction !== undefined) s.mMaxFrictionTorque = desc.friction
  return s
}

interface JointMade {
  readonly kind: JointDesc['kind']
  readonly breakImpulse: number
  readonly ragdoll: boolean
}

const addJointEntry = (w: JoltWorldHost, constraint: JoltNS.TwoBodyConstraint, made: JointMade): JointId => {
  const J = w.J
  const id = w.nextJoint++ as JointId
  w.joints.set(id, {
    constraint,
    kind: made.kind,
    breakImpulse: made.breakImpulse,
    hinge: made.kind === 'hinge' || made.kind === 'fixed' ? J.castObject(constraint, J.HingeConstraint) : null,
    swing: made.kind === 'swingTwist' ? J.castObject(constraint, J.SwingTwistConstraint) : null,
    slider: made.kind === 'slider' ? J.castObject(constraint, J.SliderConstraint) : null,
    ragdoll: made.ragdoll,
  })
  return id
}

export const createJoint = (w: JoltWorldHost, desc: JointDesc): JointId => {
  const settings = constraintSettings(w, desc)
  const constraint = w.J.castObject(settings.Create(w.entry(desc.a).body, w.entry(desc.b).body), w.J.TwoBodyConstraint)
  w.J.destroy(settings)
  w.system.AddConstraint(constraint)
  return addJointEntry(w, constraint, { kind: desc.kind, breakImpulse: desc.breakImpulse ?? Infinity, ragdoll: false })
}

/** One part's body settings in a ragdoll's settings: shape, pose, layer, material, mass and solver steps as the contract gives them. */
const ragdollPart = (w: JoltWorldHost, s: JoltNS.RagdollPart, part: RagdollDesc['parts'][number], desc: RagdollDesc): void => {
  const J = w.J
  const b = part.body
  const shape = w.makeShape(b.shape)
  s.SetShape(shape)
  shape.Release()
  const r = b.rotation ?? [0, 0, 0, 1]
  s.mPosition.Set(b.position[0], b.position[1], b.position[2])
  s.mRotation.Set(r[0], r[1], r[2], r[3])
  s.mMotionType = J.EMotionType_Dynamic
  s.mObjectLayer = layerOf(b.layer ?? 'character')
  const material = b.material ?? DEFAULT_MATERIAL
  s.mFriction = material.frictionStatic
  s.mRestitution = material.restitution
  s.mUserData = b.user
  if (b.linearDamping !== undefined) s.mLinearDamping = b.linearDamping
  if (b.angularDamping !== undefined) s.mAngularDamping = b.angularDamping
  if (b.continuous) s.mMotionQuality = J.EMotionQuality_LinearCast
  if (b.allowSleep === false) s.mAllowSleeping = false
  if (b.mass !== undefined) {
    s.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia
    s.mMassPropertiesOverride.mMass = b.mass
  }
  if (b.linearVelocity) s.mLinearVelocity.Set(b.linearVelocity[0], b.linearVelocity[1], b.linearVelocity[2])
  if (b.angularVelocity) s.mAngularVelocity.Set(b.angularVelocity[0], b.angularVelocity[1], b.angularVelocity[2])
  if (desc.solverSteps) {
    s.mNumVelocityStepsOverride = desc.solverSteps.velocity
    s.mNumPositionStepsOverride = desc.solverSteps.position
  }
  // the part holds its joint settings by reference from here on
  if (part.joint) s.mToParent = constraintSettings(w, part.joint)
}

/**
 * Jolt's own ragdoll: a skeleton of the parts, each part's joint to its parent, `Stabilize` (it evens out mass and inertia along the chain so the joints hold
 * their limits) when asked, no collision between neighbours or parts touching as made, the joints solved parents first. Its bodies and joints are the
 * adapter's like any other until `removeRagdoll`.
 */
export const createRagdoll = (w: JoltWorldHost, desc: RagdollDesc): { readonly id: RagdollId; readonly bodies: readonly BodyId[]; readonly joints: readonly JointId[] } => {
  const J = w.J
  const skeleton = new J.Skeleton()
  desc.parts.forEach((part, i) => {
    const name = new J.JPHString(`part${i}`, `part${i}`.length)
    skeleton.AddJoint(name, part.parent)
    J.destroy(name)
  })
  const settings = new J.RagdollSettings()
  settings.mSkeleton = skeleton
  settings.mParts.resize(desc.parts.length)
  desc.parts.forEach((part, i) => ragdollPart(w, settings.mParts.at(i), part, desc))
  if (desc.stabilize) settings.Stabilize()
  settings.DisableParentChildCollisions()
  settings.CalculateConstraintPriorities()
  settings.CalculateBodyIndexToConstraintIndex()
  settings.CalculateConstraintIndexToBodyIdxPair()
  // the ragdoll keeps its settings (and they their skeleton and joint settings) by reference: all go when it is destroyed
  const ragdoll = settings.CreateRagdoll(w.nextRagdoll, 0, w.system)
  ragdoll.AddToPhysicsSystem(desc.sleeping ? J.EActivation_DontActivate : J.EActivation_Activate)
  const lock = w.system.GetBodyLockInterfaceNoLock()
  const bodies: BodyId[] = desc.parts.map((part, i) => {
    const body = lock.TryGetBody(ragdoll.GetBodyID(i))
    const key = body.GetID().GetIndexAndSequenceNumber()
    const entry: BodyEntry = { body, id: new J.BodyID(key), key, user: part.body.user, layer: part.body.layer ?? 'character', material: part.body.material ?? DEFAULT_MATERIAL, invMass: body.GetMotionProperties().GetInverseMass(), kitMass: null, centred: false, ragdoll: w.nextRagdoll, sliding: false, friction: (part.body.material ?? DEFAULT_MATERIAL).frictionStatic }
    w.bodies.set(key, entry)
    w.byPointer.set(J.getPointer(body), entry)
    if (part.body.rolling) w.rollers.set(key, part.body.rolling)
    return key as BodyId
  })
  const joints: JointId[] = []
  let k = 0
  for (const part of desc.parts) {
    if (!part.joint) continue
    joints.push(addJointEntry(w, ragdoll.GetConstraint(k++), { kind: part.joint.kind, breakImpulse: Infinity, ragdoll: true }))
  }
  const id = w.nextRagdoll++ as RagdollId
  w.ragdolls.set(id, { ragdoll, bodies, joints, severed: [] })
  return { id, bodies, joints }
}

export const removeRagdoll = (w: JoltWorldHost, id: RagdollId): void => {
  const e = w.ragdolls.get(id)
  if (!e) return
  for (const j of e.joints) w.joints.delete(j)
  for (const b of e.bodies) {
    const entry = w.bodies.get(b)
    if (entry) {
      w.byPointer.delete(w.J.getPointer(entry.body))
      w.J.destroy(entry.id)
    }
    w.forget(b)
  }
  for (const constraint of e.severed) w.system.AddConstraint(constraint)
  // destroying the ragdoll destroys its bodies and constraints and lets go of its settings
  e.ragdoll.RemoveFromPhysicsSystem()
  w.J.destroy(e.ragdoll)
  w.ragdolls.delete(id)
}

export const removeJoint = (w: JoltWorldHost, id: JointId): void => {
  const e = w.joints.get(id)
  if (!e) return
  w.system.RemoveConstraint(e.constraint)
  w.joints.delete(id)
  if (!e.ragdoll) return
  for (const owner of w.ragdolls.values()) if (owner.joints.includes(id)) owner.severed.push(e.constraint)
}

/** Swing and twist of a swing-twist joint now (radians), for checking limits. */
export const jointAngles = (w: JoltWorldHost, id: JointId): { swing: number; twist: number; hinge: number } => {
  const e = w.joints.get(id)
  if (!e) return { swing: 0, twist: 0, hinge: 0 }
  if (e.hinge) return { swing: 0, twist: 0, hinge: e.hinge.GetCurrentAngle() }
  const q = e.swing?.GetRotationInConstraintSpace()
  if (!q) return { swing: 0, twist: 0, hinge: 0 }
  const x = q.GetX()
  const qw = q.GetW()
  // twist about the constraint's x (the twist axis); swing is the rest
  const twist = 2 * Math.atan2(x, qw)
  const swing = 2 * Math.acos(Math.min(1, Math.hypot(x, qw)))
  return { swing, twist, hinge: 0 }
}

/** The joints whose impulse this fixed step passed their breaking impulse (scaled to the step) go, and are added to `brokenJoints` (cleared once per `step` call). */
export const breakJoints = (w: JoltWorldHost, dt: number): void => {
  for (const [id, e] of w.joints) {
    if (e.breakImpulse === Infinity) continue
    let impulse = 0
    if (e.hinge) {
      const l = e.hinge.GetTotalLambdaPosition()
      impulse = Math.hypot(l.GetX(), l.GetY(), l.GetZ())
    } else if (e.swing) {
      const l = e.swing.GetTotalLambdaPosition()
      impulse = Math.hypot(l.GetX(), l.GetY(), l.GetZ())
    } else if (e.slider) {
      const l = e.slider.GetTotalLambdaPosition()
      impulse = Math.hypot(l.GetComponent(0), l.GetComponent(1), e.slider.GetTotalLambdaPositionLimits())
    }
    if (impulse > e.breakImpulse * (dt / w.fixedStep)) {
      w.system.RemoveConstraint(e.constraint)
      w.joints.delete(id)
      w.brokenJoints.push(id as JointId)
    }
  }
}
