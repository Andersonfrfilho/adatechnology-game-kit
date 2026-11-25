import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import type { Vec3 } from '@adatechnology/game-destruction'
import { createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type { Piece } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

const STEP = 1 / 60
/** A 5.56 rifle round at the muzzle (J) and its calibre (mm), as the room's rifle fires it. */
const RIFLE_ENERGY = 1750
const RIFLE_CALIBER = 5.56
/** How far (m) the bottom of a piece at rest may be from the floor or from the top of what it lies on. */
const REST_GAP = 0.04
const STILL_SPEED = 0.05

interface Shot {
  readonly x: number
  readonly y: number
}

/** The bookcase shot apart by a rifle at its sides (each `shots` a round), run until it should be still, with every piece it left. */
function shootApart(seed: number, shots: readonly Shot[]): { pieces: Piece[]; boxes: THREE.Box3[] } {
  const made = furnitureSpec(THREE, 'bookcase', { catalog: defaultFurnitureCatalog(), document: fakeDocument })
  const scene = new THREE.Scene()
  const world = createDestruction({ seed })
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world })
  const id = world.add(made.spec, { id: 'bookcase' })
  const root = made.build(THREE)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root)
  renderer.makePiece(id, { mass: 242 })
  for (const shot of shots) {
    const origin: Vec3 = [shot.x, shot.y, 4]
    world.shoot(origin, [0, 0, -1], RIFLE_ENERGY, RIFLE_CALIBER)
    for (let i = 0; i < 6; i++) {
      world.update(STEP)
      renderer.update(STEP)
    }
  }
  for (let t = 0; t < 15; t += STEP) {
    world.update(STEP)
    renderer.update(STEP)
  }
  const pieces = renderer.pieces()
  return { pieces, boxes: pieces.map((piece) => new THREE.Box3().setFromObject(piece.root)) }
}

/** A box rests when its bottom is on the floor or on the top of another box under it (their footprints overlap). */
function isSupported(index: number, boxes: readonly THREE.Box3[]): boolean {
  const box = boxes[index]!
  if (box.min.y <= REST_GAP) return true
  return boxes.some((other, j) => j !== index && other.max.y >= box.min.y - REST_GAP && other.min.y < box.min.y && other.max.x > box.min.x && other.min.x < box.max.x && other.max.z > box.min.z && other.min.z < box.max.z)
}

/** The sides at about ±0.6 m: rounds up one of them, then the other, as a player walks the sights along a side. */
const upAndDown = (x: number): Shot[] => [0.2, 0.55, 0.9, 1.25, 1.6, 1.9].map((y) => ({ x, y }))

describe('a bookcase shot apart', () => {
  it.each([
    ['one side, then the other', 1, [...upAndDown(-0.58), ...upAndDown(0.58)]],
    ['the other side first', 2, [...upAndDown(0.58), ...upAndDown(-0.58)]],
    ['the shelves through the middle and one side', 5, [...[0.4, 0.8, 1.2, 1.6].map((y) => ({ x: 0, y })), ...upAndDown(-0.58)]],
  ])('%s: every board, side and book lies on the floor or on other debris, still', (_name, seed, shots) => {
    const { pieces, boxes } = shootApart(seed, shots)
    expect(pieces.length).toBeGreaterThan(3)
    const floating = pieces.flatMap((piece, i) => (isSupported(i, boxes) ? [] : [`${piece.objectId}@${boxes[i]!.min.y.toFixed(2)}`]))
    const moving = pieces.filter((piece) => !piece.held && Math.hypot(...piece.velocity) > STILL_SPEED).map((piece) => piece.objectId)
    const hanging = pieces.filter((piece) => (piece as Piece & { hinge?: unknown }).hinge !== undefined).map((piece) => piece.objectId)
    expect({ floating, moving, hanging }).toEqual({ floating: [], moving: [], hanging: [] })
  })
})
