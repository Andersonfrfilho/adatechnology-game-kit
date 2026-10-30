import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFluids } from '@adatechnology/game-fluids'
import { createVfx } from '@adatechnology/game-vfx'
import type { FluidWorld, Quat } from '@adatechnology/game-fluids'
import { createFluidRenderer, smoothOutline } from '../src'

const tiltZ = (angle: number): Quat => [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]

const FLOOR = { id: 'floor', point: [0, 0, 0] as [number, number, number], normal: [0, 1, 0] as [number, number, number], halfSize: [5, 5] as [number, number], porosity: 0.05 }

const addCup = (world: FluidWorld, liquid = 'coffee', liters = 0.2) =>
  world.addContainer(
    { capacity: 0.25, liquid, liters, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 },
    { id: 'cup', position: [0, 1, 0] },
  )

const find = (root: THREE.Object3D, name: string): THREE.Mesh[] => {
  const found: THREE.Mesh[] = []
  root.traverse((o) => {
    if (o.name === name) found.push(o as THREE.Mesh)
  })
  return found
}

/** World-space positions of the drawn vertices of a mesh. */
const worldVertices = (mesh: THREE.Mesh): THREE.Vector3[] => {
  mesh.updateWorldMatrix(true, false)
  const pos = mesh.geometry.getAttribute('position')
  const count = mesh.geometry.drawRange.count === Infinity ? pos.count : mesh.geometry.drawRange.count
  const out: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld))
  return out
}

const step = (world: FluidWorld, renderer: { update(dt: number): void }, seconds: number, dt = 0.05) => {
  for (let t = 0; t < seconds; t += dt) {
    world.update(dt)
    renderer.update(dt)
  }
}

describe('container liquid', () => {
  it('a bound cup creates a liquid mesh whose top lies on the surface plane, also after tilting', () => {
    const world = createFluids()
    addCup(world)
    const scene = new THREE.Scene()
    const cup = new THREE.Group()
    cup.position.set(0, 1, 0)
    scene.add(cup)
    const renderer = createFluidRenderer(THREE, { scene, fluids: world })
    renderer.bindContainer('cup', cup)
    step(world, renderer, 0.1)
    const meshes = find(cup, 'fluid_liquid')
    expect(meshes).toHaveLength(1)
    expect(meshes[0].visible).toBe(true)
    expect(renderer.stats().containers).toBe(1)

    const checkPlane = () => {
      const state = world.container('cup')!
      const n = new THREE.Vector3(...state.surfaceNormal)
      const p = new THREE.Vector3(...state.surfacePoint)
      const verts = worldVertices(meshes[0])
      expect(verts.length).toBeGreaterThan(30)
      let onPlane = 0
      for (const v of verts) {
        const dist = n.dot(v.clone().sub(p))
        expect(dist).toBeLessThan(1e-4) // nothing pokes above the surface
        if (Math.abs(dist) < 1e-4) onPlane++
      }
      expect(onPlane).toBeGreaterThanOrEqual(3)
    }
    checkPlane()

    // Tilt by 40 degrees (no spill yet at this level): the same plane test must hold with the rotated object.
    const q: Quat = tiltZ(-0.7)
    cup.quaternion.set(q[0], q[1], q[2], q[3])
    world.setTransform('cup', [0, 1, 0], q)
    world.update(0.01)
    renderer.update(0.01)
    checkPlane()
    // The surface stays horizontal in the world although the cup rotated.
    const verts = worldVertices(meshes[0])
    const top = verts.filter((v) => Math.abs(new THREE.Vector3(...world.container('cup')!.surfaceNormal).dot(v.clone().sub(new THREE.Vector3(...world.container('cup')!.surfacePoint)))) < 1e-4)
    expect(Math.max(...top.map((v) => v.y)) - Math.min(...top.map((v) => v.y))).toBeLessThan(1e-4)

    // Lying on its side (90 degrees) is handled too.
    const side: Quat = tiltZ(-Math.PI / 2)
    cup.quaternion.set(side[0], side[1], side[2], side[3])
    world.setTransform('cup', [0, 1, 0], side)
    world.update(0.01)
    renderer.update(0.01)
    if (world.container('cup')!.liters > 0.001) checkPlane()
    renderer.dispose()
  })

  it('uses the inner offset and hides the liquid when the container is empty', () => {
    const world = createFluids()
    addCup(world, 'water', 0.1)
    const scene = new THREE.Scene()
    const cup = new THREE.Group()
    scene.add(cup)
    const renderer = createFluidRenderer(THREE, { scene, fluids: world })
    renderer.bindContainer('cup', cup, { innerOffset: [0, 1, 0] })
    renderer.update(0.016)
    const [mesh] = find(cup, 'fluid_liquid')
    const ys = worldVertices(mesh).map((v) => v.y)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0.99)
    expect(Math.max(...ys)).toBeCloseTo(1 + 0.04, 2)
    world.drink('cup', 5)
    renderer.update(0.016)
    expect(mesh.visible).toBe(false)
    expect(renderer.stats().containers).toBe(0)
    renderer.dispose()
  })

  it('shows steam for a hot drink', () => {
    const world = createFluids()
    world.addContainer({ capacity: 0.25, liquid: 'coffee', liters: 0.2, temperature: 90, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 }, { id: 'cup', position: [0, 1, 0] })
    const scene = new THREE.Scene()
    const cup = new THREE.Group()
    cup.position.set(0, 1, 0)
    scene.add(cup)
    const renderer = createFluidRenderer(THREE, { scene, fluids: world, quality: 'high' })
    renderer.bindContainer('cup', cup)
    step(world, renderer, 1)
    expect(renderer.stats().particles).toBeGreaterThan(3)
    renderer.dispose()
  })
})

