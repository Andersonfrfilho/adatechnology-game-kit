import { describe, expect, it } from 'vitest'

import { NEUTRAL_FOG_FAR, NEUTRAL_FOG_NEAR, createFog, createLightBudget, isNeutralFog } from '../src'
import { THREE, fakeRendererState } from './helpers'

function sealedScene(options: Parameters<ReturnType<typeof createLightBudget>['seal']>[2] = {}) {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x888888, 1, 100)
  const budget = createLightBudget(THREE, scene, { point: 2, pointShadows: 0, spot: 0 })
  const renderer = fakeRendererState()
  budget.seal(renderer, scene, options)
  return { scene, budget, renderer }
}

describe('sealed scene state', () => {
  it('reports a fog type change unless both types were declared', () => {
    const only = sealedScene({ fogStates: ['linear'] })
    expect(only.budget.check(only.renderer, only.scene).ok).toBe(true)
    only.scene.fog = new THREE.FogExp2(0x888888, 0.01)
    expect(only.budget.check(only.renderer, only.scene).ok).toBe(false)

    const both = sealedScene({ fogStates: ['linear', 'exp2'] })
    both.scene.fog = new THREE.FogExp2(0x888888, 0.01)
    expect(both.budget.check(both.renderer, both.scene).ok).toBe(true)
    both.scene.fog = null
    expect(both.budget.check(both.renderer, both.scene).ok).toBe(false)
  })

  it('reports tone mapping, output colour space, shadow map type and an environment texture', () => {
    const changes: Array<(state: ReturnType<typeof sealedScene>) => void> = [
      ({ renderer }) => void (renderer.toneMapping = THREE.ACESFilmicToneMapping),
      ({ renderer }) => void (renderer.outputColorSpace = THREE.LinearSRGBColorSpace),
      ({ renderer }) => void (renderer.shadowMap.type = THREE.VSMShadowMap),
      ({ scene }) => void (scene.environment = new THREE.Texture()),
    ]
    for (const change of changes) {
      const state = sealedScene()
      expect(state.budget.check(state.renderer, state.scene).ok).toBe(true)
      change(state)
      expect(state.budget.check(state.renderer, state.scene).ok).toBe(false)
    }
  })

  it('reports a visible light added after the seal', () => {
    const state = sealedScene()
    state.scene.add(new THREE.AmbientLight(0xffffff, 1))
    expect(state.budget.check(state.renderer, state.scene).ok).toBe(false)
  })

  it('reports a camera far at or beyond the neutral fog near, and accepts far 140', () => {
    const scene = new THREE.Scene()
    createFog(THREE, scene, { stable: true }).clear()
    const budget = createLightBudget(THREE, scene, { point: 1, pointShadows: 0, spot: 0 })
    const renderer = fakeRendererState()
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 140)
    budget.seal(renderer, scene, { cameras: [camera] })
    expect(budget.check(renderer, scene).ok).toBe(true)
    camera.far = 7e4
    expect(budget.check(renderer, scene).ok).toBe(false)
  })
})

describe('createFog', () => {
  it('stable clear leaves a neutral linear fog instead of null, and keeps one object', () => {
    const scene = new THREE.Scene()
    const controller = createFog(THREE, scene, { stable: true })
    controller.clear()
    const neutral = scene.fog
    expect(isNeutralFog(neutral)).toBe(true)
    expect(NEUTRAL_FOG_NEAR).toBe(6.0e4)
    expect(NEUTRAL_FOG_FAR).toBe(6.4e4)
    const linear = controller.useLinear(0xaaaaaa, 5, 90)
    expect(linear).toBe(neutral)
    expect(isNeutralFog(scene.fog)).toBe(false)
    controller.clear()
    expect(scene.fog).toBe(neutral)
    expect(isNeutralFog(scene.fog)).toBe(true)
  })

  it('stable clear gives back the host fog it found', () => {
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x123456, 2, 80)
    const controller = createFog(THREE, scene, { stable: true })
    controller.useLinear(0xffffff, 10, 20)
    controller.clear()
    expect((scene.fog as InstanceType<typeof THREE.Fog>).far).toBe(80)
    expect((scene.fog as InstanceType<typeof THREE.Fog>).color.getHex()).toBe(0x123456)
  })

  it('without stable, clear puts back what was there (null)', () => {
    const scene = new THREE.Scene()
    const controller = createFog(THREE, scene)
    controller.useExp2(0x999999, 0.02)
    expect(scene.fog).not.toBeNull()
    controller.clear()
    expect(scene.fog).toBeNull()
  })

  it('exp2 and linear reuse the scene fog object of the same type', () => {
    const scene = new THREE.Scene()
    const controller = createFog(THREE, scene)
    const first = controller.useExp2(0x999999, 0.02)
    expect(controller.useExp2(0x111111, 0.05)).toBe(first)
    expect(first.density).toBe(0.05)
  })
})
