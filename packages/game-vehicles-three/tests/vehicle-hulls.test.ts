import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { hullOf } from '@adatechnology/game-vehicles'

import { FLAT_PAD, MAX_HULL_POINTS, convexFaces, createVehicleColliders, hullVolume, reducePoints, vehicleHulls } from '../src'
import { build } from './vehicle-colliders-support'

const CUBE = [0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]

/** A flat grid of `size` x `size` metres in the plane y = `height`, two triangles a cell, as the soup a hull is made of. */
const sheet = (size: number, height: number, cells = 4): { vertices: number[]; indices: number[]; all: number[] } => {
  const vertices: number[] = []
  const indices: number[] = []
  for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) vertices.push((i / cells) * size, height, (j / cells) * size)
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      const a = j * (cells + 1) + i
      indices.push(a, a + 1, a + cells + 1, a + 1, a + cells + 2, a + cells + 1)
    }
  }
  return { vertices, indices, all: Array.from({ length: indices.length / 3 }, (_, t) => t) }
}

describe('the convex hull and the points it is made of (design 10.1)', () => {
  it('a cube is twelve faces and a volume of one, wound outward', () => {
    const faces = convexFaces(CUBE)!
    expect(faces).toHaveLength(12)
    expect(hullVolume(CUBE, faces)).toBeCloseTo(1, 9)
  })

  it('points inside the hull change nothing, and a flat or a straight set has no hull', () => {
    const faces = convexFaces([...CUBE, 0.5, 0.5, 0.5, 0.2, 0.7, 0.3])!
    expect(hullVolume([...CUBE, 0.5, 0.5, 0.5, 0.2, 0.7, 0.3], faces)).toBeCloseTo(1, 9)
    expect(convexFaces([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0.5, 0.5, 0])).toBeNull()
    expect(convexFaces([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0])).toBeNull()
  })

  it('reducing keeps at most the limit, only points that were given, and the extremes of the cube directions', () => {
    const points: number[] = []
    for (let i = 0; i < 2000; i++) points.push(Math.sin(i * 12.9898) * 3, Math.sin(i * 78.233) * 2, Math.sin(i * 37.719) * 1)
    const reduced = reducePoints(points, MAX_HULL_POINTS)
    expect(reduced.length / 3).toBe(MAX_HULL_POINTS)
    const given = new Set<string>()
    for (let i = 0; i < points.length; i += 3) given.add(`${points[i]},${points[i + 1]},${points[i + 2]}`)
    for (let i = 0; i < reduced.length; i += 3) expect(given.has(`${reduced[i]},${reduced[i + 1]},${reduced[i + 2]}`)).toBe(true)
    let maxX = -Infinity
    for (let i = 0; i < points.length; i += 3) maxX = Math.max(maxX, points[i]!)
    expect(Math.max(...reduced.filter((_, i) => i % 3 === 0))).toBe(maxX)
  })
})

describe('the hull of a drawn piece (design 10.1, method B)', () => {
  it('a piece with volume is one hull of its own drawn vertices, never padded', () => {
    const soup = { vertices: CUBE, indices: [0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6] }
    const hull = hullOf(soup)!
    const corners = (points: readonly number[]): string[] => Array.from({ length: points.length / 3 }, (_, i) => points.slice(i * 3, i * 3 + 3).join(',')).sort()
    expect(corners(hull)).toEqual(corners(CUBE))
    expect(hullVolume(hull, convexFaces(hull)!)).toBeCloseTo(1, 9)
  })

  it('a flat sheet gets FLAT_PAD on each side of its plane: 5 mm thick, 64 points at most', () => {
    const soup = sheet(1, 0.5, 12)
    const hull = hullOf(soup)!
    const heights = hull.filter((_, i) => i % 3 === 1)
    expect(Math.max(...heights)).toBeCloseTo(0.5 + FLAT_PAD, 9)
    expect(Math.min(...heights)).toBeCloseTo(0.5 - FLAT_PAD, 9)
    expect(hull.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
    expect(convexFaces(hull)).not.toBeNull()
  })

  it('a strip (a line) is padded across its plane too, so it is still a volume', () => {
    const soup = { vertices: [0, 0, 0, 1, 0, 0, 2, 0, 0, 0.5, 0, 0, 1.5, 0, 0, 0.2, 0, 0], indices: [0, 1, 2, 3, 4, 5] }
    const hull = hullOf(soup)!
    expect(hull.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
    expect(convexFaces(hull)).not.toBeNull()
  })

  it('a hull of a piece of many points keeps the extreme of the cube directions and at most 64 points', () => {
    const vertices: number[] = []
    for (let i = 0; i < 3000; i++) vertices.push(Math.sin(i * 12.9898) * 0.4, Math.sin(i * 78.233) * 0.3 + 1, Math.sin(i * 37.719) * 0.2)
    const hull = hullOf({ vertices, indices: [0, 1, 2] })!
    expect(hull.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
    expect(Math.max(...hull.filter((_, i) => i % 3 === 0))).toBe(Math.max(...vertices.filter((_, i) => i % 3 === 0)))
  })

  it('fewer than three points is no hull', () => {
    expect(hullOf({ vertices: [0, 0, 0, 1, 0, 0], indices: [] })).toBeNull()
  })
})

describe('the hulls of a model made and kept (design 10.1, 10.2)', () => {
  it('every hull belongs to a part of the model, has at most 64 points, and a wheel has none', () => {
    const { vehicle, frame, dispose } = build('naked_bike')
    const hulls = vehicleHulls(THREE, vehicle, frame)
    const parts = new Set(vehicle.model.parts.map((part) => part.id))
    const wheels = new Set(vehicle.model.parts.filter((part) => ['rim', 'tyre', 'brakes', 'shocks'].includes(part.role)).map((part) => part.id))
    expect(hulls.length).toBeGreaterThan(0)
    for (const hull of hulls) {
      expect(parts.has(hull.id)).toBe(true)
      expect(wheels.has(hull.id)).toBe(false)
      expect(hull.points.length / 3).toBeLessThanOrEqual(MAX_HULL_POINTS)
      expect(convexFaces(hull.points)).not.toBeNull()
    }
    dispose()
  })

  it('asked again with nothing changed, the same hulls come back; a dent makes again only the piece it touched', () => {
    const { vehicle, frame, dispose } = build('naked_bike')
    const colliders = createVehicleColliders(THREE, vehicle, frame, { hulls: true })
    const first = colliders.hulls()
    const again = colliders.hulls()
    expect(again).toHaveLength(first.length)
    again.forEach((hull, i) => expect(hull).toBe(first[i]))
    const meshes: THREE.Mesh[] = []
    ;(vehicle.vehicle.vehicle as THREE.Object3D).traverse((node) => {
      const candidate = node as THREE.Mesh
      if (candidate.isMesh && candidate.visible && candidate.geometry.getAttribute('position')) meshes.push(candidate)
    })
    const mesh = meshes[0]!
    const position = mesh.geometry.getAttribute('position')
    position.setX(0, position.getX(0) + 0.02)
    position.needsUpdate = true
    const dented = colliders.hulls()
    const same = dented.filter((hull, i) => first[i] === hull).length
    expect(dented.length).toBeGreaterThan(0)
    expect(same).toBeGreaterThan(dented.length / 2)
    dispose()
  })

  it('hulls() needs the option', () => {
    const { vehicle, frame, dispose } = build('naked_bike')
    expect(() => createVehicleColliders(THREE, vehicle, frame).hulls()).toThrow(/options.hulls/)
    dispose()
  })
})
