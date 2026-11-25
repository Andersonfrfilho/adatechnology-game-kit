import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { SUGGESTED_MAX_AWAKE_FRAGMENTS, SUGGESTED_MAX_AWAKE_PIECES, createDestructionRenderer } from '@adatechnology/game-destruction-three'
import type { Piece } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

/** Most a board's centre may go up once it has come to rest: a knock from what falls on it, not a rise. */
const BOUNCE = 0.06
/** A piece that stays this long (s) slower than `STILL` has come to rest. */
const REST_SECONDS = 0.3
const STILL = 0.05
/** A board longer than this standing taller than this share of its length is on its edge, not lying. */
const BOARD = 0.5
const ON_EDGE = 0.6

interface Path {
  readonly piece: Piece
  still: number
  rest: number | null
  rose: number
}

const upExtent = (piece: Piece): number => {
  const e = new THREE.Matrix4().makeRotationFromQuaternion(piece.root.quaternion).elements
  const [hx, hy, hz] = piece.halfExtents
  return 2 * (Math.abs(e[1]!) * hx + Math.abs(e[5]!) * hy + Math.abs(e[9]!) * hz)
}

const box = new THREE.Box3()
const centreY = (piece: Piece): number => box.setFromObject(piece.root).getCenter(new THREE.Vector3()).y

/** The room's bookcase (a free piece, with the room's budget of awake pieces) loses the side `side`, and runs `seconds` at `hz`: how each piece went and lies. */
function oneSideGone(side: 'wood_0' | 'wood_1', hz: number, seconds: number): Path[] {
  const made = furnitureSpec(THREE, 'bookcase', { catalog: defaultFurnitureCatalog(), document: fakeDocument })
  const scene = new THREE.Scene()
  const world = createDestruction({ seed: 4 })
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world, maxAwakePieces: SUGGESTED_MAX_AWAKE_PIECES, maxAwakeFragments: SUGGESTED_MAX_AWAKE_FRAGMENTS, settledBatches: {} })
  const id = world.add(made.spec, { id: 'bookcase' })
  const root = made.build(THREE)
  scene.add(root)
  root.updateMatrixWorld(true)
  renderer.bind(id, root)
  renderer.makePiece(id, { mass: 242 })
  const x = side === 'wood_0' ? -0.58 : 0.58
  world.hitPart(id, side, { type: 'blunt', point: [x, 1, 0], direction: [0, 0, -1], energy: 5e6, radius: 0.3, source: 'test' })
  const paths = new Map<Piece, Path>()
  const dt = 1 / hz
  for (let t = 0; t < seconds; t += dt) {
    world.update(dt)
    renderer.update(dt)
    for (const piece of renderer.pieces()) {
      const y = centreY(piece)
      const path = paths.get(piece) ?? { piece, still: 0, rest: null, rose: 0 }
      path.still = piece.sleeping || Math.hypot(...piece.velocity) < STILL ? path.still + dt : 0
      if (path.rest === null && path.still >= REST_SECONDS) path.rest = y
      if (path.rest !== null) path.rose = Math.max(path.rose, y - path.rest)
      paths.set(piece, path)
    }
  }
  return [...paths.values()]
}

describe('a bookcase that lost a side', () => {
  it.each([
    ['the left side', 'wood_0', 60],
    ['the right side', 'wood_1', 60],
    ['the left side at 30 frames a second', 'wood_0', 30],
    ['the right side at 144 frames a second', 'wood_1', 144],
  ] as const)('%s gone (%s, %i Hz): the back and the other side come down onto the books, no board at rest goes back up or keeps moving, none stands on its edge', (_name, side, hz) => {
    const paths = oneSideGone(side, hz, 10)
    const standing = paths
      .filter((path) => 2 * Math.max(...path.piece.halfExtents) > BOARD && upExtent(path.piece) > ON_EDGE * 2 * Math.max(...path.piece.halfExtents))
      .map((path) => `${path.piece.objectId} ${upExtent(path.piece).toFixed(2)} m tall`)
    const boards = paths.filter((path) => 2 * Math.max(...path.piece.halfExtents) > BOARD)
    const rose = boards.filter((path) => path.rose > BOUNCE).map((path) => `${path.piece.objectId} rose ${path.rose.toFixed(2)} m`)
    const moving = boards.filter((path) => !path.piece.sleeping && Math.hypot(...path.piece.velocity) > 0.05).map((path) => path.piece.objectId)
    expect({ standing, rose, moving }).toEqual({ standing: [], rose: [], moving: [] })
  })
})
