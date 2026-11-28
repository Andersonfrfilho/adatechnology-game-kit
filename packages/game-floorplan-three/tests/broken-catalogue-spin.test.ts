import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import { createDestructionRenderer, type Piece } from '@adatechnology/game-destruction-three'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'
import { physicsOption } from './setup-physics'

const STEP = 1 / 60
/** Updates after a part breaks in which nothing has had the time to fall: gravity alone gives 1 m/s in them. */
const EARLY_STEPS = 6
/** Seconds between one part broken and the next. */
const BETWEEN = 0.75
/** Below this (m/s, its middle and its fastest corner) a piece is at rest when the part breaks. */
const AT_REST = 0.3
/**
 * The most (m/s) the fastest corner of a piece at rest may gain in the updates right after a part of its object breaks. Its weight gives 1 m/s in that time and the start
 * down the kit gives what stands on too little under 4 across the catalogue at every size below; the push with the wrong arm gave 8 to 15.
 */
const EARLY_GAIN = 4.5
/**
 * Each piece as the catalogue has it, then stretched each way and shrunk: how far a start down throws a piece grows with how long it is for how wide, how hard a nudge
 * turns it with how tall it is, and a rule written for a metre misbehaves at 30 cm.
 */
const SIZES: ReadonlyArray<readonly [string, number, number, number]> = [
  ['as the catalogue has it', 1, 1, 1],
  ['three times as long', 3, 1, 1],
  ['three times as deep', 1, 3, 1],
  ['three times as tall', 1, 1, 3],
  ['a third of its size', 0.3, 0.3, 0.3],
]

const catalog = defaultFurnitureCatalog()
const types = [...new Set(catalog.map((entry) => entry.type))]

/** Speed (m/s) of the fastest corner of the piece's box about its middle. */
const cornerSpeed = (piece: Piece): number => {
  const turn = new THREE.Vector3(piece.angularVelocity[0], piece.angularVelocity[1], piece.angularVelocity[2]).applyQuaternion((piece.root as THREE.Object3D).quaternion.clone().invert())
  const [hx, hy, hz] = piece.halfExtents
  let fastest = 0
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) fastest = Math.max(fastest, turn.clone().cross(new THREE.Vector3(sx * hx, sy * hy, hz)).length())
  return fastest
}

/**
 * The piece laid loose as the room lays it, its parts broken one after the other from the floor up (a leg first, then what it held, as shots do): the most any piece that
 * was at rest when a part broke gained at its fastest corner right after, and what it was.
 */
function brokenPartByPart(type: string, wide: number, deep: number, tall: number): { gain: number; what: string } | null {
  const entry = catalog.find((one) => one.type === type)
  let made: ReturnType<typeof furnitureSpec>
  try {
    made = furnitureSpec(THREE, type, { catalog, document: fakeDocument, options: { chairs: false }, w: (entry?.w ?? 1) * wide, d: (entry?.d ?? 1) * deep, h: (entry?.h ?? 1) * tall })
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
  const worst = { gain: 0, what: '' }
  const run = (seconds: number, part: string | null): void => {
    const rested = new Map<Piece, number>()
    if (part) for (const piece of renderer.pieces()) if (Math.hypot(...piece.velocity) < AT_REST && cornerSpeed(piece) < AT_REST) rested.set(piece, cornerSpeed(piece))
    let step = 0
    for (let t = 0; t < seconds; t += STEP) {
      world.update(STEP)
      renderer.update(STEP)
      if (++step > EARLY_STEPS) continue
      for (const [piece, before] of rested) {
        const gain = cornerSpeed(piece) - before
        if (gain > worst.gain) Object.assign(worst, { gain, what: `${piece.objectId} (${piece.mass.toFixed(1)} kg) ${gain.toFixed(1)} m/s after ${part}` })
      }
    }
  }
  run(1, null)
  const parts = [...made.spec.parts].sort((a, b) => (a.position?.[1] ?? 0) - (b.position?.[1] ?? 0))
  for (const part of parts) {
    const at: [number, number, number] = [part.position?.[0] ?? 0, part.position?.[1] ?? 0, part.position?.[2] ?? 0]
    for (let i = 0; i < 12; i++) {
      const state = world.part(id, part.id)
      if (!state || state.status === 'broken' || state.status === 'ashes' || state.status === 'melted') break
      world.hitPart(id, part.id, { type: 'blunt', point: at, direction: [0, 0, -1], energy: 20000, radius: 0.05, source: 'test' })
    }
    run(BETWEEN, part.id)
  }
  return worst
}

describe('every piece of furniture of the catalogue, broken part by part', () => {
  it.each(SIZES)('%s: no piece at rest is spun up when a part of it breaks', (_, wide, deep, tall) => {
    const spun = types.flatMap((type) => {
      const worst = brokenPartByPart(type, wide, deep, tall)
      return worst && worst.gain > EARLY_GAIN ? [`${type}: ${worst.what}`] : []
    })
    expect(spun).toEqual([])
  })
})
