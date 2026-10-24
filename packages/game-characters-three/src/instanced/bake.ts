import { shapeGeometries } from '@adatechnology/game-shapes-three'
import type { Three, THREE_NS } from '../three'

/** The pose a body is baked in: every joint at rest, so the shader's animation starts from a neutral body (G 66017 `BAKE_NEUTRO`). */
export const BAKE_NEUTRAL_POSE = { lean: 0, armL: 0, armR: 0, elbL: 0, elbR: 0, legL: 0, legR: 0, kneeL: 0, kneeR: 0, headX: 0, headZ: 0, drop: 0, armOut: 0, neck: 0, headFwd: 0 } as const

type Rig = {
  readonly P: { readonly s: number; readonly bulk: number }
  readonly fig: THREE_NS.Object3D
  readonly upper: THREE_NS.Object3D
  readonly headG: THREE_NS.Object3D
  readonly arms: readonly { readonly g: THREE_NS.Object3D; readonly el: THREE_NS.Object3D; readonly s: number }[]
  readonly legs: readonly { readonly g: THREE_NS.Object3D; readonly kn: THREE_NS.Object3D; readonly s: number }[]
}

export type BakeSpec = {
  readonly type?: string
  readonly decay?: number
  readonly seed?: number
  readonly pose?: Readonly<Record<string, number>>
  /** A detailed survivor to bake instead of a zombie body. */
  readonly retrato?: unknown
  readonly [key: string]: unknown
}

/** The rich builders the bake reads, injected: the Bestiário v17 builder and (optionally) the survivor builder. */
export type BakeBuilders = {
  /** Builds a body at the level of detail `lod` (1, 0.5, 0.28); `spec.pose` already carries the neutral pose. */
  buildBest(spec: BakeSpec, lod: number): THREE_NS.Object3D
  buildPortrait?(portrait: unknown, lod: number): THREE_NS.Object3D
  /** The material of the shirt, which the baked parts mark as material 1. */
  topMaterial(): THREE_NS.Material | null
}

export type BakedBody = {
  readonly geo: THREE_NS.BufferGeometry
  readonly s: number
  readonly bulk: number
  readonly verts: number
}

const BLOOD_LIFT_NEAR = 0.006
const BLOOD_LIFT_FAR = 0.012
const FAR_LOD = 0.6
const EYE_SCALE = 2.2
const EYE_DEPTH_SCALE = 1.4

type Tag = readonly [number, readonly number[], readonly number[]]

type Part = { readonly g: THREE_NS.BufferGeometry; readonly bone: number; readonly pv: readonly number[]; readonly pp: readonly number[]; readonly col: readonly number[] }

/**
 * Bakes a rich body into one indexable geometry, each vertex with its bone, pivot, parent pivot and colour, so the instanced shader can animate it
 * (G 66019 `bakeBody`). Blood stays a vivid wine red at any decay; eyes are enlarged far away so they read.
 */
export const bakeBody = (host: Three, builders: BakeBuilders, spec: BakeSpec, lod: number): BakedBody => {
  const three = shapeGeometries(host)
  const root = spec.retrato && builders.buildPortrait ? builders.buildPortrait(spec.retrato, lod) : builders.buildBest({ ...spec, pose: { ...BAKE_NEUTRAL_POSE, ...(spec.pose ?? {}) } }, lod)
  const rig = root.userData.rig as Rig
  const P = rig.P
  rig.fig.position.y = 0
  rig.upper.rotation.set(0, 0, 0)
  rig.headG.rotation.set(0, 0, 0)
  for (const arm of rig.arms) {
    arm.g.rotation.set(0, 0, 0)
    arm.el.rotation.set(0, 0, 0)
  }
  for (const leg of rig.legs) {
    leg.g.rotation.set(0, 0, 0)
    leg.kn.rotation.set(0, 0, 0)
  }
  root.updateMatrixWorld(true)
  const worldPosition = (object: THREE_NS.Object3D): number[] => object.getWorldPosition(new three.Vector3()).toArray()
  const bones = new Map<THREE_NS.Object3D, Tag>()
  bones.set(rig.headG, [1, worldPosition(rig.headG), [0, 0, 0]])
  for (const arm of rig.arms) {
    const shoulder = worldPosition(arm.g)
    bones.set(arm.g, [arm.s < 0 ? 2 : 3, shoulder, [0, 0, 0]])
    bones.set(arm.el, [arm.s < 0 ? 7 : 8, worldPosition(arm.el), shoulder])
  }
  for (const leg of rig.legs) {
    const hip = worldPosition(leg.g)
    bones.set(leg.g, [leg.s < 0 ? 4 : 5, hip, [0, 0, 0]])
    bones.set(leg.kn, [leg.s < 0 ? 9 : 10, worldPosition(leg.kn), hip])
  }
  const trunk: Tag = [0, [0, 0.9 * P.s, 0], [0, 0, 0]]
  const parts: Part[] = []
  const topMaterial = spec.retrato ? null : builders.topMaterial()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    const material = mesh.material as THREE_NS.MeshStandardMaterial
    if (!mesh.isMesh || !mesh.geometry || material.transparent) return
    for (let ancestor: THREE_NS.Object3D | null = object; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return
    let tag = trunk
    for (let ancestor = object.parent; ancestor; ancestor = ancestor.parent) {
      const found = bones.get(ancestor)
      if (found) {
        tag = found
        break
      }
    }
    let [bone, pivot, parentPivot] = tag
    if (object.userData.bone === 11) {
      bone = 11
      pivot = (bones.get(rig.headG) as Tag)[1]
      parentPivot = [0, 0, 0]
    }
    const isEye = !!object.userData.eye
    const color = material.color
    const materialId = isEye ? 3 : material === topMaterial ? 1 : 6
    if (isEye && bone === 1) bone = 6
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    const isBlood = material.polygonOffset && material.isMeshStandardMaterial
    if (isBlood) liftAlongNormals(geometry, lod < FAR_LOD ? BLOOD_LIFT_FAR : BLOOD_LIFT_NEAR)
    if (isEye) enlargeEye(three, geometry, lod < FAR_LOD ? 1 : 0.68)
    const colors = isBlood ? [Math.max(color.r * 1.7, 0.3), Math.min(color.g * 1.7, 0.04), Math.min(color.b * 1.7, 0.04), materialId] : [color.r, color.g, color.b, materialId]
    parts.push({ g: geometry, bone, pv: pivot, pp: parentPivot, col: colors })
  })
  return { geo: mergeBaked(three, parts), s: P.s, bulk: P.bulk, verts: parts.reduce((sum, part) => sum + part.g.attributes.position!.count, 0) }
}

