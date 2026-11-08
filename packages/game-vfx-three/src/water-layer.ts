import type * as THREE_NS from 'three'
import { markKitOrigin } from '@adatechnology/game-contracts'
import type { WaterColumn, WaterEffects } from '@adatechnology/game-vfx'
import { WATER_COLUMN_FRAGMENT, WATER_COLUMN_VERTEX, WATER_SPRITE_FRAGMENT, WATER_SPRITE_VERTEX, WATER_SURFACE_FRAGMENT, WATER_SURFACE_VERTEX } from './shaders/water'

/** The three.js members the water layer needs at runtime. */
export type WaterThree = Pick<typeof THREE_NS, 'Group' | 'Mesh' | 'InstancedBufferGeometry' | 'InstancedBufferAttribute' | 'Float32BufferAttribute' | 'ShaderMaterial' | 'DynamicDrawUsage' | 'CylinderGeometry' | 'SphereGeometry' | 'Vector3' | 'DoubleSide'>

export interface WaterLayerOptions {
  /** Colour of the white water (linear RGB). */
  readonly foam?: readonly [number, number, number]
  /** Colour of the clear water the drops and the column show at their edges (linear RGB). */
  readonly deep?: readonly [number, number, number]
  /** Drops are drawn this many times their size (spray reads as clumps, not single drops). */
  readonly dropScale?: number
}

/** The water splashes of a `WaterEffects` drawn with four instanced meshes: surface marks, sprites, columns and domes. */
export interface WaterLayer {
  readonly group: THREE_NS.Group
  /** Copies the pools into the instance buffers; answers how many instances are drawn. */
  sync(): number
  dispose(): void
}

const SURFACE_RIPPLE = 0
const SURFACE_FOAM = 3
const SPRITE_DROP = 0
const SPRITE_BUBBLE = 1
const SPRITE_MIST = 2

type Attribute = THREE_NS.InstancedBufferAttribute

interface Batch {
  readonly mesh: THREE_NS.Mesh
  readonly geometry: THREE_NS.InstancedBufferGeometry
  readonly attributes: readonly Attribute[]
  readonly arrays: readonly Float32Array[]
}

function makeBatch(THREE: WaterThree, base: THREE_NS.BufferGeometry, material: THREE_NS.ShaderMaterial, sizes: readonly number[], capacity: number): Batch {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', base.getAttribute('position'))
  if (base.index) geometry.setIndex(base.index)
  const names = ['aP', 'aD', 'aK']
  const arrays = sizes.map((size) => new Float32Array(Math.max(1, capacity) * size))
  const attributes = sizes.map((size, index) => {
    const attribute = new THREE.InstancedBufferAttribute(arrays[index]!, size).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute(names[index]!, attribute)
    return attribute
  })
  geometry.instanceCount = 0
  base.dispose()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  return { mesh, geometry, attributes, arrays }
}

function material(THREE: WaterThree, vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }>): THREE_NS.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false })
}

function quad(THREE: WaterThree, flat: boolean): THREE_NS.BufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry()
  const corners = flat ? [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1] : [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3))
  geometry.setIndex(flat ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3])
  return geometry
}

const put4 = (array: Float32Array, index: number, a: number, b: number, c: number, d: number): void => {
  array[index * 4] = a
  array[index * 4 + 1] = b
  array[index * 4 + 2] = c
  array[index * 4 + 3] = d
}
const put3 = (array: Float32Array, index: number, a: number, b: number, c: number): void => {
  array[index * 3] = a
  array[index * 3 + 1] = b
  array[index * 3 + 2] = c
}
const put2 = (array: Float32Array, index: number, a: number, b: number): void => {
  array[index * 2] = a
  array[index * 2 + 1] = b
}

function finish(batch: Batch, count: number): number {
  batch.geometry.instanceCount = count
  for (const attribute of batch.attributes) attribute.needsUpdate = true
  return count
}

