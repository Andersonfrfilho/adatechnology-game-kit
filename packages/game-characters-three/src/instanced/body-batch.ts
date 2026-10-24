import type { Three, THREE_NS } from '../three'

import { createBodyMaterial } from './body-material'

const ATTRIBUTES: readonly (readonly [string, number])[] = [['iA', 4], ['iB', 4], ['iC', 4], ['iCol', 3], ['iEye', 3]]
const MIN_HEIGHT = -2
const MAX_HEIGHT = 8
const HEIGHT_STEPS = 1000
const POSE_SLOTS = 16

export type BodyBatchOptions = {
  /** Instances the batch can hold. */
  readonly max: number
  readonly castShadow?: boolean
  readonly time: { value: number }
}

/** One instance: the 12 numbers of the shader's `iA`, `iB` and `iC`, the shirt colour and the eye colour (G 65509 `push`). */
export type BodyInstance = {
  readonly a: readonly [number, number, number, number]
  readonly b: readonly [number, number, number, number]
  readonly c: readonly [number, number, number, number]
  readonly color: { readonly r: number; readonly g: number; readonly b: number }
  readonly eye?: { readonly r: number; readonly g: number; readonly b: number }
  /** Ground height (a pile of bodies, a jump); packed into `b[3]` next to the pose. */
  readonly y?: number
}

export type BodyBatch = {
  readonly mesh: THREE_NS.InstancedMesh
  readonly max: number
  readonly count: number
  begin(): void
  push(instance: BodyInstance): void
  end(): void
}

/** A batch of bodies drawn in one call (zombies, survivors, corpses). `begin`, `push` per body each frame, then `end` (G 65509 `BodyBatch`). */
export const createBodyBatch = (three: Three, geometry: THREE_NS.BufferGeometry, options: BodyBatchOptions): BodyBatch => {
  const { max, castShadow = true, time } = options
  const copy = geometry.clone()
  const attributes: Record<string, THREE_NS.InstancedBufferAttribute> = {}
  for (const [name, size] of ATTRIBUTES) {
    const attribute = new three.InstancedBufferAttribute(new Float32Array(max * size), size)
    attribute.setUsage(three.DynamicDrawUsage)
    copy.setAttribute(name, attribute)
    attributes[name] = attribute
  }
  const mesh = new three.InstancedMesh(copy, createBodyMaterial(three, { time }), max)
  mesh.customDepthMaterial = createBodyMaterial(three, { depth: true, time }) as THREE_NS.MeshDepthMaterial
  mesh.frustumCulled = false
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  mesh.count = 0
  let count = 0
  return {
    mesh,
    max,
    get count() {
      return count
    },
    begin() {
      count = 0
    },
    push({ a, b, c, color, eye, y = 0 }) {
      if (count >= max) return
      const index = count++
      const fourOffset = index * 4
      const threeOffset = index * 3
      attributes.iA!.array.set(a, fourOffset)
      attributes.iB!.array.set([b[0], b[1], b[2], b[3] + POSE_SLOTS * Math.round((Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, y)) - MIN_HEIGHT) * HEIGHT_STEPS)], fourOffset)
      attributes.iC!.array.set(c, fourOffset)
      attributes.iCol!.array.set([color.r, color.g, color.b], threeOffset)
      attributes.iEye!.array.set(eye ? [eye.r, eye.g, eye.b] : [0, 0, 0], threeOffset)
    },
    end() {
      mesh.count = count
      for (const attribute of Object.values(attributes)) {
        attribute.clearUpdateRanges()
        attribute.addUpdateRange(0, count * attribute.itemSize)
        attribute.needsUpdate = true
      }
    },
  }
}
