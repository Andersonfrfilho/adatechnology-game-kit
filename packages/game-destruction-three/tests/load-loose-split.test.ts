import { markKitOrigin } from '@adatechnology/game-contracts'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import type { Piece, RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const FRAME = 1 / 60

/** An object `o1` already built with the given groups (the first one stays the object), each part a small box in a row on the floor, bound and not yet updated. */
function builtWith(groups: string[][], options: Partial<RendererOptions> = {}, heights: Record<string, number> = {}) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const onPiece = vi.fn<(piece: Piece) => void>()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), onPiece, ...options })
  const ids = groups.flat()
  world.addObject('o1', ids.map((id) => partState(id, 'wood')), groups.map((group) => [...group]))
  const root = new THREE.Group()
  const meshes: Record<string, THREE.Mesh> = {}
  ids.forEach((id, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial())
    mesh.position.set(index, heights[id] ?? 0.1, 0)
    meshes[id] = mesh
    root.add(mesh)
  })
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  const splitParts = (): string[][] => world.splits.map((split) => world.state(split.newId)?.parts.map((part) => part.id) ?? [])
  return { renderer, world, meshes, onPiece, splitParts }
}

describe('an object bound with loose groups, without the work budget', () => {
  it('has them as pieces after one update, none left as extra groups in its object, and none split inside bind', () => {
    const { renderer, world, onPiece, splitParts } = builtWith([['base'], ['pole'], ['mailbox'], ['door', 'hinge']])
    expect(world.splits).toHaveLength(0)
    renderer.update(FRAME)
    expect(splitParts()).toEqual([['pole'], ['mailbox'], ['door', 'hinge']])
    expect(world.state('o1')?.groups).toEqual([['base']])
    expect(onPiece).toHaveBeenCalledTimes(3)
    expect(renderer.pieces()).toHaveLength(3)
  })

  it('the pieces start where their parts stood, still', () => {
    const { renderer, meshes } = builtWith([['base'], ['pole']])
    const before = meshes.pole!.getWorldPosition(new THREE.Vector3())
    renderer.update(FRAME)
    const after = meshes.pole!.getWorldPosition(new THREE.Vector3())
    expect(after.distanceTo(before)).toBeLessThan(0.01)
  })

  it('one standing on something starts asleep where it stood: nothing jumps', () => {
    const { renderer, meshes } = builtWith([['base'], ['pole']])
    renderer.update(FRAME)
    const piece = renderer.pieces()[0]!
    expect(piece.sleeping).toBe(true)
    const before = meshes.pole!.getWorldPosition(new THREE.Vector3())
    for (let frame = 0; frame < 30; frame++) renderer.update(FRAME)
    expect(meshes.pole!.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-6)
  })

  it('one held up by nothing (a door whose wall was taken out) is awake and falls: nothing loose hangs in the air', () => {
    const { renderer, meshes } = builtWith([['base'], ['door']], {}, { door: 2 })
    renderer.update(FRAME)
    expect(renderer.pieces()[0]!.sleeping).toBe(false)
    for (let frame = 0; frame < 120; frame++) renderer.update(FRAME)
    expect(meshes.door!.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(0.5)
  })

  it('splits in the same order every run', () => {
    const groups = [['base'], ['c'], ['a'], ['b', 'd']]
    const runs = [0, 1].map(() => {
      const { renderer, splitParts } = builtWith(groups)
      renderer.update(FRAME)
      return splitParts()
    })
    expect(runs[0]).toEqual(runs[1])
  })

  it('with autoSplit off keeps them in its object, as before', () => {
    const { renderer, world, onPiece } = builtWith([['base'], ['pole'], ['mailbox']], { autoSplit: false })
    renderer.update(FRAME)
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(0)
    expect(world.state('o1')?.groups).toHaveLength(3)
    expect(onPiece).not.toHaveBeenCalled()
  })

  it('with no loose group creates nothing', () => {
    const { renderer, world, onPiece } = builtWith([['base', 'wall', 'roof']])
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(0)
    expect(onPiece).not.toHaveBeenCalled()
    expect(renderer.pieces()).toHaveLength(0)
  })

  it('a deferred-queue flush splits them too, before any update', () => {
    const { renderer, world } = builtWith([['base'], ['pole'], ['mailbox']])
    expect(renderer.deferredQueue().pending()).toBeGreaterThan(0)
    renderer.deferredQueue().flush()
    expect(world.splits).toHaveLength(2)
    expect(renderer.deferredQueue().pending()).toBe(0)
  })

  it('unbound before the update, splits nothing', () => {
    const { renderer, world } = builtWith([['base'], ['pole']])
    renderer.unbind('o1')
    renderer.update(FRAME)
    expect(world.splits).toHaveLength(0)
  })
})

/** A table `o1` (furniture): a floor slab that stays the object and, loose or not, a 1.2 m top on one leg under its end (§12: a top on one leg always topples). */
function tableOnOneLeg(looseAtBind: boolean) {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
  const all = [['slab', 'top', 'leg']]
  world.addObject('o1', ['slab', 'top', 'leg'].map((id) => partState(id, 'wood')), looseAtBind ? [['slab'], ['top', 'leg']] : all)
  const root = new THREE.Group()
  const box = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial())
    mesh.position.set(x, y, z)
    root.add(mesh)
    return mesh
  }
  const meshes = { slab: box(0.2, 0.2, 0.2, 5, 0.1, 0), top: box(1.2, 0.04, 0.6, 0, 0.74, 0), leg: box(0.05, 0.72, 0.05, -0.55, 0.36, 0) }
  markKitOrigin(root, { owner: 'game-floorplan-three', kind: 'furniture', id: 'table' })
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind('o1', root, { parts: meshes })
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += FRAME) renderer.update(FRAME)
  }
  return { renderer, world, meshes, run }
}

