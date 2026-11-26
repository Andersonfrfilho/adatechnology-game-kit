import { describe, expect, it } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'

import { groundLayoutOfPlans } from '../src/lot/ground-layout'
import { THREE, houseOf, planOf } from './helpers/houses'

/** PG-7V (RPG-7) on the ground: 0.45 kg of TNT, 200 kJ on the arsenal's scale. */
const PG7V = { energy: 200_000, tnt: 0.45, hasCharge: true, radius: 16 } as const

/** The flat meshes of the house that lie over a point the crater took down: a bottom more than 10 cm over the ground there, with the ground 20 cm or more under where it was. */
function hangingOver(group: THREE.Object3D, groundAt: (x: number, z: number) => number, crater: { readonly x: number; readonly z: number; readonly radius: number }): string[] {
  group.updateMatrixWorld(true)
  const out: string[] = []
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.visible) return
    const box = new THREE.Box3().setFromObject(mesh)
    // a pad or a path on the ground: thin, its bottom on the ground's plane
    if (box.max.y - box.min.y > 0.1 || Math.abs(box.min.y) > 0.1) return
    for (let i = 0; i <= 8; i++) for (let k = 0; k <= 8; k++) {
      const x = crater.x + ((i - 4) / 4) * crater.radius * 0.5, z = crater.z + ((k - 4) / 4) * crater.radius * 0.5
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue
      const ground = groundAt(x, z)
      if (ground < -0.2 && box.min.y - ground > 0.1) return void out.push(`${o.parent?.name ?? ''}/${o.name}`)
    }
  })
  return out
}

describe('nothing of the lot hangs over a crater in the ground the host lays (CLAUDE.md §12)', () => {
  const plan = planOf('single_storey_a', 1)
  const path = (plan as { lot?: { paths?: { rects: number[][] }[] } }).lot?.paths?.[0]?.rects[0] as [number, number, number, number]
  const crater = { x: (path[0] + path[2]) / 2, z: (path[1] + path[3]) / 2, radius: 0.8 }
  const dug = (): ReturnType<typeof createTerrain> => {
    const terrain = createTerrain({ bounds: [-30, -30, 40, 40], cellSize: 0.1, layout: groundLayoutOfPlans([{ plan }]) })
    // the first rocket throws the pavers off their sand bed (a floor of separate pieces), the next ones dig the soil under them
    for (let k = 0; k < 3; k++) terrain.applyHit({ type: 'explosive', point: [crater.x, terrain.heightAt(crater.x, crater.z), crater.z], ...PG7V })
    return terrain
  }

  it('the path from the gate is the terrain\'s own paving: three RPGs on it leave no slab of the house over the hole', () => {
    const terrain = dug()
    expect(terrain.columnAt(crater.x, crater.z).depth).toBeGreaterThan(0.3)
    const { house } = houseOf(plan, {}, { quality: 'game', terrain: false, groundSurfaces: false })
    house.show({ floor: -1, cut: false, lot: true })
    expect(hangingOver(house.group, (x, z) => terrain.heightAt(x, z), crater)).toEqual([])
  })

  it('a house that lays its own ground still draws its path (the default)', () => {
    const terrain = dug()
    const { house } = houseOf(plan, {}, { quality: 'game', terrain: false })
    house.show({ floor: -1, cut: false, lot: true })
    expect(hangingOver(house.group, (x, z) => terrain.heightAt(x, z), crater).length).toBeGreaterThan(0)
  })
})
