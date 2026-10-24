import { describeScene } from '@adatechnology/golden-tool'
import { describe, expect, it } from 'vitest'

import type { House } from '../src'
import { houseOf, planOf } from './helpers/houses'

// Walls, doors, windows, floors, slabs and stairs of the house: what the first slice of the port draws, checked on the plans of the team's pairs.
/** Where each piece of the structure sits in the merged meshes: id -> ranges `{ mesh, v0, v1, i0, i1 }` (the meshes carry them in `userData.ranges`). */
function rangesOf(house: House): Map<string, { mesh: any; v0: number; v1: number; i0: number; i1: number }[]> {
  const out = new Map<string, { mesh: any; v0: number; v1: number; i0: number; i1: number }[]>()
  house.group.traverse((node: any) => {
    for (const r of node.userData?.ranges ?? []) out.set(r.id, [...(out.get(r.id) ?? []), { mesh: node, v0: r.v0, v1: r.v1, i0: r.i0, i1: r.i1 }])
  })
  return out
}

const PAIRS: [string, number][] = [['casaA', 3], ['sobrado', 3], ['apartamento', 1], ['media_terrea_moderna', 3], ['mercado', 3], ['farmacia', 2]]

describe('walls, doors, windows, floors and stairs', () => {
  for (const [template, seed] of PAIRS) {
    describe(`${template} ${seed}`, () => {
      const plan = planOf(template, seed)
      const { house } = houseOf(plan)

      it('has a group for each floor and one mesh per material in it', () => {
        expect(house.floors).toHaveLength(plan.floors.length)
        house.floors.forEach((floor, index) => {
          expect(house.groups[`f${index}`]).toBe(floor)
          expect(floor.children.length).toBeGreaterThan(5)
        })
        expect(house.r.floors.map((f: any) => f.index)).toEqual(plan.floors.map((f: any) => f.index))
      })

      it('draws every door of the plan, with the id of the plan', () => {
        expect(house.doors.map((d) => d.id)).toEqual(plan.doors.map((d: any) => d.id))
        for (const door of house.doors) {
          expect(door.open).toBe(false)
          expect(door.floor).toBeGreaterThanOrEqual(0)
          expect(house.parts[`door:${door.id}`]).toBeTruthy()
        }
      })

      it('gives every piece of a merged mesh a range of its own, inside the mesh', () => {
        const ranges = rangesOf(house)
        expect(ranges.size).toBeGreaterThan(3)
        // the frames of the doors and windows are pieces of the mesh from the start
        for (const door of house.doors) expect(ranges.get(`jamb:${door.id}`)?.length, door.id).toBeGreaterThan(0)
        // every range sits inside its mesh and the ranges of one mesh never overlap: a piece that disappears takes nothing of another
        const byMesh = new Map<any, { v0: number; v1: number; i0: number; i1: number }[]>()
        for (const list of ranges.values()) for (const r of list) byMesh.set(r.mesh, [...(byMesh.get(r.mesh) ?? []), r])
        for (const [mesh, list] of byMesh) {
          const count = mesh.geometry.attributes.position.count
          const sorted = [...list].sort((x, y) => x.v0 - y.v0)
          sorted.forEach((r, i) => {
            expect(r.v1, mesh.name).toBeGreaterThan(r.v0)
            expect(r.v1).toBeLessThanOrEqual(count)
            expect(r.i1).toBeGreaterThan(r.i0)
            if (i > 0) expect(r.v0).toBeGreaterThanOrEqual(sorted[i - 1]!.v1)
          })
        }
      })

      it('has a slab for every floor above the ground, at the level of the floor', () => {
        const ranges = rangesOf(house)
        const slabs = plan.structure.parts.filter((p: any) => p.role === 'slab')
        for (const floor of plan.floors.filter((f: any) => f.index > 0)) {
          const slab = slabs.find((s: any) => s.floor === floor.index && Math.abs(s.y1 - floor.y0) < 0.1)
          expect(slab, `floor ${floor.index}`).toBeTruthy()
          expect(ranges.get(slab.id)?.length, slab.id).toBeGreaterThan(0)
        }
      })

      it('puts a stair between floors only when the plan has more than one', () => {
        if (plan.floors.length < 2) expect(house.stairs).toHaveLength(0)
        else {
          expect(house.stairs.length).toBeGreaterThan(0)
          for (const stair of house.stairs) {
            expect(stair.to).not.toBe(stair.f)
            const [x0, z0, x1, z1] = stair.rect
            expect(x1).toBeGreaterThan(x0)
            expect(z1).toBeGreaterThan(z0)
          }
        }
      })

      it('draws the same scene when built again (nothing depends on the order of builds)', () => {
        const again = houseOf(plan).house
        expect(describeScene(again.group, { ignoreNames: true })).toEqual(describeScene(house.group, { ignoreNames: true }))
      })
    })
  }

  it('draws a window for every window of the plan', () => {
    const plan = planOf('sobrado', 3)
    const { house } = houseOf(plan)
    const glass = new Set<string>()
    house.floors.forEach((floor) => floor.traverse((node: any) => { if (node.isMesh && /glass/.test(node.name)) glass.add(node.name) }))
    expect(glass.size).toBeGreaterThan(0)
    expect(plan.windows.length).toBeGreaterThan(0)
  })
})
