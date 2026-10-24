import type * as THREE_NS from 'three'
import type { Chunk, Glow, OrderedPool, Puff, Spark } from '@adatechnology/game-vfx'
import { GLOW_FRAGMENT, GLOW_VERTEX } from './shaders/glow'
import { PUFF_FRAGMENT, PUFF_VERTEX } from './shaders/puff'
import { SPARK_FRAGMENT, SPARK_VERTEX } from './shaders/spark'
import type { ThreeLib } from './types'

export interface DrawnLayer {
  readonly mesh: THREE_NS.Mesh
  /** Copies the pool into the instance buffers and answers how many are drawn. */
  sync(): number
  dispose(): void
}

type Attribute = THREE_NS.InstancedBufferAttribute

function dynamic(THREE: ThreeLib, array: Float32Array, size: number): Attribute {
  return new THREE.InstancedBufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage)
}

export interface PuffUniforms {
  uLight: { value: THREE_NS.Vector3 }
  uSky: { value: THREE_NS.Vector3 }
  uGround: { value: THREE_NS.Vector3 }
  uGlowPos: { value: THREE_NS.Vector3 }
  uGlowCol: { value: THREE_NS.Vector3 }
  uGlowI: { value: number }
  uTime: { value: number }
}

export function createPuffLayer(THREE: ThreeLib, pool: OrderedPool<Puff>, uniforms: PuffUniforms): DrawnLayer {
  const capacity = pool.capacity
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.IcosahedronGeometry(1, 1).getAttribute('position'))
  const a = new Float32Array(capacity * 4)
  const d = new Float32Array(capacity * 4)
  const c = new Float32Array(capacity * 3)
  const attributes = [dynamic(THREE, a, 4), dynamic(THREE, d, 4), dynamic(THREE, c, 3)] as const
  geometry.setAttribute('aP', attributes[0])
  geometry.setAttribute('aD', attributes[1])
  geometry.setAttribute('aC', attributes[2])
  geometry.instanceCount = 0
  const material = new THREE.ShaderMaterial({ uniforms: uniforms as never, vertexShader: PUFF_VERTEX, fragmentShader: PUFF_FRAGMENT })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  return {
    mesh,
    sync() {
      let n = 0
      for (const p of pool.items) {
        a[n * 4] = p.x
        a[n * 4 + 1] = p.y
        a[n * 4 + 2] = p.z
        a[n * 4 + 3] = p.size
        d[n * 4] = p.age
        d[n * 4 + 1] = p.heat
        d[n * 4 + 2] = p.seed
        d[n * 4 + 3] = p.kind
        c[n * 3] = p.color[0]
        c[n * 3 + 1] = p.color[1]
        c[n * 3 + 2] = p.color[2]
        n++
      }
      geometry.instanceCount = n
      for (const attribute of attributes) attribute.needsUpdate = true
      return n
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

export function createSparkLayer(THREE: ThreeLib, pool: OrderedPool<Spark>): DrawnLayer {
  const capacity = pool.capacity
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const position = new Float32Array(capacity * 3)
  const velocity = new Float32Array(capacity * 3)
  const extra = new Float32Array(capacity * 4)
  const attributes = [dynamic(THREE, position, 3), dynamic(THREE, velocity, 3), dynamic(THREE, extra, 4)] as const
  geometry.setAttribute('aPos', attributes[0])
  geometry.setAttribute('aVel', attributes[1])
  geometry.setAttribute('aE', attributes[2])
  geometry.instanceCount = 0
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: SPARK_VERTEX, fragmentShader: SPARK_FRAGMENT })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 5
  return {
    mesh,
    sync() {
      let n = 0
      for (const s of pool.items) {
        position[n * 3] = s.x
        position[n * 3 + 1] = s.y
        position[n * 3 + 2] = s.z
        velocity[n * 3] = s.vx
        velocity[n * 3 + 1] = s.vy
        velocity[n * 3 + 2] = s.vz
        extra[n * 4] = s.age
        extra[n * 4 + 1] = s.w
        extra[n * 4 + 2] = s.st
        extra[n * 4 + 3] = s.kind
        n++
      }
      geometry.instanceCount = n
      for (const attribute of attributes) attribute.needsUpdate = true
      return n
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

export function createGlowLayer(THREE: ThreeLib, pool: OrderedPool<Glow>): DrawnLayer {
  const capacity = pool.capacity
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const where = new Float32Array(capacity * 4)
  const color = new Float32Array(capacity * 4)
  const attributes = [dynamic(THREE, where, 4), dynamic(THREE, color, 4)] as const
  geometry.setAttribute('aP', attributes[0])
  geometry.setAttribute('aC', attributes[1])
  geometry.instanceCount = 0
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 6
  return {
    mesh,
    sync() {
      let n = 0
      for (const g of pool.items) {
        where[n * 4] = g.outX
        where[n * 4 + 1] = g.outY
        where[n * 4 + 2] = g.outZ
        where[n * 4 + 3] = g.outSize
        color[n * 4] = g.color[0]
        color[n * 4 + 1] = g.color[1]
        color[n * 4 + 2] = g.color[2]
        color[n * 4 + 3] = g.outIntensity
        n++
      }
      geometry.instanceCount = n
      for (const attribute of attributes) attribute.needsUpdate = true
      return n
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

export interface ChunkLayer {
  readonly rocks: THREE_NS.InstancedMesh
  readonly plates: THREE_NS.InstancedMesh
  sync(): number
  dispose(): void
}

export function createChunkLayer(THREE: ThreeLib, pool: OrderedPool<Chunk>, shapes: { rock: THREE_NS.BufferGeometry; plate: THREE_NS.BufferGeometry }, colorOf: (chunk: Chunk) => readonly [number, number, number]): ChunkLayer {
  const capacity = pool.capacity
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true })
  const plateMaterial = rockMaterial.clone()
  const make = (geometry: THREE_NS.BufferGeometry, material: THREE_NS.Material): THREE_NS.InstancedMesh => {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.count = 0
    mesh.setColorAt(0, new THREE.Color(1, 1, 1))
    return mesh
  }
  const rocks = make(shapes.rock, rockMaterial)
  const plates = make(shapes.plate, plateMaterial)
  const matrix = new THREE.Matrix4()
  const quaternion = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const position = new THREE.Vector3()
  const scale = new THREE.Vector3()
  return {
    rocks,
    plates,
    sync() {
      let rockCount = 0
      let plateCount = 0
      for (const chunk of pool.items) {
        euler.set(chunk.rx, chunk.ry, chunk.rz)
        quaternion.setFromEuler(euler)
        matrix.compose(position.set(chunk.x, chunk.y, chunk.z), quaternion, scale.set(chunk.sx, chunk.sy, chunk.sz))
        const mesh = chunk.plate ? plates : rocks
        const index = chunk.plate ? plateCount++ : rockCount++
        mesh.setMatrixAt(index, matrix)
        const color = colorOf(chunk)
        const colors = mesh.instanceColor!.array as Float32Array
        colors[index * 3] = color[0]
        colors[index * 3 + 1] = color[1]
        colors[index * 3 + 2] = color[2]
      }
      rocks.count = rockCount
      plates.count = plateCount
      for (const mesh of [rocks, plates]) {
        mesh.instanceMatrix.needsUpdate = true
        mesh.instanceColor!.needsUpdate = true
      }
      return rockCount + plateCount
    },
    dispose() {
      rockMaterial.dispose()
      plateMaterial.dispose()
      rocks.dispose()
      plates.dispose()
    },
  }
}
