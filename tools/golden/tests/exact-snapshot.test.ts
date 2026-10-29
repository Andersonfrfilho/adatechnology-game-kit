import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { exactSnapshot, hashBytes } from '../src'

const build = (tweak?: (g: THREE.BufferGeometry) => void): THREE.Group => {
  const root = new THREE.Group()
  const g = new THREE.BoxGeometry(1, 2, 3)
  tweak?.(g)
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x336699 }))
  mesh.userData.part = 'lid'
  root.add(mesh, new THREE.PointLight(0xffeedd, 1, 4))
  return root
}

describe('exactSnapshot', () => {
  it('is the same for the same build and ignores uuids and the attribute wrapper class', () => {
    expect(exactSnapshot(build()).hash).toBe(exactSnapshot(build()).hash)
    const wrapped = build((g) => g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('uv').array), 2)))
    expect(exactSnapshot(wrapped).hash).toBe(exactSnapshot(build()).hash)
  })
  it('sees one bit, the sign of a zero, the attribute order and a user data field', () => {
    const base = exactSnapshot(build()).hash
    const bit = build((g) => {
      const a = g.getAttribute('position').array as Float32Array
      const u = new Uint32Array(a.buffer)
      u[5] = (u[5] as number) ^ 1
    })
    expect(exactSnapshot(bit).hash).not.toBe(base)
    expect(hashBytes(new Float32Array([0]))).not.toBe(hashBytes(new Float32Array([-0])))
    const reordered = build((g) => {
      const normal = g.getAttribute('normal')
      g.deleteAttribute('normal')
      g.setAttribute('normal', normal)
    })
    expect(exactSnapshot(reordered).hash).not.toBe(base)
    const tagged = build()
    tagged.children[0]!.userData.part = 'door'
    expect(exactSnapshot(tagged).hash).not.toBe(base)
    expect(exactSnapshot(build()).nodes).toHaveLength(3)
  })
  it('leaves out where an object comes from (the kit origin mark), not the rest of its user data', () => {
    const marked = build()
    marked.userData.kitOrigin = { owner: 'game-items-three', kind: 'item' }
    expect(exactSnapshot(marked).hash).toBe(exactSnapshot(build()).hash)
    marked.userData.extra = 1
    expect(exactSnapshot(marked).hash).not.toBe(exactSnapshot(build()).hash)
  })

  it('tells shared materials from equal ones', () => {
    const shared = new THREE.Group()
    const m = new THREE.MeshBasicMaterial()
    shared.add(new THREE.Mesh(new THREE.BoxGeometry(), m), new THREE.Mesh(new THREE.BoxGeometry(), m))
    const equal = new THREE.Group()
    equal.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()), new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()))
    expect(exactSnapshot(shared).hash).not.toBe(exactSnapshot(equal).hash)
  })
})
