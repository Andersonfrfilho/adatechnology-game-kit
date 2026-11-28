import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsOption } from './setup-physics'

const STEP = 1 / 60
/** Seconds a piece of debris has to fall from a table and come to lie (the longest takes 3.5); after them none of it is above `LYING`. */
const SETTLE = 4
/** How high (m) the middle of a board lying on a flat floor, or on another board, may be. */
const LYING = 0.2
/** Lengths (m) of what a broken thing leaves: a splinter, a stub of a chair leg, half a board, a whole board of a long table. */
const LENGTHS = [0.1, 0.3, 0.8, 1.7, 3, 4.2]
/** Leans (degrees from lying) the pieces start with, each with a turn of its own: debris never comes off level. */
const LEANS = [0, 15, 45, 80]

/** A deterministic stream in [0, 1). */
const stream = (seed: number): (() => number) => {
  let state = seed
  return () => (state = (state * 16807) % 2147483647) / 2147483647
}

/** The debris of one broken part: one piece of each length at each lean, dropped from a table's height over a floor, some across the others. */
function dropped(section: readonly [number, number]): { rise: number; awake: number; what: string } {
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { physics: physicsOption(), scene, world: world.asWorld(), groundAt: () => 0 })
  world.addObject('table', [partState('top', 'wood_hard', { mass: 60 })])
  const random = stream(7)
  const fragments = LENGTHS.flatMap((length, i) =>
    LEANS.map((lean, k) => {
      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, random() * Math.PI, (lean * Math.PI) / 180, 'YXZ'))
      return {
        id: `f${i}_${k}`, part: 'top', material: 'wood_hard', shape: 'splinter', center: [(random() - 0.5) * 3, 0.76 + length / 2, (random() - 0.5) * 3], size: [length, section[0], section[1]],
        rotation: [rotation.x, rotation.y, rotation.z, rotation.w], velocity: [(random() - 0.5) * 2, random(), (random() - 0.5) * 2], angularVelocity: [(random() - 0.5) * 4, (random() - 0.5) * 4, (random() - 0.5) * 4], mass: 600 * length * section[0] * section[1],
      }
    }),
  )
  world.emit({ type: 'fracture', object: 'table', part: 'top', point: [0, 0.76, 0], style: 'splinter', fragments } as never)
  const meshes = (): THREE.Object3D[] => {
    const found: THREE.Object3D[] = []
    scene.traverse((node) => {
      if (node.name === 'fragment') found.push(node)
    })
    return found
  }
  const worst = { rise: 0, awake: 0, what: '' }
  let before = new Map<THREE.Object3D, number>()
  for (let t = 0; t < 12; t += STEP) {
    renderer.update(STEP)
    if (t < SETTLE) continue
    const now = new Map(meshes().map((mesh) => [mesh, mesh.position.y]))
    for (const [mesh, y] of now) {
      if (y > worst.rise) Object.assign(worst, { rise: y, what: `a piece ${Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z).toFixed(1)} m long, its middle ${y.toFixed(2)} m up ${t.toFixed(1)} s after it broke` })
      if (t > 6 && before.has(mesh) && Math.abs(y - (before.get(mesh) ?? y)) > 1e-4) worst.awake++
    }
    before = now
  }
  return worst
}

describe('debris of any length comes to lie on the floor', () => {
  it.each([
    ['a board of a table top', [0.04, 0.075]],
    ['a slat', [0.02, 0.04]],
    ['a beam', [0.1, 0.1]],
  ] as Array<[string, [number, number]]>)('%s, from a splinter to 4.2 m: once fallen none stands on its end, rises or keeps moving', (_, section) => {
    const worst = dropped(section)
    expect(worst.rise, worst.what).toBeLessThan(LYING)
    expect(worst.awake, 'updates in which a piece still moved 6 s after it broke').toBe(0)
  })
})
