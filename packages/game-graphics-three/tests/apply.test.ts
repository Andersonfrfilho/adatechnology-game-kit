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

  it('sets the far plane from the view distance', () => {
    const { camera, view } = setup()
    view.apply(effective({ viewDistance: 'short' }))
    expect(camera.far).toBe(60)
    view.apply(effective({ viewDistance: 'long' }))
    expect(camera.far).toBe(300)
  })
})
