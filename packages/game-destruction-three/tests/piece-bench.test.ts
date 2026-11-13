import * as THREE from 'three'
import { it } from 'vitest'
import type { PhysicsEngine } from '@adatechnology/game-physics'
import { loadRapierEngine } from '@adatechnology/game-physics-rapier'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { FakeWorld, partState } from './fake-world'

/**
 * Spike A's bench: `update` with 160 pieces asleep on the ground and 40 kept awake on top of them (200 updates at 1/60 s), on the kit's own solver and through the physics
 * contract (Rapier). The whole renderer update and the piece system's alone. Only with PIECE_BENCH set.
 */
const bench = (engine?: PhysicsEngine): string => {
  let state = 12345
  const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const physics = engine?.createWorld({ gravity: [0, -9.81, 0], maxStep: Number(process.env.BENCH_MAX_STEP ?? 1 / 60) })
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), physics })
  const sys = (renderer as unknown as { pieceSys: { update: (dt: number) => void } }).pieceSys
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
  const whole: number[] = []
  const pieces: number[] = []
  const realUpdate = sys.update.bind(sys)
  let pieceMs = 0
  sys.update = (dt) => {
    const t = performance.now()
    realUpdate(dt)
    pieceMs = performance.now() - t
  }
  for (let i = 0; i < 200; i++) {
    for (const m of movers) m.sleeping = false
    const t0 = performance.now()
    renderer.update(1 / 60)
    whole.push(performance.now() - t0)
    pieces.push(pieceMs)
  }
  whole.sort((a, b) => a - b)
  pieces.sort((a, b) => a - b)
  const asleep = renderer.pieces().filter((p) => p.sleeping).length
  physics?.dispose()
  return `update median ${whole[100].toFixed(3)} p90 ${whole[180].toFixed(3)} ms; pieces median ${pieces[100].toFixed(3)} p90 ${pieces[180].toFixed(3)} ms; asleep ${asleep}/200`
}

it.runIf(process.env.PIECE_BENCH)('bench: 160 resting + 40 moving, own solver and Rapier', async () => {
  const engine = await loadRapierEngine()
  for (let run = 0; run < 3; run++) {
    console.log(`bench own    ${bench()}`)
    console.log(`bench rapier ${bench(engine)}`)
  }
}, 600000)
