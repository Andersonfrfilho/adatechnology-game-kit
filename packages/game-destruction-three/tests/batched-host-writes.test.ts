import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { Dent } from '@adatechnology/game-destruction'

import type { HostVis, MeshVis, PartVis } from '../src/internal'
import { Visuals } from '../src/visual'

const PARTS = 6

/** Six slabs in one mesh under a group, as a house joins its parts: the vertex range of each is the part that draws it. `shared` puts a second mesh in the same `Visuals`. */
const house = (shared?: Visuals, z = 0) => {
  const geometries = Array.from({ length: PARTS }, (_, i) => new THREE.BoxGeometry(1, 2, 0.2, 4, 8, 1).translate(i * 2, 1, z))
  const position: number[] = []
  const uv: number[] = []
  const index: number[] = []
  const ranges: Array<[number, number]> = []
  for (const g of geometries) {
    const base = position.length / 3
    position.push(...(g.getAttribute('position').array as Float32Array))
    uv.push(...(g.getAttribute('uv').array as Float32Array))
    for (const k of g.getIndex()!.array as Uint16Array) index.push(base + k)
    ranges.push([base, position.length / 3])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(position.length).fill(1), 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry)
  const root = new THREE.Group()
  root.add(mesh)
  root.updateMatrixWorld(true)
  const visuals = shared ?? new Visuals(THREE, false, 100)
  const hosts = new Map<THREE.Mesh, HostVis>()
  const parts = ranges.map((r) => visuals.makeMeshVis(mesh, 'house', r, hosts))
  return { visuals, mesh, root, parts, ranges, host: hosts.get(mesh)! }
}

const partOf = (meshes: MeshVis[]): PartVis => ({ id: 'p', home: 'house', material: 'concrete', meshes, charApplied: 0, glowApplied: 0, meltApplied: 0, gone: 'none' })

type Hosted = ReturnType<typeof house>

/** Counts the writes of the merged mesh (each one recomputes its normals; the host clones its geometry on the first change, so the count is on the class). */
const countWrites = (): { readonly stop: () => number } => {
  const spy = vi.spyOn(THREE.BufferGeometry.prototype, 'computeVertexNormals')
  return {
    stop: () => {
      const writes = spy.mock.calls.length
      spy.mockRestore()
      return writes
    },
  }
}

const snapshot = (h: Hosted): { position: number[]; normal: number[] } => ({
  position: Array.from(h.mesh.geometry.getAttribute('position').array as Float32Array),
  normal: Array.from(h.mesh.geometry.getAttribute('normal').array as Float32Array),
})

describe('a lot of events writes the merged mesh once per host, not once per change (spec 017)', () => {
  it('hides in two fractures inside a lot leave the same mesh as one write per hide, with fewer writes', () => {
    const each = house()
    const eachWrites = countWrites()
    for (const i of [0, 1, 2, 3]) each.visuals.hide(partOf([each.parts[i]!]), 'broken')

    const eachCount = eachWrites.stop()
    const lot = house()
    const lotWrites = countWrites()
    lot.visuals.batchRebuilds(() => {
      lot.visuals.batchRebuilds(() => [0, 1].forEach((i) => lot.visuals.hide(partOf([lot.parts[i]!]), 'broken')))
      lot.visuals.batchRebuilds(() => [2, 3].forEach((i) => lot.visuals.hide(partOf([lot.parts[i]!]), 'broken')))
    })

    const lotCount = lotWrites.stop()
    expect(snapshot(lot)).toEqual(snapshot(each))
    expect(eachCount).toBe(4)
    expect(lotCount).toBe(2)
  })

  it('a part taken out after other hides in the lot copies the normals it would have had one write per hide', () => {
    const run = (isLot: boolean): { position: number[]; normal: number[] } => {
      const h = house()
      const out = new THREE.Group()
      const work = (): void => {
        h.visuals.hide(partOf([h.parts[0]!]), 'broken')
        h.visuals.hide(partOf([h.parts[1]!]), 'broken')
        h.visuals.extract(h.parts[3]!, out)
        h.visuals.hide(partOf([h.parts[2]!]), 'broken')
      }
      if (isLot) h.visuals.batchRebuilds(work)
      else work()
      const loose = out.children[0] as THREE.Mesh
      return { position: Array.from(loose.geometry.getAttribute('position').array as Float32Array), normal: Array.from(loose.geometry.getAttribute('normal').array as Float32Array) }
    }
    expect(run(true)).toEqual(run(false))
  })
})


const FACE = new THREE.Vector3(0, 0, 1)
const DENT = { radius: 0.4, depth: 0.05 } as Dent
const decalsOf = (h: Hosted, part: number): number[][] => h.parts[part]!.decals.map((d) => [...d.obj.position.toArray(), ...d.obj.quaternion.toArray()])