const liftAlongNormals = (geometry: THREE_NS.BufferGeometry, lift: number): void => {
  const positions = geometry.attributes.position!
  const normals = geometry.attributes.normal!
  for (let index = 0; index < positions.count; index++) positions.setXYZ(index, positions.getX(index) + normals.getX(index) * lift, positions.getY(index) + normals.getY(index) * lift, positions.getZ(index) + normals.getZ(index) * lift)
}

const enlargeEye = (three: Three, geometry: THREE_NS.BufferGeometry, factor: number): void => {
  geometry.computeBoundingBox()
  const center = geometry.boundingBox!.getCenter(new three.Vector3())
  geometry.translate(-center.x, -center.y, -center.z)
  geometry.scale(EYE_SCALE * factor, EYE_SCALE * factor, EYE_DEPTH_SCALE * factor)
  geometry.translate(center.x, center.y, center.z)
}

const mergeBaked = (three: Three, parts: readonly Part[]): THREE_NS.BufferGeometry => {
  let vertexTotal = 0
  let indexTotal = 0
  for (const part of parts) {
    vertexTotal += part.g.attributes.position!.count
    indexTotal += part.g.index ? part.g.index.count : part.g.attributes.position!.count
  }
  const position = new Float32Array(vertexTotal * 3)
  const normal = new Float32Array(vertexTotal * 3)
  const color = new Float32Array(vertexTotal * 4)
  const bone = new Float32Array(vertexTotal)
  const pivot = new Float32Array(vertexTotal * 3)
  const parentPivot = new Float32Array(vertexTotal * 3)
  const index = vertexTotal > 65535 ? new Uint32Array(indexTotal) : new Uint16Array(indexTotal)
  let vertexOffset = 0
  let indexOffset = 0
  for (const part of parts) {
    const count = part.g.attributes.position!.count
    position.set(part.g.attributes.position!.array, vertexOffset * 3)
    normal.set(part.g.attributes.normal!.array, vertexOffset * 3)
    for (let vertex = 0; vertex < count; vertex++) {
      color.set(part.col, (vertexOffset + vertex) * 4)
      bone[vertexOffset + vertex] = part.bone
      pivot.set(part.pv, (vertexOffset + vertex) * 3)
      parentPivot.set(part.pp, (vertexOffset + vertex) * 3)
    }
    if (part.g.index) {
      const source = part.g.index.array
      for (let item = 0; item < source.length; item++) index[indexOffset++] = (source[item] as number) + vertexOffset
    } else for (let vertex = 0; vertex < count; vertex++) index[indexOffset++] = vertexOffset + vertex
    vertexOffset += count
    part.g.dispose()
  }
  const out = new three.BufferGeometry()
  out.setAttribute('position', new three.BufferAttribute(position, 3))
  out.setAttribute('normal', new three.BufferAttribute(normal, 3))
  out.setAttribute('vcol', new three.BufferAttribute(color, 4))
  out.setAttribute('bone', new three.BufferAttribute(bone, 1))
  out.setAttribute('pivot', new three.BufferAttribute(pivot, 3))
  out.setAttribute('ppivot', new three.BufferAttribute(parentPivot, 3))
  out.setIndex(new three.BufferAttribute(index, 1))
  out.computeBoundingSphere()
  return out
}
