import { DEFERRED_QUEUE_ID, checkDeferredQueue } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { BATCHED_LAYER, createStaticBatchQueue, createStaticBatcher } from '../src'
import type { StaticBatcher } from '../src'
import { THREE } from './helpers'

function car() {
  const root = new THREE.Group()
  const paint = new THREE.MeshStandardMaterial()
  const glass = new THREE.MeshStandardMaterial()
  const parts = [0, 1, 2].map((at) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), paint)
    mesh.position.set(at * 2, 0, 0)
    root.add(mesh)
    return mesh
  })
  const panes = [0, 1].map((at) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glass)
    mesh.position.set(at, 2, 0)
    root.add(mesh)
    return mesh
  })
  return { root, parts, panes }
}

const drawn = (object: THREE.Object3D) => object.layers.test(new THREE.Camera().layers)

describe('createStaticBatcher', () => {
  it('draws the meshes of one material as one batch, in place, and takes them off the camera layer', () => {
    const { root, parts, panes } = car()
    const batcher = createStaticBatcher(THREE, root)
    expect(batcher.stats()).toEqual({ batches: 2, batched: 5, released: 0 })
    expect(parts.every((part) => !drawn(part) && part.layers.isEnabled(BATCHED_LAYER))).toBe(true)
    const paint = batcher.group.children.find((child) => (child as THREE.Mesh).material === parts[0]!.material) as THREE.Mesh
    paint.geometry.computeBoundingBox()
    expect(paint.geometry.boundingBox!.min.x).toBeCloseTo(-0.5)
    expect(paint.geometry.boundingBox!.max.x).toBeCloseTo(4.5)
    expect(panes.every((pane) => !drawn(pane))).toBe(true)
  })

  it('batches copies of one material together when a material key says they draw the same, and keeps the others apart', () => {
    const root = new THREE.Group()
    const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a4a })
    const copies = [wood, wood.clone(), wood.clone()]
    const other = new THREE.MeshLambertMaterial({ color: 0x777777 })
    for (const [at, material] of [...copies, other].entries()) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
      mesh.position.set(at * 2, 0, 0)
      root.add(mesh)
    }
    expect(createStaticBatcher(THREE, root.clone()).stats()).toEqual({ batches: 0, batched: 0, released: 0 })
    const batcher = createStaticBatcher(THREE, root, { materialKey: (material) => `${material.type}:${(material as THREE.MeshLambertMaterial).color.getHex()}` })
    expect(batcher.stats()).toEqual({ batches: 1, batched: 3, released: 0 })
    expect((batcher.group.children[0] as THREE.Mesh).material).toBe(wood)
  })

  it('tells the host each batch it makes and the meshes it draws', () => {
    const { root, parts, panes } = car()
    const made: Array<[THREE.Mesh, readonly THREE.Mesh[]]> = []
    const batcher = createStaticBatcher(THREE, root, { onBatch: (batch, meshes) => made.push([batch, meshes]) })
    expect(made.map(([batch]) => batch)).toEqual(batcher.group.children)
    expect(made.map(([, meshes]) => meshes.length).sort()).toEqual([2, 3])
    expect(made.find(([, meshes]) => meshes.includes(parts[0]!))![1]).toEqual(parts)
    expect(made.find(([, meshes]) => meshes.includes(panes[0]!))![1]).toEqual(panes)
  })

  it('gives a mesh its own draw back when it moves, is dented or is hidden, and leaves the others batched', () => {
    const { root, parts, panes } = car()
    const batcher = createStaticBatcher(THREE, root)
    parts[0]!.rotation.y = 1
    root.updateMatrixWorld(true)
    parts[1]!.geometry.attributes.position!.needsUpdate = true
    panes[0]!.visible = false
    expect(batcher.update()).toBe(3)
    expect(drawn(parts[0]!) && drawn(parts[1]!)).toBe(true)
    expect(drawn(parts[2]!)).toBe(false)
    expect(batcher.stats().batched).toBe(2)
    expect(batcher.update()).toBe(0)
  })

  it('moves with its root without releasing anything, and is never hit by a ray', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root)
    root.position.set(10, 0, 0)
    root.updateMatrixWorld(true)
    expect(batcher.update()).toBe(0)
    const ray = new THREE.Raycaster(new THREE.Vector3(10, 0, 5), new THREE.Vector3(0, 0, -1))
    ray.layers.enableAll()
    const hits = ray.intersectObject(root, true)
    expect(hits[0]?.object).toBe(parts[0])
  })

  it('puts every mesh back on its layer on dispose', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root)
    batcher.dispose()
    expect(parts.every(drawn)).toBe(true)
    expect(root.getObjectByName('static-batches')).toBeUndefined()
  })
})

