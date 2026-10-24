import type * as ThreeNamespace from 'three'

type Three = typeof ThreeNamespace

/** What `createNodeSkin` makes: one mesh that stands for a whole tree of meshes, each vertex tied to the node of the tree that moves it. */
export type NodeSkin = {
  readonly mesh: ThreeNamespace.Mesh
  /** The nodes the animation moves, in the order of the skin's `aNodeIndex`. */
  readonly nodes: readonly ThreeNamespace.Object3D[]
  /** The matrix of each node, uploaded as the `uNodes` uniform. */
  readonly matrices: { readonly value: ThreeNamespace.Matrix4[] }
  /** Copies the world matrix of every node into `matrices`: call it once per frame, after the tree was animated. */
  update(): void
}

export type NodeSkinOptions = {
  /** Meshes the animation moves and that therefore stay nodes of their own (a head ball, an eye). Groups and meshes with children are always nodes. */
  readonly nodes?: Iterable<ThreeNamespace.Object3D>
}

const MAX_WALK_DEPTH = 3

/**
 * Every Object3D reachable from the fields of `owner` (up to 3 levels, skipping the keys in `skip`): what the animation of a tree keeps in its own
 * state (head, jaw, wings, legs). Pass the result as `nodes` so those meshes are not merged into their parents.
 */
export const collectReferencedNodes = (owner: object, skip: readonly string[] = []): Set<ThreeNamespace.Object3D> => {
  const found = new Set<ThreeNamespace.Object3D>()
  const seen = new Set<unknown>()
  const walk = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || depth > MAX_WALK_DEPTH || seen.has(value)) return
    seen.add(value)
    const candidate = value as { isObject3D?: boolean; isMaterial?: boolean; isBufferGeometry?: boolean }
    if (candidate.isObject3D) {
      found.add(value as ThreeNamespace.Object3D)
      return
    }
    if (candidate.isMaterial || candidate.isBufferGeometry) return
    for (const key in value) walk((value as Record<string, unknown>)[key], depth + 1)
  }
  for (const key in owner) if (!skip.includes(key)) walk((owner as Record<string, unknown>)[key], 0)
  return found
}

type TextureSample = { readonly data: Uint8ClampedArray; readonly width: number; readonly height: number }

const isVisibleInTree = (object: ThreeNamespace.Object3D): boolean => {
  for (let node: ThreeNamespace.Object3D | null = object; node; node = node.parent) if (!node.visible) return false
  return true
}

/**
 * A GPU "node skin": a tree of about fifty meshes (an animal, a character prop) merged into one mesh, every vertex tied to the node that moves it.
 * The tree stays out of the scene and keeps animating; `update()` copies its node matrices each frame. Colour (with the texture sampled at the uv),
 * roughness, metalness and emissive are baked per vertex, so the 40 animals of a scene cost 40 draw calls instead of 2,000.
 * Generalised from the game's `bichoPele` (G 66536); the colours are read the way r160 does (linear converted to sRGB), as the game does.
 */
