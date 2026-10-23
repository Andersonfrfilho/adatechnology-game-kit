import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

/** Merge geometries into one indexed geometry and return it with the vertex range of each one. */
function merge(geos: THREE.BufferGeometry[]): { geo: THREE.BufferGeometry; ranges: Array<[number, number]> } {
  const ranges: Array<[number, number]> = []
  const pos: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  let base = 0
  for (const g of geos) {
    const n = g.getAttribute('position').count
    pos.push(...Array.from(g.getAttribute('position').array))
    nor.push(...Array.from(g.getAttribute('normal').array))
    for (const i of Array.from(g.getIndex()!.array)) idx.push(i + base)
    ranges.push([base, base + n])
    base += n
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  geo.setIndex(idx)
  return { geo, ranges }
}

const box = (x: number, w = 1) => new THREE.BoxGeometry(w, 1, 1, 4, 4, 4).translate(x, 0, 0)

function setup(opts: { nonIndexed?: boolean } = {}) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const sounds: string[] = []
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), onSound: (k) => sounds.push(k) })
  // two walls 0.2 apart, merged into one mesh and placed away from the origin
  const { geo: indexed, ranges } = merge([box(-0.6), box(0.6)])
  const geo = opts.nonIndexed ? indexed.toNonIndexed() : indexed
  const ranged: Array<[number, number]> = opts.nonIndexed ? ranges.map(([a, b]) => [a, b] as [number, number]) : ranges
  if (opts.nonIndexed) {
    // faces of the first box come first: its range is the first 6 * 4 * 4 * 6 vertices
    const per = 6 * 16 * 6
    ranged[0] = [0, per]
    ranged[1] = [per, 2 * per]
  }
  const material = new THREE.MeshStandardMaterial({ color: 0x998877 })
  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(1, 2, 3)
  const root = new THREE.Group()
  root.add(mesh)
  scene.add(root)
  root.updateMatrixWorld(true)
  world.addObject('house', [partState('a', 'wood'), partState('b', 'wood')], [['a'], ['b']])
  // the world starts with one group; the tests that detach set two
  world.objects.get('house')!.groups = [['a', 'b']]
  renderer.bind('house', root, { parts: { a: { mesh, range: ranged[0] }, b: { mesh, range: ranged[1] } } })
  return { scene, world, renderer, mesh, root, geo, material, ranges: ranged }
}

const pos = (m: THREE.Mesh | THREE.BufferGeometry): Float32Array => {
  const g = m instanceof THREE.Mesh ? m.geometry : m
  return new Float32Array((g.getAttribute('position') as THREE.BufferAttribute).array as ArrayLike<number>)
}

const inRange = (a: Float32Array, b: Float32Array, [v0, v1]: [number, number]) => {
  let moved = 0
  let rest = 0
  for (let i = 0; i < a.length; i += 3) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
    if (i / 3 >= v0 && i / 3 < v1) moved += d
    else rest += d
  }
  return { moved, rest }
}

const dentA = {
  type: 'dent' as const,
  object: 'house',
  part: 'a',
  // world point on the face of 'a' facing 'b' (mesh at (1, 2, 3); the face is at local x = -0.1)
  worldPoint: [0.9, 2, 3] as [number, number, number],
  dent: { point: [-0.1, 0, 0] as [number, number, number], normal: [1, 0, 0] as [number, number, number], radius: 0.5, depth: 0.05 },
}

