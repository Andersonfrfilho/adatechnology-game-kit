import { snapshotScene } from '@adatechnology/golden-tool'
import { mergeByMaterial as legacyMergeByMaterial } from './fixtures/legacy-merge-by-material'
import { generate } from '@adatechnology/game-shapes'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { mergeByMaterial, shapeGeometries, toObject3D } from '../src'

const T = shapeGeometries(THREE)

const sameBits = (a: ArrayLike<number> | undefined, b: ArrayLike<number> | undefined): boolean => {
  if (!a || !b) return a === b
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

const outline = (points: Array<[number, number]>): THREE.Shape => {
  const shape = new THREE.Shape()
  points.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)))
  return shape
}
const axe: Array<[number, number]> = [[0, 0], [0.42, -0.16], [0.5, 0.05], [0.48, 0.3], [0.4, 0.42], [0, 0.22]]

type Ns = typeof THREE
const builds: Array<[string, (n: Ns) => THREE.BufferGeometry]> = [
  ['box', (n) => new n.BoxGeometry(0.28, 0.15, 0.15)],
  ['box segments', (n) => new n.BoxGeometry(1, 2, 3, 2, 3, 4)],
  ['box default', (n) => new n.BoxGeometry()],
  ['cylinder', (n) => new n.CylinderGeometry(0.05, 0.065, 1.1, 10)],
  ['cylinder open arc', (n) => new n.CylinderGeometry(0.3, 0.5, 1, 12, 1, true, 0.2, 2)],
  ['cylinder default', (n) => new n.CylinderGeometry()],
  ['cone', (n) => new n.ConeGeometry(0.06, 0.3, 6)],
  ['sphere', (n) => new n.SphereGeometry(0.5, 12, 8)],
  ['dome', (n) => new n.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2)],
  ['plane', (n) => new n.PlaneGeometry(2, 1, 3, 2)],
  ['circle', (n) => new n.CircleGeometry(0.4, 10)],
  ['ring', (n) => new n.RingGeometry(0.2, 0.4, 16, 2)],
  ['lathe', (n) => new n.LatheGeometry([new n.Vector2(0, -0.5), new n.Vector2(0.5, -0.5), new n.Vector2(0.4, 0.4), new n.Vector2(0, 0.4)], 14)],
  ['torus', (n) => new n.TorusGeometry(0.32, 0.02, 5, 10)],
  ['torus default', (n) => new n.TorusGeometry()],
  ['extrude', (n) => new n.ExtrudeGeometry(outline(axe), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 })],
]

describe('shapeGeometries: the same geometry as three, made by game-shapes', () => {
  it.each(builds)('%s', (_label, build) => {
    const ours = build(T)
    const theirs = build(THREE)
    expect(ours).toBeInstanceOf((THREE as Record<string, any>)[theirs.type])
    expect(ours).toBeInstanceOf((T as Record<string, any>)[theirs.type])
    expect(ours.type).toBe(theirs.type)
    expect(Object.keys(ours.attributes)).toEqual(Object.keys(theirs.attributes))
    for (const name of Object.keys(theirs.attributes)) {
      const a = ours.getAttribute(name) as THREE.BufferAttribute
      const b = theirs.getAttribute(name) as THREE.BufferAttribute
      expect(a.itemSize, name).toBe(b.itemSize)
      expect(a.array.constructor, name).toBe(b.array.constructor)
      expect(sameBits(a.array, b.array), name).toBe(true)
    }
    expect(ours.index?.array.constructor).toBe(theirs.index?.array.constructor)
    expect(sameBits(ours.index?.array, theirs.index?.array)).toBe(true)
    expect(ours.groups).toEqual(theirs.groups)
    // an extrusion's parameters hold the Shape objects the caller passed (two builds, two uuids): compare the options
    if (theirs.type === 'ExtrudeGeometry') expect((ours as any).parameters.options).toEqual((theirs as any).parameters.options)
    else expect((ours as any).parameters).toEqual((theirs as any).parameters)
    const clone = ours.clone()
    expect(clone.type).toBe(theirs.type)
    expect(sameBits(clone.getAttribute('position').array, theirs.getAttribute('position').array)).toBe(true)
    if (theirs.type !== 'ExtrudeGeometry') expect(ours.toJSON()).toEqual({ ...theirs.toJSON(), uuid: ours.uuid })
  })

  it('a scene built with it hashes as one built with three', () => {
    const scene = (n: Ns): THREE.Group => {
      const group = new THREE.Group()
      builds.forEach(([, build], i) => {
        const mesh = new THREE.Mesh(build(n), new THREE.MeshStandardMaterial({ color: 0x336699 }))
        mesh.position.set(i * 0.3, 0, -i * 0.1)
        mesh.rotation.set(0.1 * i, 0.2, 0)
        group.add(mesh)
      })
      return group
    }
    expect(snapshotScene(scene(T) as never)).toEqual(snapshotScene(scene(THREE) as never))
  })

  it('extrusions it cannot make exactly fall back to three', () => {
    const curved = new THREE.Shape().moveTo(0, 0).lineTo(1, 0).quadraticCurveTo(1.5, 0.5, 1, 1).lineTo(0, 1)
    const g = new T.ExtrudeGeometry(curved, { depth: 0.1 })
    expect(sameBits(g.getAttribute('position').array, new THREE.ExtrudeGeometry(curved, { depth: 0.1 }).getAttribute('position').array)).toBe(true)
    expect(new T.ExtrudeGeometry([outline(axe), outline(axe)], { depth: 0.1 }).getAttribute('position').count).toBe(new THREE.ExtrudeGeometry([outline(axe), outline(axe)], { depth: 0.1 }).getAttribute('position').count)
  })

  it('everything else is three', () => {
    expect(T.Mesh).toBe(THREE.Mesh)
    expect(T.Vector3).toBe(THREE.Vector3)
    expect(T.TubeGeometry).toBe(THREE.TubeGeometry)
    expect(shapeGeometries(THREE)).toBe(T)
  })

  it('cached geometries do not share arrays', () => {
    const a = new T.BoxGeometry(1, 1, 1)
    const b = new T.BoxGeometry(1, 1, 1)
    a.translate(1, 0, 0)
    expect(b.getAttribute('position').getX(0)).toBe(0.5)
  })
})

