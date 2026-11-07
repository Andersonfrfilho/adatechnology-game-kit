import type * as THREE_NS from 'three'
import { markShared } from '@adatechnology/game-shapes-three'
import type { ModelKit, Parent } from './kit'

/** One point of a side profile: the x along the weapon and the y of the top and of the bottom edge there. */
export type ProfilePoint = readonly [x: number, top: number, bottom: number]

const SLICE_LENGTH = 0.02

const at = (points: readonly ProfilePoint[], x: number): readonly [number, number] => {
  const last = points[points.length - 1] as ProfilePoint
  if (x >= last[0]) return [last[1], last[2]]
  const nextIndex = points.findIndex((point) => point[0] >= x)
  const next = points[Math.max(nextIndex, 1)] as ProfilePoint
  const previous = points[Math.max(nextIndex, 1) - 1] as ProfilePoint
  const fraction = (x - previous[0]) / (next[0] - previous[0])
  return [previous[1] + (next[1] - previous[1]) * fraction, previous[2] + (next[2] - previous[2]) * fraction]
}

/** A wooden piece cut from its side profile: short slanted slices as wide as the weapon, so that the piece tapers and bends like the photo's stock does. */
export function profileBlock(kit: ModelKit, parent: Parent, points: readonly ProfilePoint[], width: number, material: THREE_NS.Material): void {
  const first = points[0] as ProfilePoint
  const last = points[points.length - 1] as ProfilePoint
  const count = Math.max(1, Math.ceil((last[0] - first[0]) / SLICE_LENGTH))
  const step = (last[0] - first[0]) / count
  for (let index = 0; index < count; index++) {
    const [rearTop, rearBottom] = at(points, first[0] + step * index)
    const [frontTop, frontBottom] = at(points, first[0] + step * (index + 1))
    const rise = (frontTop + frontBottom - rearTop - rearBottom) / 2
    const height = (frontTop - frontBottom + rearTop - rearBottom) / 2
    const centre = (rearTop + rearBottom + frontTop + frontBottom) / 4
    kit.box(parent, Math.hypot(step, rise) * 1.12, height, width, material, first[0] + step * (index + 0.5), centre, 0, Math.atan2(rise, step))
  }
}

const BEVEL = 0.0025

// triangulating a spline outline is the slow part of a model: each stock is built once per kit and shared by every weapon that wears it
const solids = new WeakMap<ModelKit, Map<string, THREE_NS.BufferGeometry>>()

/**
 * A stock cut from its side profile as one smooth solid: the top and the bottom edges are splines through the points, the outline is extruded across the weapon with a
 * rounded edge, and `hole` (a closed loop of (x, y) points, also a spline) cuts a thumbhole through it. Centred on z, `width` wide in all.
 */
export function profileSolid(kit: ModelKit, parent: Parent, points: readonly ProfilePoint[], width: number, material: THREE_NS.Material, hole?: readonly (readonly [number, number])[]): THREE_NS.Mesh {
  const key = JSON.stringify([points, width, hole ?? null])
  const cache = solids.get(kit) ?? new Map<string, THREE_NS.BufferGeometry>()
  solids.set(kit, cache)
  let geometry = cache.get(key)
  if (!geometry) {
    geometry = buildSolid(kit, points, width, hole)
    markShared(geometry)
    cache.set(key, geometry)
  }
  const { THREE } = kit
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function buildSolid(kit: ModelKit, points: readonly ProfilePoint[], width: number, hole?: readonly (readonly [number, number])[]): THREE_NS.BufferGeometry {
  const { THREE } = kit
  const top = points.map(([x, y]) => new THREE.Vector2(x, y))
  const bottom = [...points].reverse().map(([x, , y]) => new THREE.Vector2(x, y))
  const first = top[0] as THREE_NS.Vector2
  const shape = new THREE.Shape()
  shape.moveTo(first.x, first.y)
  shape.splineThru(top.slice(1))
  shape.lineTo((bottom[0] as THREE_NS.Vector2).x, (bottom[0] as THREE_NS.Vector2).y)
  shape.splineThru(bottom.slice(1))
  shape.closePath()
  if (hole) {
    const loop = hole.map(([x, y]) => new THREE.Vector2(x, y))
    const path = new THREE.Path()
    path.moveTo((loop[0] as THREE_NS.Vector2).x, (loop[0] as THREE_NS.Vector2).y)
    path.splineThru([...loop.slice(1), loop[0] as THREE_NS.Vector2])
    shape.holes.push(path)
  }
  const depth = Math.max(0.002, width - BEVEL * 2)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, curveSegments: 16, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 2 })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}
