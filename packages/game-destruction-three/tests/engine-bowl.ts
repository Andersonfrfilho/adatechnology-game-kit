import * as THREE from 'three'
import type { PhysicsEngine } from '@adatechnology/game-physics'
import { createDestructionRenderer } from '../src/renderer'
import type { Piece } from '../src/types'
import { measureEnergy } from './engine-measure'
import type { EnergyReport } from './engine-measure'
import { FakeWorld, partState } from './fake-world'

export interface BowlResult extends EnergyReport {
  readonly asleepAtEnd: number
  readonly pieces: number
  readonly secondsToSleep: number
  readonly poseHash: string
  readonly msPerUpdate: number
  readonly groundMsPerUpdate: number
  readonly awakeIds: string
}

/**
 * The deepening bowl (spike A's scene), stepped through `engine` (or the kit's own solver when absent): a 1.2 m sheet on four tilted plates in a bowl 0.25 m deep that
 * deepens to 0.45 m over 2 s with `wakeRegion` every frame; then 3 s with the ground still (C4).
 */
export const engineBowl = (seed: number, dt: number, engine?: PhysicsEngine, worldOptions?: { maxStep?: number; solverIterations?: number }, onFrame?: (pieces: readonly Piece[], phase: string, groundAt: (x: number, z: number) => number) => void): BowlResult => {
  let state = seed * 9301 + 49297
  const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
  let t = 0
  const groundAt = (x: number, z: number): number => {
    const d = Math.hypot(x, z)
    const bowl = d < 1.2 ? -0.25 * (1 - (d / 1.2) ** 2) : 0
    return bowl * (1 + 0.8 * Math.min(1, t / 2))
  }
  const physics = engine?.createWorld({ gravity: [0, -9.81, 0], maxStep: worldOptions?.maxStep ?? 1 / 60, solverIterations: worldOptions?.solverIterations })
  const scene = new THREE.Scene()
  const world = new FakeWorld()
  const renderer = createDestructionRenderer(THREE, { scene, world: world.asWorld(), groundAt, physics })
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
  const sys = (renderer as unknown as { pieceSys: { wakeRegion: (x: number, z: number, r: number) => void } }).pieceSys
  for (let i = 0; i < 4; i++) box(`plate${i}`, [0.634, 0.304, 0.04], [(next() - 0.5) * 1.2, 0, (next() - 0.5) * 1.2], [Math.PI / 2 + (next() - 0.5) * 0.9, next() * 3, (next() - 0.5) * 0.5])
  for (let i = 0; i < 2 / dt; i++) {
    renderer.update(dt)
    onFrame?.(pieces, 'plates', groundAt)
  }
  box('sheet', [1.2, 0.04, 1.224], [(next() - 0.5) * 0.4, 0.5, (next() - 0.5) * 0.4], [(next() - 0.5) * 0.5, next() * 3, (next() - 0.5) * 0.5])
  for (let i = 0; i < 0.5 / dt; i++) {
    renderer.update(dt)
    onFrame?.(pieces, 'sheet', groundAt)
  }
  let ms = 0
  let groundMs = 0
  let n = 0
  const engineOf = (): { groundMs: number } | null => (renderer as unknown as { pieceSys: { engine: { groundMs: number } | null } }).pieceSys.engine
  const timed = (d: number): void => {
    const t0 = performance.now()
    renderer.update(d)
    ms += performance.now() - t0
    groundMs += engineOf()?.groundMs ?? 0
    onFrame?.(pieces, 'bowl', groundAt)
    n++
  }
  // 2 s of the bowl deepening, then 3 s of still ground; wakeRegion every frame throughout, as the soft-ground slide does
  const report = measureEnergy(
    () => pieces,
    (d) => {
      t += d
      timed(d)
    },
    dt,
    Math.round(5 / dt),
    () => sys.wakeRegion(0, 0, 2),
  )
  let secondsToSleep = Infinity
  // time after the ground stopped (t = 2 s) until every piece slept
  const asleep = (): number => pieces.filter((p) => (p as unknown as { sleeping: boolean }).sleeping).length
  const asleepAtEnd = asleep()
  if (asleepAtEnd === pieces.length) secondsToSleep = 3
  let h = 2166136261
  for (const p of pieces) {
    for (const x of [p.root.position.x, p.root.position.y, p.root.position.z, p.root.quaternion.x, p.root.quaternion.y, p.root.quaternion.z, p.root.quaternion.w]) {
      const f = new Float64Array([x])
      const u = new Uint32Array(f.buffer)
      h = Math.imul(h ^ u[0], 16777619) >>> 0
      h = Math.imul(h ^ u[1], 16777619) >>> 0
    }
  }
  physics?.dispose()
  const awakeIds = pieces.filter((p) => !(p as unknown as { sleeping: boolean }).sleeping).map((p) => `${p.objectId}@${p.root.position.y.toFixed(3)}`).join(',')
  return { ...report, asleepAtEnd, pieces: pieces.length, secondsToSleep, poseHash: h.toString(16), msPerUpdate: ms / n, groundMsPerUpdate: groundMs / n, awakeIds }
}
