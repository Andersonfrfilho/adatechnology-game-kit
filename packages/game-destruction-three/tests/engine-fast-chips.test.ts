import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { PieceSystem } from '../src/pieces'
import { IS_JOLT, physicsOption } from './setup-physics'

type Ground = (x: number, z: number) => number
type Landing = { readonly fellThrough: number; readonly under: number }

const CHIP_HALF = 0.02
const CHIP_MASS = 0.06
const TRIALS = 30
const SPEEDS = [80, 250] as const
const FRAMES_SECONDS = 4
/** How far (m) under its resting height a chip may end: none, but the ground's own few mm. */
const SINK_TOLERANCE = 0.01

const flatGround: Ground = () => 0
/** A blast's crater: a bowl and a raised rim, the ground the room's chips fly over. */
const craterGround: Ground = (x, z) => {
  const distance = Math.hypot(x - 3, z - 5.5)
  if (distance < 3) return -0.5 * (1 - (distance / 3) ** 2)
  if (distance < 4.2) return 0.15 * Math.exp(-(((distance - 3.6) / 0.4) ** 2))
  return 0
}

/** The same numbers on every machine (a linear congruential sequence), so a failure repeats. */
const sequenceFrom = (seed: number): (() => number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/** A 4 cm chip thrown down and out at up to `speedMax` from a few metres up, over ground that no chip has flown over yet. */
function throwChip(groundAt: Ground, step: number, speedMax: number, next: () => number): Landing {
  const system = new PieceSystem(THREE, { physics: physicsOption(), groundAt, gravity: 9.81, onHardLanding: () => undefined, scene: new THREE.Scene() })
  const root = new THREE.Object3D()
  root.position.set(5 + next() * 5, 0.1 + next() * 2, -4 + next() * 4)
  const chip = system.create('chip', root, [CHIP_HALF, CHIP_HALF, CHIP_HALF], new THREE.Vector3(), CHIP_MASS)
  const speed = next() * speedMax
  const heading = next() * 2 * Math.PI
  const pitch = -0.2 - next() * 1.2
  chip.velocity[0] = speed * Math.cos(heading) * Math.cos(pitch)
  chip.velocity[1] = speed * Math.sin(pitch)
  chip.velocity[2] = speed * Math.sin(heading) * Math.cos(pitch)
  for (let frame = 0; frame < Math.round(FRAMES_SECONDS / step); frame++) system.update(step)
  const engine = (system as unknown as { engine: { fellThrough: number } }).engine
  const resting = groundAt(root.position.x, root.position.z) + CHIP_HALF
  return { fellThrough: engine.fellThrough, under: Math.max(0, resting - root.position.y) }
}

describe.skipIf(!IS_JOLT)('a fast chip lands on ground that is there', () => {
  for (const [name, groundAt] of [['flat', flatGround], ['crater', craterGround]] as const) {
    for (const step of [1 / 60, 0.05]) {
      for (const speedMax of SPEEDS) {
        it(`${name} ground, ${step.toFixed(3)} s a frame, up to ${speedMax} m/s: none is let through and none ends under the surface`, () => {
          const next = sequenceFrom(12345 + speedMax)
          const landings = Array.from({ length: TRIALS }, () => throwChip(groundAt, step, speedMax, next))
          expect(landings.filter((landing) => landing.fellThrough > 0)).toHaveLength(0)
          expect(landings.filter((landing) => landing.under > SINK_TOLERANCE)).toHaveLength(0)
        }, 120000)
      }
    }
  }
})
