import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGraphicsView } from '../src'
import type { EffectiveGraphics } from '@adatechnology/game-graphics'

/** The members of a WebGLRenderer the view uses (no GL context in node). */
const fakeRenderer = () => {
  let ratio = 1
  return { shadowMap: { enabled: true }, getPixelRatio: () => ratio, setPixelRatio: (r: number) => void (ratio = r) } as unknown as THREE.WebGLRenderer
}
const effective = (over: Partial<EffectiveGraphics> = {}): EffectiveGraphics => ({ resolutionScale: 1, hordeDetail: 'auto', shadows: 'all', viewDistance: 'medium', fpsCap: 60, showFps: false, ...over })

const setup = () => {
  const renderer = fakeRenderer()
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 140)
  const sun = new THREE.DirectionalLight()
  sun.position.set(7, 13, 8)
  sun.castShadow = true
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 })
  const view = createGraphicsView({ renderer, camera, sun, basePixelRatio: 2 })
  return { renderer, camera, sun, view }
}

describe('graphics view', () => {
  it('draws the resolution scale as the pixel ratio', () => {
    const { renderer, view } = setup()
    view.apply(effective({ resolutionScale: 0.5 }))
    expect(renderer.getPixelRatio()).toBe(1)
  })

  it('turns the shadows off, to a small box around the player, and back to the whole box at a bigger map', () => {
    const { renderer, sun, view } = setup()
    view.apply(effective({ shadows: 'off' }))
    expect(renderer.shadowMap.enabled).toBe(false)
    expect(sun.castShadow).toBe(false)
    view.apply(effective({ shadows: 'near' }))
    expect(sun.castShadow).toBe(true)
    expect(sun.shadow.camera.right).toBe(9)
    expect(sun.shadow.mapSize.x).toBe(1024)
    view.follow(20, -4)
    expect(sun.target.position.x).toBeCloseTo(20, 0)
    expect(sun.position.x - sun.target.position.x).toBeCloseTo(7, 5)
    view.apply(effective({ shadows: 'all' }))
    expect(sun.shadow.camera.right).toBe(16)
    expect(sun.shadow.mapSize.x).toBe(2048)
    expect(sun.position.x).toBe(7)
    expect(sun.target.position.x).toBe(0)
  })

  it('moves the shadow box that follows the player only by whole texels of the map, measured in the light plane', () => {
    const { sun, view } = setup()
    view.apply(effective({ shadows: 'near' }))
    const texel = 18 / sun.shadow.mapSize.x
    const lightSpace = (): THREE.Vector3 => {
      sun.shadow.camera.position.copy(sun.position)
      sun.shadow.camera.lookAt(sun.target.position)
      sun.shadow.camera.updateMatrixWorld()
      return new THREE.Vector3().applyMatrix4(sun.shadow.camera.matrixWorldInverse)
    }
    for (const [x, z] of [[0.3, 0.1], [3.137, -2.71], [-11.42, 7.77], [20.004, -4.0031]] as const) {
      view.follow(x, z)
      const origin = lightSpace()
      expect(Math.abs(origin.x / texel - Math.round(origin.x / texel))).toBeLessThan(1e-3)
      expect(Math.abs(origin.y / texel - Math.round(origin.y / texel))).toBeLessThan(1e-3)
      expect(Math.hypot(sun.target.position.x - x, sun.target.position.z - z)).toBeLessThan(texel * 3)
    }
  })

  it('sets the far plane from the view distance', () => {
    const { camera, view } = setup()
    view.apply(effective({ viewDistance: 'short' }))
    expect(camera.far).toBe(60)
    view.apply(effective({ viewDistance: 'long' }))
    expect(camera.far).toBe(300)
  })
})

describe('view distance holds', () => {
  it('puts the far plane back when something else moved it', () => {
    const { camera, view } = setup()
    view.apply(effective({ viewDistance: 'short' }))
    camera.far = 600
    view.hold()
    expect(camera.far).toBe(60)
  })
})
