import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createGroundField, LOD_LAB } from '@adatechnology/game-vfx'
import { createVfxRenderer } from '../src'
import { createFakeCanvas } from './fake-canvas'

const isTwoPass = (material: THREE.Material): boolean => material.transparent === true && material.side === THREE.DoubleSide && material.forceSinglePass === false

function ringMaterial(): THREE.MeshBasicMaterial {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 600)
  const vfx = { seed: 3, profile: 'high' as const, lod: LOD_LAB, areaCap: false as const, ground: createGroundField() }
  const renderer = createVfxRenderer(THREE, { scene, camera, vfx, createCanvas: createFakeCanvas, reducedMotion: false })
  renderer.play({ effect: 'blood_hit', point: [0, 0.2, 0], direction: [1, 0.3, 0], seed: 5 })
  renderer.update(1 / 60)
  renderer.update(1 / 60)
  const rings = scene.getObjectByName('workshop')!.getObjectByName('workshop-rings') as THREE.InstancedMesh
  return rings.material as THREE.MeshBasicMaterial
}

describe('the workshop ring is drawn in one pass', () => {
  it('keeps the flag next to the properties that made three draw it twice', () => {
    const material = ringMaterial()
    expect(material.forceSinglePass).toBe(true)
    expect(material.transparent).toBe(true)
    expect(material.side).toBe(THREE.DoubleSide)
  })

  it('is not a two-pass material by the rule three uses in renderObject', () => {
    expect(isTwoPass(ringMaterial())).toBe(false)
  })
})