describe('createStaticBatcher with a rebuilt model', () => {
  it('releases a mesh that is no longer under its root', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root)
    root.remove(parts[0]!)
    expect(batcher.update()).toBe(1)
  })
})

describe('createStaticBatcher with a budget', () => {
  it('makes the batches over the next updates instead of in the call', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root, { budgetMs: 0 })
    expect(batcher.stats().batches).toBe(0)
    expect(drawn(parts[0]!)).toBe(true)
    batcher.update()
    batcher.update()
    expect(batcher.stats().batches).toBe(2)
    expect(drawn(parts[0]!)).toBe(false)
  })
  it('leaves out of a waiting group a mesh another drawer took (its layers changed) or that was hidden, and merges the rest', () => {
    const { root, parts } = car()
    const extra = new THREE.Mesh(parts[0]!.geometry, parts[0]!.material)
    root.add(extra)
    const batcher = createStaticBatcher(THREE, root, { budgetMs: 0 })
    parts[1]!.layers.set(29)
    parts[2]!.visible = false
    batcher.update()
    batcher.update()
    // the taken mesh keeps the layer it was given and is not batched; it never gets the grouped layers back from a dispose
    expect(parts[1]!.layers.mask).toBe(1 << 29)
    expect(drawn(parts[0]!)).toBe(false)
    expect(drawn(extra)).toBe(false)
    // the two paint meshes left and the two panes
    expect(batcher.stats().batched).toBe(4)
    batcher.dispose()
    expect(parts[1]!.layers.mask).toBe(1 << 29)
    expect(drawn(parts[0]!) && drawn(extra)).toBe(true)
  })

  it('leaves out of a waiting group a mesh whose material was swapped or that gained a colour attribute, and merges the rest without throwing', () => {
    const { root, parts } = car()
    const extra = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), parts[0]!.material)
    root.add(extra)
    const batcher = createStaticBatcher(THREE, root, { budgetMs: 0 })
    // the first of the group gains a colour attribute (a charred piece): copied first, the others have none to copy
    const tinted = parts[0]!.geometry.clone()
    tinted.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tinted.getAttribute('position').count * 3).fill(0.2), 3))
    parts[0]!.geometry = tinted
    parts[1]!.material = new THREE.MeshStandardMaterial({ color: 0x220000 })
    expect(() => {
      batcher.update()
      batcher.update()
    }).not.toThrow()
    expect(drawn(parts[0]!)).toBe(true)
    expect(drawn(parts[1]!)).toBe(true)
    expect(drawn(parts[2]!)).toBe(false)
    expect(drawn(extra)).toBe(false)
  })

  it('leaves out of a waiting group a mesh its include() no longer takes', () => {
    const { root, parts } = car()
    const refused = new Set<THREE.Object3D>()
    const batcher = createStaticBatcher(THREE, root, { budgetMs: 0, include: (mesh) => !refused.has(mesh) })
    refused.add(parts[1]!)
    batcher.update()
    batcher.update()
    expect(drawn(parts[1]!)).toBe(true)
    expect(drawn(parts[0]!) || drawn(parts[2]!)).toBe(false)
  })
})

describe('createStaticBatcher with every mesh of a batch released', () => {
  it('hides the empty batch', () => {
    const { root, panes } = car()
    const batcher = createStaticBatcher(THREE, root)
    for (const pane of panes) pane.visible = false
    batcher.update()
    const glass = batcher.group.children.find((child) => (child as THREE.Mesh).material === panes[0]!.material)!
    expect(glass.visible).toBe(false)
  })
})

