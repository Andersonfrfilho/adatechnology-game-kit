import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import type { Dent } from '@adatechnology/game-destruction'
import type { BodyDesc, BodyId, Material, SeamWorld } from '@adatechnology/game-physics'
import { markPositionsWritten } from '@adatechnology/game-shapes-three'

import { drawnSolidsOf } from '../src/drawn-solids'
import type { MeasureBudget } from '../src/drawn-solids'
import { EngineStatics } from '../src/engine-statics'
import type { StaticSolid } from '../src/engine-statics'
import type { HostVis, MeshVis, PartVis } from '../src/internal'
import { showCollapsedRanges, Visuals } from '../src/visual'

const DENT: Dent = { radius: 0.4, depth: 0.05 } as Dent
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

/** Measures every part; `budget.left` says how many vertices were measured from scratch. */
const measure = (visuals: Visuals, parts: readonly MeshVis[]): { solids: StaticSolid[][]; budget: MeasureBudget } => {
  const budget: MeasureBudget = { left: 1e9, incomplete: false }
  return { solids: parts.map((mv, k) => drawnSolidsOf(THREE, visuals, mv, `p${k}`, budget)), budget }
}

/** The vertices measured from scratch in the last `measure` (one part costs its vertices and 24). */
const spent = (budget: MeasureBudget): number => 1e9 - budget.left

