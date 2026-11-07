import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructibleSpec, DestructionEvent } from '@adatechnology/game-destruction'
import { createVfx } from '@adatechnology/game-vfx'
import { createDestructionRenderer } from '../src/renderer'
import { SETTLE_SECONDS } from '../src/settlement'
import { stairCrackPath, stairCrackStrip } from '../src/stair-crack'

const LENGTH = 6

/** A brick wall on its ground beam, on the anchored terrain slab of a house: the beam and the wall drawn by vertex ranges of one merged mesh. */
const spec: DestructibleSpec = {
  parts: [
    { id: 'ground', material: 'concrete', anchored: true, hp: 1e12, structure: { role: 'foundation' }, tags: ['terrain'], shape: { kind: 'box', size: [LENGTH + 6, 0.5, 6] }, position: [LENGTH / 2, -0.25, 0] },
    { id: 'beam', material: 'concrete', anchored: true, structure: { role: 'foundation' }, shape: { kind: 'box', size: [LENGTH, 0.3, 0.15] }, position: [LENGTH / 2, -0.15, 0] },
    { id: 'wall', material: 'brick', structure: { role: 'wall' }, shape: { kind: 'box', size: [LENGTH, 2.8, 0.15] }, position: [LENGTH / 2, 1.4, 0] },
  ],
  joints: [
    { a: 'beam', b: 'ground', kind: 'rebar', bears: 'a_on_b' },
    { a: 'wall', b: 'beam', kind: 'mortar', bears: 'a_on_b' },
  ],
}

function setUp() {
  const world = createDestruction({ seed: 3 })
  world.add(spec, { id: 'house' })
  const scene = new THREE.Scene()
  const root = new THREE.Group()
  const beam = new THREE.BoxGeometry(LENGTH, 0.3, 0.15, 30, 1, 1).translate(LENGTH / 2, -0.15, 0)
  const wall = new THREE.BoxGeometry(LENGTH, 2.8, 0.15, 30, 4, 1).translate(LENGTH / 2, 1.4, 0)
  const nb = beam.getAttribute('position').count
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute([...beam.getAttribute('position').array, ...wall.getAttribute('position').array], 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute([...beam.getAttribute('normal').array, ...wall.getAttribute('normal').array], 3))
  merged.setIndex([...beam.getIndex()!.array, ...Array.from(wall.getIndex()!.array, (i) => i + nb)])
  const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial())
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  const total = merged.getAttribute('position').count
  const renderer = createDestructionRenderer(THREE, { scene, world, vfx: createVfx() })
  renderer.bind('house', root, { parts: { beam: { mesh, range: [0, nb] }, wall: { mesh, range: [nb, total] } } })
  const events: DestructionEvent[] = []
  world.on('*', (event) => events.push(event))
  /** Lowest y the wall is drawn at near `x`. */
  const wallBottomAt = (x: number): number => {
    const pos = mesh.geometry.getAttribute('position')
    let low = Infinity
    for (let i = nb; i < total; i++) if (Math.abs(pos.getX(i) - x) < 0.11) low = Math.min(low, pos.getY(i))
    return low
  }
  const step = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 0.05) {
      world.update(0.05)
      renderer.update(0.05)
    }
  }
  return { world, renderer, mesh, root, events, wallBottomAt, step }
}

describe('settlement drawn', () => {
  it('a crater by one end: the beam and the wall on it go down there, smoothly, and tilt; the far end stays', () => {
    const h = setUp()
    expect(h.wallBottomAt(0)).toBeCloseTo(0, 6)
    h.world.groundLoss({ x: -0.3, z: -0.3, radius: 1.5, depth: 0.45, source: 'crater' })
    h.step(0.25)
    const line = h.world.part('house', 'wall')!.settlement!
    expect(line).toEqual(h.world.part('house', 'beam')!.settlement)
    expect(line.drop[0]).toBeGreaterThan(line.drop[line.drop.length - 1]!)
    const early = -h.wallBottomAt(0)
    expect(early).toBeGreaterThan(0)
    expect(early).toBeLessThan(line.drop[0] * 0.9)
    h.step(SETTLE_SECONDS)
    expect(-h.wallBottomAt(0)).toBeCloseTo(line.drop[0], 3)
    expect(-h.wallBottomAt(LENGTH)).toBeCloseTo(line.drop[line.drop.length - 1]!, 3)
    expect(-h.wallBottomAt(0)).toBeGreaterThan(-h.wallBottomAt(LENGTH))
  })

  it('the wall cracks in steps through the joints, toward the end that went down, and the cracks go with the wall', () => {
    const h = setUp()
    h.world.groundLoss({ x: -0.3, z: -0.3, radius: 1.5, depth: 0.45, source: 'crater' })
    h.step(SETTLE_SECONDS + 0.2)
    const cracks = h.events.filter((e): e is Extract<DestructionEvent, { type: 'crack' }> => e.type === 'crack' && e.part === 'wall')
    expect(cracks.length).toBeGreaterThan(0)
    for (const crack of cracks) {
      expect(crack.crack.stair).toBeDefined()
      // it climbs toward x = 0, where the crater is
      expect(crack.crack.stair!.along[0]).toBeLessThan(0)
      expect(crack.crack.stair!.along[1]).toBeGreaterThan(0)
      expect(crack.crack.stair!.width).toBeGreaterThan(0.0005)
    }
    const strips = h.mesh.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh === true)
    // through the wall: one strip on each face
    expect(strips.length).toBe(2 * cracks.length)
    const side = (strip: THREE.Mesh): number => {
      strip.geometry.computeBoundingBox()
      return Math.sign(strip.geometry.boundingBox!.getCenter(new THREE.Vector3()).z)
    }
    expect(new Set(strips.map(side))).toEqual(new Set([-1, 1]))
    const geometries = strips.map((s) => s.geometry)
    let disposed = 0
    for (const g of geometries) g.addEventListener('dispose', () => disposed++)
    h.renderer.restore('house')
    expect(h.mesh.children.filter((c) => (c as THREE.Mesh).isMesh)).toHaveLength(0)
    expect(disposed).toBe(geometries.length)
    // put back as it was, not going down any more
    h.renderer.update(0.5)
    expect(h.wallBottomAt(0)).toBeCloseTo(0, 6)
  })
})

describe('stair-step crack', () => {
  it('climbs at about 45 degrees through the joints of a 19 x 9 cm brick: half a unit along a course, one course up', () => {
    const path = stairCrackPath({ length: 1, step: [0.2, 0.1], seed: 7 })
    const [h, u] = path[path.length - 1]!
    expect(Math.atan2(u, h) * (180 / Math.PI)).toBeGreaterThan(30)
    expect(Math.atan2(u, h) * (180 / Math.PI)).toBeLessThan(50)
    for (let k = 1; k < path.length; k++) {
      const [h0, u0] = path[k - 1]!
      const [h1, u1] = path[k]!
      // each leg is either along a bed joint or up a head joint
      expect(h1 === h0 || u1 === u0).toBe(true)
    }
    expect(stairCrackPath({ length: 1, step: [0.2, 0.1], seed: 7 })).toEqual(path)
  })

  it('is a strip as wide as the crack opened, narrowing toward its end', () => {
    const strip = stairCrackStrip([[0, 0], [1, 0]], 0.01, 0.5)
    const us = strip.filter((_, i) => i % 2 === 1)
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(0.01, 9)
  })
})
