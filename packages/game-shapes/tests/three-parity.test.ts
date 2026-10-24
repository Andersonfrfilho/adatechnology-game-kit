import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildPrimitive, clearTemplateCache, generate, mergeTransformed } from '../src'
import type { PrimitiveBuffers, PrimitiveNode } from '../src'

/** Bitwise equality of two numeric arrays (-0 and +0 differ, NaN equals NaN). */
const sameBits = (a: ArrayLike<number> | undefined, b: ArrayLike<number> | undefined): boolean => {
  if (!a || !b) return a === b
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

const expectSameAsThree = (ours: PrimitiveBuffers, theirs: THREE.BufferGeometry, label: string): void => {
  expect(ours.type, label).toBe(theirs.type)
  expect(sameBits(ours.positions, theirs.attributes.position!.array as Float32Array), `${label} positions`).toBe(true)
  expect(sameBits(ours.normals, theirs.attributes.normal!.array as Float32Array), `${label} normals`).toBe(true)
  expect(sameBits(ours.uvs, theirs.attributes.uv!.array as Float32Array), `${label} uvs`).toBe(true)
  expect(ours.positions.constructor, `${label} position type`).toBe(Float32Array)
  if (theirs.index) {
    expect(ours.indices?.constructor, `${label} index type`).toBe(theirs.index.array.constructor)
    expect(sameBits(ours.indices, theirs.index.array as ArrayLike<number>), `${label} indices`).toBe(true)
  } else expect(ours.indices, `${label} non-indexed`).toBeUndefined()
  expect(ours.groups, `${label} groups`).toEqual(theirs.groups)
}

const PI = Math.PI
const cases: Array<[string, PrimitiveNode, () => THREE.BufferGeometry]> = []
const add = (label: string, node: PrimitiveNode, three: () => THREE.BufferGeometry): void => void cases.push([label, node, three])

for (const [w, h, d] of [[1, 1, 1], [0.37, 1.91, 0.023], [2.8, 0.85, 1.7], [-0.4, 0.2, 0.3]] as const)
  for (const seg of [[1, 1, 1], [2, 3, 1], [4, 1, 5]] as const)
    add(`box ${w} ${h} ${d} ${seg}`, { kind: 'box', size: [w, h, d], segments: seg }, () => new THREE.BoxGeometry(w, h, d, ...seg))
add('box defaults', { kind: 'box' }, () => new THREE.BoxGeometry())
for (const [rt, rb, h] of [[1, 1, 1], [0.5, 0.35, 0.12], [0, 1, 1], [0.02, 0.055, 0.14], [0.3, 0, 2]] as const)
  for (const radial of [6, 8, 12, 14, 32])
    for (const [hs, open, ts, tl] of [[1, false, 0, PI * 2], [3, true, 0.3, PI], [2, false, -1, 1.5]] as const)
      add(`cylinder ${rt} ${rb} ${h} ${radial} ${hs} ${open} ${ts}`, { kind: 'cylinder', radiusTop: rt, radiusBottom: rb, height: h, radialSegments: radial, heightSegments: hs, openEnded: open, thetaStart: ts, thetaLength: tl }, () => new THREE.CylinderGeometry(rt, rb, h, radial, hs, open, ts, tl))
add('cylinder defaults', { kind: 'cylinder' }, () => new THREE.CylinderGeometry())
for (const [r, h, radial] of [[0.06, 0.3, 6], [1, 2, 32], [0.5, 1.5, 12]] as const) add(`cone ${r} ${h} ${radial}`, { kind: 'cone', radius: r, height: h, radialSegments: radial }, () => new THREE.ConeGeometry(r, h, radial))
add('cone open', { kind: 'cone', radius: 0.4, height: 1, radialSegments: 9, heightSegments: 2, openEnded: true, thetaStart: 1, thetaLength: 4 }, () => new THREE.ConeGeometry(0.4, 1, 9, 2, true, 1, 4))
for (const [r, ws, hs] of [[1, 12, 8], [0.5, 8, 6], [0.5, 12, 6], [0.13, 32, 16], [1, 3, 2]] as const) {
  add(`sphere ${r} ${ws} ${hs}`, { kind: 'sphere', radius: r, widthSegments: ws, heightSegments: hs }, () => new THREE.SphereGeometry(r, ws, hs))
  add(`dome ${r} ${ws} ${hs}`, { kind: 'sphere', radius: r, widthSegments: ws, heightSegments: hs, phiStart: 0, phiLength: PI * 2, thetaStart: 0, thetaLength: PI / 2 }, () => new THREE.SphereGeometry(r, ws, hs, 0, PI * 2, 0, PI / 2))
  add(`band ${r} ${ws} ${hs}`, { kind: 'sphere', radius: r, widthSegments: ws, heightSegments: hs, phiStart: 0.4, phiLength: 3, thetaStart: 0.5, thetaLength: 1.2 }, () => new THREE.SphereGeometry(r, ws, hs, 0.4, 3, 0.5, 1.2))
}
add('sphere defaults', { kind: 'sphere' }, () => new THREE.SphereGeometry())
for (const [w, h, ws, hs] of [[1, 1, 1, 1], [2, 3, 2, 2], [0.7, 0.2, 5, 1]] as const) add(`plane ${w} ${h} ${ws} ${hs}`, { kind: 'plane', width: w, height: h, widthSegments: ws, heightSegments: hs }, () => new THREE.PlaneGeometry(w, h, ws, hs))
for (const [r, s, ts, tl] of [[0.5, 12, 0, PI * 2], [1, 32, 0.2, PI], [0.08, 3, 0, 1]] as const) add(`circle ${r} ${s}`, { kind: 'circle', radius: r, segments: s, thetaStart: ts, thetaLength: tl }, () => new THREE.CircleGeometry(r, s, ts, tl))
for (const [a, b, t, p] of [[0.2, 0.5, 12, 2], [0.5, 1, 32, 1], [0.01, 0.02, 3, 3]] as const) add(`ring ${a} ${b} ${t} ${p}`, { kind: 'ring', innerRadius: a, outerRadius: b, thetaSegments: t, phiSegments: p }, () => new THREE.RingGeometry(a, b, t, p))
const profiles: Array<Array<[number, number]>> = [
  [[0, -0.5], [0.5, -0.5], [0.5, 0.12], [0.225, 0.3], [0.2, 0.4], [0, 0.4]],
  [[0, -0.5], [0.38, -0.5], [0.5, 0.5], [0.44, 0.5], [0.33, -0.44], [0, -0.44]],
  [[0, 1], [1, 0]],
]
for (const [index, profile] of profiles.entries())
  for (const [segments, ps, pl] of [[14, 0, PI * 2], [7, 0, PI * 2], [16, 1, 2]] as const)
    add(`lathe ${index} ${segments}`, { kind: 'lathe', points: profile, segments, phiStart: ps, phiLength: pl }, () => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments, ps, pl))
