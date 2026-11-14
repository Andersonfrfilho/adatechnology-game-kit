import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import type { Piece, RendererOptions } from '../src/types'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

/** `count` crates of `size` metres in a row away from the blast at the origin, each bound and (with `piece`) already a piece. */
const crates = (count: number, size: number, options: Partial<RendererOptions>, piece = true) => {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), eventBudgetMs: Infinity, ...options })
  const pieces: Piece[] = []
  for (let i = 0; i < count; i++) {
    const id = `crate${i}`
    world.addObject(id, [partState('box', 'wood', { mass: 10 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(1.5 + (i % 8) * 0.5, size / 2, Math.floor(i / 8) * 0.5)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { box: mesh } })
    if (piece) pieces.push(renderer.makePiece(id))
  }
  return { renderer, pieces }
}

const moving = (pieces: readonly Piece[]): number => pieces.filter((p) => Math.hypot(...p.velocity) > 0.5).length

describe('the debris of a blast (spec 008 D4)', () => {
  it('without the option the whole blast shoves in its own frame, as before', () => {
    const { renderer, pieces } = crates(40, 0.3, {})
    renderer.explode([0, 0.2, 0], 200000, 8, { visual: false })
    expect(moving(pieces)).toBe(40)
  })

  it('with the option the shoves wait their turn, from the numbers given, and all are in by the maximum delay', () => {
    const { renderer, pieces } = crates(40, 0.3, { blastDebris: { wakeCostTargetMs: 0, minWakesPerFrame: 4, maxWakeDelay: 0.1 } })
    renderer.explode([0, 0.2, 0], 200000, 8, { visual: false })
    expect(moving(pieces)).toBe(4)
    for (let frame = 0; frame < 3; frame++) renderer.update(1 / 60)
    expect(moving(pieces)).toBeGreaterThan(4)
    expect(moving(pieces)).toBeLessThan(40)
    for (let frame = 0; frame < 8; frame++) renderer.update(1 / 60)
    expect(moving(pieces)).toBeGreaterThan(30)
  })

  it('a blast can override the numbers of the renderer that are its own (how long its debris waits, how many pieces)', () => {
    const { renderer, pieces } = crates(40, 0.3, { blastDebris: { wakeCostTargetMs: 0, minWakesPerFrame: 4 } })
    renderer.explode([0, 0.2, 0], 200000, 8, { visual: false, debris: { maxWakeDelay: 0 } })
    expect(moving(pieces)).toBe(40)
  })

  it('only the count the measured cost allows enters physics, the big ones first; the rest stay where they stand', () => {
    const loosened: string[] = []
    const { renderer } = crates(12, 0.3, { blastDebris: { minPhysicsPieces: 2, maxPhysicsPieces: 5 }, shoveable: () => true, onLoosened: (id) => loosened.push(id) }, false)
    renderer.explode([0, 0.2, 0], 200000, 8, { visual: false })
    expect(loosened).toHaveLength(5)
    const small = crates(12, 0.05, { blastDebris: { minPhysicsPieces: 2, maxPhysicsPieces: 5, chipSize: 0.15 }, shoveable: () => true }, false)
    small.renderer.explode([0, 0.2, 0], 200000, 8, { visual: false, debris: { maxPhysicsPieces: 3 } })
    const bodies = Array.from({ length: 12 }, (_, i) => small.renderer.piece(`crate${i}`)).filter((p) => p !== null)
    expect(bodies).toHaveLength(3)
  })

  it('far and old debris at rest fades: its body goes, its root shrinks away and the host disposes it', () => {
    const faded: string[] = []
    const { renderer, pieces } = crates(3, 0.3, { blastDebris: { far: { distance: 10, age: 0, action: 'fade', fadeSeconds: 0.2 } }, focus: () => [100, 0, 0], onDebrisFaded: (id) => faded.push(id) })
    for (let frame = 0; frame < 240; frame++) renderer.update(1 / 60)
    expect(faded.sort()).toEqual(['crate0', 'crate1', 'crate2'])
    expect(pieces.every((p) => renderer.piece(p.objectId) === null)).toBe(true)
  })

  it('far and old debris sleeps by default and stays in the world', () => {
    const { renderer, pieces } = crates(3, 0.3, { blastDebris: { far: { distance: 10, age: 0 } }, focus: () => [100, 0, 0] })
    for (let frame = 0; frame < 240; frame++) renderer.update(1 / 60)
    expect(pieces.every((p) => p.sleeping)).toBe(true)
    expect(renderer.pieces().length).toBe(3)
  })

  it('over the cap of pieces alive the oldest at rest fade, near or far', () => {
    const faded: string[] = []
    const { renderer } = crates(6, 0.3, { blastDebris: { maxLivePieces: 4 }, onDebrisFaded: (id) => faded.push(id) })
    for (let frame = 0; frame < 240; frame++) renderer.update(1 / 60)
    expect(faded).toHaveLength(2)
    expect(renderer.pieces().length).toBe(4)
  })
})
