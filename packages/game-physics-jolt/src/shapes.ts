import type JoltNS from 'jolt-physics/wasm-compat'

import type { ShapeDesc } from '@adatechnology/game-physics'

import { HEIGHT_BLOCK, NO_COLLISION, NO_TAG } from './constants'
import type { Jolt } from './constants'
import type { HullSet } from './hull-cache'

/** Jolt's settings for a shape of the contract; `scratch` is a vector the caller owns and reuses. */
export const shapeSettings = (J: Jolt, scratch: JoltNS.Vec3, shape: ShapeDesc, hulls?: HullSet): JoltNS.ShapeSettings => {
  switch (shape.kind) {
    case 'box': {
      const smallest = Math.min(shape.half[0], shape.half[1], shape.half[2])
      scratch.Set(shape.half[0], shape.half[1], shape.half[2])
      // the convex radius rounds the edges; kept under a fifth of the thinnest half so a 4 cm plate stays a plate
      return new J.BoxShapeSettings(scratch, shape.convexRadius ?? Math.min(0.05, smallest * 0.2))
    }
    case 'sphere':
      return new J.SphereShapeSettings(shape.radius)
    case 'capsule':
      return new J.CapsuleShapeSettings(shape.halfHeight, shape.radius)
    case 'cylinder':
      return new J.CylinderShapeSettings(shape.halfHeight, shape.radius, Math.min(0.05, shape.radius * 0.2))
    case 'convex': {
      const s = new J.ConvexHullShapeSettings()
      for (let i = 0; i < shape.points.length; i += 3) {
        scratch.Set(shape.points[i], shape.points[i + 1], shape.points[i + 2])
        s.mPoints.push_back(scratch)
      }
      return s
    }
    case 'trimesh':
      return trimeshSettings(J, shape)
    case 'heightfield':
      return heightFieldSettings(J, shape)
    case 'compound': {
      const s = new J.StaticCompoundShapeSettings()
      for (const child of shape.children) {
        if (shape.reuseHulls && hulls && child.shape.kind === 'convex' && child.tag === undefined) {
          addReusedHull(J, scratch, s, child, hulls)
          continue
        }
        const inner = shapeSettings(J, scratch, child.shape)
        // a compound answers a sub-shape's user data with its inner shape's own (the one given to `AddShape` is read back through `GetCompoundUserData`)
        inner.mUserData = (child.tag ?? -1) >>> 0
        const r = child.rotation ?? [0, 0, 0, 1]
        const pos = new J.Vec3(child.position[0], child.position[1], child.position[2])
        const rot = new J.Quat(r[0], r[1], r[2], r[3])
        s.AddShape(pos, rot, inner, (child.tag ?? -1) >>> 0)
        J.destroy(pos)
        J.destroy(rot)
      }
      return s
    }
  }
}

/** An untagged convex child as the hull the cache holds for its points (made the first time): the compound keeps its own reference to it. */
const addReusedHull = (J: Jolt, scratch: JoltNS.Vec3, compound: JoltNS.StaticCompoundShapeSettings, child: Extract<ShapeDesc, { kind: 'compound' }>['children'][number], hulls: HullSet): void => {
  const convex = child.shape as Extract<ShapeDesc, { kind: 'convex' }>
  const hull = hulls.shapeOf(convex.points, () => makeShape(J, scratch, convex))
  const r = child.rotation ?? [0, 0, 0, 1]
  const pos = new J.Vec3(child.position[0], child.position[1], child.position[2])
  const rot = new J.Quat(r[0], r[1], r[2], r[3])
  compound.AddShapeShape(pos, rot, hull, NO_TAG)
  J.destroy(pos)
  J.destroy(rot)
}