for (const [r, t, rs, ts, arc] of [[0.4, 0.05, 5, 10, PI * 2], [1, 0.4, 12, 48, PI * 2], [0.2, 0.03, 8, 18, PI]] as const) add(`torus ${r} ${t} ${rs} ${ts}`, { kind: 'torus', radius: r, tube: t, radialSegments: rs, tubularSegments: ts, arc }, () => new THREE.TorusGeometry(r, t, rs, ts, arc))

const outline = (points: Array<[number, number]>): THREE.Shape => {
  const shape = new THREE.Shape()
  points.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)))
  return shape
}
const axeHead: Array<[number, number]> = [[0, 0], [0.42, -0.16], [0.5, 0.05], [0.48, 0.3], [0.4, 0.42], [0, 0.22]]
const blade: Array<[number, number]> = [[0, 0], [0.66, 0], [0.68, 0.04], [0, 0.1]]
const square: Array<[number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]
const hole: Array<[number, number]> = [[-0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0.3, -0.3]]
add('extrude axe bevel', { kind: 'extrude', shape: { outer: axeHead }, depth: 0.07, bevel: { thickness: 0.015, size: 0.015, segments: 2 } }, () => new THREE.ExtrudeGeometry(outline(axeHead), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }))
add('extrude blade', { kind: 'extrude', shape: { outer: blade }, depth: 0.004, bevel: { thickness: 0.0002, size: 0.0002, segments: 2 } }, () => new THREE.ExtrudeGeometry(outline(blade), { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0002, bevelSize: 0.0002, bevelSegments: 2 }))
add('extrude flat', { kind: 'extrude', shape: { outer: axeHead }, depth: 0.3, steps: 3, bevel: false }, () => new THREE.ExtrudeGeometry(outline(axeHead), { depth: 0.3, steps: 3, bevelEnabled: false }))
add('extrude defaults', { kind: 'extrude', shape: { outer: blade } }, () => new THREE.ExtrudeGeometry(outline(blade)))
add('extrude reversed with hole', { kind: 'extrude', shape: { outer: [...square].reverse(), holes: [hole] }, depth: 0.2, bevel: { thickness: 0.05, size: 0.04, offset: 0.01, segments: 3 } }, () => {
  const shape = outline([...square].reverse())
  const path = new THREE.Path()
  hole.forEach(([x, y], index) => (index ? path.lineTo(x, y) : path.moveTo(x, y)))
  shape.holes.push(path)
  return new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelOffset: 0.01, bevelSegments: 3 })
})