describe('toObject3D', () => {
  const buffers = generate({
    version: 1,
    name: 'cabinet',
    materials: { wood: { color: 0x7a5434, roughness: 0.8 } },
    root: {
      kind: 'group',
      children: [
        { kind: 'box', size: [1, 1, 0.5], material: 'wood' },
        { kind: 'group', part: 'door', position: [0.5, 0, 0.25], rotation: [0, 0.4, 0], children: [{ kind: 'box', size: [1, 1, 0.02], material: 'wood', position: [-0.5, 0, 0] }, { kind: 'cylinder', material: 'metal', radialSegments: 8, scale: 0.02 }] },
        { kind: 'cylinder', material: 'metal', radialSegments: 6, scale: [0.02, 0.1, 0.02], instances: [{ position: [-0.4, -0.55, -0.2] }, { position: [0.4, -0.55, -0.2] }] },
        { kind: 'point', name: 'lamp', position: [0, 1, 0], data: { light: true } },
      ],
    },
    lod: [{ distance: 15, detail: 0.5 }],
    cullDistance: 50,
  })
  it('meshes per batch, parts at their pivots, instances and a LOD', () => {
    const shape = toObject3D(THREE, buffers)
    expect(shape.object).toBeInstanceOf(THREE.LOD)
    const lod = shape.object as THREE.LOD
    expect(lod.levels.map((l) => l.distance)).toEqual([0, 15, 50])
    expect(shape.near.children.map((c) => c.name)).toEqual(['static:wood', 'instanced:metal', 'part:door'])
    const door = shape.parts.door!
    expect(door.position.toArray()).toEqual([0.5, 0, 0.25])
    expect(door.rotation.y).toBe(0.4)
    expect(door.children.map((c) => c.name)).toEqual(['part:door', 'part:door'])
    expect(shape.instanced[0]!.count).toBe(2)
    expect(shape.points[0]!.name).toBe('lamp')
    expect(shape.materials.wood).toBeInstanceOf(THREE.MeshStandardMaterial)
    expect((shape.materials.wood as THREE.MeshStandardMaterial).roughness).toBe(0.8)
    // the far level has no part groups: the door is baked
    const far = lod.levels[1]!.object
    expect(far.children.some((c) => c.name.startsWith('part:'))).toBe(false)
  })
  it('uses the host materials', () => {
    const wood = new THREE.MeshBasicMaterial()
    const shape = toObject3D(THREE, buffers, { materials: { wood }, materialFor: (id, part) => (id === 'metal' && part === 'door' ? wood : undefined) })
    expect((shape.meshes[0] as THREE.Mesh).material).toBe(wood)
    expect(shape.parts.door!.children.every((c) => (c as THREE.Mesh).material === wood)).toBe(true)
  })
})

describe('mergeByMaterial on the core merge', () => {
  it('gives what game-props3d gave, bit for bit', () => {
    const root = new THREE.Group()
    const space = new THREE.Group()
    space.position.set(1, 2, 3)
    space.rotation.set(0.1, 0.5, 0)
    space.scale.setScalar(0.4)
    const steel = new THREE.MeshStandardMaterial()
    const wood = new THREE.MeshStandardMaterial()
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, p: [number, number, number], parent: THREE.Object3D = root): THREE.Mesh => {
      const m = new THREE.Mesh(geometry, material)
      m.position.set(...p)
      m.rotation.set(p[0], p[1] * 2, p[2] * 3)
      parent.add(m)
      return m
    }
    const inner = new THREE.Group()
    inner.position.set(0.2, -0.1, 0.4)
    inner.scale.set(1, -1, 1)
    root.add(inner)
    add(new THREE.BoxGeometry(0.3, 0.2, 0.1), steel, [0.1, 0.2, 0.3])
    add(new THREE.CylinderGeometry(0.1, 0.2, 0.5, 9), wood, [-0.3, 0, 0.1], inner)
    add(new THREE.ExtrudeGeometry(outline(axe), { depth: 0.05 }), steel, [0, 0.4, -0.2], inner)
    add(new THREE.TorusGeometry(0.2, 0.05, 5, 9), steel, [0.5, 0.5, 0.5]).visible = false
    const bare = new THREE.BufferGeometry()
    bare.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
    add(bare, wood, [0, 0, 0])
    space.add(root)
    space.updateMatrixWorld(true)
    const ours = mergeByMaterial(THREE, root, space)
    const theirs = legacyMergeByMaterial(THREE, root, space)
    expect(ours.map((m) => m.material)).toEqual(theirs.map((m) => m.material))
    for (const [i, mesh] of ours.entries()) {
      for (const name of ['position', 'normal', 'uv']) expect(sameBits(mesh.geometry.getAttribute(name).array, theirs[i]!.geometry.getAttribute(name).array), `${i} ${name}`).toBe(true)
      expect(mesh.castShadow).toBe(false)
      expect(mesh.receiveShadow).toBe(true)
    }
  })
})