describe('bind by vertex range', () => {
  it('dents only the vertices of the part, even when the dent reaches the neighbour', () => {
    const { world, renderer, mesh, geo, ranges } = setup()
    const before = pos(mesh)
    world.emit(dentA)
    renderer.update(0.016)
    expect(mesh.geometry).not.toBe(geo)
    const { moved, rest } = inRange(before, pos(mesh), ranges[0])
    expect(moved).toBeGreaterThan(0.01)
    // part b has vertices within 0.5 of the dent point (its face is 0.2 away) and none of them moved
    expect(rest).toBe(0)
    // the original geometry was not touched
    expect(pos(geo)).toEqual(before)
    renderer.restore('house')
    expect(mesh.geometry).toBe(geo)
    expect(pos(mesh)).toEqual(before)
  })

  it('char and heat colours are written to the vertex colours of the part only', () => {
    const { world, renderer, mesh, geo, material, ranges } = setup()
    expect(geo.getAttribute('color')).toBeUndefined()
    world.part('house', 'a')!.char = 1
    world.emit({ type: 'burnout', object: 'house', part: 'a', point: [1, 2, 3] })
    renderer.update(0.016)
    const c = mesh.geometry.getAttribute('color') as THREE.BufferAttribute
    expect(c).toBeDefined()
    expect(mesh.material).not.toBe(material)
    expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true)
    // wood chars to 0x111111
    const charred = new THREE.Color(0x111111)
    for (let i = ranges[0][0]; i < ranges[0][1]; i++) expect([c.getX(i), c.getY(i), c.getZ(i)]).toEqual([charred.r, charred.g, charred.b].map((v) => expect.closeTo(v, 5)))
    for (let i = ranges[1][0]; i < ranges[1][1]; i++) expect([c.getX(i), c.getY(i), c.getZ(i)]).toEqual([1, 1, 1])
    // the host's own material and geometry are untouched
    expect(material.vertexColors).toBe(false)
    expect(geo.getAttribute('color')).toBeUndefined()
    renderer.restore('house')
    expect(mesh.geometry).toBe(geo)
    expect(mesh.material).toBe(material)
    expect(geo.getAttribute('color')).toBeUndefined()
  })

  it('a hot part glows through its own vertex colours', () => {
    const { world, renderer, mesh, root, geo, ranges } = setup()
    world.part('house', 'b')!.material = 'steel'
    renderer.bind('house', root, { parts: { a: { mesh, range: ranges[0] }, b: { mesh, range: ranges[1] } } })
    world.part('house', 'b')!.temperature = 900
    for (let i = 0; i < 6; i++) renderer.update(0.1)
    const c = mesh.geometry.getAttribute('color') as THREE.BufferAttribute
    expect(c).toBeDefined()
    expect(c.getX(ranges[0][0])).toBe(1)
    expect(c.getY(ranges[0][0])).toBe(1)
    // a white base lerped towards a red-orange heat colour: blue drops the most
    expect(c.getX(ranges[1][0])).toBeGreaterThan(c.getZ(ranges[1][0]))
    expect(c.getZ(ranges[1][0])).toBeLessThan(1)
    world.part('house', 'b')!.temperature = 20
    for (let i = 0; i < 12; i++) renderer.update(0.1)
    expect(c.getZ(ranges[1][0])).toBe(1)
    renderer.restore('house')
    expect(mesh.geometry).toBe(geo)
  })

  it('keeps the original vertex colours of the other parts and takes the part\'s own as the base', () => {
    const { world, renderer, mesh, geo, ranges } = setup()
    const n = geo.getAttribute('position').count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) col.set(i < ranges[0][1] ? [1, 0, 0] : [0, 1, 0], i * 3)
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    ;(mesh.material as THREE.MeshStandardMaterial).vertexColors = true
    world.part('house', 'a')!.char = 1
    world.emit({ type: 'burnout', object: 'house', part: 'a', point: [0, 0, 0] })
    renderer.update(0.016)
    const c = mesh.geometry.getAttribute('color') as THREE.BufferAttribute
    // red (1, 0, 0) charred all the way is the char colour 0x111111
    expect(c.getX(ranges[0][0])).toBeCloseTo(new THREE.Color(0x111111).r, 4)
    expect(c.getY(ranges[1][0])).toBe(1)
    expect(c.getX(ranges[1][0])).toBe(0)
    renderer.restore('house')
    expect((mesh.geometry.getAttribute('color') as THREE.BufferAttribute).getX(0)).toBe(1)
  })

  it('a fracture hides the part\'s faces without touching its neighbour or the mesh', () => {
    const { world, renderer, mesh, geo, ranges } = setup()
    const before = pos(mesh)
    world.emit({ type: 'hole', object: 'house', part: 'b', worldPoint: [1.5, 2, 3], hole: { point: [0.5, 0, 0], normal: [0, 0, 1], diameter: 0.02, through: false } })
    renderer.update(0.016)
    expect(renderer.stats().decals).toBeGreaterThan(0)
    world.emit({ type: 'fracture', object: 'house', part: 'b', style: 'splinter', fragments: [], point: [1.6, 2, 3] })
    renderer.update(0.016)
    expect(mesh.visible).toBe(true)
    const p = pos(mesh)
    const [v0, v1] = ranges[1]
    for (let i = v0; i < v1; i++) expect([p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]).toEqual([p[v0 * 3], p[v0 * 3 + 1], p[v0 * 3 + 2]])
    expect(inRange(before, p, ranges[1]).rest).toBe(0)
    expect(mesh.children.every((c) => !c.visible)).toBe(true)
    renderer.restore('house')
    expect(mesh.geometry).toBe(geo)
    expect(pos(mesh)).toEqual(before)
    expect(mesh.children).toHaveLength(0)
  })

  for (const nonIndexed of [false, true]) {
    it(`a detached part leaves as a mesh of its own, carrying dents and decals${nonIndexed ? ' (non-indexed geometry)' : ''}`, () => {
      const { world, renderer, mesh, geo, scene, root, ranges } = setup({ nonIndexed })
      const { moved: none } = inRange(pos(mesh), pos(mesh), ranges[0])
      expect(none).toBe(0)
      // dent and shoot part b first
      world.emit({ ...dentA, part: 'b', worldPoint: [1.1, 2, 3], dent: { ...dentA.dent, point: [0.1, 0, 0], normal: [-1, 0, 0] } })
      world.emit({ type: 'hole', object: 'house', part: 'b', worldPoint: [1.6, 2, 3], hole: { point: [0.6, 0, 0], normal: [1, 0, 0], diameter: 0.02, through: false } })
      renderer.update(0.016)
      const dented = pos(mesh)
      const [v0, v1] = ranges[1]
      const worldBefore = mesh.localToWorld(new THREE.Vector3(dented[v0 * 3], dented[v0 * 3 + 1], dented[v0 * 3 + 2]))
      world.objects.get('house')!.groups = [['a'], ['b']]
      world.emit({ type: 'detach', object: 'house', joint: 'j', parts: ['a', 'b'], by: 'break', groups: [['a'], ['b']] })
      renderer.update(0)
      expect(world.splits).toHaveLength(1)
      const piece = renderer.piece(world.splits[0].newId)!
      const loose = piece.root.children.find((c) => c instanceof THREE.Mesh) as THREE.Mesh
      expect(loose).toBeDefined()
      expect(loose).not.toBe(mesh)
      // the loose mesh has exactly the faces of b, with its dented positions and the same place in the world
      expect(loose.geometry.getAttribute('position').count).toBe(v1 - v0)
      expect(pos(loose)).toEqual(dented.slice(v0 * 3, v1 * 3))
      const idx = loose.geometry.getIndex()
      if (nonIndexed) expect(idx).toBeNull()
      else {
        expect(idx!.count).toBe(6 * 16 * 6)
        for (let i = 0; i < idx!.count; i++) expect(idx!.getX(i)).toBeLessThan(v1 - v0)
      }
      const worldAfter = loose.localToWorld(new THREE.Vector3(pos(loose)[0], pos(loose)[1], pos(loose)[2]))
      expect(worldAfter.distanceTo(worldBefore)).toBeLessThan(1e-4)
      expect(loose.children.length).toBeGreaterThan(0)
      expect(mesh.children).toHaveLength(0)
      expect(loose.material).not.toBe(mesh.material)
      // in the merged mesh the range is gone (collapsed to a point) and the rest is unchanged
      const after = pos(mesh)
      for (let i = v0; i < v1; i++) expect([after[i * 3], after[i * 3 + 1], after[i * 3 + 2]]).toEqual([after[v0 * 3], after[v0 * 3 + 1], after[v0 * 3 + 2]])
      expect(inRange(dented, after, ranges[1]).rest).toBe(0)
      // dents on the loose piece change it and not the merged mesh
      world.emit({ ...dentA, part: 'b', worldPoint: worldAfter.toArray() as [number, number, number], dent: { ...dentA.dent, point: [0, 0, 0], radius: 0.3 } })
      renderer.update(0.016)
      expect(pos(mesh)).toEqual(after)
      // restore brings everything back
      renderer.restore('house')
      expect(mesh.geometry).toBe(geo)
      expect(mesh.parent).toBe(root)
      expect(scene.children).toEqual([root])
      expect(piece.root.parent).toBeNull()
    })
  }

  it('a collapse event splits the loose group too, and clear() restores it', () => {
    const { world, renderer, mesh, geo, scene, root, ranges } = setup()
    world.objects.get('house')!.groups = [['a'], ['b']]
    world.emit({ type: 'collapse', object: 'house', parts: ['b'], mass: 2 })
    renderer.update(0)
    expect(world.splits).toHaveLength(1)
    expect(renderer.pieces()).toHaveLength(1)
    const loose = renderer.pieces()[0].root.children[0] as THREE.Mesh
    expect(loose.isMesh).toBe(true)
    expect(loose.geometry.getAttribute('position').count).toBe(ranges[1][1] - ranges[1][0])
    renderer.clear()
    expect(mesh.geometry).toBe(geo)
    expect(scene.children).toEqual([root])
  })

  it('melts only the range', () => {
    const { world, renderer, mesh, ranges } = setup()
    const before = pos(mesh)
    world.part('house', 'a')!.melt = 0.8
    world.emit({ type: 'melt', object: 'house', part: 'a', amount: 0.1 } as never)
    renderer.update(0.5)
    const { moved, rest } = inRange(before, pos(mesh), ranges[0])
    expect(moved).toBeGreaterThan(0.1)
    expect(rest).toBe(0)
    expect(mesh.scale.toArray()).toEqual([1, 1, 1])
  })

  it('rejects ranges outside the geometry', () => {
    const { renderer, mesh, root } = setup()
    const n = mesh.geometry.getAttribute('position').count
    expect(() => renderer.bind('house', root, { parts: { a: { mesh, range: [0, n + 1] } } })).toThrow(/invalid vertex range/)
    expect(() => renderer.bind('house', root, { parts: { a: { mesh, range: [5, 5] } } })).toThrow(/invalid vertex range/)
  })

  it('plain meshes keep working next to ranged ones', () => {
    const { world, renderer, mesh, root, ranges } = setup()
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.1, 4, 4, 4), new THREE.MeshStandardMaterial())
    door.position.set(1, 2, 3)
    root.add(door)
    world.objects.get('house')!.parts.push(partState('door', 'wood'))
    renderer.bind('house', root, { parts: { a: { mesh, range: ranges[0] }, b: [{ mesh, range: ranges[1] }], door } })
    const before = pos(door)
    world.emit({ type: 'dent', object: 'house', part: 'door', worldPoint: [1, 2, 3.05], dent: { point: [0, 0, 0.05], normal: [0, 0, -1], radius: 0.2, depth: 0.03 } })
    renderer.update(0.016)
    expect(inRange(before, pos(door), [0, 1e9]).moved).toBeGreaterThan(0)
    world.emit({ type: 'fracture', object: 'house', part: 'door', style: 'splinter', fragments: [], point: [1, 2, 3] })
    renderer.update(0.016)
    expect(door.visible).toBe(false)
    expect(mesh.visible).toBe(true)
  })
})
