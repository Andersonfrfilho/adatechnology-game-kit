import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { ParticleSystem } from '../src/particles'

function setup(): { scene: THREE.Scene; particles: ParticleSystem } {
  const scene = new THREE.Scene()
  const particles = new ParticleSystem(THREE, { capacity: 50, scene, density: 1, pointScale: 700, groundAt: () => 0, gravity: 9.81, onLand: () => undefined })
  return { scene, particles }
}

const colorsOf = (scene: THREE.Scene, name: string): Float32Array => (scene.getObjectByName(name) as THREE.Points).geometry.getAttribute('pcolor').array as Float32Array

describe('particle colours', () => {
  it('a spawn colour override stays exactly that colour for the whole life', () => {
    const { scene, particles } = setup()
    particles.spawn('smoke', [0, 1, 0], [0, 0, 0], { color: 0x336699 })
    for (let k = 0; k < 5; k++) {
      particles.update(0.1)
      const rgb = colorsOf(scene, 'destruction-particles')
      expect(rgb[0]).toBeCloseTo(0x33 / 255, 6)
      expect(rgb[1]).toBeCloseTo(0x66 / 255, 6)
      expect(rgb[2]).toBeCloseTo(0x99 / 255, 6)
    }
  })

  it('a kind without override fades from its start colour to its end colour', () => {
    const { scene, particles } = setup()
    particles.spawn('fire', [0, 1, 0], [0, 0, 0])
    particles.update(0.2)
    const rgb = colorsOf(scene, 'destruction-particles-additive')
    // fire goes 0xffc040 -> 0xc02000: the green channel gives the progress, red and blue must agree with it
    const progress = (0xc0 / 255 - rgb[1]) / (0xc0 / 255 - 0x20 / 255)
    expect(progress).toBeGreaterThan(0)
    expect(progress).toBeLessThan(1)
    expect(rgb[0]).toBeCloseTo(1 + (0xc0 / 255 - 1) * progress, 5)
    expect(rgb[2]).toBeCloseTo((0x40 / 255) * (1 - progress), 5)
  })
})
