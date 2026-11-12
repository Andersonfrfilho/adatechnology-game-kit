import * as THREE from 'three'

import { FragmentSystem } from '../src/fragments'
import type { FragmentSystemOptions } from '../src/fragments'

/**
 * Debris as it lies after a break: a dozen fragments of each shape and material falling on the same spot of a solid floor and settling,
 * where flat pieces end up on each other. The shapes come from the contract's list and the materials from the kit's broken materials.
 */
type Root = THREE.Object3D
export type Case = [string, () => Root]

const SHAPES = ['chunk', 'shard', 'splinter', 'scrap', 'slab'] as const
const MATERIALS = [['wood', 0x8a6a4a], ['concrete', 0x9a9a96], ['brick', 0xa0522d], ['glass', 0xcfe8ef], ['ceramic', 0xe8e4dc], ['steel', 0x777b80]] as const
const SIZES: Record<(typeof SHAPES)[number], [number, number, number]> = { chunk: [0.08, 0.07, 0.09], shard: [0.12, 0.004, 0.08], splinter: [0.22, 0.015, 0.02], scrap: [0.1, 0.002, 0.07], slab: [0.3, 0.03, 0.2] }

function settle(shape: (typeof SHAPES)[number], material: (typeof MATERIALS)[number]): Root {
  const scene = new THREE.Scene()
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 6), new THREE.MeshStandardMaterial())
  floor.name = 'floor'
  floor.position.y = -0.1
  scene.add(floor)
  const system = new FragmentSystem(THREE, { scene, gravity: 9.8, groundAt: () => 0, life: 0 } as unknown as FragmentSystemOptions)
  const look = system.materialFor(material[0], material[1], material[0] === 'glass')
  for (let i = 0; i < 12; i++) {
    const fragment = { id: `f${i}`, shape, center: [(i % 3) * 0.03, 0.2 + i * 0.05, Math.floor(i / 3) * 0.02], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], size: SIZES[shape], material: material[0], mass: 0.3 }
    system.spawn(fragment as never, look, 'home', 30)
  }
  for (let frame = 0; frame < 240; frame++) system.update(1 / 60)
  return scene
}

export const cases: Case[] = SHAPES.flatMap((shape) => MATERIALS.map((material): Case => [`${shape}/${material[0]}`, () => settle(shape, material)]))
