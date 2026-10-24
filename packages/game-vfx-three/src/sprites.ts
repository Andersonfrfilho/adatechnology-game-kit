import type * as THREE_NS from 'three'
import type { SpriteKindPool, SpriteKindSystem } from '@adatechnology/game-vfx'
import { SPRITE_FRAGMENT, SPRITE_VERTEX } from './shaders/sprite'
import type { ThreeLib } from './types'

export interface SpriteLayer {
  readonly additive: THREE_NS.Points
  readonly normal: THREE_NS.Points
  /** Tells the GPU what changed and answers how many sprites are drawn. */
  sync(): number
  dispose(): void
}

interface Drawn {
  readonly points: THREE_NS.Points
  sync(): number
  dispose(): void
}

function drawPool(THREE: ThreeLib, pool: SpriteKindPool, additive: boolean, pointScale: number): Drawn {
  const geometry = new THREE.BufferGeometry()
  const attributes: [string, Float32Array, number][] = [['position', pool.position, 3], ['pcolor', pool.color, 3], ['alpha', pool.alpha, 1], ['size', pool.size, 1]]
  const buffers = attributes.map(([name, array, size]) => {
    const attribute = new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute(name, attribute)
    return attribute
  })
  geometry.setDrawRange(0, 0)
  const material = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: pointScale } },
    vertexShader: SPRITE_VERTEX,
    fragmentShader: SPRITE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  points.name = additive ? 'vfx-sprites-additive' : 'vfx-sprites'
  points.renderOrder = additive ? 11 : 10
  return {
    points,
    sync() {
      geometry.setDrawRange(0, pool.drawCount)
      for (const buffer of buffers) buffer.needsUpdate = true
      return pool.drawCount
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

/** Draws the game's sprite kinds (debris, sparks, smoke, steam, drips...) as two soft point layers, additive and normal. */
export function createSpriteLayer(THREE: ThreeLib, system: SpriteKindSystem, pointScale: number): SpriteLayer {
  const additive = drawPool(THREE, system.additive, true, pointScale)
  const normal = drawPool(THREE, system.normal, false, pointScale)
  return {
    additive: additive.points,
    normal: normal.points,
    sync: () => additive.sync() + normal.sync(),
    dispose() {
      additive.dispose()
      normal.dispose()
    },
  }
}
