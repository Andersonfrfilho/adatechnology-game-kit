import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { ActiveEmitter } from '@adatechnology/game-interactables'
import { createEffects } from '../src'
import { fakeDocument } from './helpers'

const em = (kind: ActiveEmitter['kind'], intensity = 1, id = kind): ActiveEmitter => ({ id, object: 'o', kind, pos: [0, 1, 0], dir: [0, -1, 0.2], size: 0.3, intensity })

describe('createEffects', () => {
  it('never exceeds maxParticles', () => {
    const scene = new THREE.Scene()
    const fx = createEffects(THREE, { scene, camera: null, maxParticles: 100 })
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
    const fx = createEffects(THREE, { scene, camera: null, maxParticles: 200, document: fakeDocument() })
    expect(Object.keys(fx.objects).sort()).toEqual(['fire', 'smoke', 'spark', 'steam', 'water'])
    expect(scene.children.length).toBe(6) // five Points and the group of stream / flame meshes
    for (let i = 0; i < 60; i++) fx.update(1 / 30, [em('smoke')])
    expect(fx.stats().byKind.smoke).toBeGreaterThan(5)
    expect(fx.objects.smoke.geometry.drawRange.count).toBe(fx.stats().byKind.smoke)
    expect(fx.stats().byKind.fire).toBe(0)
  })

  it('smoke rises, fades and dies; particles disappear after the emitter stops', () => {
    const fx = createEffects(THREE, { scene: new THREE.Scene(), camera: null, maxParticles: 200 })
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
    const fx = createEffects(THREE, { scene: new THREE.Scene(), camera: null, maxParticles: 400 })
    for (let i = 0; i < 20; i++) fx.update(1 / 30, [em('flame', 1)])
    expect(fx.stats().byKind.fire).toBeGreaterThan(0)
    const drip = createEffects(THREE, { scene: new THREE.Scene(), camera: null, maxParticles: 400 })
    const stream = createEffects(THREE, { scene: new THREE.Scene(), camera: null, maxParticles: 400 })
    for (let i = 0; i < 30; i++) {
      drip.update(1 / 30, [em('water', 0.1)])
      stream.update(1 / 30, [em('water', 1)])
    }
    expect(drip.stats().byKind.water).toBeLessThan(stream.stats().byKind.water / 4)
    expect(drip.stats().byKind.water).toBeGreaterThan(0)
  })

  it('is deterministic per seed and does not allocate pool buffers per frame', () => {
    const run = (seed: number) => {
      const fx = createEffects(THREE, { scene: new THREE.Scene(), camera: null, maxParticles: 100, seed })
      for (let i = 0; i < 40; i++) fx.update(1 / 30, [em('spark'), em('fire')])
      return Array.from(fx.objects.spark.geometry.getAttribute('position').array.slice(0, 12))
    }
    expect(run(5)).toEqual(run(5))
    expect(run(5)).not.toEqual(run(6))
    const fx = createEffects(THREE, { scene: new THREE.Scene(), camera: null, maxParticles: 100 })
    const before = fx.objects.fire.geometry.getAttribute('position').array
    for (let i = 0; i < 20; i++) fx.update(1 / 30, [em('fire')])
    expect(fx.objects.fire.geometry.getAttribute('position').array).toBe(before)
  })

  it('a shower is a continuous tapered stream from the outlet to the floor, with droplets and a splash', () => {
    const scene = new THREE.Scene()
    const fx = createEffects(THREE, scene)
    const shower: ActiveEmitter = { id: 'sh', object: 'o', kind: 'water', pos: [1, 1.9, 2], dir: [0, -1, 0.15], size: 0.35, intensity: 1 }
    for (let i = 0; i < 60; i++) fx.update(1 / 30, [shower])
    const stream = fx.meshes.streams[0]
    expect(stream.visible).toBe(true)
    const pos = stream.geometry.getAttribute('position') as THREE.BufferAttribute
    stream.geometry.computeBoundingBox()
    expect(stream.geometry.boundingBox!.max.y).toBeCloseTo(1.9, 1)
    expect(stream.geometry.boundingBox!.min.y).toBeLessThan(0.02)
    // every ring is within a spray width of the arc and no gap: consecutive rings are less than 25 cm apart
    const ring = 9
    for (let i = 1; i <= 12; i++) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, (i - 1) * ring)
      const b = new THREE.Vector3().fromBufferAttribute(pos, i * ring)
      expect(a.distanceTo(b)).toBeLessThan(0.25)
    }
    // translucent
    expect((stream.material as THREE.MeshBasicMaterial).transparent).toBe(true)
    expect((stream.material as THREE.MeshBasicMaterial).opacity).toBeLessThan(1)
    // droplets around the stream and a splash that stays above the floor
    expect(fx.stats().byKind.water).toBeGreaterThan(60)
    const wp = fx.objects.water.geometry.getAttribute('position') as THREE.BufferAttribute
    let low = 0
    for (let i = 0; i < fx.stats().byKind.water; i++) {
      expect(wp.getY(i)).toBeGreaterThanOrEqual(-1e-6)
      if (wp.getY(i) < 0.3) low++
    }
    expect(low).toBeGreaterThan(5)
    fx.update(1 / 30, [])
    expect(stream.visible).toBe(false)
  })

  it('a tap stream stops at its reach and a thin stream narrows', () => {
    const fx = createEffects(THREE, new THREE.Scene())
    const tap: ActiveEmitter = { id: 'tap', object: 'o', kind: 'water', pos: [0, 1.1, 0], dir: [0, -1, 0], size: 0.02, reach: 0.3, intensity: 1 }
    fx.update(1 / 30, [tap])
    const g = fx.meshes.streams[0].geometry
    g.computeBoundingBox()
    expect(g.boundingBox!.min.y).toBeCloseTo(0.8, 1)
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const width = (ring: number) => {
      const a = new THREE.Vector3().fromBufferAttribute(pos, ring * 9)
      const b = new THREE.Vector3().fromBufferAttribute(pos, ring * 9 + 4)
      return a.distanceTo(b)
    }
    expect(width(12)).toBeLessThan(width(1))
  })

  it('every gas flame ring is a blue mesh in one draw; burners are visible by default', () => {
    const fx = createEffects(THREE, new THREE.Scene())
    const burners = [0, 1, 2, 3].map((i): ActiveEmitter => ({ id: `b${i}`, object: 'o', kind: 'flame', pos: [i * 0.2, 0.9, 0], dir: [0, 1, 0], size: 0.05, intensity: 1 }))
    fx.update(1 / 30, burners)
    const f = fx.meshes.flames
    expect(f.visible).toBe(true)
    expect(f.geometry.drawRange.count).toBe(4 * 16 * 9)
    const col = f.geometry.getAttribute('color') as THREE.BufferAttribute
    expect(col.getZ(0)).toBeGreaterThan(col.getX(0) * 2) // blue
    f.geometry.computeBoundingBox()
    expect(f.geometry.boundingBox!.max.y).toBeGreaterThan(0.93)
    fx.update(1 / 30, [])
    expect(fx.meshes.flames.visible).toBe(false)
  })

  it('default rates make a dense plume and fire', () => {
    const fx = createEffects(THREE, new THREE.Scene())
    const smoke: ActiveEmitter = { id: 's', object: 'o', kind: 'smoke', pos: [0, 1, 0], dir: [0, 1, 0], size: 0.35, intensity: 1 }
    const fire: ActiveEmitter = { id: 'f', object: 'o', kind: 'fire', pos: [0, 1, 0], dir: [0, 1, 0], size: 0.45, intensity: 1 }
    for (let i = 0; i < 90; i++) fx.update(1 / 30, [smoke, fire])
    expect(fx.stats().byKind.smoke).toBeGreaterThan(80)
    expect(fx.stats().byKind.fire).toBeGreaterThan(50)
  })

  it('dispose removes the objects', () => {
    const scene = new THREE.Scene()
    const fx = createEffects(THREE, { scene, camera: null })
    fx.dispose()
    expect(scene.children.length).toBe(0)
  })
})

