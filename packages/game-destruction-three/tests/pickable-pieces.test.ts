import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'

const hasCore = existsSync(fileURLToPath(new URL('../../game-destruction/dist/index.js', import.meta.url)))

const meshesOf = (o: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = []
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh)
  })
  return out
}

function chair() {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), eventBudgetMs: Infinity })
  world.addObject('chair', [partState('seat', 'wood', { mass: 3 }), partState('leg', 'wood', { mass: 1 })], [['seat'], ['leg']])
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5))
  seat.position.y = 2
  // a leg made of two meshes (a part can be several meshes) and no userData at all
  const leg = new THREE.Group()
  const legA = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05))
  const legB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06))
  legA.position.set(0.2, 1.75, 0.2)
  legB.position.set(0.2, 1.55, 0.2)
  leg.add(legA, legB)
  const root = new THREE.Group()
  root.add(seat, leg)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('chair', root, { parts: { seat, leg } })
  return { scene, world, renderer, seat, legA, legB }
}

describe('loose pieces stay pickable', () => {
  it('every mesh of a piece carries the part id and the id of the piece the world made', () => {
    const { world, renderer, seat, legA, legB } = chair()
    expect(seat.userData).toMatchObject({ destructionPart: 'seat', destructionObject: 'chair' })
    world.emit({ type: 'detach', object: 'chair', joint: 'j', parts: ['seat', 'leg'], by: 'break', groups: [['seat'], ['leg']] })
    renderer.update(0)
    expect(world.splits).toHaveLength(1)
    const newId = world.splits[0].newId
    for (const m of [legA, legB]) {
      expect(m.userData.destructionPart).toBe('leg')
      expect(m.userData.destructionObject).toBe(newId)
    }
    expect(seat.userData).toMatchObject({ destructionPart: 'seat', destructionObject: 'chair' })
    expect(renderer.piece(newId)).not.toBeNull()
    // a raycast against the piece finds the part and the object
    const piece = renderer.piece(newId)!
    piece.root.updateMatrixWorld(true)
    const hit = new THREE.Raycaster(new THREE.Vector3(0.2, 3, 0.2), new THREE.Vector3(0, -1, 0)).intersectObject(piece.root, true)[0]
    expect(hit.object.userData).toMatchObject({ destructionPart: 'leg', destructionObject: newId })
  })

  it('restore gives the meshes back to the object they came from', () => {
    const { world, renderer, legA } = chair()
    world.emit({ type: 'detach', object: 'chair', joint: 'j', parts: ['seat', 'leg'], by: 'break', groups: [['seat'], ['leg']] })
    renderer.update(0)
    expect(legA.userData.destructionObject).not.toBe('chair')
    renderer.restore('chair')
    expect(legA.userData).toMatchObject({ destructionPart: 'leg', destructionObject: 'chair' })
  })

  it('keeps an object-valued destructionPart hint intact when it already names the part', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    world.addObject('o', [partState('trunk', 'wood')])
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1))
    const hint = { id: 'trunk', material: 'green_wood' }
    m.userData.destructionPart = hint
    scene.add(m)
    renderer.bind('o', m, { parts: { trunk: m } })
    expect(m.userData.destructionPart).toBe(hint)
    expect(m.userData.destructionObject).toBe('o')
  })

  it('a part drawn by a vertex range gets its own tagged mesh when it leaves, and the merged mesh stays untagged', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
    const a = new THREE.BoxGeometry(1, 1, 1).translate(-0.6, 0, 0)
    const b = new THREE.BoxGeometry(1, 1, 1).translate(0.6, 0, 0)
    const n = a.getAttribute('position').count
    const pos = new Float32Array([...Array.from(a.getAttribute('position').array), ...Array.from(b.getAttribute('position').array)])
    const nor = new Float32Array([...Array.from(a.getAttribute('normal').array), ...Array.from(b.getAttribute('normal').array)])
    const idx = [...Array.from(a.getIndex()!.array), ...Array.from(b.getIndex()!.array).map((i) => i + n)]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3))
    geo.setIndex(idx)
    const merged = new THREE.Mesh(geo, new THREE.MeshStandardMaterial())
    const root = new THREE.Group()
    root.add(merged)
    scene.add(root)
    root.updateMatrixWorld(true)
    world.addObject('house', [partState('a', 'wood'), partState('b', 'wood')], [['a', 'b']])
    renderer.bind('house', root, { parts: { a: { mesh: merged, range: [0, n] }, b: { mesh: merged, range: [n, 2 * n] } } })
    expect(merged.userData.destructionPart).toBeUndefined()
    world.objects.get('house')!.groups = [['a'], ['b']]
    world.emit({ type: 'detach', object: 'house', joint: 'j', parts: ['a', 'b'], by: 'break', groups: [['a'], ['b']] })
    renderer.update(0)
    const newId = world.splits[0].newId
    const loose = meshesOf(renderer.piece(newId)!.root)
    expect(loose.length).toBeGreaterThan(0)
    for (const m of loose) expect(m.userData).toMatchObject({ destructionPart: 'b', destructionObject: newId })
    expect(merged.userData.destructionPart).toBeUndefined()
  })
})