describe('every generator is three r160, bit for bit', () => {
  it.each(cases)('%s', (label, node, three) => {
    clearTemplateCache()
    expectSameAsThree(buildPrimitive(node), three(), label)
    // a cache hit gives the same arrays
    expectSameAsThree(buildPrimitive(node), three(), `${label} (cached)`)
  })

  it('covers every three-equivalent kind', () => {
    expect(new Set(cases.map(([, node]) => node.kind))).toEqual(new Set(['box', 'cylinder', 'cone', 'sphere', 'plane', 'circle', 'ring', 'lathe', 'torus', 'extrude']))
  })
})

/** What `createMeshApi` of game-interactables-three does with one primitive: template x (frame(M) x compose YXZ), as three computes it. */
function meshApiBake(geometry: THREE.BufferGeometry, M: { x: number; z: number; ry: number }, p: [number, number, number], r: [number, number, number], s: [number, number, number], hex: number) {
  const frame = new THREE.Matrix4().makeRotationY(M.ry)
  frame.setPosition(M.x, 0, M.z)
  const local = new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], 'YXZ')), new THREE.Vector3(...s))
  const total = new THREE.Matrix4().copy(frame).multiply(local)
  const n3 = new THREE.Matrix3().getNormalMatrix(total)
  const e = total.elements
  const nm = n3.elements
  const pos = geometry.attributes.position!.array as Float32Array
  const nor = geometry.attributes.normal!.array as Float32Array
  const out = { pos: [] as number[], nor: [] as number[], col: [] as number[] }
  const color = new THREE.Color().setHex(hex)
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.length / 3; i++) {
    const [x, y, z] = [pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!]
    out.pos.push(e[0]! * x + e[4]! * y + e[8]! * z + e[12]!, e[1]! * x + e[5]! * y + e[9]! * z + e[13]!, e[2]! * x + e[6]! * y + e[10]! * z + e[14]!)
    const [nx, ny, nz] = [nor[i * 3]!, nor[i * 3 + 1]!, nor[i * 3 + 2]!]
    v.set(nm[0]! * nx + nm[3]! * ny + nm[6]! * nz, nm[1]! * nx + nm[4]! * ny + nm[7]! * nz, nm[2]! * nx + nm[5]! * ny + nm[8]! * nz).normalize()
    out.nor.push(v.x, v.y, v.z)
    out.col.push(color.r, color.g, color.b)
  }
  return { pos: new Float32Array(out.pos), nor: new Float32Array(out.nor), col: new Float32Array(out.col) }
}

