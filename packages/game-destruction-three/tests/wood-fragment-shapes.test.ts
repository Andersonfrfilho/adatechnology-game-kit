import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Fragment, SplitForm } from '@adatechnology/game-destruction'
import { FragmentSystem } from '../src/fragments'

const FORMS: Record<string, SplitForm> = { wood_soft: 'slivers', plywood: 'plies', mdf: 'granules' }

const system = (): FragmentSystem =>
  new FragmentSystem(THREE, { scene: new THREE.Scene(), gravity: 9.8, groundAt: () => 0, life: 0, max: 100, formOf: (id) => FORMS[id] })

const fragment = (id: string, shape: Fragment['shape'], material: string): Fragment => ({
  id, part: 'p', material, shape, center: [0, 1, 0], size: [0.3, 0.02, 0.01], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], mass: 0.05,
})

const spawn = (s: FragmentSystem, f: Fragment): THREE.Mesh => s.spawn(f, s.materialFor(f.material, 0x8a5a2b, false), 'home', 100)!

/** Widest cross-section (|y| and |z|) of the vertices within `band` of x = `at` in the unit box. */
const sectionAt = (geometry: THREE.BufferGeometry, at: number, band = 0.06): number => {
  const position = geometry.getAttribute('position')
  let widest = 0
  for (let i = 0; i < position.count; i++) if (Math.abs(position.getX(i) - at) <= band) widest = Math.max(widest, Math.abs(position.getY(i)), Math.abs(position.getZ(i)))
  return widest
}

describe('wood fragments are drawn by how the wood came apart', () => {
  it('a splinter is a pointed sliver with frayed edges, not a box', () => {
    const s = system()
    const mesh = spawn(s, fragment('a#1', 'splinter', 'wood_soft'))
    const geometry = mesh.geometry
    expect(geometry).not.toBeInstanceOf(THREE.BoxGeometry)
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    for (const v of [box.min.x, box.min.y, box.min.z]) expect(v).toBeGreaterThanOrEqual(-0.5 - 1e-6)
    for (const v of [box.max.x, box.max.y, box.max.z]) expect(v).toBeLessThanOrEqual(0.5 + 1e-6)
    // full in the middle, a point at one end
    expect(sectionAt(geometry, 0.5, 0.01)).toBeLessThan(0.3)
    expect(sectionAt(geometry, 0, 0.15)).toBeGreaterThan(0.35)
    // the corners stray from section to section: the sliver is not a straight prism
    const position = geometry.getAttribute('position')
    const ys = new Set<number>()
    for (let i = 0; i < position.count; i++) ys.add(Math.round(Math.abs(position.getY(i)) * 1000))
    expect(ys.size).toBeGreaterThan(10)
    expect(position.count / 3).toBeLessThanOrEqual(80)
  })

  it('splinters share a few shapes (no geometry per fragment) and look different from each other', () => {
    const s = system()
    const geometries = new Set(Array.from({ length: 40 }, (_, i) => spawn(s, fragment(`a#${i}`, 'splinter', 'wood_soft')).geometry))
    expect(geometries.size).toBeGreaterThan(2)
    expect(geometries.size).toBeLessThanOrEqual(6)
  })

  it('MDF lumps are closed irregular lumps, plywood sheets ragged veneer, and other materials keep the box', () => {
    const s = system()
    const lump = spawn(s, fragment('m#1', 'chunk', 'mdf')).geometry
    const veneer = spawn(s, fragment('p#1', 'scrap', 'plywood')).geometry
    const concrete = spawn(s, fragment('c#1', 'chunk', 'concrete')).geometry
    expect(lump).toBeInstanceOf(THREE.BufferGeometry)
    expect(lump).not.toBeInstanceOf(THREE.BoxGeometry)
    expect(lump.getAttribute('position').count / 3).toBe(20)
    expect(veneer).toBeInstanceOf(THREE.ExtrudeGeometry)
    expect(concrete).toBeInstanceOf(THREE.BoxGeometry)
  })

  it('the stub of a broken board of wood ends in torn strands at +x; an MDF slab stays a clean box', () => {
    const s = system()
    const stub = spawn(s, fragment('b#0', 'slab', 'wood_soft')).geometry
    expect(stub).not.toBeInstanceOf(THREE.BoxGeometry)
    // the far end is square, the torn end comes to several points at different lengths
    expect(sectionAt(stub, -0.5, 0.01)).toBeCloseTo(0.5, 5)
    const position = stub.getAttribute('position')
    const tips = new Set<number>()
    for (let i = 0; i < position.count; i++) if (position.getX(i) > 0.3) tips.add(Math.round(position.getX(i) * 1000))
    expect(tips.size).toBeGreaterThanOrEqual(3)
    expect(spawn(s, fragment('m#0', 'slab', 'mdf')).geometry).toBeInstanceOf(THREE.BoxGeometry)
  })

  it('disposes the shared shapes with the system', () => {
    const s = system()
    const geometry = spawn(s, fragment('a#1', 'splinter', 'wood_soft')).geometry
    let disposed = false
    geometry.addEventListener('dispose', () => (disposed = true))
    s.dispose()
    expect(disposed).toBe(true)
  })
})
