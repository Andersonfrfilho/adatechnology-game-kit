import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'
import { measureLift } from './lift-measure'

/** What contacts did to the pieces over a run: the most any piece was carried up beyond its own flight, and the fastest any was sent up by an update. */
export interface LiftReport {
  readonly lift: number
  readonly fastestUp: number
  readonly sheetY: number
}


/**
 * A 1.2 m sheet dropped onto four 0.63 x 0.30 x 0.04 m plates lying tilted in a bowl 0.25 m deep that deepens to 0.45 m over 2 s, every piece woken each frame
 * (`wakeRegion`, as soft ground sliding away does). By a fixed seed.
 */
export const deepeningBowl = (seed: number, dt: number): LiftReport => {
  let state = seed * 9301 + 49297
  const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
  let t = 0
  const groundAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z)
    const bowl = d < 1.2 ? -0.25 * (1 - (d / 1.2) ** 2) : 0
    return bowl * (1 + 0.8 * Math.min(1, t / 2))
  }
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), groundAt })
  const pieces: Piece[] = []
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
    const piece = renderer.makePiece(id)
    pieces.push(piece)
    return piece
  }
  const wake = (renderer as unknown as { pieceSys: { wakeRegion: (x: number, z: number, r: number) => void } }).pieceSys
  for (let i = 0; i < 4; i++) box(`plate${i}`, [0.634, 0.304, 0.04], [(next() - 0.5) * 1.2, 0, (next() - 0.5) * 1.2], [Math.PI / 2 + (next() - 0.5) * 0.9, next() * 3, (next() - 0.5) * 0.5])
  for (let i = 0; i < 2 / dt; i++) renderer.update(dt)
  const sheet = box('sheet', [1.2, 0.04, 1.224], [(next() - 0.5) * 0.4, 0.5, (next() - 0.5) * 0.4], [(next() - 0.5) * 0.5, next() * 3, (next() - 0.5) * 0.5])
  for (let i = 0; i < 0.5 / dt; i++) renderer.update(dt)
  const lifts = measureLift(
    () => pieces,
    (d) => {
      t += d
      renderer.update(d)
    },
    dt,
    Math.round(4 / dt),
    () => wake.wakeRegion(0, 0, 2),
  )
  let lift = 0
  let fastestUp = 0
  for (const r of lifts.values()) {
    lift = Math.max(lift, r.lift)
    fastestUp = Math.max(fastestUp, r.up)
  }
  return { lift, fastestUp, sheetY: sheet.root.position.y }
}

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1)

describe('a sheet on plates in a bowl that deepens under them', () => {
  for (const dt of [0.05, 1 / 60]) {
    it.each(SEEDS)(`is never carried up nor sent up by the contacts (dt ${dt.toFixed(3)}, seed %i)`, (seed) => {
      const { lift, fastestUp, sheetY } = deepeningBowl(seed, dt)
      if (process.env.BOWL_REPORT) console.log(`bowl dt ${dt.toFixed(3)} seed ${seed} lift ${lift.toFixed(4)} up ${fastestUp.toFixed(3)} y ${sheetY.toFixed(3)}`)
      expect(lift).toBeLessThanOrEqual(0.035)
      expect(fastestUp).toBeLessThanOrEqual(0.05)
    })
  }
})
