import * as THREE from 'three'
import { it } from 'vitest'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'

/** Cost of `update` with 160 pieces asleep on the ground and 40 kept awake on top of them (median of 200 updates at 1/60 s). Only with PIECE_BENCH set. */
it.runIf(process.env.PIECE_BENCH)('bench: 160 resting + 40 moving', () => {
  let state = 12345
  const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld() })
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
  for (let i = 0; i < 160; i++) box(`rest${i}`, [0.3 + next() * 0.15, 0.06, 0.3 + next() * 0.15], [(i % 16) * 0.5 - 4, 0.031, Math.floor(i / 16) * 0.5 - 2.5], [0, next(), 0])
  for (let i = 0; i < 180; i++) renderer.update(1 / 60)
  const movers: Piece[] = []
  for (let i = 0; i < 40; i++) movers.push(box(`move${i}`, [0.2 + next() * 0.3, 0.05 + next() * 0.1, 0.2 + next() * 0.3], [(next() - 0.5) * 7, 0.3 + next() * 1.2, (next() - 0.5) * 4.5], [next(), next() * 3, next()]))
  const times: number[] = []
  for (let i = 0; i < 200; i++) {
    for (const m of movers) m.sleeping = false
    const t0 = performance.now()
    renderer.update(1 / 60)
    times.push(performance.now() - t0)
  }
  times.sort((a, b) => a - b)
  const asleep = renderer.pieces().filter((p) => p.sleeping).length
  console.log(`bench median ${times[100].toFixed(3)} ms p90 ${times[180].toFixed(3)} ms asleep ${asleep}`)
}, 120000)
