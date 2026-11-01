import type { Three, THREE_NS } from '../three'

import { createBodyMaterial } from './body-material'

const ATTRIBUTES: readonly (readonly [string, number])[] = [['iA', 4], ['iB', 4], ['iC', 4], ['iCol', 3], ['iEye', 3]]
const IDENTITY_ATTRIBUTES: readonly (readonly [string, number])[] = [['iD', 4]]
const ACCESSORY_ATTRIBUTES: readonly (readonly [string, number])[] = [['iAcc', 4]]
const MIN_HEIGHT = -2
const MAX_HEIGHT = 8
const HEIGHT_STEPS = 1000
const POSE_SLOTS = 16
const NO_IDENTITY = [0, 0, 0, 0] as const
const NO_ACCESSORY = [0, 0, 0, 1] as const

export type BodyBatchOptions = {
  /** Instances the batch can hold. */
  readonly max: number
  readonly castShadow?: boolean
  readonly time: { value: number }
  /** Adds the `iD` identity attribute and the extension of the shader (T4b.7); off, the batch is the game's. */
  readonly identity?: boolean
  /** A batch of an accessory (baked once, moved per variant by `iAcc`): implies `identity`. */
  readonly accessory?: boolean
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
  /** The `iD` identity (with `identity`), see `packIdentity`. */
  readonly d?: readonly [number, number, number, number]
  /** The `iAcc` pivot offset and scale (with `accessory`). */
  readonly acc?: readonly [number, number, number, number]
}

/** A plain `Mesh` over an `InstancedBufferGeometry` (no `instanceMatrix`: 4 vertex attribute slots less); `count` mirrors the geometry's `instanceCount`. */
export type BodyBatchMesh = THREE_NS.Mesh & { count: number }

export type BodyBatch = {
  readonly mesh: BodyBatchMesh
  readonly max: number
  readonly count: number
  begin(): void
  push(instance: BodyInstance): void
  end(): void
}

/** A batch of bodies drawn in one call (zombies, survivors, corpses). `begin`, `push` per body each frame, then `end` (G 65509 `BodyBatch`). */
export const createBodyBatch = (three: Three, geometry: THREE_NS.BufferGeometry, options: BodyBatchOptions): BodyBatch => {
  const { max, castShadow = true, time, accessory = false } = options
  const identity = options.identity === true || accessory
  const layout = [...ATTRIBUTES, ...(identity ? IDENTITY_ATTRIBUTES : []), ...(accessory ? ACCESSORY_ATTRIBUTES : [])]
  const copy = new three.InstancedBufferGeometry().copy(geometry as THREE_NS.InstancedBufferGeometry)
  copy.instanceCount = 0
  const attributes: Record<string, THREE_NS.InstancedBufferAttribute> = {}
  for (const [name, size] of layout) {
    const attribute = new three.InstancedBufferAttribute(new Float32Array(max * size), size)
    attribute.setUsage(three.DynamicDrawUsage)
    copy.setAttribute(name, attribute)
    attributes[name] = attribute
  }
  const mesh = new three.Mesh(copy, createBodyMaterial(three, { time, identity, accessory })) as unknown as BodyBatchMesh
  Object.defineProperty(mesh, 'count', {
    get: () => copy.instanceCount,
    set: (value: number) => {
      copy.instanceCount = value
    },
  })
  mesh.customDepthMaterial = createBodyMaterial(three, { depth: true, time, identity, accessory }) as THREE_NS.MeshDepthMaterial
  if (identity) mesh.customDistanceMaterial = createBodyMaterial(three, { distance: true, time, identity, accessory }) as THREE_NS.MeshDistanceMaterial
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
    push({ a, b, c, color, eye, y = 0, d, acc }) {
      if (count >= max) return
      const index = count++
      const fourOffset = index * 4
      const threeOffset = index * 3
      attributes.iA!.array.set(a, fourOffset)
      attributes.iB!.array.set([b[0], b[1], b[2], b[3] + POSE_SLOTS * Math.round((Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, y)) - MIN_HEIGHT) * HEIGHT_STEPS)], fourOffset)
      attributes.iC!.array.set(c, fourOffset)
      attributes.iCol!.array.set([color.r, color.g, color.b], threeOffset)
      attributes.iEye!.array.set(eye ? [eye.r, eye.g, eye.b] : [0, 0, 0], threeOffset)
      if (identity) attributes.iD!.array.set(d ?? NO_IDENTITY, fourOffset)
      if (accessory) attributes.iAcc!.array.set(acc ?? NO_ACCESSORY, fourOffset)
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