const trimeshSettings = (J: Jolt, shape: Extract<ShapeDesc, { kind: 'trimesh' }>): JoltNS.ShapeSettings => {
  const verts = new J.VertexList()
  const tris = new J.IndexedTriangleList()
  const f3 = new J.Float3(0, 0, 0)
  verts.reserve(shape.vertices.length / 3)
  for (let i = 0; i < shape.vertices.length; i += 3) {
    f3.x = shape.vertices[i]
    f3.y = shape.vertices[i + 1]
    f3.z = shape.vertices[i + 2]
    verts.push_back(f3)
  }
  tris.reserve(shape.indices.length / 3)
  const t = new J.IndexedTriangle(0, 0, 0, 0, 0)
  for (let i = 0; i < shape.indices.length; i += 3) {
    // Jolt winds triangles counter-clockwise seen from the front; ours are three.js order (also counter-clockwise)
    t.set_mIdx(0, shape.indices[i])
    t.set_mIdx(1, shape.indices[i + 1])
    t.set_mIdx(2, shape.indices[i + 2])
    tris.push_back(t)
  }
  const materials = new J.PhysicsMaterialList()
  const s = new J.MeshShapeSettings(verts, tris, materials)
  J.destroy(f3)
  J.destroy(t)
  J.destroy(verts)
  J.destroy(tris)
  J.destroy(materials)
  return s
}

const heightFieldSettings = (J: Jolt, shape: Extract<ShapeDesc, { kind: 'heightfield' }>): JoltNS.ShapeSettings => {
  const s = new J.HeightFieldShapeSettings()
  s.mOffset.Set(shape.origin[0], shape.origin[1], shape.origin[2])
  s.mScale.Set(shape.cell, 1, shape.cell)
  // Jolt takes a multiple of the block size: the samples past `size` are holes, so the field ends where ours does
  const count = Math.ceil(shape.size / HEIGHT_BLOCK) * HEIGHT_BLOCK
  s.mSampleCount = count
  s.mBlockSize = HEIGHT_BLOCK
  s.mBitsPerSample = 8
  s.mHeightSamples.resize(count * count)
  const ptr = J.getPointer(s.mHeightSamples.data()) >> 2
  for (let z = 0; z < count; z++) {
    for (let x = 0; x < count; x++) J.HEAPF32[ptr + z * count + x] = x < shape.size && z < shape.size ? shape.heights[z * shape.size + x] : NO_COLLISION
  }
  return s
}

/** A shape made from its settings, with one reference the caller owns (`Release` it once a body took its own). */
export const makeShape = (J: Jolt, scratch: JoltNS.Vec3, shape: ShapeDesc, hulls?: HullSet): JoltNS.Shape => {
  const settings = shapeSettings(J, scratch, shape, hulls)
  // a plain shape answers its user data as the sub-shape's `tag`: all ones read back as -1 (`| 0`), "no part"
  settings.mUserData = NO_TAG
  const result = settings.Create()
  if (result.HasError()) {
    const message = result.GetError().c_str()
    J.destroy(result)
    throw new Error(`game-physics-jolt: ${shape.kind} shape: ${message}`)
  }
  const made = result.Get()
  // the body takes its own reference; the settings and the result (which also hold one) go
  made.AddRef()
  J.destroy(result)
  J.destroy(settings)
  return made
}

/** The shape with its centre of mass moved to the origin: Jolt takes a compound's centre of mass from its parts' volumes, the kit puts it where it measured it. */
export const makeCentredShape = (J: Jolt, scratch: JoltNS.Vec3, shape: ShapeDesc, hulls?: HullSet): JoltNS.Shape => {
  const plain = makeShape(J, scratch, shape, hulls)
  const centre = plain.GetCenterOfMass()
  const x = centre.GetX()
  const y = centre.GetY()
  const z = centre.GetZ()
  if (Math.hypot(x, y, z) < 1e-5) return plain
  plain.Release()
  const inner = shapeSettings(J, scratch, shape, hulls)
  inner.mUserData = NO_TAG
  const offset = new J.Vec3(-x, -y, -z)
  const settings = new J.OffsetCenterOfMassShapeSettings(offset, inner)
  settings.mUserData = NO_TAG
  const result = settings.Create()
  if (result.HasError()) {
    const message = result.GetError().c_str()
    J.destroy(result)
    throw new Error(`game-physics-jolt: ${shape.kind} shape: ${message}`)
  }
  const made = result.Get()
  made.AddRef()
  J.destroy(result)
  J.destroy(settings)
  J.destroy(offset)
  return made
}