export const createNodeSkin = (THREE: Three, root: ThreeNamespace.Object3D, options: NodeSkinOptions = {}): NodeSkin => {
  const referenced = new Set(options.nodes ?? [])
  const nodes: ThreeNamespace.Object3D[] = []
  const indexOf = new Map<ThreeNamespace.Object3D, number>()
  root.traverse((object) => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh || object.children.length > 0 || referenced.has(object)) {
      indexOf.set(object, nodes.length)
      nodes.push(object)
    }
  })

  const positions: number[] = []
  const normals: number[] = []
  const tints: number[] = []
  const surfaces: number[] = []
  const nodeIndices: number[] = []
  const samples = new Map<ThreeNamespace.Texture, TextureSample>()
  const color = new THREE.Color()
  const vertex = new THREE.Vector3()
  const normal = new THREE.Vector3()

  const sampleOf = (texture: ThreeNamespace.Texture): TextureSample | undefined => {
    const image = texture.image as { getContext?: (kind: string) => CanvasRenderingContext2D | null; width: number; height: number } | undefined
    if (!image?.getContext) return undefined
    const cached = samples.get(texture)
    if (cached) return cached
    const context = image.getContext('2d')
    if (!context) return undefined
    const sample = { data: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height }
    samples.set(texture, sample)
    return sample
  }

  root.traverse((object) => {
    const mesh = object as ThreeNamespace.Mesh
    if (!mesh.isMesh || !isVisibleInTree(object)) return
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as ThreeNamespace.MeshStandardMaterial
    const geometry = mesh.geometry
    const position = geometry.attributes.position as ThreeNamespace.BufferAttribute
    const normalAttribute = geometry.attributes.normal as ThreeNamespace.BufferAttribute | undefined
    const uv = geometry.attributes.uv as ThreeNamespace.BufferAttribute | undefined
    const matrix = new THREE.Matrix4()
    let nodeIndex = indexOf.get(object)
    if (nodeIndex === undefined) {
      nodeIndex = indexOf.get(object.parent as ThreeNamespace.Object3D) ?? 0
      object.updateMatrix()
      matrix.copy(object.matrix)
    }
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    const sample = material.map ? sampleOf(material.map) : undefined
    const emissive = material.emissive ? (material.emissive.r + material.emissive.g + material.emissive.b) * (material.emissiveIntensity ?? 1) : 0
    const index = geometry.index ? geometry.index.array : null
    const count = index ? index.length : position.count
    for (let item = 0; item < count; item++) {
      const at = index ? (index[item] as number) : item
      vertex.fromBufferAttribute(position, at).applyMatrix4(matrix)
      positions.push(vertex.x, vertex.y, vertex.z)
      if (normalAttribute) normal.fromBufferAttribute(normalAttribute, at).applyMatrix3(normalMatrix).normalize()
      else normal.set(0, 1, 0)
      normals.push(normal.x, normal.y, normal.z)
      color.copy(material.color || color.set(1, 1, 1)).convertLinearToSRGB()
      if (sample && uv && material.map) {
        const repeat = material.map.repeat
        const u = (((uv.getX(at) * repeat.x) % 1) + 1) % 1
        const v = (((uv.getY(at) * repeat.y) % 1) + 1) % 1
        const pixelX = Math.min(sample.width - 1, (u * sample.width) | 0)
        const pixelY = Math.min(sample.height - 1, ((1 - v) * sample.height) | 0)
        const offset = (pixelY * sample.width + pixelX) * 4
        color.multiply(new THREE.Color().setRGB((sample.data[offset] as number) / 255, (sample.data[offset + 1] as number) / 255, (sample.data[offset + 2] as number) / 255, THREE.SRGBColorSpace))
      }
      if (emissive > 0.3) color.lerp(material.emissive, 0.7)
      tints.push(color.r, color.g, color.b)
      surfaces.push(material.roughness ?? 0.8, material.metalness ?? 0, emissive > 0.3 ? 1 : 0)
      nodeIndices.push(nodeIndex)
    }
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('aTint', new THREE.Float32BufferAttribute(tints, 3))
  geometry.setAttribute('aSurface', new THREE.Float32BufferAttribute(surfaces, 3))
  geometry.setAttribute('aNodeIndex', new THREE.Float32BufferAttribute(nodeIndices, 1))
  geometry.computeBoundingSphere()

  const matrices = { value: nodes.map(() => new THREE.Matrix4()) }
  const skinVertex = (shader: ThreeNamespace.WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uNodes = matrices
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform mat4 uNodes[${nodes.length}]; attribute float aNodeIndex; attribute vec3 aTint; attribute vec3 aSurface; varying vec3 vTint; varying vec3 vSurface;`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = mat3(uNodes[int(aNodeIndex + .5)]) * normal;')
      .replace('#include <begin_vertex>', 'vec3 transformed = (uNodes[int(aNodeIndex + .5)] * vec4(position, 1.)).xyz; vTint = aTint; vSurface = aSurface;')
  }

  const material = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 })
  material.onBeforeCompile = (shader) => {
    skinVertex(shader)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTint; varying vec3 vSurface;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vTint, opacity );')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurface.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurface.y;')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance = vTint * vSurface.z * 1.5;')
  }
  material.customProgramCacheKey = () => `nodeSkin${nodes.length}`
  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  depthMaterial.onBeforeCompile = skinVertex
  depthMaterial.customProgramCacheKey = () => `nodeSkinDepth${nodes.length}`

  const mesh = new THREE.Mesh(geometry, material)
  mesh.customDepthMaterial = depthMaterial
  mesh.frustumCulled = false
  root.updateMatrixWorld(true)
  return {
    mesh,
    nodes,
    matrices,
    update() {
      root.updateMatrixWorld(true)
      for (let index = 0; index < nodes.length; index++) (matrices.value[index] as ThreeNamespace.Matrix4).copy((nodes[index] as ThreeNamespace.Object3D).matrixWorld)
    },
  }
}