describe('baking is three, bit for bit', () => {
  const items = [
    { M: { x: 0, z: 0, ry: 0 }, p: [0.1, 0.42, -0.3], r: [0, 0, 0], s: [0.6, 0.84, 0.4] },
    { M: { x: 4, z: -2, ry: Math.PI / 2 }, p: [-0.31, 0.05, 0.2], r: [0.3, -1.2, 0.05], s: [0.04, 0.9, 0.04] },
    { M: { x: -1.25, z: 3.5, ry: 2.7 }, p: [0, 1.1, 0], r: [-Math.PI / 2, 0.4, 1.1], s: [1.3, 0.02, 2.1] },
  ] as const
  for (const [index, item] of items.entries()) {
    it(`a box and a cylinder under item frame ${index} match createMeshApi's arithmetic`, () => {
      for (const [node, geometry] of [
        [{ kind: 'box' }, new THREE.BoxGeometry(1, 1, 1)],
        [{ kind: 'cylinder', radiusTop: 1, radiusBottom: 1, height: 1, radialSegments: 12 }, new THREE.CylinderGeometry(1, 1, 1, 12)],
        [{ kind: 'sphere', radius: 1, widthSegments: 12, heightSegments: 8 }, new THREE.SphereGeometry(1, 12, 8)],
      ] as const) {
        const buffers = generate({
          version: 1,
          root: { kind: 'group', heading: item.M.ry, position: [item.M.x, 0, item.M.z], children: [{ ...node, position: [...item.p], rotation: [...item.r], rotationOrder: 'YXZ', scale: [...item.s], color: 0x6e7078 } as PrimitiveNode] },
        })
        const batch = buffers.levels[0]!.batches[0]!
        const expected = meshApiBake(geometry, item.M, [...item.p], [...item.r], [...item.s], 0x6e7078)
        expect(sameBits(batch.positions, expected.pos), `${node.kind} positions`).toBe(true)
        expect(sameBits(batch.normals, expected.nor), `${node.kind} normals`).toBe(true)
        expect(sameBits(batch.colors, expected.col), `${node.kind} colours`).toBe(true)
        expect(sameBits(batch.uvs, geometry.attributes.uv!.array as Float32Array), `${node.kind} uvs`).toBe(true)
        expect(sameBits(batch.indices, geometry.index!.array as Uint16Array), `${node.kind} indices`).toBe(true)
      }
    })
  }

  it('Object3D transforms (Euler XYZ, nested groups) match updateMatrixWorld + applyMatrix4', () => {
    const outer = { position: [0.3, -1, 2] as const, rotation: [0.2, 0.7, -0.4] as const, scale: [1.5, 0.5, 2] as const }
    const inner = { position: [-0.05, 0.4, 0.1] as const, rotation: [1.1, 0, 0.3] as const, scale: 0.8 }
    const buffers = generate({ version: 1, root: { kind: 'group', ...outer, children: [{ kind: 'torus', radius: 0.4, tube: 0.05, radialSegments: 5, tubularSegments: 10, ...inner }] } }, { indexed: false })
    const group = new THREE.Group()
    group.position.set(...outer.position)
    group.rotation.set(...outer.rotation)
    group.scale.set(...outer.scale)
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 5, 10))
    mesh.position.set(...inner.position)
    mesh.rotation.set(...inner.rotation)
    mesh.scale.setScalar(inner.scale)
    group.add(mesh)
    group.updateMatrixWorld(true)
    const baked = mesh.geometry.toNonIndexed().applyMatrix4(mesh.matrixWorld)
    const batch = buffers.levels[0]!.batches[0]!
    expect(sameBits(batch.positions, baked.attributes.position!.array as Float32Array)).toBe(true)
    expect(sameBits(batch.normals, baked.attributes.normal!.array as Float32Array)).toBe(true)
  })
})

describe('mergeTransformed is toNonIndexed + applyMatrix4 + join', () => {
  it('matches three for indexed and non-indexed pieces, including missing attributes', () => {
    const a = new THREE.CylinderGeometry(0.5, 0.3, 1.2, 9)
    const b = new THREE.ExtrudeGeometry(outline(axeHead), { depth: 0.07, bevelSegments: 2, bevelThickness: 0.015, bevelSize: 0.015 })
    const c = new THREE.BufferGeometry()
    c.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3))
    const ma = new THREE.Matrix4().compose(new THREE.Vector3(1, 2, 3), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0.2, 0.1)), new THREE.Vector3(2, 1, 0.5))
    const mb = new THREE.Matrix4().makeRotationY(1.3).setPosition(-2, 0, 1)
    const mc = new THREE.Matrix4().makeScale(-1, 2, 1)
    const merged = mergeTransformed([
      { positions: a.attributes.position!.array, normals: a.attributes.normal!.array, uvs: a.attributes.uv!.array, indices: a.index!.array, matrix: ma.elements },
      { positions: b.attributes.position!.array, normals: b.attributes.normal!.array, uvs: b.attributes.uv!.array, matrix: mb.elements },
      { positions: c.attributes.position!.array, matrix: mc.elements },
    ])
    const expected = [a.toNonIndexed().applyMatrix4(ma), b.clone().applyMatrix4(mb)]
    const cc = c.clone()
    cc.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(9), 3))
    cc.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(6), 2))
    expected.push(cc.applyMatrix4(mc))
    const join = (name: string) => {
      const parts = expected.map((g) => Array.from(g.getAttribute(name).array as Float32Array))
      return new Float32Array(parts.flat())
    }
    expect(sameBits(merged.positions, join('position'))).toBe(true)
    expect(sameBits(merged.normals, join('normal'))).toBe(true)
    expect(sameBits(merged.uvs, join('uv'))).toBe(true)
  })
})
