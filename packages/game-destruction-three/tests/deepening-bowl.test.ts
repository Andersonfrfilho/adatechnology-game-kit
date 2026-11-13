import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'

/** Most a piece may rise in all (m) while the bowl under it only deepens, and the fastest it may go up (m/s): nothing in it should be pushed up. */
const MOST_RISE = 0.035
const MOST_UP_SPEED = 0.05

interface BowlRun {
  /** Largest sum of the rises of one piece's centre of mass over the steps, while the bowl deepens. */
  readonly rise: number
  /** Fastest any piece went up after a step, while the bowl deepens. */
  readonly fastestUp: number
  /** Where every piece ended (root position and rotation), to compare two runs. */
  readonly end: readonly number[]
}

const centreY = (piece: Piece): number => {
  piece.root.updateMatrixWorld(true)
  return new THREE.Vector3(...piece.localCenter).applyMatrix4(piece.root.matrixWorld).y
}

/**
 * Four concrete plates tilted in a bowl 1.2 m across, a 1.2 m sheet dropped onto them; then the bowl deepens from 0.25 to 0.45 m over 2 s while the region is told every
 * frame that its ground changed. Measured on the centre of mass of each piece, whatever moved it: the ground only goes down, so any rise is the contacts pushing it up.
 */
export const runBowl = (seed: number, dt: number, trace?: (frame: number, pieces: readonly Piece[], rises: number[]) => void): BowlRun => {
  let state = seed * 9301 + 49297
  const next = (): number => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648)
  let time = 0
  const groundAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z)
    const bowl = d < 1.2 ? -0.25 * (1 - (d / 1.2) ** 2) : 0
    return bowl * (1 + 0.8 * Math.min(1, time / 2))
  }
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), groundAt })
  const box = (id: string, size: [number, number, number], at: [number, number, number], turn: [number, number, number]): Piece => {
    world.addObject(id, [partState('body', 'concrete', { mass: size[0] * size[1] * size[2] * 2400 + 1 })])
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
    const root = new THREE.Group()
    root.add(mesh)
    root.position.set(...at)
    root.rotation.set(...turn)
    scene.add(root)
    root.updateMatrixWorld(true)
    renderer.bind(id, root, { parts: { body: mesh } })
    return renderer.makePiece(id)
  }
  const pieces: Piece[] = []
  for (let i = 0; i < 4; i++) {
    pieces.push(box(`plate${i}`, [0.634, 0.304, 0.04], [(next() - 0.5) * 1.2, 0, (next() - 0.5) * 1.2], [Math.PI / 2 + (next() - 0.5) * 0.9, next() * 3, (next() - 0.5) * 0.5]))
  }
  for (let i = 0; i < 2 / dt; i++) renderer.update(dt)
  pieces.push(box('sheet', [1.2, 0.04, 1.224], [(next() - 0.5) * 0.4, 0.5, (next() - 0.5) * 0.4], [(next() - 0.5) * 0.5, next() * 3, (next() - 0.5) * 0.5]))
  for (let i = 0; i < 0.5 / dt; i++) renderer.update(dt)
  const rise = new Map<Piece, number>()
  let fastestUp = 0
  for (let i = 0; i < 4 / dt; i++) {
    time += dt
    renderer.wakeRegion(0, 0, 2)
    const before = pieces.map(centreY)
    renderer.update(dt)
    trace?.(i, pieces, pieces.map((p, k) => centreY(p) - before[k]))
    pieces.forEach((piece, k) => {
      const up = centreY(piece) - before[k]
      if (up > 0) rise.set(piece, (rise.get(piece) ?? 0) + up)
      if (!piece.sleeping) fastestUp = Math.max(fastestUp, piece.velocity[1])
    })
  }
  const end = pieces.flatMap((p) => [...p.root.position.toArray(), ...p.root.quaternion.toArray()])
  renderer.dispose()
  return { rise: Math.max(0, ...rise.values()), fastestUp, end }
}

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1)

describe('debris in a bowl that deepens under it', () => {
  for (const dt of [0.05, 1 / 60]) {
    it.each(SEEDS)(`is never pushed up (dt ${dt.toFixed(3)}, seed %i)`, (seed) => {
      const { rise, fastestUp } = runBowl(seed, dt)
      console.log(`bowl dt ${dt.toFixed(3)} seed ${seed} rise ${rise.toFixed(4)} fastestUp ${fastestUp.toFixed(3)}`)
      expect(rise).toBeLessThanOrEqual(MOST_RISE)
      expect(fastestUp).toBeLessThanOrEqual(MOST_UP_SPEED)
    })
  }
})

describe('the same seed and step', () => {
  it('end the same, to the last bit', () => {
    for (const dt of [0.05, 1 / 60]) expect(runBowl(7, dt).end).toEqual(runBowl(7, dt).end)
  })
})
