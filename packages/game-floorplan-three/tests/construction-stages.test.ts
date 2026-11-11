import { describe, expect, it } from 'vitest'

import { checkConstructionStages } from '../src'
import { coplanarOverlaps } from '../src/construction-stages/coplanar'
import { THREE, houseOf, planOf } from './helpers/houses'

type StagedHouse = ReturnType<typeof houseOf>['house'] & { setConstructionLevel(level: number, options?: { waterLayer?: boolean; roofLayer?: boolean; lotLayer?: boolean }): number }

const staged = (template = 'single_storey_a', seed = 1): StagedHouse => houseOf(planOf(template, seed), {}, { quality: 'game', constructionStages: true, constructionLevel: 8 }).house as StagedHouse

const STAGE_GROUPS = ['stage:1:foundation', 'stage:1:starter_bars', 'stage:2:frame', 'stage:3:masonry', 'stage:4:installations', 'stage:7:roof_framing']
const partOf = (o: THREE.Object3D): string => String(o.userData.structurePartId ?? '')
const visibleIn = (o: THREE.Object3D): boolean => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/** Construction tests of the construction stages (CLAUDE.md §11): what each stage draws stands on what is under it, and no two of its faces fight. */
describe('construction stages of single_storey_a', () => {
  const house = staged()
  const group = (name: string): THREE.Object3D => house.groups[name] as THREE.Object3D
  const boxOf = (o: THREE.Object3D): THREE.Box3 => new THREE.Box3().setFromObject(o)

  it('draws no two faces of different materials on the same plane, at any level, in the bare structure or against the house', () => {
    for (const level of [1, 2, 3, 4, 5, 6, 7, 8]) {
      house.setConstructionLevel(level, { roofLayer: true, lotLayer: false })
      const overlaps = coplanarOverlaps(THREE, house.group, {
        keep: (mesh) => {
          for (let p: THREE.Object3D | null = mesh; p; p = p.parent) if (STAGE_GROUPS.includes(p.name)) return true
          return false
        },
      })
      expect(overlaps.map((o) => `level ${level}: ${o.a.name || partOf(o.a)} / ${o.b.name || partOf(o.b)} ${o.area.toFixed(3)} m² at ${o.at.toArray().map((v) => v.toFixed(2))} facing ${o.normal.toArray().map((v) => v.toFixed(2))}`)).toEqual([])
    }
  })

  it('casts lintels and sills with the masonry: none of them hangs in the frame stage', () => {
    house.setConstructionLevel(2)
    const frameLintels = group('stage:2:frame').children.filter((c) => /lintel|sillbeam/.test(partOf(c)))
    expect(frameLintels.map(partOf)).toEqual([])
    const masonryLintels = group('stage:3:masonry').children.filter((c) => /lintel|sillbeam/.test(partOf(c)))
    expect(masonryLintels.length).toBeGreaterThan(5)
  })

  it('stands every pillar on the foundation and seats every beam and pillar under a slab into it', () => {
    const frame = group('stage:2:frame')
    const foundation = group('stage:1:foundation')
    const slabs = frame.children.filter((c) => /_p\d+$|outbuilding_slab$/.test(partOf(c))).map(boxOf)
    expect(slabs.length).toBeGreaterThan(0)
    for (const c of frame.children) {
      const id = partOf(c)
      const b = boxOf(c)
      if (/column/.test(id) && !id.startsWith('tank_')) {
        expect(b.min.y, id).toBeLessThan(0.01)
        const footing = foundation.children.some((f) => {
          const fb = boxOf(f)
          return fb.max.y >= -0.001 && fb.min.y < 0 && fb.min.x < b.max.x && fb.max.x > b.min.x && fb.min.z < b.max.z && fb.max.z > b.min.z
        })
        expect(footing, `${id} on a footing or ground beam`).toBe(true)
      }
      if (/_p\d+$|outbuilding_slab$/.test(id)) continue
      for (const s of slabs) {
        const under = s.min.x < b.max.x - 1e-3 && s.max.x > b.min.x + 1e-3 && s.min.z < b.max.z - 1e-3 && s.max.z > b.min.z + 1e-3 && b.max.y > s.min.y - 0.05 && b.min.y < s.min.y
        if (!under) continue
        // seated: it reaches into the slab, short of its top
        expect(b.max.y, `${id} under the slab`).toBeGreaterThan(s.min.y)
        expect(b.max.y, `${id} under the slab`).toBeLessThan(s.max.y - 0.02)
      }
    }
  })

  it('gives the outbuilding its slab from the frame stage on, over its bond beams, and its window openings in the masonry', () => {
    for (const level of [2, 3, 4]) {
      house.setConstructionLevel(level)
      const slab = group('stage:2:frame').children.find((c) => partOf(c) === 'backyard.outbuilding_slab')
      expect(slab && visibleIn(slab), `level ${level}`).toBe(true)
    }
    const slab = boxOf(group('stage:2:frame').children.find((c) => partOf(c) === 'backyard.outbuilding_slab')!)
    const beams = group('stage:2:frame').children.filter((c) => /outbuilding_bond_beam/.test(partOf(c))).map(boxOf)
    expect(beams).toHaveLength(4)
    for (const b of beams) {
      expect(b.max.y).toBeGreaterThan(slab.min.y)
      expect(b.max.y).toBeLessThan(slab.max.y)
      expect(slab.min.x).toBeLessThanOrEqual(b.min.x + 1e-4)
      expect(slab.max.x).toBeGreaterThanOrEqual(b.max.x - 1e-4)
    }
    expect(group('stage:3:masonry').children.filter((c) => /outbuilding\.w\d_lintel/.test(partOf(c)))).toHaveLength(2)
  })

  it('lays the sewer, its boxes and its trenches under the ground', () => {
    const sewer = group('stage:4:installations').userData.sewer as { pieces: { points: number[][]; bore: number }[]; boxes: { bottom: number }[] }
    expect(sewer.pieces.length).toBeGreaterThan(3)
    for (const b of sewer.boxes) expect(b.bottom).toBeLessThan(-0.3)
    group('stage:4:installations').traverse((o) => {
      if (!(o as THREE.Mesh).isMesh || o.name === 'excavation:heap' || o.name === 'excavation:opening') return
      // a box's lid is flush with the ground (under a centimetre over it); everything else is under it
      expect(boxOf(o).max.y, o.name || o.type).toBeLessThanOrEqual(o.name === 'sewer:lid' ? 0.01 : 0.0001)
    })
  })

  it('lays each pipe and conduit once, in the same place at every level, inside walls or over the ceiling slab, and shows it cut into the masonry only in the rough-in', () => {
    const runs: THREE.Object3D[] = []
    house.group.traverse((o) => {
      if ((o.userData.part === 'wall_pipe' || o.userData.part === 'wall_conduit') && o.userData.pivot === true) runs.push(o)
    })
    expect(runs.filter((o) => o.userData.part === 'wall_pipe').length).toBeGreaterThan(1)
    expect(new Set(runs.map((o) => o.userData.id)).size).toBe(runs.length)
    const snapshot = (): string[] => runs.map((o) => `${o.uuid} ${boxOf(o).min.toArray().map((v) => v.toFixed(3))} ${boxOf(o).max.toArray().map((v) => v.toFixed(3))}`)
    house.setConstructionLevel(4)
    const at4 = snapshot()
    for (const o of runs) expect(visibleIn(o), `${o.userData.id} at level 4`).toBe(true)
    for (const level of [5, 6, 7, 8]) {
      house.setConstructionLevel(level)
      expect(snapshot(), `level ${level}`).toEqual(at4)
      for (const o of runs) expect(visibleIn(o), `${o.userData.id} hidden in the plaster at level ${level}`).toBe(false)
    }
    // the stage group adds only the sewer: no water pipe nor conduit of its own
    expect(group('stage:4:installations').children.filter((c) => /water|conduit/.test(c.name))).toEqual([])
    const plan = planOf('single_storey_a', 1) as unknown as { walls: { floor: number; axis: string; u0: number; v0: number; u1: number; v1: number }[]; floors: { ceiling: number }[] }
    const ceiling = plan.floors[0]!.ceiling
    for (const o of runs) {
      for (const route of (o.userData.routes as number[][][] | undefined) ?? []) {
        for (let i = 0; i + 1 < route.length; i++) {
          const a = route[i]!, b = route[i + 1]!
          if (a[1]! >= ceiling - 1e-6 && b[1]! >= ceiling - 1e-6) continue // over the ceiling slab
          const mid = [(a[0]! + b[0]!) / 2, (a[2]! + b[2]!) / 2]
          const inWall = plan.walls.some((w) => (w.axis === 'u' ? Math.abs(mid[1]! - w.v0) < 0.1 && mid[0]! >= w.u0 - 0.1 && mid[0]! <= w.u1 + 0.1 : Math.abs(mid[0]! - w.u0) < 0.1 && mid[1]! >= w.v0 - 0.1 && mid[1]! <= w.v1 + 0.1))
          expect(inWall, `${o.userData.id} segment ${a} -> ${b} inside a wall`).toBe(true)
        }
      }
    }
  })

  it('never shows what is hidden by default (a tap\'s water, a lamp that is off) when its stage comes in', () => {
    house.setConstructionLevel(8)
    const shown: string[] = []
    house.group.traverse((o) => {
      if (o.userData.hidden === true && o.userData.part !== 'wall_pipe' && visibleIn(o)) shown.push(String(o.userData.part))
    })
    expect(shown).toEqual([])
  })

  it('puts the timber frame up at level 7, under where the tiles go, and the tiles at level 8', () => {
    house.setConstructionLevel(7)
    expect(visibleIn(group('stage:7:roof_framing'))).toBe(true)
    expect(group('roof').visible).toBe(false)
    house.setConstructionLevel(8)
    expect(group('roof').visible).toBe(true)
    const tiles: THREE.Object3D[] = []
    group('roof').traverse((o) => (o as THREE.Mesh).isMesh && tiles.push(o))
    const ray = new THREE.Raycaster()
    const framing = group('stage:7:roof_framing')
    framing.updateMatrixWorld(true)
    let checked = 0
    framing.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const position = mesh.geometry.getAttribute('position')
      for (let i = 0; i < position.count; i += 7) {
        const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld)
        ray.set(new THREE.Vector3(p.x, p.y + 20, p.z), new THREE.Vector3(0, -1, 0))
        const hit = ray.intersectObjects(tiles, false).find((h) => h.point.y > p.y - 1)
        if (!hit) continue
        expect(hit.point.y, `timber at ${p.toArray().map((v) => v.toFixed(2))}`).toBeGreaterThan(p.y)
        checked++
      }
    })
    expect(checked).toBeGreaterThan(50)
  })
})