describe('createStaticBatcher following its meshes', () => {
  it('keeps a posed mesh batched and draws its part of the batch where the mesh now is', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root, { followMeshes: true })
    const moved = parts[1]!
    moved.position.set(5, 3, -2)
    moved.rotation.set(0, Math.PI / 2, 0)
    root.updateMatrixWorld(true)
    expect(batcher.update()).toBe(0)
    const paint = batcher.group.children.find((child) => (child as THREE.Mesh).material === moved.material) as THREE.SkinnedMesh
    expect(paint.isSkinnedMesh).toBe(true)
    paint.skeleton.update()
    const vertices = (parts[0]!.geometry.attributes.position as THREE.BufferAttribute).count
    const corner = new THREE.Vector3().fromBufferAttribute(moved.geometry.attributes.position as THREE.BufferAttribute, 0)
    const expected = moved.localToWorld(corner.clone())
    const drawnAt = paint.localToWorld(paint.applyBoneTransform(vertices, new THREE.Vector3().fromBufferAttribute(paint.geometry.attributes.position as THREE.BufferAttribute, vertices)))
    expect(drawnAt.distanceTo(expected)).toBeLessThan(1e-5)
  })

  it('still gives a dented or hidden mesh its own draw back', () => {
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root, { followMeshes: true })
    parts[0]!.visible = false
    ;(parts[1]!.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    expect(batcher.update()).toBe(2)
  })

  it('shadowOnly: one shadow batch per side, the meshes still drawn on their own and not casting while batched', () => {
    const root = new THREE.Group()
    const brick = new THREE.MeshLambertMaterial({ color: 0x884422 })
    const tile = new THREE.MeshStandardMaterial({ color: 0x777777 })
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 })
    const leaves = new THREE.MeshLambertMaterial({ map: new THREE.Texture(), alphaTest: 0.5 })
    const cloth = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
    const make = (material: THREE.Material, at: number, casts = true): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
      mesh.position.set(at * 2, 0, 0)
      mesh.castShadow = casts
      root.add(mesh)
      return mesh
    }
    const walls = [make(brick, 0), make(tile, 1), make(glass, 2)]
    const cutOut = [make(leaves, 3), make(leaves, 4)]
    const sheets = [make(cloth, 5), make(cloth, 6)]
    const lamp = make(brick, 7, false)
    const batcher = createStaticBatcher(THREE, root, { shadowOnly: true })
    // brick, tile and glass draw the same into the depth map (front faces culled): one batch; the double-sided cloth is another
    expect(batcher.stats()).toEqual({ batches: 2, batched: 5, released: 0 })
    expect([...walls, ...sheets].every((mesh) => drawn(mesh) && !mesh.castShadow), 'still drawn by the camera, cast by the batch').toBe(true)
    expect(cutOut.every((mesh) => mesh.castShadow), 'a cut-out map casts its own shadow').toBe(true)
    expect(lamp.castShadow).toBe(false)
    const batches = batcher.group.children as THREE.Mesh[]
    expect(batches.every((batch) => batch.castShadow && !batch.receiveShadow)).toBe(true)
    expect(batches.every((batch) => Object.keys(batch.geometry.attributes).join() === 'position'), 'positions only').toBe(true)
    const sides = batches.map((batch) => (batch.material as THREE.Material).side).sort()
    expect(sides).toEqual([THREE.FrontSide, THREE.DoubleSide].sort())
    // the camera's pass gets an empty draw range (no draw call); the shadow pass the whole of it (the batch reads none of the arguments)
    const noArgs = [] as unknown as Parameters<THREE.Mesh['onBeforeShadow']>
    const batch = batches[0]!
    expect(batch.geometry.drawRange.count).toBeLessThan(0)
    batch.onBeforeShadow(...noArgs)
    expect(batch.geometry.drawRange.count).toBe(Number.POSITIVE_INFINITY)
    batch.onAfterShadow(...noArgs)
    expect(batch.geometry.drawRange.count).toBeLessThan(0)
  })

  it('shadowOnly: a mesh that changes casts its own shadow again, and dispose gives every mesh its shadow back', () => {
    const root = new THREE.Group()
    const brick = new THREE.MeshLambertMaterial()
    const walls = [0, 1, 2].map((at) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), brick)
      mesh.position.set(at * 2, 0, 0)
      mesh.castShadow = true
      root.add(mesh)
      return mesh
    })
    const batcher = createStaticBatcher(THREE, root, { shadowOnly: true })
    const batch = batcher.group.children[0] as THREE.Mesh
    // a piece hidden in place (its positions written over) or a wall knocked off its spot
    ;(walls[0]!.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
    walls[1]!.position.y += 0.2
    root.updateMatrixWorld(true)
    expect(batcher.update()).toBe(2)
    expect(walls[0]!.castShadow && walls[1]!.castShadow && !walls[2]!.castShadow).toBe(true)
    // the released ones leave the batch: their triangles collapse to one vertex
    const index = batch.geometry.index!
    const count = walls[0]!.geometry.index!.count
    expect(new Set(Array.from(index.array).slice(0, count * 2)).size).toBeLessThanOrEqual(2)
    expect(walls.every((wall) => drawn(wall))).toBe(true)
    batcher.dispose()
    expect(walls.every((wall) => wall.castShadow)).toBe(true)
    expect(batcher.group.parent).toBeNull()
  })
})

