import { createFluids, LIQUIDS } from '@adatechnology/game-fluids'
import type { FluidWorld, Quat } from '@adatechnology/game-fluids'
import * as THREE from 'three'

import { createFluidRenderer } from '../src'

/** Every liquid of the catalog spilt from a cup onto a solid floor, caught while it pours and once the stains have spread, and two spills on the same spot: built from the catalog, so a new liquid is in it. */
type Root = THREE.Object3D
export type Case = [string, () => Root]

const FLOOR = { id: 'floor', point: [0, 0, 0] as [number, number, number], normal: [0, 1, 0] as [number, number, number], halfSize: [5, 5] as [number, number], porosity: 0.05 }
const TIPPED: Quat = [0, 0, Math.sin(-Math.PI / 4), Math.cos(-Math.PI / 4)]

function spill(liquids: readonly string[], seconds: number): Root {
  const world: FluidWorld = createFluids({ seed: 4 })
  world.addSurface(FLOOR)
  const scene = new THREE.Scene()
  const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 10), new THREE.MeshStandardMaterial())
  floor.name = 'floor'
  floor.position.y = -0.05
  scene.add(floor)
  liquids.forEach((liquid, index) => {
    const id = `cup${index}`
    world.addContainer({ capacity: 0.25, liquid, liters: 0.25, shape: { kind: 'cylinder', radius: 0.04, height: 0.1 }, opening: 0.04 }, { id, position: [index * 0.05, 1, 0] })
    world.setTransform(id, [index * 0.05, 1, 0], TIPPED)
  })
  const renderer = createFluidRenderer(THREE, { scene, fluids: world })
  for (let t = 0; t < seconds; t += 0.05) {
    world.update(0.05)
    renderer.update(0.05)
  }
  return scene
}

const ids = LIQUIDS.map((liquid) => liquid.id)

export const cases: Case[] = [
  ...ids.flatMap((liquid): Case[] => [[`${liquid}/pouring`, () => spill([liquid], 0.3)], [`${liquid}/spread`, () => spill([liquid], 4)]]),
  ['two_spills_on_one_spot', () => spill([ids[0]!, ids[1] ?? ids[0]!], 4)],
]