describe('sprite size follows the camera lens', () => {
  const scaleOf = (fx: ReturnType<typeof createEffects>) => (fx.objects.smoke.material as THREE.ShaderMaterial).uniforms.uScale.value as number

  it('a 90 degree lens keeps viewHeight / 2; narrower lenses make bigger sprites; update(dt, emitters) reads the camera it was created with', () => {
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.1, 100)
    const fx = createEffects(THREE, { scene: new THREE.Scene(), camera: cam, viewHeight: 800 })
    expect(scaleOf(fx)).toBeCloseTo(800 / (2 * Math.tan(Math.PI / 6)), 3)
    cam.fov = 30
    fx.update(1 / 60, [])
    expect(scaleOf(fx)).toBeCloseTo(800 / (2 * Math.tan(Math.PI / 12)), 3)
    cam.zoom = 2
    fx.update(1 / 60, [])
    expect(scaleOf(fx)).toBeGreaterThan(800 / (2 * Math.tan(Math.PI / 12)))
    fx.setViewHeight(400)
    expect(scaleOf(fx)).toBeLessThan((800 / (2 * Math.tan(Math.PI / 12))) * 2)
    fx.setCamera(null)
    expect(scaleOf(fx)).toBeCloseTo(200)
    fx.setCamera(cam)
    fx.update(1 / 60, [])
    expect(scaleOf(fx)).toBeGreaterThan(200)
  })

  it('a camera given as a function is asked again every update', () => {
    const a = new THREE.PerspectiveCamera(90)
    const b = new THREE.PerspectiveCamera(30)
    let cur = a
    const fx = createEffects(THREE, { scene: new THREE.Scene(), camera: () => cur, viewHeight: 800 })
    expect(scaleOf(fx)).toBeCloseTo(400)
    cur = b
    fx.update(1 / 60, [])
    expect(scaleOf(fx)).toBeCloseTo(800 / (2 * Math.tan(Math.PI / 12)), 3)
  })

  it('scene and camera are required options; the old (scene, options) call still works', () => {
    expect(() => createEffects(THREE, { camera: null } as never)).toThrow(/scene/)
    expect(() => createEffects(THREE, { scene: new THREE.Scene() } as never)).toThrow(/camera/)
    const scene = new THREE.Scene()
    const legacy = createEffects(THREE, scene, { maxParticles: 50 })
    expect(scene.children.length).toBe(6)
    legacy.dispose()
  })
})
