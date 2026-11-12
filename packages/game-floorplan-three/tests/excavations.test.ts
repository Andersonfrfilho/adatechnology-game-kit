import { describe, expect, it } from 'vitest'

import { createTerrain } from '@adatechnology/game-terrain'
import type { GroundExcavation } from '@adatechnology/game-contracts'

import { THREE, houseOf, planOf } from './helpers/houses'

type StagedHouse = ReturnType<typeof houseOf>['house'] & { setConstructionLevel(level: number): number; excavations(): GroundExcavation[] }

interface SunkBox { readonly u: number; readonly v: number; readonly size: number; readonly bottom: number }
interface Piece { readonly points: readonly (readonly number[])[]; readonly bore: number }

/** The house turned and moved as the houses area lays it (half a turn, off the origin), so the world frame is not the plan's. */
function placedHouse(): StagedHouse {
  const house = houseOf(planOf('single_storey_a', 1), {}, { quality: 'game', constructionStages: true, constructionLevel: 8 }).house as StagedHouse
  house.group.rotation.y = Math.PI
  house.group.position.set(6, 0, 7)
  house.group.updateMatrixWorld(true)
  return house
}

const groundOf = (excavations: readonly GroundExcavation[]) => createTerrain({ bounds: [-30, -30, 30, 30], cellSize: 0.1, layout: { surface: 'dirt', excavations } })

/** How far past a trench's edge the terrain's wall can reach: it digs from the cell an edge lies in and slopes over the next (cells of 0.1 m). */
const CELL_SLOPE = 0.21

/** Plan point to world. */
const world = (house: StagedHouse, p: readonly number[]): THREE.Vector3 => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(house.groups['stage:4:installations']!.matrixWorld)

describe('the trenches and pits of the rough-in are real holes in the terrain (game-terrain), never a drawn hole', () => {
  const house = placedHouse()
  house.setConstructionLevel(4)
  const dug = house.excavations()
  const stage = house.groups['stage:4:installations'] as THREE.Object3D
  const sewer = stage.userData.sewer as { pieces: Piece[]; boxes: SunkBox[] }
  const rain = stage.userData.rain as { pieces: Piece[]; boxes: SunkBox[] }
  const terrain = groundOf(dug)

  it('the house draws no hole of its own: no stencil, no depth cleared, no earth faces', () => {
    const fakes: string[] = []
    house.group.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      for (const m of [mesh.material].flat() as THREE.Material[]) {
        if (m.stencilWrite || /gl_FragDepth/.test((m as THREE.ShaderMaterial).fragmentShader ?? '') || m.depthFunc !== THREE.LessEqualDepth) fakes.push(mesh.name || mesh.type)
      }
      if (/^excavation:(opening|earth)/.test(mesh.name)) fakes.push(mesh.name)
    })
    expect(fakes).toEqual([])
    expect(dug.length).toBeGreaterThan(3)
  })

  it('a vertical ray over a pipe meets the pipe before the ground: the pipe lies in the open trench, on its bed', () => {
    for (const piece of [...sewer.pieces, ...rain.pieces]) {
      const a = piece.points[piece.points.length - 2]!, b = piece.points[piece.points.length - 1]!
      const mid = world(house, [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2, (a[2]! + b[2]!) / 2])
      const hit = terrain.raycast([mid.x, 2, mid.z], [0, -1, 0], 10)
      expect(hit, `ground over the pipe at ${mid.toArray()}`).not.toBeNull()
      // the ground there is under the pipe's bottom: the ray reaches the pipe first
      expect(hit!.point[1], `pipe at ${mid.toArray().map((v) => v.toFixed(2))}`).toBeLessThanOrEqual(mid.y - piece.bore / 2 + 0.01)
    }
  })

  it('each box stands in its own pit: the ground round it and under its top is dug to its floor, no earth crosses it', () => {
    for (const b of [...sewer.boxes, ...rain.boxes]) {
      const half = b.size / 2 - 0.02
      for (const [du, dv] of [[0, 0], [-half, -half], [half, -half], [-half, half], [half, half]] as const) {
        const p = world(house, [b.u + du, 0, b.v + dv])
        expect(terrain.heightAt(p.x, p.z), `box at ${b.u},${b.v}`).toBeLessThanOrEqual(b.bottom + 0.005)
      }
    }
  })

  it('a grazing ray from the yard across the trenches is stopped by the ground between them, never sees a trench through another', () => {
    const ys: number[] = []
    for (const e of dug) {
      const [x0, z0, x1, z1] = e.rect
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
      // from just under the ground in this trench, along x then along z: the first ground met is this trench's own wall or the earth beside it, never past
      // another trench's far wall
      for (const dir of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]] as const) {
        const hit = terrain.raycast([cx, -0.05, cz], dir, 30)
        if (!hit) continue
        const out = Math.abs(dir[0]) ? Math.abs(hit.point[0] - cx) : Math.abs(hit.point[2] - cz)
        const reach = Math.abs(dir[0]) ? (x1 - x0) / 2 : (z1 - z0) / 2
        const inUnion = dug.some((o) => hit.point[0] > o.rect[0] - CELL_SLOPE && hit.point[0] < o.rect[2] + CELL_SLOPE && hit.point[2] > o.rect[1] - CELL_SLOPE && hit.point[2] < o.rect[3] + CELL_SLOPE)
        // the ray stops at the hole's wall: within the dug ground (up to two cells: the one the terrain digs past the edge and the one its wall slopes in) of the trench it starts in or a trench that runs on from it
        expect(inUnion, `ray from ${cx.toFixed(2)},${cz.toFixed(2)} went to ${hit.point.map((v) => v.toFixed(2))}`).toBe(true)
        ys.push(out - reach)
      }
    }
    expect(ys.length).toBeGreaterThan(0)
  })

  it('the dug earth is heaped beside the holes, never over one: mounds that fall off to the ground, no plumb face', () => {
    let heap: THREE.Mesh | undefined
    stage.traverse((o) => { if (o.name === 'excavation:heap') heap = o as THREE.Mesh })
    expect(heap).toBeDefined()
    heap!.updateWorldMatrix(true, false)
    const position = heap!.geometry.getAttribute('position')
    const over: string[] = []
    let top = 0
    for (let i = 0; i < position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(heap!.matrixWorld)
      top = Math.max(top, p.y)
      if (dug.some((e) => p.x > e.rect[0] + 1e-3 && p.x < e.rect[2] - 1e-3 && p.z > e.rect[1] + 1e-3 && p.z < e.rect[3] - 1e-3)) over.push(p.toArray().map((v) => v.toFixed(2)).join(','))
    }
    expect(over).toEqual([])
    expect(top).toBeGreaterThan(0.1)
    // no face of it stands plumb: every side slopes (a box would show vertical faces)
    const normal = heap!.geometry.getAttribute('normal')
    let plumb = 0
    for (let i = 0; i < normal.count; i++) if (Math.abs(normal.getY(i)) < 1e-3) plumb++
    expect(plumb).toBe(0)
  })

  it('after the backfill the trenches are closed: no excavation from level 5, and the ray meets the ground again', () => {
    house.setConstructionLevel(5)
    expect(house.excavations()).toEqual([])
    const closed = groundOf(house.excavations())
    const pipe = sewer.pieces[0]!.points[1]!
    const p = world(house, pipe)
    expect(closed.raycast([p.x, 2, p.z], [0, -1, 0], 10)!.point[1]).toBeCloseTo(0, 3)
    for (const level of [0, 1, 2, 3]) {
      house.setConstructionLevel(level)
      expect(house.excavations(), `level ${level}`).toEqual([])
    }
  })
})
