import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createParticles } from '../src/fx/particles'
import type { SurfaceProbe } from '../src/laser-raycast'

const WALL_X = 1
const STEP = 1 / 60
const FLOOR_Y = 0
const GRAVITY = 9.8

/** A world with one wall at x = WALL_X (normal -x) and a floor at y = FLOOR_Y (normal +y), as a probe returns them. */
const world: SurfaceProbe = (origin, direction, maxDistance) => {
  let best: { distance: number; normal: THREE.Vector3 } | null = null
  const consider = (distance: number, normal: THREE.Vector3): void => {
    if (distance >= 0 && distance <= maxDistance && (!best || distance < best.distance)) best = { distance, normal }
  }
  if (direction.x > 1e-9) consider((WALL_X - origin.x) / direction.x, new THREE.Vector3(-1, 0, 0))
  if (direction.y < -1e-9) consider((FLOOR_Y - origin.y) / direction.y, new THREE.Vector3(0, 1, 0))
  return best
}

const make = (kind: 'casing' | 'round' | 'other', surface: SurfaceProbe | undefined, gravity: number) => {
  const particles = createParticles(THREE, new THREE.Scene(), () => FLOOR_Y, undefined, surface)
  const bounces: number[] = []
  const rests: number[] = []
  particles.onBounce = (_kind, hit) => bounces.push(hit?.speed ?? 0)
  const object = new THREE.Object3D()
  const spawn = (position: THREE.Vector3, velocity: THREE.Vector3): void => {
    object.position.copy(position)
    particles.spawn(object, velocity, { kind, life: 99, gravity, bounce: 0.3, radius: 0.003, onRest: () => rests.push(1) })
  }
  return { particles, object, bounces, rests, spawn }
}

const flight = (kind: 'casing' | 'round' | 'other', surface?: SurfaceProbe) => {
  const { particles, object, bounces, spawn } = make(kind, surface, 0)
  spawn(new THREE.Vector3(0, 1, 0), new THREE.Vector3(6, 0, 0))
  let furthest = -Infinity
  for (let i = 0; i < 120; i++) {
    particles.update(STEP)
    furthest = Math.max(furthest, object.position.x)
  }
  return { furthest, bounces, x: object.position.x }
}

describe('casings and the world surfaces', () => {
  it('a casing thrown at a wall stops at it and comes back, instead of going through the concrete', () => {
    const { furthest, x, bounces } = flight('casing', world)
    expect(furthest).toBeLessThanOrEqual(WALL_X)
    expect(x).toBeLessThan(WALL_X)
    expect(bounces.length).toBeGreaterThan(0)
  })

  it('an unfired round thrown out stops at the wall too', () => {
    expect(flight('round', world).furthest).toBeLessThanOrEqual(WALL_X)
  })

  it('without a surface probe it goes through, as before', () => {
    expect(flight('casing').furthest).toBeGreaterThan(WALL_X + 1)
  })

  it('what is not a casing, a round or a magazine (smoke, sparks) is not probed', () => {
    expect(flight('other', world).furthest).toBeGreaterThan(WALL_X + 1)
  })

  it('a casing grazing a wall keeps sliding along it and does not gain upward speed', () => {
    const { particles, object, spawn } = make('casing', world, GRAVITY)
    // mostly falling, a little toward the wall
    spawn(new THREE.Vector3(WALL_X - 0.05, 1, 0), new THREE.Vector3(2, -3, 0))
    let highest = -Infinity
    for (let i = 0; i < 6; i++) {
      particles.update(STEP)
      highest = Math.max(highest, object.position.y)
    }
    expect(highest).toBeLessThan(1 + 1e-6)
  })

  it('the floor stays with the floor rules: a casing falling on a floor that the probe also reports comes to rest and says so', () => {
    const { particles, object, rests, spawn } = make('casing', world, GRAVITY)
    spawn(new THREE.Vector3(0, 0.3, 0), new THREE.Vector3(0, 0, 0))
    for (let i = 0; i < 60 * 6; i++) particles.update(STEP)
    expect(rests.length).toBe(1)
    expect(object.position.y).toBeCloseTo(0.003, 3)
  })
})