type Reference = { position: number[]; normal: number[]; uv: number[]; index: number[] }

/** The copy the batcher did before the typed-array loop: `getX` per vertex, one normal matrix per attribute. */
function referenceMerge(meshes: THREE.Mesh[], root: THREE.Object3D): Reference {
  root.updateMatrixWorld(true)
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const out: Reference = { position: [], normal: [], uv: [], index: [] }
  let vertexOffset = 0
  for (const mesh of meshes) {
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
    const { position, normal, uv } = mesh.geometry.attributes as Record<string, THREE.BufferAttribute>
    const target = { position: new Float32Array(position!.count * 3), normal: new Float32Array(position!.count * 3) }
    for (let at = 0; at < position!.count; at++) {
      const e = matrix.elements
      const x = position!.getX(at)
      const y = position!.getY(at)
      const z = position!.getZ(at)
      target.position.set([e[0]! * x + e[4]! * y + e[8]! * z + e[12]!, e[1]! * x + e[5]! * y + e[9]! * z + e[13]!, e[2]! * x + e[6]! * y + e[10]! * z + e[14]!], at * 3)
      const n = normalMatrix.elements
      const nx = normal!.getX(at)
      const ny = normal!.getY(at)
      const nz = normal!.getZ(at)
      const vx = n[0]! * nx + n[3]! * ny + n[6]! * nz
      const vy = n[1]! * nx + n[4]! * ny + n[7]! * nz
      const vz = n[2]! * nx + n[5]! * ny + n[8]! * nz
      const length = Math.hypot(vx, vy, vz) || 1
      target.normal.set([vx / length, vy / length, vz / length], at * 3)
    }
    out.position.push(...target.position)
    out.normal.push(...target.normal)
    for (let at = 0; at < uv!.count; at++) out.uv.push(uv!.getComponent(at, 0), uv!.getComponent(at, 1))
    const index = mesh.geometry.index!
    for (let at = 0; at < index.count; at++) out.index.push(index.getX(at) + vertexOffset)
    vertexOffset += position!.count
  }
  return out
}

describe('createStaticBatcher merge copy', () => {
  const merged = (batcher: ReturnType<typeof createStaticBatcher>): Reference => {
    const { attributes, index } = (batcher.group.children[0] as THREE.Mesh).geometry
    return {
      position: [...(attributes.position!.array as Float32Array)],
      normal: [...(attributes.normal!.array as Float32Array)],
      uv: [...(attributes.uv!.array as Float32Array)],
      index: [...(index!.array as Uint16Array)],
    }
  }
  const moved = () => {
    const root = new THREE.Group()
    root.position.set(3, -1, 2)
    root.rotation.set(0.2, 0.5, 0.1)
    const material = new THREE.MeshStandardMaterial()
    const meshes = [new THREE.BoxGeometry(1, 2, 3), new THREE.SphereGeometry(1, 8, 6), new THREE.CylinderGeometry(1, 0.5, 2, 7)].map((geometry, at) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(at, at * 2, -at)
      mesh.rotation.set(at * 0.3, 0.1, at)
      mesh.scale.set(1 + at * 0.2, 1, 2 - at * 0.3)
      root.add(mesh)
      return mesh
    })
    return { root, meshes }
  }

  it('gives the same bytes as the per-vertex copy for positions, normals, uvs and indexes', () => {
    const { root, meshes } = moved()
    const expected = referenceMerge(meshes, root)
    const actual = merged(createStaticBatcher(THREE, root))
    expect(actual.position).toEqual([...new Float32Array(expected.position)])
    expect(actual.normal).toEqual([...new Float32Array(expected.normal)])
    expect(actual.uv).toEqual(expected.uv)
    expect(actual.index).toEqual(expected.index)
  })

  it('reads an interleaved or normalized attribute through its accessors, as before', () => {
    const root = new THREE.Group()
    const material = new THREE.MeshBasicMaterial()
    const plain = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    const odd = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    const source = odd.geometry.attributes.position as THREE.BufferAttribute
    const stride = new THREE.InterleavedBuffer(new Float32Array(source.count * 4), 4)
    const interleaved = new THREE.InterleavedBufferAttribute(stride, 3, 1)
    for (let at = 0; at < source.count; at++) interleaved.setXYZ(at, source.getX(at), source.getY(at), source.getZ(at))
    odd.geometry.setAttribute('position', interleaved as unknown as THREE.BufferAttribute)
    odd.position.set(2, 0, 0)
    root.add(plain, odd)
    const batcher = createStaticBatcher(THREE, root, { materialKey: () => 'same' })
    const position = (batcher.group.children[0] as THREE.Mesh).geometry.attributes.position as THREE.BufferAttribute
    expect(position.count).toBe(2 * source.count)
    expect(position.getX(source.count)).toBeCloseTo(source.getX(0) + 2)
  })
})

