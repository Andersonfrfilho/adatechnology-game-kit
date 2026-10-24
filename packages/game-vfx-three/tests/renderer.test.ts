import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGroundField, createVfx, LOD_LAB } from '@adatechnology/game-vfx'
import { GLOW_FRAGMENT, PUFF_FRAGMENT, PUFF_VERTEX, SPARK_FRAGMENT, createGroundPatch, createVfxRenderer } from '../src'
import { createFakeCanvas } from './fake-canvas'

function setup(extra: Parameters<typeof createVfx>[0] = {}) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 600)
  camera.position.set(10, 6.5, 14)
  const ground = createGroundField()
  const renderer = createVfxRenderer(THREE, { scene, camera, vfx: { seed: 3, profile: 'high', lod: LOD_LAB, areaCap: false, ground, ...extra }, createCanvas: createFakeCanvas, reducedMotion: false })
  return { scene, camera, renderer, ground }
}

describe('shaders', () => {
  it('keep the Lab code and use the r160 colour-space chunk', () => {
    for (const source of [PUFF_FRAGMENT, SPARK_FRAGMENT, GLOW_FRAGMENT]) {
      expect(source).toContain('#include <colorspace_fragment>')
      expect(source).not.toContain('encodings_fragment')
    }
    expect(PUFF_FRAGMENT).toContain('float band=lam>.55?1.:lam>.15?.68:.42;')
    expect(PUFF_FRAGMENT).toContain('vec3 c0=L(vec3(.36,.07,.03))')
    expect(PUFF_VERTEX).toContain('p*=0.78+0.5*n;')
  })
})

describe('createVfxRenderer', () => {
  it('draws an explosion: instances, debris, shock shell, lights and marks', () => {
    const { scene, renderer } = setup()
    renderer.play({ effect: 'm67', point: [0, 0.1, 0], seed: 1 })
    renderer.update(1 / 60)
    const stats = renderer.stats()
    expect(stats.puffs).toBeGreaterThan(30)
    expect(stats.drawCalls).toBeGreaterThan(3)
    let instanced = 0
    scene.traverse((node) => {
      const mesh = node as THREE.Mesh
      const geometry = mesh.geometry as THREE.InstancedBufferGeometry | undefined
      if (geometry?.isInstancedBufferGeometry && geometry.instanceCount > 0) instanced++
    })
    expect(instanced).toBe(3)
    const lights = scene.children[0]!.children.find((child) => child.children.length === 6)!
    expect((lights.children[0] as THREE.PointLight).intensity).toBeGreaterThan(0)
    expect(renderer.world.pools().marks.entries.length).toBeGreaterThan(5)
  })

  it('answers null for an unknown effect and lists the catalogue', () => {
    const { renderer } = setup()
    expect(renderer.play({ effect: 'nothing', point: [0, 0, 0] })).toBeNull()
    expect(renderer.catalog?.()).toContain('fuel_barrel')
  })

  it('lod_band forces the scale of what is played', () => {
    const { renderer } = setup()
    renderer.configure?.({ lod_band: 'far' })
    renderer.play({ effect: 'm67', point: [0, 0.1, 0] })
    expect(renderer.world.stats().lod).toBe(0.2)
    renderer.configure?.({ lod_band: 'auto' })
    renderer.play({ effect: 'm67', point: [0, 0.1, 0] })
    expect(renderer.world.stats().lod).toBe(1)
  })

  it('uses where the camera is for an effect played before the first update', () => {
    const { camera, renderer } = setup()
    camera.position.set(0, 1.6, 150)
    renderer.play({ effect: 'm67', point: [0, 0.1, 0] })
    expect(renderer.world.stats().lod).toBe(0.08)
  })

  it('shakes the camera around the render and puts it back', () => {
    const { camera, renderer } = setup()
    renderer.play({ effect: 'c4', point: [4, 0.1, 4] })
    renderer.update(1 / 60)
    const before = camera.position.clone()
    const restore = renderer.applyCamera()
    expect(camera.position.distanceTo(before)).toBeGreaterThan(0)
    restore()
    expect(camera.position.equals(before)).toBe(true)
  })

  it('never shakes with reduced motion', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()
    const renderer = createVfxRenderer(THREE, { scene, camera, vfx: { profile: 'low' }, createCanvas: createFakeCanvas, reducedMotion: true })
    renderer.play({ effect: 'c4', point: [1, 0.1, 1] })
    const before = camera.position.clone()
    renderer.applyCamera()
    expect(camera.position.equals(before)).toBe(true)
  })

  it('a shared world is stepped by the renderer and the marks go when the world is cleared', () => {
    const world = createVfx({ profile: 'high', areaCap: false, ground: createGroundField() })
    const scene = new THREE.Scene()
    const renderer = createVfxRenderer(THREE, { scene, camera: new THREE.PerspectiveCamera(), vfx: world, createCanvas: createFakeCanvas })
    world.explosion('c4', [0, 0.1, 0])
    renderer.update(0.5)
    expect(world.time()).toBe(0.5)
    const marksGroup = scene.children[0]!.children.at(-1)!
    expect(marksGroup.children.length).toBeGreaterThan(0)
    world.clear()
    expect(marksGroup.children.length).toBe(0)
  })

  it('dispose takes everything out of the scene', () => {
    const { scene, renderer } = setup()
    renderer.play({ effect: 'm67', point: [0, 0.1, 0] })
    renderer.dispose()
    expect(scene.children.length).toBe(0)
  })
})

describe('sprite kinds', () => {
  it('draws the bursts of the world as two point layers and counts them as draw calls', () => {
    const { scene, renderer } = setup()
    const before = renderer.stats().drawCalls
    renderer.world.burst('sparks', [0, 1, 0], [0, 1, 0], 12, 3)
    renderer.world.burst('dust', [0, 1, 0], [0, 1, 0], 9, 1)
    renderer.update(1 / 60)
    const additive = scene.getObjectByName('vfx-sprites-additive') as THREE.Points
    const normal = scene.getObjectByName('vfx-sprites') as THREE.Points
    expect(additive.geometry.drawRange.count).toBe(12)
    expect(normal.geometry.drawRange.count).toBe(9)
    expect(additive.geometry.getAttribute('pcolor')).toBeDefined()
    expect(renderer.stats().drawCalls - before).toBe(2)
    renderer.dispose()
    expect(scene.getObjectByName('vfx-sprites')).toBeUndefined()
  })

  it('has the soft point shader the destruction renderer had', async () => {
    const { SPRITE_FRAGMENT, SPRITE_VERTEX } = await import('../src')
    expect(SPRITE_VERTEX).toContain('gl_PointSize = min(size * uScale / max(0.1, -mv.z), 256.0);')
    expect(SPRITE_FRAGMENT).toContain('smoothstep(0.35, 1.0, d)')
  })
})

describe('createGroundPatch', () => {
  it('follows the height field and only redraws when it changed', () => {
    const field = createGroundField()
    const patch = createGroundPatch(THREE, { field })
    expect(patch.sync()).toBe(true)
    expect(patch.sync()).toBe(false)
    field.dent({ next: () => 0.5, between: (a, b) => (a + b) / 2, direction: (out) => out, state: 1 }, 0, 0, 2, 0.5)
    expect(patch.sync()).toBe(true)
    const position = patch.mesh.geometry.attributes.position!
    const center = Math.round((0 - field.origin) / field.cellSize) * field.stride + Math.round((0 - field.origin) / field.cellSize)
    expect(position.getY(center)).toBeLessThan(-0.1)
    expect(position.getY(center)).toBe(field.heights[center])
  })
})
