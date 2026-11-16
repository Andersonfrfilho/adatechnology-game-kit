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
