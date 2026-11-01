import type { Three, THREE_NS } from '../three'

export type BlobShadowOptions = {
  /** Shadows the batch can hold. */
  readonly max: number
  /** Radius in metres of a body of height 1 (default 0.55). */
  readonly radius?: number
  /** The darkness at the centre (default 0.42). */
  readonly opacity?: number
}

export type BlobShadowBatch = {
  readonly mesh: THREE_NS.Mesh & { count: number }
  readonly count: number
  begin(): void
  /** One shadow under a body at `x`, `z` on the ground height `y`, for a body `height` metres tall. */
  push(x: number, y: number, z: number, height: number): void
  end(): void
}

const BLOB_LIFT = 0.03

/**
 * The shadow of a body that is too far for a real one (economy ladder, step 1): one dark disc per body on the ground, a single draw call.
 * No depth write and no shadow map: it costs a quad per body.
 */
export const createBlobShadowBatch = (three: Three, { max, radius = 0.55, opacity = 0.42 }: BlobShadowOptions): BlobShadowBatch => {
  const geometry = new three.InstancedBufferGeometry()
  geometry.setAttribute('position', new three.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3))
  geometry.setAttribute('uv', new three.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2))
  geometry.setIndex([0, 2, 1, 0, 3, 2])
  const placement = new three.InstancedBufferAttribute(new Float32Array(max * 4), 4)
  placement.setUsage(three.DynamicDrawUsage)
  geometry.setAttribute('iBlob', placement)
  geometry.instanceCount = 0
  const material = new three.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { uOpacity: { value: opacity } },
    vertexShader: `attribute vec4 iBlob; varying vec2 vUv;
      void main(){ vUv = uv; vec3 p = position*iBlob.w + iBlob.xyz; gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.); }`,
    fragmentShader: `uniform float uOpacity; varying vec2 vUv;
      void main(){ float d = dot(vUv, vUv); if (d > 1.) discard; gl_FragColor = vec4(0., 0., 0., uOpacity*(1. - smoothstep(0.15, 1., d))); }`,
  })
  const mesh = new three.Mesh(geometry, material) as unknown as THREE_NS.Mesh & { count: number }
  Object.defineProperty(mesh, 'count', { get: () => geometry.instanceCount, set: (value: number) => (geometry.instanceCount = value) })
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  mesh.name = 'blob-shadows'
  let count = 0
  return {
    mesh,
    get count() {
      return count
    },
    begin() {
      count = 0
    },
    push(x, y, z, height) {
      if (count >= max) return
      placement.array.set([x, y + BLOB_LIFT, z, radius * height], count++ * 4)
    },
    end() {
      geometry.instanceCount = count
      placement.clearUpdateRanges()
      placement.addUpdateRange(0, count * 4)
      placement.needsUpdate = true
    },
  }
}
