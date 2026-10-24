import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { describeScene, hashText, snapshotScene } from '../src'
import type { SceneNodeLike } from '../src'

function buildScene(): THREE.Group {
  const root = new THREE.Group()
  root.name = 'vehicle'
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: 0x9a2424 }))
  body.name = 'body'
  body.position.set(0, 0.5, 0)
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x0a0b0c }))
  wheel.name = 'wheel'
  wheel.rotation.z = Math.PI / 2
  wheel.position.set(1, 0.3, 1.5)
  root.add(body, wheel)
  return root
}

const asNode = (root: THREE.Object3D): SceneNodeLike => root as unknown as SceneNodeLike

describe('snapshotScene', () => {
  it('is stable across runs and across independent builds', () => {
    expect(snapshotScene(asNode(buildScene())).hash).toBe(snapshotScene(asNode(buildScene())).hash)
  })

  it('does not depend on uuids', () => {
    const first = buildScene()
    const second = buildScene()
    expect(first.uuid).not.toBe(second.uuid)
    expect(describeScene(asNode(first))).toEqual(describeScene(asNode(second)))
  })

  it('changes when one vertex moves', () => {
    const changed = buildScene()
    const body = changed.getObjectByName('body') as THREE.Mesh
    const positions = body.geometry.attributes.position as THREE.BufferAttribute
    positions.setX(0, positions.getX(0) + 0.01)
    expect(snapshotScene(asNode(changed)).hash).not.toBe(snapshotScene(asNode(buildScene())).hash)
  })

  it('changes when a material color changes', () => {
    const changed = buildScene()
    ;((changed.getObjectByName('body') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(0x112233)
    expect(snapshotScene(asNode(changed)).hash).not.toBe(snapshotScene(asNode(buildScene())).hash)
  })

  it('changes when a transform moves beyond the precision, and ignores noise below it', () => {
    const baseline = snapshotScene(asNode(buildScene())).hash
    const noisy = buildScene()
    noisy.getObjectByName('wheel')?.position.addScalar(1e-7)
    expect(snapshotScene(asNode(noisy)).hash).toBe(baseline)
    const moved = buildScene()
    moved.getObjectByName('wheel')?.position.addScalar(0.01)
    expect(snapshotScene(asNode(moved)).hash).not.toBe(baseline)
  })

  it('catches a 1 mm move of one vertex and of one transform', () => {
    const baseline = snapshotScene(asNode(buildScene())).hash
    const vertex = buildScene()
    const positions = (vertex.getObjectByName('body') as THREE.Mesh).geometry.attributes.position as THREE.BufferAttribute
    positions.setX(0, positions.getX(0) + 0.001)
    expect(snapshotScene(asNode(vertex)).hash).not.toBe(baseline)
    const transform = buildScene()
    transform.getObjectByName('wheel')?.position.addScalar(0.001)
    expect(snapshotScene(asNode(transform)).hash).not.toBe(baseline)
  })

  it('changes when a node is renamed, unless names are ignored', () => {
    const renamed = buildScene()
    renamed.getObjectByName('wheel')!.name = 'tyre'
    expect(snapshotScene(asNode(renamed)).hash).not.toBe(snapshotScene(asNode(buildScene())).hash)
    expect(snapshotScene(asNode(renamed), { ignoreNames: true }).hash).toBe(snapshotScene(asNode(buildScene()), { ignoreNames: true }).hash)
  })

  it('reports geometry type, vertex count and bounding box per node', () => {
    const lines = describeScene(asNode(buildScene()))
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('geo:BoxGeometry v24')
    expect(lines[1]).toContain('bbox-1,-0.5,-2,1,0.5,2')
    expect(lines[1]).toContain('MeshStandardMaterial:9a2424:1')
  })
})

describe('hashText', () => {
  it('is FNV-1a: stable, hex, and sensitive to one character', () => {
    expect(hashText('')).toBe('811c9dc5')
    expect(hashText('a')).toBe('e40c292c')
    expect(hashText('rooms')).not.toBe(hashText('rooms '))
  })
})