describe('visual debris is marked', () => {
  it('fracture fragments, decals and ground stains carry destructionDebris', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), eventBudgetMs: Infinity })
    world.addObject('o', [partState('top', 'glass'), partState('plate', 'wood')])
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1))
    const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 1))
    scene.add(plate, top)
    renderer.bind('o', scene, { parts: { plate, top } })
    const before = new Set(meshesOf(scene))
    world.emit({
      type: 'fracture', object: 'o', part: 'top', style: 'shatter', point: [0, 1, 0],
      fragments: [0, 1, 2].map((i) => ({ id: `f${i}`, part: 'top', material: 'glass', shape: 'shard', center: [0, 1, 0], size: [0.1, 0.1, 0.01], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angularVelocity: [0, 0, 0], mass: 0.1 })),
    } as never)
    world.emit({ type: 'hole', object: 'o', part: 'plate', worldPoint: [0, 0.05, 0], hole: { point: [0, 0.05, 0], normal: [0, 1, 0], diameter: 0.02, through: false } })
    renderer.update(0.016)
    const added = meshesOf(scene).filter((m) => !before.has(m))
    expect(added.length).toBeGreaterThanOrEqual(4)
    for (const m of added) expect(m.userData.destructionDebris).toBe(true)
    // the part meshes themselves are not debris
    expect(plate.userData.destructionDebris).toBeUndefined()
  })
})

describe.skipIf(!hasCore)('with the real world', () => {
  it('the object id on a piece is a live object of the world', async () => {
    const { createDestruction } = await import('@adatechnology/game-destruction')
    const world = createDestruction()
    const scene = new THREE.Scene()
    const renderer = createDestructionRenderer(THREE, { scene, world })
    const parts = [
      { id: 'base', material: 'wood_hard', shape: { kind: 'box' as const, size: [1, 0.2, 1] as [number, number, number] }, position: [0, 0.1, 0] as [number, number, number], anchored: true },
      { id: 'lid', material: 'wood_hard', shape: { kind: 'box' as const, size: [1, 0.1, 1] as [number, number, number] }, position: [0, 0.3, 0] as [number, number, number] },
    ]
    const id = world.add({ parts, joints: [{ a: 'lid', b: 'base', kind: 'nail' }] })
    const root = new THREE.Group()
    const meshes: Record<string, THREE.Mesh> = {}
    for (const p of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...(p.shape.size as [number, number, number])))
      m.position.set(...p.position)
      meshes[p.id] = m
      root.add(m)
    }
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: meshes })
    world.hit(id, { type: 'blunt', point: [0, 0.2, 0], direction: [0, -1, 0], energy: 4000, radius: 0.3 })
    for (let i = 0; i < 20; i++) {
      world.update(0.05)
      renderer.update(0.05)
    }
    const pieces = renderer.pieces()
    expect(pieces.length).toBeGreaterThan(0)
    for (const p of pieces) {
      expect(world.has(p.objectId)).toBe(true)
      for (const m of meshesOf(p.root)) {
        expect(m.userData.destructionObject).toBe(p.objectId)
        expect(world.part(p.objectId, m.userData.destructionPart as string)).not.toBeNull()
      }
    }
  })
})