/** An array that counts the reads of its elements. */
const counting = (array: Float32Array): { array: Float32Array; reads: () => number } => {
  let reads = 0
  const proxy = new Proxy(array, {
    get(target, key) {
      if (typeof key === 'string' && /^\d+$/.test(key)) reads++
      const value = Reflect.get(target, key, target) as unknown
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
  return { array: proxy, reads: () => reads }
}

const partOf = (meshes: MeshVis[]): PartVis => ({ id: 'p', home: 'house', material: 'concrete', meshes, charApplied: 0, glowApplied: 0, meltApplied: 0, gone: 'none' })

/** What the house does to a wall it draws with holes (`collapseRange` of game-floorplan-three): the range collapsed to its first vertex, listed, the first positions kept. */
const collapseLikeTheHouse = (mesh: THREE.Mesh, v0: number, v1: number): Float32Array => {
  const a = (mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
  const u = mesh.userData as { _p0?: Float32Array; plainPositions?: Float32Array; collapsedRanges?: Array<[number, number]> }
  u._p0 ??= a.slice()
  u.plainPositions ??= u._p0
  ;(u.collapsedRanges ??= []).push([v0, v1])
  const saved = a.slice(v0 * 3, v1 * 3)
  for (let k = v0 + 1; k < v1; k++) a.set(a.subarray(v0 * 3, v0 * 3 + 3), k * 3)
  markPositionsWritten(mesh, v0, v1)
  return saved
}

/** And what it does to draw the wall whole again (`restoreRange`). */
const restoreLikeTheHouse = (mesh: THREE.Mesh, v0: number, saved: Float32Array): void => {
  ;((mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array).set(saved, v0 * 3)
  markPositionsWritten(mesh, v0, v0 + saved.length / 3)
  const u = mesh.userData as { collapsedRanges?: Array<[number, number]> }
  u.collapsedRanges = (u.collapsedRanges ?? []).filter((r) => r[0] !== v0)
}

const front = (x: number): THREE.Vector3 => new THREE.Vector3(x, 1, 0.1)
const inward = new THREE.Vector3(0, 0, -1)

describe('a part is measured again exactly when its positions were written', () => {
  it('an unchanged house reads no vertex: the versions say it is the same (a house touched by a dent, and one never touched)', () => {
    for (const touched of [true, false]) {
      const h = house()
      if (touched) h.visuals.applyDent(h.parts[0]!, front(0), inward, DENT)
      measure(h.visuals, h.parts)
      const watched = counting((touched ? h.host.work : (h.mesh.geometry.getAttribute('position').array as Float32Array))!)
      if (touched) h.host.work = watched.array
      else (h.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array = watched.array
      const again = measure(h.visuals, h.parts)
      expect(watched.reads()).toBe(0)
      expect(spent(again.budget)).toBe(0)
    }
  })

  it('a dent: only the dented part is measured again, and its collider follows the dent', () => {
    const h = house()
    const first = measure(h.visuals, h.parts)
    h.visuals.applyDent(h.parts[2]!, front(4), inward, DENT)
    const after = measure(h.visuals, h.parts)
    // the house is owned now (its positions copied once): the parts whose vertices did not change are not measured again
    expect(spent(after.budget)).toBe(h.ranges[2]![1] - h.ranges[2]![0] + 24)
    expect(after.solids[2]).not.toBe(first.solids[2])
    expect(after.solids[0]).toBe(first.solids[0])
    // the dent pushes the face in: the part is no box any more, its triangles hold the dent
    expect(after.solids[2]![0]!.mesh).toBeDefined()
  })

  it('a bend, a settlement (written now or at commit), a melt, a hide and a restore each measure the part again', () => {
    const h = house()
    h.visuals.applyDent(h.parts[5]!, front(10), inward, DENT)
    let last = measure(h.visuals, h.parts).solids
    const writers: Array<[string, () => void, number]> = [
      ['bend', () => h.visuals.applyBend(h.parts[1]!, new THREE.Vector3(2, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.5), 1],
      ['sink', () => h.visuals.sink(h.parts[3]!, () => 0.3), 3],
      ['sink before its commit', () => h.visuals.sink(h.parts[4]!, (p) => 0.1 * p.x, false), 4],
      ['melt', () => h.visuals.setMelt(partOf([h.parts[0]!]), 0.5), 0],
      ['hide', () => h.visuals.hide(partOf([h.parts[2]!]), 'broken'), 2],
      ['restore', () => h.visuals.restorePart(partOf([h.parts[3]!])), 3],
    ]
    for (const [name, write, part] of writers) {
      const before = h.parts[part]!.shapeVersion
      write()
      expect(h.parts[part]!.shapeVersion, name).toBeGreaterThan(before)
      const now = measure(h.visuals, h.parts)
      expect(spent(now.budget), name).toBe(h.ranges[part]![1] - h.ranges[part]![0] + 24)
      for (let k = 0; k < PARTS; k++) if (k !== part) expect(now.solids[k], `${name}: part ${k}`).toBe(last[k])
      last = now.solids
    }
    // what moved is where the colliders are: the settled part went down 0.3 m, then back up when restored
    const fresh = house()
    fresh.visuals.sink(fresh.parts[3]!, () => 0.3)
    expect(measure(fresh.visuals, fresh.parts).solids[3]![0]!.center[1]).toBeCloseTo(0.7, 5)
    fresh.visuals.restorePart(partOf([fresh.parts[3]!]))
    expect(measure(fresh.visuals, fresh.parts).solids[3]![0]!.center[1]).toBeCloseTo(1, 5)
  })

  it('a part split off (extract) has a new source, and the parts left in the mesh are not measured again', () => {
    const h = house()
    measure(h.visuals, h.parts)
    const group = new THREE.Group()
    const before = h.parts[1]!.shapeVersion
    h.visuals.extract(h.parts[1]!, group)
    expect(h.parts[1]!.shapeVersion).toBeGreaterThan(before)
    expect(h.parts[1]!.host).not.toBe(h.host)
    const rest = [0, 2, 3, 4, 5].map((k) => h.parts[k]!)
    expect(spent(measure(h.visuals, rest).budget)).toBe(0)
  })

  it('a range the house collapses itself (a wall drawn with holes) and declares: only that part is measured again, and it has no collider', () => {
    const h = house()
    const first = measure(h.visuals, h.parts)
    const [v0, v1] = h.ranges[3]!
    const pos = h.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = pos.array as Float32Array
    for (let k = v0; k < v1; k++) a.set(a.subarray(v0 * 3, v0 * 3 + 3), k * 3)
    markPositionsWritten(h.mesh, v0, v1)
    const after = measure(h.visuals, h.parts)
    expect(spent(after.budget)).toBe(v1 - v0 + 24)
    expect(after.solids[3]).toEqual([])
    expect(after.solids[0]).toBe(first.solids[0])
  })

  it('a write that flags `needsUpdate` but declares no range measures every part again, and the changed one follows', () => {
    const h = house()
    measure(h.visuals, h.parts)
    const [v0, v1] = h.ranges[4]!
    const pos = h.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = pos.array as Float32Array
    for (let i = v0 * 3; i < v1 * 3; i += 3) a[i + 1] += 0.5
    pos.needsUpdate = true
    const after = measure(h.visuals, h.parts)
    expect(spent(after.budget)).toBe(PARTS * 24 + (h.ranges[PARTS - 1]![1] - h.ranges[0]![0]))
    expect(after.solids[4]![0]!.center[1]).toBeCloseTo(1.5, 5)
  })

  it('the old blind spot: every vertex moved along (3, -1, 0) t keeps x + 3y + 7z (the checksum), and the move is seen', () => {
    const h = house()
    const first = measure(h.visuals, h.parts)
    const [v0, v1] = h.ranges[2]!
    const pos = h.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const a = pos.array as Float32Array
    const checksum = (): [number, number] => {
      let sum = 0
      let spread = 0
      for (let i = v0 * 3; i < v1 * 3; i += 3) {
        const s = a[i]! + 3 * a[i + 1]! + 7 * a[i + 2]!
        sum += s
        spread += s * s
      }
      return [sum, spread]
    }
    const was = checksum()
    const t = 0.25
    for (let i = v0 * 3; i < v1 * 3; i += 3) {
      a[i] += 3 * t
      a[i + 1] -= t
    }
    markPositionsWritten(h.mesh, v0, v1)
    const now = checksum()
    expect(now[0]).toBeCloseTo(was[0], 3)
    expect(now[1]).toBeCloseTo(was[1], 3)
    const after = measure(h.visuals, h.parts).solids[2]![0]!
    expect(after.center[0]).toBeCloseTo(first.solids[2]![0]!.center[0] + 3 * t, 5)
    expect(after.center[1]).toBeCloseTo(first.solids[2]![0]!.center[1] - t, 5)
  })

  it('a range the house keeps collapsed (a wall it draws with holes) has no collider, before and after the renderer owns the mesh, and again once drawn back', () => {
    const h = house()
    const [v0, v1] = h.ranges[1]!
    const saved = collapseLikeTheHouse(h.mesh, v0, v1)
    const first = measure(h.visuals, h.parts)
    expect(first.solids[1]).toEqual([])
    // the first dent owns the house: its work starts from the first positions (`_p0`), where the wall is whole, but it is drawn collapsed: still nothing collides there
    h.visuals.applyDent(h.parts[4]!, front(8), inward, DENT)
    const owned = measure(h.visuals, h.parts)
    expect(spent(owned.budget)).toBe(v1 - v0 + 24 + h.ranges[4]![1] - h.ranges[4]![0] + 24)
    expect(owned.solids[1]).toEqual([])
    expect(spent(measure(h.visuals, h.parts).budget)).toBe(0)
    // drawn whole again: only that part is measured, and it collides again
    restoreLikeTheHouse(h.mesh, v0, saved)
    const back = measure(h.visuals, h.parts)
    expect(spent(back.budget)).toBe(v1 - v0 + 24)
    expect(back.solids[1]).toHaveLength(1)
    // and collapsed again after the renderer owns it: only that part, and no collider
    collapseLikeTheHouse(h.mesh, v0, v1)
    const again = measure(h.visuals, h.parts)
    expect(spent(again.budget)).toBe(v1 - v0 + 24)
    expect(again.solids[1]).toEqual([])
    expect(again.solids[0]).toBe(back.solids[0])
  })

  it('a mesh of its own: a dent, a melt, a range drawn again (`showCollapsedRanges`) and a restore are seen by its attribute version', () => {
    const geometry = new THREE.BoxGeometry(1, 2, 0.2).translate(0, 1, 0)
    const mesh = new THREE.Mesh(geometry)
    mesh.updateMatrixWorld(true)
    const visuals = new Visuals(THREE, false, 100)
    const mv = visuals.makeMeshVis(mesh, 'crate')
    const budget = (): MeasureBudget => ({ left: 1e9, incomplete: false })
    let last = drawnSolidsOf(THREE, visuals, mv, 'c', budget())
    const unchanged = budget()
    expect(drawnSolidsOf(THREE, visuals, mv, 'c', unchanged)).toBe(last)
    expect(spent(unchanged)).toBe(0)
    const writes: Array<[string, () => void]> = [
      ['dent', () => visuals.applyDent(mv, new THREE.Vector3(0, 1, 0.1), inward, DENT)],
      ['melt', () => visuals.setMelt(partOf([mv]), 0.6)],
      [
        'drawn again',
        () => {
          const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
          mesh.userData.plainPositions = new Float32Array(pos.array as Float32Array).map((v, i) => (i % 3 === 1 ? v + 0.2 : v))
          mesh.userData.collapsedRanges = [[0, pos.count]]
          showCollapsedRanges(mesh)
        },
      ],
      ['restore', () => visuals.restoreMesh(mv)],
    ]
    for (const [name, write] of writes) {
      write()
      const now = drawnSolidsOf(THREE, visuals, mv, 'c', budget())
      expect(now, name).not.toBe(last)
      last = now
    }
  })
})

describe('a part whose friction alone changed', () => {
  it('is a changed part: its body keeps its shape and takes the new surface', () => {
    const calls: string[] = []
    let next = 1
    const world = {
      createBodies: (descs: readonly BodyDesc[]) => descs.map(() => next++ as unknown as BodyId),
      setShape: () => calls.push('shape'),
      setPose: () => calls.push('pose'),
      setMaterial: (_: BodyId, m: Material) => calls.push(`material ${m.frictionStatic}`),
      removeBody: () => calls.push('remove'),
      wakeInBox: () => undefined,
    } as unknown as SeamWorld
    const statics = new EngineStatics(world, { frictionStatic: 0.6, frictionDynamic: 0.5, restitution: 0 } as Material)
    const box = (fs: number): StaticSolid => ({ center: [0, 1, 0], half: [1, 1, 1], rotation: [0, 0, 0, 1], key: 'wall', friction: { static: fs, dynamic: 0.4, rolling: 0 } })
    statics.lay(new Map([['house', [box(0.7)]]]))
    statics.lay(new Map([['house', [box(0.7)]]]))
    expect(calls).toEqual([])
    statics.lay(new Map([['house', [box(0.9)]]]))
    expect(calls).toEqual(['material 0.9'])
    expect(statics.changed.size).toBe(1)
  })
})

describe('one measure brings each mesh up to date once', () => {
  it('a house under four groups: one `updateWorldMatrix` per distinct mesh per measure, and the very same colliders as one per part', () => {
    const nested = () => {
      const h = house()
      let top: THREE.Object3D = h.root
      for (let k = 0; k < 4; k++) {
        const group = new THREE.Group()
        group.position.set(k + 0.5, 0.25 * k, -k)
        group.rotation.y = 0.1 * k
        group.add(top)
        top = group
      }
      top.updateMatrixWorld(true)
      return h
    }
    const once = nested()
    const each = nested()
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5))
    once.root.add(crate)
    each.root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)))
    const parts = [...once.parts, once.visuals.makeMeshVis(crate, 'crate')]
    const otherParts = [...each.parts, each.visuals.makeMeshVis(each.root.children[1] as THREE.Mesh, 'crate')]
    const calls = new Map<object, number>()
    for (const mesh of [once.mesh, crate]) {
      const update = mesh.updateWorldMatrix.bind(mesh)
      mesh.updateWorldMatrix = (parents: boolean, children: boolean): void => {
        calls.set(mesh, (calls.get(mesh) ?? 0) + 1)
        update(parents, children)
      }
    }
    const shared = (): MeasureBudget => ({ left: 1e9, incomplete: false, updated: new Set() })
    const perPart = (): MeasureBudget => ({ left: 1e9, incomplete: false })
    for (let round = 0; round < 2; round++) {
      calls.clear()
      if (round === 1) {
        once.visuals.applyDent(once.parts[2]!, once.mesh.localToWorld(front(4)), new THREE.Vector3(0, 0, -1).transformDirection(once.mesh.matrixWorld), DENT)
        each.visuals.applyDent(each.parts[2]!, each.mesh.localToWorld(front(4)), new THREE.Vector3(0, 0, -1).transformDirection(each.mesh.matrixWorld), DENT)
        calls.clear()
      }
      const budget = shared()
      const got = parts.map((mv, k) => drawnSolidsOf(THREE, once.visuals, mv, `p${k}`, budget))
      const per = perPart()
      const want = otherParts.map((mv, k) => drawnSolidsOf(THREE, each.visuals, mv, `p${k}`, per))
      expect(calls.get(once.mesh)).toBe(1)
      expect(calls.get(crate)).toBe(1)
      expect(got).toEqual(want)
    }
  })
})
