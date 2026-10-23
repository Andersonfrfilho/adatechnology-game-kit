import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { ActiveEmitter } from '@adatechnology/game-interactables'
import { createEffects } from '../src'
import { fakeDocument } from './helpers'

const em = (kind: ActiveEmitter['kind'], intensity = 1, id = kind): ActiveEmitter => ({ id, object: 'o', kind, pos: [0, 1, 0], dir: [0, -1, 0.2], size: 0.3, intensity })

describe('createEffects', () => {
  it('never exceeds maxParticles', () => {
    const scene = new THREE.Scene()
    const fx = createEffects(THREE, scene, { maxParticles: 100 })
    const all = (['smoke', 'fire', 'steam', 'water', 'spark', 'flame'] as const).map((k) => em(k, 1))
    let peak = 0
    for (let i = 0; i < 400; i++) {
      fx.update(1 / 30, all)
      peak = Math.max(peak, fx.stats().alive)
      expect(fx.stats().alive).toBeLessThanOrEqual(100)
    }
    expect(peak).toBeGreaterThan(30)
    expect(fx.stats().capacity).toBeLessThanOrEqual(100)
  })

  it('creates one Points per kind, in the scene, and fills the draw range', () => {
    const scene = new THREE.Scene()
    const fx = createEffects(THREE, scene, { maxParticles: 200, document: fakeDocument() })
    expect(Object.keys(fx.objects).sort()).toEqual(['fire', 'smoke', 'spark', 'steam', 'water'])
    expect(scene.children.length).toBe(5)
    for (let i = 0; i < 60; i++) fx.update(1 / 30, [em('smoke')])
    expect(fx.stats().byKind.smoke).toBeGreaterThan(5)
    expect(fx.objects.smoke.geometry.drawRange.count).toBe(fx.stats().byKind.smoke)
    expect(fx.stats().byKind.fire).toBe(0)
  })

  it('smoke rises, fades and dies; particles disappear after the emitter stops', () => {
    const fx = createEffects(THREE, new THREE.Scene(), { maxParticles: 200 })
    for (let i = 0; i < 30; i++) fx.update(1 / 30, [em('smoke')])
    const a = fx.objects.smoke.geometry.getAttribute('position') as THREE.BufferAttribute
    const n = fx.stats().byKind.smoke
    let maxY = 0
    for (let i = 0; i < n; i++) maxY = Math.max(maxY, a.getY(i))
    expect(maxY).toBeGreaterThan(1.1)
    for (let i = 0; i < 300; i++) fx.update(1 / 30, [])
    expect(fx.stats().alive).toBe(0)
  })

  it('gas flame goes to the fire pool; water with low intensity drips slower than a stream', () => {
    const fx = createEffects(THREE, new THREE.Scene(), { maxParticles: 400 })
    for (let i = 0; i < 20; i++) fx.update(1 / 30, [em('flame', 1)])
    expect(fx.stats().byKind.fire).toBeGreaterThan(0)
    const drip = createEffects(THREE, new THREE.Scene(), { maxParticles: 400 })
    const stream = createEffects(THREE, new THREE.Scene(), { maxParticles: 400 })
    for (let i = 0; i < 30; i++) {
      drip.update(1 / 30, [em('water', 0.1)])
      stream.update(1 / 30, [em('water', 1)])
    }
    expect(drip.stats().byKind.water).toBeLessThan(stream.stats().byKind.water / 4)
    expect(drip.stats().byKind.water).toBeGreaterThan(0)
  })

  it('is deterministic per seed and does not allocate pool buffers per frame', () => {
    const run = (seed: number) => {
      const fx = createEffects(THREE, new THREE.Scene(), { maxParticles: 100, seed })
      for (let i = 0; i < 40; i++) fx.update(1 / 30, [em('spark'), em('fire')])
      return Array.from(fx.objects.spark.geometry.getAttribute('position').array.slice(0, 12))
    }
    expect(run(5)).toEqual(run(5))
    expect(run(5)).not.toEqual(run(6))
    const fx = createEffects(THREE, new THREE.Scene(), { maxParticles: 100 })
    const before = fx.objects.fire.geometry.getAttribute('position').array
    for (let i = 0; i < 20; i++) fx.update(1 / 30, [em('fire')])
    expect(fx.objects.fire.geometry.getAttribute('position').array).toBe(before)
  })

  it('dispose removes the objects', () => {
    const scene = new THREE.Scene()
    const fx = createEffects(THREE, scene)
    fx.dispose()
    expect(scene.children.length).toBe(0)
  })
})

describe('sprite size follows the camera lens', () => {
  const scaleOf = (fx: ReturnType<typeof createEffects>) => (fx.objects.smoke.material as THREE.ShaderMaterial).uniforms.uScale.value as number

  it('a 90 degree lens keeps viewHeight / 2; narrower lenses make bigger sprites', () => {
    const fx = createEffects(THREE, new THREE.Scene(), { viewHeight: 800 })
    expect(scaleOf(fx)).toBeCloseTo(400)
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 100)
    fx.update(1 / 60, [], cam)
    expect(scaleOf(fx)).toBeCloseTo(800 / (2 * Math.tan(Math.PI / 6)), 3)
    cam.fov = 30
    fx.update(1 / 60, [])
    expect(scaleOf(fx)).toBeCloseTo(800 / (2 * Math.tan(Math.PI / 12)), 3)
    cam.zoom = 2
    fx.update(1 / 60, [])
    expect(scaleOf(fx)).toBeGreaterThan(800 / (2 * Math.tan(Math.PI / 12)))
    fx.setViewHeight(400)
    expect(scaleOf(fx)).toBeLessThan(800 / (2 * Math.tan(Math.PI / 12)) * 2)
    fx.setCamera(null)
    expect(scaleOf(fx)).toBeCloseTo(200)
  })
})