describe('streams and stains', () => {
  const spill = () => {
    const world = createFluids({ seed: 4 })
    world.addSurface(FLOOR)
    addCup(world, 'coffee', 0.25)
    world.setTransform('cup', [0, 1, 0], tiltZ(-Math.PI / 2))
    const scene = new THREE.Scene()
    const renderer = createFluidRenderer(THREE, { scene, fluids: world })
    return { world, scene, renderer }
  }

  it('draws the stream and creates an irregular stain mesh on the floor', () => {
    const { world, scene, renderer } = spill()
    step(world, renderer, 0.3)
    expect(renderer.stats().streams).toBeGreaterThan(0)
    expect(find(scene, 'fluid_stream').some((m) => m.visible) || find(scene, 'fluid_stream_drops').some((m) => m.visible)).toBe(true)
    step(world, renderer, 3)
    const stats = renderer.stats()
    expect(stats.stains).toBeGreaterThan(0)
    const film = find(scene, 'fluid_stain_film').find((m) => m.visible && m.parent?.visible)!
    expect(film).toBeTruthy()
    // Outline: distance of the rim vertices from the centre vertex (index 0) must not be constant.
    const pos = film.geometry.getAttribute('position')
    const centre = new THREE.Vector3().fromBufferAttribute(pos, 0)
    const radii: number[] = []
    for (let i = 1; i < pos.count; i++) radii.push(new THREE.Vector3().fromBufferAttribute(pos, i).distanceTo(centre))
    const max = Math.max(...radii)
    const min = Math.min(...radii)
    expect((max - min) / ((max + min) / 2)).toBeGreaterThan(0.08)
    // The stain lies on the floor, a hair above it.
    expect(centre.y).toBeGreaterThan(0)
    expect(centre.y).toBeLessThan(0.01)
    renderer.dispose()
  })

  it('keeps stream geometry finite and draws a thin leak as drops', () => {
    const { world, scene, renderer } = spill()
    step(world, renderer, 0.6)
    for (const m of find(scene, 'fluid_stream')) {
      const arr = m.geometry.getAttribute('position').array as Float32Array
      expect(arr.every((v) => Number.isFinite(v))).toBe(true)
    }
    const can = createFluids({ seed: 2 })
    can.addSurface(FLOOR)
    can.addContainer({ capacity: 18, liquid: 'fuel', liters: 10, shape: { kind: 'box', size: [0.3, 0.4, 0.15] }, opening: 0.02, closed: true }, { id: 'can', position: [0, 0.5, 0] })
    can.puncture('can', [0.15, 0.2, 0], [1, 0, 0], 0.003)
    const r2 = createFluidRenderer(THREE, { scene: new THREE.Scene(), fluids: can })
    step(can, r2, 1)
    expect(can.streams()[0].thin).toBe(true)
    expect(r2.stats().streams).toBe(1)
    expect(r2.stats().triangles).toBeGreaterThan(0)
    r2.dispose()
    renderer.dispose()
  })

  it('shrinks the glossy wet fan while the stain dries and keeps the mark', () => {
    const world = createFluids({ seed: 1 })
    world.addSurface(FLOOR)
    world.splash('coffee', [0, 0.01, 0], 0.1)
    const scene = new THREE.Scene()
    const renderer = createFluidRenderer(THREE, { scene, fluids: world, quality: 'low' })
    step(world, renderer, 0.5)
    const radius = (name: string) => {
      const mesh = find(scene, name).find((m) => m.visible)
      if (!mesh) return 0
      const pos = mesh.geometry.getAttribute('position')
      const c = new THREE.Vector3().fromBufferAttribute(pos, 0)
      return new THREE.Vector3().fromBufferAttribute(pos, 1).distanceTo(c)
    }
    // The wet fan relative to the whole film: it recedes from the edge in while the outline stays.
    const wetShare = () => radius('fluid_stain_wet') / radius('fluid_stain_film')
    const wetBefore = wetShare()
    for (let i = 0; i < 40; i++) {
      world.update(10)
      renderer.update(10)
    }
    expect(wetShare()).toBeLessThan(wetBefore * 0.85)
    for (let i = 0; i < 200; i++) {
      world.update(10)
      renderer.update(10)
    }
    expect(world.stains()[0].mark).toBe(true)
    expect(renderer.stats().stains).toBe(1)
    expect(find(scene, 'fluid_stain_wet').some((m) => m.visible)).toBe(false)
    renderer.dispose()
  })

  it('emits droplets on splash events', () => {
    const { world, renderer } = spill()
    step(world, renderer, 0.6)
    expect(renderer.stats().particles).toBeGreaterThan(0)
    renderer.clear()
    expect(renderer.stats().particles).toBe(0)
    expect(renderer.stats().stains).toBe(0)
    renderer.dispose()
  })

  it('respects the quality budgets', () => {
    const world = createFluids({ maxStains: 500 })
    world.addSurface(FLOOR)
    for (let i = 0; i < 100; i++) world.splash('water', [(i % 10) - 5 + 0.5, 0.01, Math.floor(i / 10) - 5 + 0.5], 0.02)
    expect(world.stains().length).toBe(100)
    const scene = new THREE.Scene()
    const low = createFluidRenderer(THREE, { scene, fluids: world, quality: 'low' })
    const high = createFluidRenderer(THREE, { scene, fluids: world, quality: 'high' })
    low.update(0.016)
    high.update(0.016)
    expect(low.stats().stains).toBe(low.stats().budget.stains)
    expect(low.stats().stains).toBeLessThan(high.stats().stains)
    expect(high.stats().stains).toBeLessThanOrEqual(high.stats().budget.stains)
    expect(low.stats().particles).toBeLessThanOrEqual(low.stats().budget.particles)
    low.dispose()
    high.dispose()
  })
})

