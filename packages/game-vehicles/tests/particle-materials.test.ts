import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { ParticleMaterials } from '../src'
import { makeKit } from './helpers/kit'

function pool() {
  const owned: unknown[] = []
  const released: unknown[] = []
  const materials: ParticleMaterials = {
    own: (build) => {
      const material = build()
      owned.push(material)
      return material
    },
    release: (material) => void released.push(material),
  }
  return { materials, owned, released }
}

const world = () => ({ effects: new THREE.Group(), particles: [] as any[], rand: () => 0.5 })

describe('particle materials from the host pool', () => {
  it('each puff owns its material through the pool and gives it back when it dies, without disposing it', () => {
    const { materials, owned, released } = pool()
    const kit: any = makeKit({ particleMaterials: materials }, false)
    const c = world()
    const puff = kit.spawn(c, 'smoke', new THREE.Vector3(), new THREE.Vector3(0, 1, 0), { life: 0.2 })
    expect(owned).toEqual([puff.m.material])
    let disposed = 0
    puff.m.material.addEventListener('dispose', () => disposed++)
    for (let step = 0; step < 20; step++) kit._.tickParticles(c, 0.05)
    expect(c.particles.length).toBe(0)
    expect(released).toEqual([puff.m.material])
    expect(disposed).toBe(0)
  })

  it('solid particles keep the shared materials and never go through the pool', () => {
    const { materials, owned } = pool()
    const kit: any = makeKit({ particleMaterials: materials }, false)
    const c = world()
    kit.spawn(c, 'spark', new THREE.Vector3(), new THREE.Vector3(1, 1, 0), { life: 0.1 })
    expect(owned).toEqual([])
  })

  it('without a pool the puff disposes its own material, as before', () => {
    const kit: any = makeKit({}, false)
    const c = world()
    const puff = kit.spawn(c, 'smoke', new THREE.Vector3(), new THREE.Vector3(0, 1, 0), { life: 0.1 })
    let disposed = 0
    puff.m.material.addEventListener('dispose', () => disposed++)
    for (let step = 0; step < 10; step++) kit._.tickParticles(c, 0.05)
    expect(disposed).toBe(1)
  })
})