describe('reads of the merged mesh inside a lot (spec 017 review)', () => {
  it('a mark on one mesh writes only that mesh: the other waits for the end of the lot, and marks and meshes equal the unbatched path', () => {
    const run = (isLot: boolean) => {
      const visuals = new Visuals(THREE, false, 100)
      const a = house(visuals, 0)
      const b = house(visuals, 10)
      const spy = countWrites()
      const work = (): void => {
        for (let i = 0; i < 4; i++) {
          visuals.hide(partOf([a.parts[i]!]), 'broken')
          visuals.hide(partOf([b.parts[i]!]), 'broken')
          visuals.addHole(a.parts[5]!, new THREE.Vector3(10, 1, 0.1), FACE, 0.05)
        }
      }
      if (isLot) visuals.batchRebuilds(work)
      else work()
      return { writes: spy.stop(), a: snapshot(a), b: snapshot(b), marks: decalsOf(a, 5) }
    }
    const lot = run(true)
    const each = run(false)
    expect(lot.a).toEqual(each.a)
    expect(lot.b).toEqual(each.b)
    expect(lot.marks).toEqual(each.marks)
    expect(lot.marks).toHaveLength(4)
    // the first write of each mesh, one write of the marked mesh per mark that follows a change, and the other mesh once at the end
    expect(lot.writes).toBe(2 + 3 + 1)
    expect(each.writes).toBe(8)
  })

  it('a write that fails neither skips the other meshes nor replaces the error the work threw', () => {
    const run = (failWork: boolean) => {
      const visuals = new Visuals(THREE, false, 100)
      const a = house(visuals, 0)
      const b = house(visuals, 10)
      let thrown: unknown
      const original = THREE.BufferGeometry.prototype.computeVertexNormals
      let failing: THREE.BufferGeometry | null = null
      const spy = vi.spyOn(THREE.BufferGeometry.prototype, 'computeVertexNormals').mockImplementation(function (this: THREE.BufferGeometry) {
        if (this === failing) throw new Error('write')
        original.call(this)
      })
      try {
        visuals.batchRebuilds(() => {
          for (const i of [0, 1]) {
            visuals.hide(partOf([a.parts[i]!]), 'broken')
            visuals.hide(partOf([b.parts[i]!]), 'broken')
          }
          failing = a.mesh.geometry
          if (failWork) throw new Error('work')
        })
      } catch (error) {
        thrown = error
      } finally {
        spy.mockRestore()
      }
      return { thrown, b: snapshot(b) }
    }
    const reference = house(undefined, 10)
    for (const i of [0, 1]) reference.visuals.hide(partOf([reference.parts[i]!]), 'broken')
    expect((run(false).thrown as Error).message).toBe('write')
    expect((run(true).thrown as Error).message).toBe('work')
    expect(run(false).b.position).toEqual(snapshot(reference).position)
  })

  it('a range the house collapses and restores straight into the array inside a lot ends as without the lot', () => {
    const run = (isLot: boolean) => {
      const h = house()
      const u = h.mesh.userData as { _p0?: Float32Array; plainPositions?: Float32Array; collapsedRanges?: Array<[number, number]> }
      const array = (): Float32Array => (h.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
      u._p0 = array().slice()
      u.plainPositions = u._p0
      let saved: Float32Array = new Float32Array(0)
      const [v0, v1] = h.ranges[4]!
      const work = (): void => {
        h.visuals.hide(partOf([h.parts[0]!]), 'broken')
        const a = array()
        saved = a.slice(v0 * 3, v1 * 3)
        ;(u.collapsedRanges ??= []).push([v0, v1])
        for (let k = v0 + 1; k < v1; k++) a.set(a.subarray(v0 * 3, v0 * 3 + 3), k * 3)
        h.visuals.hide(partOf([h.parts[1]!]), 'broken')
        h.visuals.hide(partOf([h.parts[2]!]), 'broken')
        array().set(saved, v0 * 3)
        u.collapsedRanges = u.collapsedRanges.filter((r) => r[0] !== v0)
        h.visuals.hide(partOf([h.parts[3]!]), 'broken')
      }
      if (isLot) h.visuals.batchRebuilds(work)
      else work()
      return snapshot(h)
    }
    expect(run(true)).toEqual(run(false))
  })

  it('a part taken out after a dent and a melt, with other parts collapsing in the lot, has the same positions, normals, uv and colour', () => {
    const run = (isLot: boolean) => {
      const h = house()
      const out = new THREE.Group()
      const work = (): void => {
        h.visuals.hide(partOf([h.parts[0]!]), 'broken')
        h.visuals.applyDent(h.parts[3]!, new THREE.Vector3(6, 1, 0.1), new THREE.Vector3(0, 0, -1), DENT)
        h.visuals.hide(partOf([h.parts[1]!]), 'broken')
        h.visuals.setMelt(partOf([h.parts[3]!]), 0.5)
        h.visuals.hide(partOf([h.parts[2]!]), 'broken')
        h.visuals.extract(h.parts[3]!, out)
      }
      if (isLot) h.visuals.batchRebuilds(work)
      else work()
      const geometry = (out.children[0] as THREE.Mesh).geometry
      const read = (name: string): number[] => Array.from(geometry.getAttribute(name).array as Float32Array)
      return { position: read('position'), normal: read('normal'), uv: read('uv'), color: read('color'), host: snapshot(h) }
    }
    expect(run(true)).toEqual(run(false))
  })
})