describe('a loose group that cannot stand where it stood', () => {
  it('bound as a top on one leg: it is not put to sleep there, it topples', () => {
    const { renderer, meshes, run } = tableOnOneLeg(true)
    renderer.update(FRAME)
    expect(renderer.pieces()).toHaveLength(1)
    expect(renderer.pieces()[0]!.sleeping).toBe(false)
    run(3)
    expect(meshes.top.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(0.5)
  })

  it('drawn again from a world where it broke loose (a restored broken table): it topples as a live one does', () => {
    const { renderer, world, meshes, run } = tableOnOneLeg(false)
    run(0.1)
    expect(renderer.pieces()).toHaveLength(0)
    world.state('o1')!.groups = [['slab'], ['top', 'leg']]
    renderer.redraw('o1')
    renderer.update(FRAME)
    // live, the furniture left standing is a piece too (the slab here)
    const table = renderer.pieces().find((piece) => piece.objectId !== 'o1')
    expect(table?.sleeping).toBe(false)
    run(3)
    expect(meshes.top.getWorldPosition(new THREE.Vector3()).y).toBeLessThan(0.5)
  })

  it('a top on four legs, bound loose, sleeps where it stood', () => {
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld() })
    const ids = ['slab', 'top', 'l0', 'l1', 'l2', 'l3']
    world.addObject('o1', ids.map((id) => partState(id, 'wood')), [['slab'], ids.slice(1)])
    const root = new THREE.Group()
    const parts: Record<string, THREE.Mesh> = {}
    const box = (id: string, w: number, h: number, d: number, x: number, y: number, z: number): void => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial())
      mesh.position.set(x, y, z)
      root.add(mesh)
      parts[id] = mesh
    }
    box('slab', 0.2, 0.2, 0.2, 5, 0.1, 0)
    box('top', 1.2, 0.04, 0.6, 0, 0.74, 0)
    ;[[-0.55, -0.25], [0.55, -0.25], [-0.55, 0.25], [0.55, 0.25]].forEach(([x, z], k) => box(`l${k}`, 0.05, 0.72, 0.05, x!, 0.36, z!))
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind('o1', root, { parts })
    renderer.update(FRAME)
    expect(renderer.pieces()).toHaveLength(1)
    expect(renderer.pieces()[0]!.sleeping).toBe(true)
  })
})
