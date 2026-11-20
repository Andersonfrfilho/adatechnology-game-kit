import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { HostVis, MeshVis, PartVis } from '../src/internal'
import { Visuals } from '../src/visual'

const PARTS = 6

/** Six slabs in one mesh under a group, as a house joins its parts: the vertex range of each is the part that draws it. */
const house = () => {
  const geometries = Array.from({ length: PARTS }, (_, i) => new THREE.BoxGeometry(1, 2, 0.2, 4, 8, 1).translate(i * 2, 1, 0))
  const position: number[] = []
  const index: number[] = []
  const ranges: Array<[number, number]> = []
  for (const g of geometries) {
    const base = position.length / 3
    position.push(...(g.getAttribute('position').array as Float32Array))
    for (const k of g.getIndex()!.array as Uint16Array) index.push(base + k)
    ranges.push([base, position.length / 3])
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry)
  const root = new THREE.Group()
  root.add(mesh)
  root.updateMatrixWorld(true)
  const visuals = new Visuals(THREE, false, 100)
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