describe('lifecycle', () => {
  it('dispose removes everything it added', () => {
    const { world, scene, renderer } = (() => {
      const world = createFluids({ seed: 4 })
      world.addSurface(FLOOR)
      addCup(world, 'coffee', 0.25)
      world.setTransform('cup', [0, 1, 0], tiltZ(-Math.PI / 2))
      const scene = new THREE.Scene()
      return { world, scene, renderer: createFluidRenderer(THREE, { scene, fluids: world }) }
    })()
    const cup = new THREE.Group()
    scene.add(cup)
    renderer.bindContainer('cup', cup)
    const childrenBefore = scene.children.length
    step(world, renderer, 3)
    expect(scene.children.length).toBe(childrenBefore) // everything lives under one root group
    expect(find(scene, 'fluid_liquid').length).toBe(1)
    expect(find(scene, 'fluid_stain').length).toBeGreaterThan(0)
    renderer.dispose()
    expect(find(scene, 'fluid_liquid')).toHaveLength(0)
    expect(find(scene, 'fluid_stain')).toHaveLength(0)
    expect(find(scene, 'fluid_stream')).toHaveLength(0)
    expect(find(scene, 'fluid_particles')).toHaveLength(0)
    expect(find(scene, 'fluid_renderer')).toHaveLength(0)
    expect(cup.children).toHaveLength(0)
    expect(scene.children).toEqual([cup])
    // The renderer no longer reacts to the world.
    expect(() => {
      world.update(0.1)
      renderer.update(0.1)
    }).not.toThrow()
    expect(renderer.stats().stains).toBe(0)
  })

  it('unbindContainer removes only that liquid', () => {
    const world = createFluids()
    addCup(world)
    const scene = new THREE.Scene()
    const cup = new THREE.Group()
    scene.add(cup)
    const renderer = createFluidRenderer(THREE, { scene, fluids: world })
    renderer.bindContainer('cup', cup)
    renderer.update(0.1)
    expect(find(cup, 'fluid_liquid')).toHaveLength(1)
    renderer.unbindContainer('cup')
    expect(cup.children).toHaveLength(0)
    renderer.dispose()
  })
})