describe('createStaticBatchQueue', () => {
  const scene = (count: number) => Array.from({ length: count }, () => car().root)

  it('honours the DeferredQueue contract', () => {
    const queue = createStaticBatchQueue({ id: DEFERRED_QUEUE_ID.STATIC_BATCH })
    const report = checkDeferredQueue(queue.deferredQueue(), () => scene(2).forEach((root) => createStaticBatcher(THREE, root, { queue })))
    expect(report.problems).toEqual([])
  })

  it('carries the id it was given and the static-batch default', () => {
    expect(createStaticBatchQueue({ id: 'animals.static-batch' }).deferredQueue().id).toBe('animals.static-batch')
    expect(createStaticBatchQueue().deferredQueue().id).toBe(DEFERRED_QUEUE_ID.STATIC_BATCH)
  })

  it('merges nothing in the call, one chunk per unit, rotating between the batchers', () => {
    const queue = createStaticBatchQueue()
    const [first, second] = scene(2).map((root) => createStaticBatcher(THREE, root, { queue })) as [StaticBatcher, StaticBatcher]
    const deferred = queue.deferredQueue()
    expect(first.stats().batches + second.stats().batches).toBe(0)
    // each car has two groups (paint, glass): four chunks
    expect(deferred.pending()).toBe(4)
    expect(deferred.run(0, () => 1)).toBe(1)
    expect([first.stats().batches, second.stats().batches]).toEqual([1, 0])
    expect(deferred.run(0, () => 1)).toBe(1)
    expect([first.stats().batches, second.stats().batches]).toEqual([1, 1])
  })

  it('runs units until the deadline and at least one when it has passed', () => {
    const queue = createStaticBatchQueue()
    scene(2).forEach((root) => createStaticBatcher(THREE, root, { queue }))
    let now = 0
    expect(queue.deferredQueue().run(1, () => now++)).toBe(2)
    expect(queue.deferredQueue().pending()).toBe(2)
  })

  it('leaves the merging to a registered queue: update releases changes but merges nothing', () => {
    const queue = createStaticBatchQueue()
    queue.deferredQueue().attach?.()
    const { root, parts } = car()
    const batcher = createStaticBatcher(THREE, root, { queue })
    batcher.update()
    expect(batcher.stats().batches).toBe(0)
    queue.deferredQueue().flush()
    expect(batcher.stats()).toEqual({ batches: 2, batched: 5, released: 0 })
    parts[0]!.position.x += 1
    parts[0]!.updateMatrixWorld(true)
    expect(batcher.update()).toBe(1)
  })

  it('drains inside update with budgetMs when no budget registered it, as before', () => {
    const queue = createStaticBatchQueue()
    const { root } = car()
    const batcher = createStaticBatcher(THREE, root, { queue })
    expect(batcher.stats().batches).toBe(0)
    batcher.update()
    expect(batcher.stats().batches).toBe(2)
    queue.deferredQueue().detach?.()
    const { root: other } = car()
    const slow = createStaticBatcher(THREE, other, { queue, budgetMs: 0 })
    slow.update()
    expect(slow.stats().batches).toBe(1)
    slow.update()
    expect(slow.stats().batches).toBe(2)
  })

  it('forgets a disposed batcher and its waiting chunks', () => {
    const queue = createStaticBatchQueue()
    const { root } = car()
    const batcher = createStaticBatcher(THREE, root, { queue })
    expect(queue.deferredQueue().pending()).toBe(2)
    batcher.dispose()
    expect(queue.deferredQueue().pending()).toBe(0)
    expect(queue.deferredQueue().run(0, () => 1)).toBe(0)
  })

  it('splits a group into chunks of maxVertices and merges one chunk per unit', () => {
    const queue = createStaticBatchQueue()
    const root = new THREE.Group()
    const material = new THREE.MeshBasicMaterial()
    for (let at = 0; at < 6; at++) root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material))
    const batcher = createStaticBatcher(THREE, root, { queue, maxVertices: 48 })
    // a box has 24 vertices: two per chunk
    expect(queue.deferredQueue().pending()).toBe(3)
    queue.deferredQueue().run(0, () => 1)
    expect(batcher.stats()).toEqual({ batches: 1, batched: 2, released: 0 })
  })
})
