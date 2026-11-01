import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createParticles } from '../src/fx/particles'

const spawnMany = (particles: ReturnType<typeof createParticles>, total: number): void => {
  for (let index = 0; index < total; index += 1) particles.spawn(new THREE.Object3D(), new THREE.Vector3(), { kind: 'casing', life: 99 })
}

describe('particle limit', () => {
  it('keeps the own cap of 900 when the host lends none', () => {
    const particles = createParticles(THREE, new THREE.Scene(), () => 0)
    spawnMany(particles, 1000)
    expect(particles.count('casing')).toBe(900)
  })

  it('follows the host limit, read at each spawn, with no cap of its own', () => {
    let limit = 1200
    const particles = createParticles(THREE, new THREE.Scene(), () => 0, () => limit)
    spawnMany(particles, 1000)
    expect(particles.count('casing')).toBe(1000)
    limit = 50
    spawnMany(particles, 1)
    expect(particles.count('casing')).toBe(1000)
    limit = 2000
    spawnMany(particles, 1)
    expect(particles.count('casing')).toBe(1001)
  })
})
