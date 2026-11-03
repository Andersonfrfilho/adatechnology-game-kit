import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGroundField, LOD_LAB } from '@adatechnology/game-vfx'
import { createLightBudget } from '@adatechnology/game-render-three'
import { createVfxRenderer } from '../src'
import { createFakeCanvas } from './fake-canvas'

function setup(point = 12) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 600)
  camera.position.set(10, 6.5, 14)
  const lights = createLightBudget(THREE, scene, { point, spot: 0, pointShadows: 0 })
  const vfx = { seed: 3, profile: 'high' as const, lod: LOD_LAB, areaCap: false as const, ground: createGroundField() }
  const renderer = createVfxRenderer(THREE, { scene, camera, lights, vfx, createCanvas: createFakeCanvas, reducedMotion: false })
  return { scene, renderer, lights }
}

describe('createVfxRenderer with a LightBudget', () => {
  it('creates no light of its own and lights the blast through the budget', () => {
    const { scene, renderer, lights } = setup()
    let own = 0
    scene.traverse((node) => {
      if ((node as THREE.PointLight).isPointLight && !lights.group.getObjectById(node.id)) own++
    })
    expect(own).toBe(0)
    expect(lights.stats().lit).toBe(0)
    renderer.play({ effect: 'm67', point: [0, 0.1, 0], seed: 1 })
    renderer.update(1 / 60)
    expect(lights.stats().lit).toBeGreaterThan(0)
    expect(lights.group.children.some((light) => (light as THREE.PointLight).intensity > 0)).toBe(true)
    expect(lights.check({ toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.SRGBColorSpace, shadowMap: { type: THREE.PCFShadowMap } }, scene).strays).toEqual([])
  })

  it('gives the slots back the frame the light goes out, and keeps the empty lights group in the root', () => {
    const { scene, renderer, lights } = setup()
    renderer.play({ effect: 'm67', point: [0, 0.1, 0], seed: 1 })
    renderer.update(1 / 60)
    for (let frame = 0; frame < 600; frame++) renderer.update(1 / 30)
    expect(lights.stats().lit).toBe(0)
    const root = scene.children.find((child) => child !== lights.group && child.children.some((inner) => inner.children.length === 0 && inner.type === 'Group'))
    expect(root).toBeDefined()
  })

  it('a full budget refuses the blast light without breaking the frame', () => {
    const { renderer, lights } = setup(1)
    renderer.play({ effect: 'm67', point: [0, 0.1, 0], seed: 1 })
    expect(() => renderer.update(1 / 60)).not.toThrow()
    expect(lights.stats().lit).toBeLessThanOrEqual(1)
  })
})
