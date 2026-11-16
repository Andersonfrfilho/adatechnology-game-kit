import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createParticles } from '../src/fx/particles'

const WALL_X = 1
const STEP = 1 / 60

/** A world with one wall at x = WALL_X (a ray along +x hits it) and nothing else. */
const wall = (origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number): number | null => {
  if (direction.x <= 1e-9) return null
  const distance = (WALL_X - origin.x) / direction.x
  return distance >= 0 && distance <= maxDistance ? distance : null
}

const run = (kind: 'casing' | 'other', surface?: typeof wall) => {
  const particles = createParticles(THREE, new THREE.Scene(), () => -100, undefined, surface)
  const bounces: number[] = []
  particles.onBounce = (_kind, hit) => bounces.push(hit?.speed ?? 0)
  const object = new THREE.Object3D()
  object.position.set(0, 1, 0)
  particles.spawn(object, new THREE.Vector3(6, 0, 0), { kind, life: 99, gravity: 0, bounce: 0.3 })
  let furthest = -Infinity
  for (let i = 0; i < 120; i++) {
    particles.update(STEP)
    furthest = Math.max(furthest, object.position.x)
  }
  return { furthest, bounces, x: object.position.x }
}

describe('casings and the world surfaces', () => {
  it('a casing thrown at a wall stops at it and comes back, instead of going through the concrete', () => {
    const { furthest, x, bounces } = run('casing', wall)
    expect(furthest).toBeLessThanOrEqual(WALL_X)
    expect(x).toBeLessThan(WALL_X)
    expect(bounces.length).toBeGreaterThan(0)
  })

  it('without a surface probe it goes through, as before', () => {
    expect(run('casing').furthest).toBeGreaterThan(WALL_X + 1)
  })

  it('what is not a casing or a magazine (smoke, sparks) is not probed', () => {
    expect(run('other', wall).furthest).toBeGreaterThan(WALL_X + 1)
  })
})