export function createWaterEffectsLayer(THREE: WaterThree, effects: WaterEffects, options: WaterLayerOptions = {}): WaterLayer {
  const foam = options.foam ?? [0.86, 0.9, 0.92]
  const deep = options.deep ?? [0.42, 0.55, 0.6]
  const dropScale = options.dropScale ?? 2.5
  const uniforms = { uFoam: { value: new THREE.Vector3(...foam) }, uDeep: { value: new THREE.Vector3(...deep) } }
  const { limits } = effects
  const surface = makeBatch(THREE, quad(THREE, true), material(THREE, WATER_SURFACE_VERTEX, WATER_SURFACE_FRAGMENT, uniforms), [4, 3], limits.rings + limits.foam)
  const sprites = makeBatch(THREE, quad(THREE, false), material(THREE, WATER_SPRITE_VERTEX, WATER_SPRITE_FRAGMENT, uniforms), [4, 3], limits.drops + limits.bubbles + limits.mist)
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 14, 6, true).translate(0, 0.5, 0)
  const columns = makeBatch(THREE, cylinder, material(THREE, WATER_COLUMN_VERTEX, WATER_COLUMN_FRAGMENT, uniforms), [4, 4, 2], limits.columns)
  const hemisphere = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)
  const domes = makeBatch(THREE, hemisphere, material(THREE, WATER_COLUMN_VERTEX, WATER_COLUMN_FRAGMENT, uniforms), [4, 4, 2], limits.columns)
  ;(columns.mesh.material as THREE_NS.ShaderMaterial).side = THREE.DoubleSide
  surface.mesh.renderOrder = 2
  domes.mesh.renderOrder = 3
  columns.mesh.renderOrder = 4
  sprites.mesh.renderOrder = 5
  const group = markKitOrigin(new THREE.Group(), { owner: 'game-vfx-three', kind: 'effect' })
  group.name = 'water-effects'
  for (const batch of [surface, sprites, columns, domes]) {
    batch.mesh.name = 'water-effects-batch'
    group.add(batch.mesh)
  }

  const syncSurface = (): number => {
    const [p, d] = surface.arrays as [Float32Array, Float32Array]
    let n = 0
    for (const ring of effects.rings) {
      if (ring.alpha <= 0.004) continue
      put4(p, n, ring.x, ring.y, ring.z, ring.radius)
      put3(d, n++, ring.alpha, ring.kind === 0 ? SURFACE_RIPPLE : ring.kind, (ring.x * 7.13 + ring.z * 3.71) % 1)
    }
    for (const patch of effects.foam) {
      put4(p, n, patch.x, patch.y, patch.z, patch.radius)
      put3(d, n++, patch.alpha, SURFACE_FOAM, (patch.x * 5.3 + patch.z * 9.1) % 1)
    }
    return finish(surface, n)
  }

  const syncSprites = (): number => {
    const [p, d] = sprites.arrays as [Float32Array, Float32Array]
    let n = 0
    for (const drop of effects.drops) {
      put4(p, n, drop.x, drop.y, drop.z, drop.size * dropScale)
      put3(d, n++, 0.85, SPRITE_DROP, 0)
    }
    for (const bubble of effects.bubbles) {
      if (bubble.alpha <= 0.004) continue
      put4(p, n, bubble.x, bubble.y, bubble.z, bubble.size)
      put3(d, n++, bubble.alpha, SPRITE_BUBBLE, 0)
    }
    for (const mist of effects.mist) {
      put4(p, n, mist.x, mist.y, mist.z, mist.size)
      put3(d, n++, mist.alpha, SPRITE_MIST, (mist.x * 3.3) % 1)
    }
    return finish(sprites, n)
  }

  const syncColumns = (batch: Batch, dome: boolean): number => {
    const [p, d, k] = batch.arrays as [Float32Array, Float32Array, Float32Array]
    let n = 0
    for (const column of effects.columns as readonly WaterColumn[]) {
      if (column.dome !== dome || column.alpha <= 0.004 || column.height <= 0.005) continue
      put4(p, n, column.x, column.y, column.z, column.radius)
      put4(d, n, column.height, column.alpha, column.tiltX, column.tiltZ)
      put2(k, n++, dome ? 1 : 0, Math.abs(column.x * 1.7 + column.z * 2.3) % 1)
    }
    return finish(batch, n)
  }

  return {
    group,
    sync: () => syncSurface() + syncSprites() + syncColumns(columns, false) + syncColumns(domes, true),
    dispose() {
      for (const batch of [surface, sprites, columns, domes]) {
        batch.geometry.dispose()
        ;(batch.mesh.material as THREE_NS.ShaderMaterial).dispose()
      }
      group.removeFromParent()
    },
  }
}