describe('the water tank of a house with a pitched roof', () => {
  for (const [template, seeds] of [['single_storey_a', [1, 2, 3, 4, 5]], ['townhouse', [1, 2, 3]], ['mid_modern_single_storey', [1, 2, 3]]] as const) {
    for (const seed of seeds) {
      it(`${template} #${seed}: stands under the tiles, its lid clear of them`, () => {
        const plan = planOf(template, seed) as unknown as { waterTank: { place: string; u: number; v: number; w: number; d: number; y: number; h: number } | null }
        const tank = plan.waterTank
        if (!tank || (tank.place !== 'raised_slab' && tank.place !== 'attic')) return
        const { house } = houseOf(planOf(template, seed), {}, { quality: 'game' })
        const roof = house.groups.roof as THREE.Object3D
        roof.updateMatrixWorld(true)
        const ray = new THREE.Raycaster()
        // the renderer stands an attic tank on the ceiling (0.2 m over the plan's slab height); its lid is 0.12 m over the body
        const top = tank.y + (tank.place === 'attic' ? 0.2 : 0) + tank.h + 0.12
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]] as const) {
          const x = tank.u + (a * tank.w) / 2, z = tank.v + (b * tank.d) / 2
          ray.set(new THREE.Vector3(x, 30, z).applyMatrix4(house.house.matrixWorld), new THREE.Vector3(0, -1, 0))
          const hit = ray.intersectObject(roof, true)[0]
          expect(hit, `roof over ${x.toFixed(2)},${z.toFixed(2)}`).toBeDefined()
          // a platform leaves a hand over the lid; an attic tank under a low fibre-cement roof only stays under it (the platform did not fit)
          expect(hit!.point.y, `roof over the tank's corner ${a},${b}`).toBeGreaterThan(top + (tank.place === 'attic' ? 0 : 0.15))
        }
      })
    }
  }
})

/** The same construction tests on every typology of the packs, a few seeds each (the test room's scenario runs them on what the page registered). */
describe('construction stages of every typology', () => {
  const TEMPLATES = ['single_storey_a', 'townhouse', 'budget_slab_house', 'budget_semi_detached', 'mid_modern_single_storey', 'mid_modern_townhouse', 'high_end_contemporary', 'mansion', 'apartment_basic', 'apartment_modern', 'market', 'pharmacy']
  for (const template of TEMPLATES) {
    for (const seed of [1, 2, 3]) {
      it(`${template} #${seed}`, () => {
        const house = staged(template, seed)
        const problems = checkConstructionStages(THREE, house)
        expect(problems.map((p) => `${p.code} @${p.level}: ${p.detail}`).slice(0, 12)).toEqual([])
        house.dispose()
      })
    }
  }
})