describe('outline smoothing', () => {
  it('interpolates the front radii and keeps them positive', () => {
    const front = Array.from({ length: 16 }, (_, i) => 0.1 + (i % 2) * 0.1)
    const out = smoothOutline(front, 4)
    expect(out).toHaveLength(64)
    expect(Math.min(...out)).toBeGreaterThan(0)
    expect(out[0]).toBeCloseTo(0.1, 9)
  })
})

describe('sprites of the shared effects world', () => {
  it('puts the steam of a hot drink in the world it was lent, and does not step it', () => {
    const world = createFluids()
    world.addContainer({ capacity: 0.25, liquid: 'coffee', liters: 0.2, temperature: 90, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 }, { id: 'cup', position: [0, 1, 0] })
    const scene = new THREE.Scene()
    const cup = new THREE.Group()
    cup.position.set(0, 1, 0)
    scene.add(cup)
    const vfx = createVfx({ seed: 1 })
    const renderer = createFluidRenderer(THREE, { scene, fluids: world, quality: 'high', vfx })
    renderer.bindContainer('cup', cup)
    for (let t = 0; t < 1; t += 0.05) {
      world.update(0.05)
      renderer.update(0.05)
    }
    expect(vfx.sprites().normal.live).toBeGreaterThan(3)
    expect(vfx.time()).toBe(0)
    expect(scene.getObjectByName('vfx-sprites')).toBeUndefined()
    renderer.dispose()
  })

  it('droplets from a splash stop at the height they were thrown from', () => {
    const world = createFluids()
    const scene = new THREE.Scene()
    const vfx = createVfx({ seed: 1 })
    const renderer = createFluidRenderer(THREE, { scene, fluids: world, vfx })
    world.addSurface(FLOOR)
    world.splash('water', [0, 0.01, 0], 0.1)
    world.update(0.05)
    renderer.update(0.05)
    expect(vfx.sprites().normal.live).toBeGreaterThanOrEqual(2)
    for (let t = 0; t < 2; t += 1 / 60) vfx.update(1 / 60)
    expect(vfx.sprites().live).toBe(0)
    renderer.dispose()
  })
})

describe('sealed containers', () => {
  const sealed = (transparent: boolean): boolean => {
    const world = createFluids()
    world.addContainer({ capacity: 0.25, liquid: 'coffee', liters: 0.2, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04, closed: true }, { id: 'tin', position: [0, 1, 0] })
    const scene = new THREE.Scene()
    const tin = new THREE.Group()
    tin.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1), new THREE.MeshStandardMaterial({ transparent })))
    scene.add(tin)
    const renderer = createFluidRenderer(THREE, { scene, fluids: world })
    renderer.bindContainer('tin', tin)
    step(world, renderer, 0.1)
    return find(tin, 'fluid_liquid').some((mesh) => mesh.visible)
  }

  it('draws no liquid inside an opaque shell, where a dent would let it show through, and still draws it in a glass one', () => {
    expect(sealed(false)).toBe(false)
    expect(sealed(true)).toBe(true)
  })
})

describe('a shot can', () => {
  const shown = (opening: number, holed: boolean): boolean => {
    const world = createFluids()
    world.addContainer({ capacity: 0.36, liquid: 'soda', liters: 0.33, shape: { kind: 'cylinder', radius: 0.03, height: 0.11 }, opening, closed: false }, { id: 'can', position: [0, 1, 0] })
    const scene = new THREE.Scene()
    const can = new THREE.Group()
    can.add(new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12), new THREE.MeshStandardMaterial()))
    if (holed) {
      // a bullet hole drawn by game-destruction-three: a see-through disc on the shell
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.005), new THREE.MeshBasicMaterial({ transparent: true }))
      hole.userData.destructionDebris = true
      can.add(hole)
    }
    scene.add(can)
    const renderer = createFluidRenderer(THREE, { scene, fluids: world })
    renderer.bindContainer('can', can)
    step(world, renderer, 0.1)
    return find(can, 'fluid_liquid').some((mesh) => mesh.visible)
  }

  it('shows nothing of its soda through the tab or a bullet hole, and still shows the liquid of a wide open pot', () => {
    expect(shown(0.012, false)).toBe(false)
    expect(shown(0.012, true)).toBe(false)
    expect(shown(0.03, true)).toBe(true)
  })
})
