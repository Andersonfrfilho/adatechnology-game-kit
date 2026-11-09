import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createFilmLcg } from '@adatechnology/game-fluids'

import { createFakeWebGl } from '../../../test-support/fake-webgl'
import { createFilmManager } from '../src'

// three r160's own WebGLRenderer on a context that draws nothing: its program cache frees a program with its last material, as in a browser
function setup() {
  const fake = createFakeWebGl()
  const renderer = new THREE.WebGLRenderer({ canvas: fake.canvas, context: fake.context })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 1.6, 4)
  const manager = createFilmManager(THREE, { scene, camera, random: createFilmLcg(7), fluids: { splash: () => undefined } as never, now: () => 0 })
  return { fake, renderer, scene, camera, manager }
}

/** A spill that makes a grid, drawn, then the area cleared (the bench's reset frees every grid). */
function spillAndClear({ renderer, scene, camera, manager }: ReturnType<typeof setup>): THREE.ShaderMaterial {
  const grid = manager.launch({ fluid: 'fuel', point: [0, 0.4, 0], radius: 5 })
  if (!grid) throw new Error('no grid')
  renderer.render(scene, camera)
  const strip = grid.group.children.find((child) => (child as THREE.Mesh).material instanceof THREE.ShaderMaterial) as THREE.Mesh
  manager.clear()
  return strip.material as THREE.ShaderMaterial
}

describe('film programs', () => {
  it('without the warm-up, every grid after a clear links the film program again', () => {
    const world = setup()
    spillAndClear(world)
    const linked = world.fake.linked()
    spillAndClear(world)
    expect(world.fake.linked()).toBeGreaterThan(linked)
  })

  it('drawn once at load, the probes keep the film programs linked: grids made and cleared in sequence link none', () => {
    const world = setup()
    const probes = world.manager.warmUpProbes()
    const group = probes.group as THREE.Object3D
    world.scene.add(group)
    world.renderer.render(world.scene, world.camera)
    world.scene.remove(group)
    probes.dispose()
    const linked = world.fake.linked()
    const first = spillAndClear(world)
    const second = spillAndClear(world)
    expect(world.fake.linked()).toBe(linked)
    // each grid still has its own material (its texture and size are uniforms of it), freed with the grid
    expect(second).not.toBe(first)
    world.manager.dispose()
  })
})
