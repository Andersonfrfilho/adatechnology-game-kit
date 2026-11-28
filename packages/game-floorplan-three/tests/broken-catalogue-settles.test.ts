import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

const STEP = 1 / 60
/** Seconds after the last part broke by which everything loose has come to rest. */
const SETTLED = 8
/** Seconds it is then watched for. */
const WATCH = 1
/** A piece of debris that moved more than this (m) while watched is not at rest. */
const MOVED = 1e-3
/** A loose piece faster than this (m/s plus rad/s) while watched is not at rest. */
const AWAKE = 0.05

/**
 * The pieces of the catalogue that still leave something moving `SETTLED` s after they were broken, and what: debt found when this test was written, which only goes down.
 * A piece fixed leaves the list; a new piece never enters it.
 */
const KNOWN: Readonly<Record<string, string>> = {
  armchair: 'debris',
  armchair_high: 'debris',
  console_table: 'debris',
  curtain: 'debris',
  dresser: 'debris',
  floor_lamp: 'piece',
  laundry_cabinet: 'debris',
  nightstand: 'debris',
  shower: 'piece',
  shower_large: 'piece',
  sofa_2seat: 'debris',
  vanity_table: 'debris',
  wardrobe_small: 'debris',
  washbasin: 'debris',
}

const catalog = defaultFurnitureCatalog()
const types = [...new Set(catalog.map((entry) => entry.type))]

/** What of the piece, every part of it broken one after the other from the floor up, still moves `SETTLED` s later: 'debris' (its fragments), 'piece' (a loose piece), or null. */
function unsettled(type: string): string | null {
  let made: ReturnType<typeof furnitureSpec>
  try {
    made = furnitureSpec(THREE, type, { catalog, document: fakeDocument, options: { chairs: false } })
  } catch {
    return null
  }
  const scene = new THREE.Scene()
  const world = createDestruction()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const id = world.add(made.spec, { id: type })
  const root = made.build(THREE)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root)
  if (!made.fixed) renderer.makePiece(id)
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += STEP) {
      world.update(STEP)
      renderer.update(STEP)
    }
  }
  run(1)
  const parts = [...made.spec.parts].sort((a, b) => (a.position?.[1] ?? 0) - (b.position?.[1] ?? 0))
  for (const part of parts) {
    const at: [number, number, number] = [part.position?.[0] ?? 0, part.position?.[1] ?? 0, part.position?.[2] ?? 0]
    for (let i = 0; i < 12; i++) {
      const state = world.part(id, part.id)
      if (!state || state.status === 'broken' || state.status === 'ashes' || state.status === 'melted') break
      world.hitPart(id, part.id, { type: 'blunt', point: at, direction: [0, 0, -1], energy: 20000, radius: 0.05, source: 'test' })
    }
    run(0.3)
  }
  run(SETTLED)
  // a fragment fading away shrinks as it goes: only one that kept its size is judged
  const debris = (): Map<THREE.Object3D, { at: THREE.Vector3; size: number }> => {
    const found = new Map<THREE.Object3D, { at: THREE.Vector3; size: number }>()
    scene.traverse((node) => {
      if (node.name === 'fragment') found.set(node, { at: node.position.clone(), size: node.scale.x })
    })
    return found
  }
  const before = debris()
  const awake = new Set(renderer.pieces().filter((piece) => !piece.sleeping))
  run(WATCH)
  const moved = [...debris()].some(([node, now]) => {
    const was = before.get(node)
    return was !== undefined && was.size === now.size && was.at.distanceTo(now.at) > MOVED
  })
  if (moved) return 'debris'
  const restless = renderer.pieces().some((piece) => awake.has(piece) && !piece.sleeping && Math.hypot(...piece.velocity) + Math.hypot(...piece.angularVelocity) > AWAKE)
  return restless ? 'piece' : null
}

describe('every piece of furniture of the catalogue, broken to the end', () => {
  it(`nothing of it still moves ${SETTLED} s later (but the debt counted in KNOWN, which only goes down)`, () => {
    const found: Record<string, string> = {}
    for (const type of types) {
      const what = unsettled(type)
      if (what) found[type] = what
    }
    expect(found).toEqual(KNOWN)
  })
})
