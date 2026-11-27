import { createHash } from 'node:crypto'

import * as THREE from 'three'

import type { PhysicsLoop, PhysicsWorld } from '@adatechnology/game-physics'
import type { PhysicsCostMeterState, WakeQueueState } from '@adatechnology/game-physics'

import type { BlastWake, DebrisCostOptions, DebrisCostSample } from '../src/blast-debris'
import { createDestructionRenderer } from '../src/renderer'
import { FakeWorld, partState } from './fake-world'
import { physicsLoop } from './setup-physics'

const DT = 1 / 60
const BLAST_AT = 30

export interface SceneOptions {
  readonly seed: number
  readonly cost: DebrisCostOptions
  /** What this fake machine reports as the step time of a frame, per awake body (ms): another machine, another number. */
  readonly msPerBody: number
}

export interface SavedScene {
  readonly world: Uint8Array
  readonly meter: PhysicsCostMeterState
  readonly wakes: WakeQueueState<BlastWake>
  readonly frame: number
}

interface Inside {
  costMeter: { saveState(): PhysicsCostMeterState; restoreState(state: PhysicsCostMeterState): void }
  blastWakes: { saveState(): WakeQueueState<BlastWake>; restoreState(state: WakeQueueState<BlastWake>): void; pending: number }
}

/**
 * The scene of C8: a seeded bowl of plates and a sheet, a 5-crate stack, and a pile of 100 loose crates that a blast at frame 30 loosens and shoves under the debris policy
 * (physics count 50 by the cost target, wake queue); every frame the loop steps, a fake step time is written in the frame, then the renderer updates.
 */
export class Scene {
  readonly renderer: ReturnType<typeof createDestructionRenderer>
  readonly loop: PhysicsLoop
  frame = 0

  constructor(private readonly options: SceneOptions) {
    const loop = physicsLoop()
    this.loop = loop
    const scene = new THREE.Scene()
    const world = new FakeWorld()
    this.renderer = createDestructionRenderer(THREE, { physics: loop, scene, world: world.asWorld(), eventBudgetMs: Infinity, shoveable: () => true, debrisCost: options.cost, blastDebris: { physicsCostTargetMs: 1, wakeCostTargetMs: 0.2, minWakesPerFrame: 6 } })
    let state = options.seed * 9301 + 49297
    const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
    const box = (id: string, size: [number, number, number], at: [number, number, number], turn: [number, number, number], piece: boolean): void => {
      world.addObject(id, [partState('body', 'concrete', { mass: size[0] * size[1] * size[2] * 2400 + 1 })])
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size))
      const root = new THREE.Group()
      root.add(mesh)
      root.position.set(...at)
      root.rotation.set(...turn)
      scene.add(root)
      root.updateMatrixWorld(true)
      this.renderer.bind(id, root, { parts: { body: mesh } })
      if (piece) this.renderer.makePiece(id)
    }
    for (let i = 0; i < 4; i++) box(`plate${i}`, [0.634, 0.304, 0.04], [-4 + (next() - 0.5) * 1.2, 0.2, -3 + (next() - 0.5) * 1.2], [Math.PI / 2 + (next() - 0.5) * 0.9, next() * 3, (next() - 0.5) * 0.5], true)
    box('sheet', [1.2, 0.04, 1.224], [-4 + (next() - 0.5) * 0.4, 0.8, -3 + (next() - 0.5) * 0.4], [(next() - 0.5) * 0.5, next() * 3, (next() - 0.5) * 0.5], true)
    for (let i = 0; i < 5; i++) box(`stack${i}`, [0.4, 0.2, 0.4], [4, 0.1 + i * 0.2, 4], [0, 0, 0], true)
    for (let i = 0; i < 100; i++) box(`crate${i}`, [0.3, 0.3, 0.3], [1.5 + (i % 10) * 0.32 + (next() - 0.5) * 0.02, 0.15 + Math.floor(i / 50) * 0.31, Math.floor((i % 50) / 10) * 0.32], [0, 0, 0], false)
  }

  /** The loop's world with the saved-state calls (the seam type hides them from the systems; the host holds the whole world). */
  get world(): PhysicsWorld {
    return this.loop.world as unknown as PhysicsWorld
  }

  private inside(): Inside {
    return this.renderer as unknown as Inside
  }

  step(): void {
    if (this.frame === BLAST_AT) this.renderer.explode([0, 0.2, 0], 1000000, 8, { visual: false })
    this.loop.step(DT)
    ;(this.loop.frame as { stepMs: number }).stepMs = this.options.msPerBody * this.loop.world.activeCount
    this.renderer.update(DT)
    this.frame++
  }

  /** The bits of every piece's pose and velocity, the world's saved bytes, and what the policy holds (the queue's length, the meter). */
  hash(): string {
    const hash = createHash('sha256')
    const numbers = new Float64Array(10)
    for (const piece of this.renderer.pieces()) {
      numbers.set([...piece.root.position.toArray(), ...piece.root.quaternion.toArray(), ...piece.velocity])
      hash.update(piece.objectId).update(numbers)
    }
    hash.update(this.world.saveState())
    hash.update(JSON.stringify([this.inside().blastWakes.pending, this.inside().costMeter.saveState(), this.renderer.pieces().length]))
    return hash.digest('hex').slice(0, 24)
  }

  save(): SavedScene {
    return { world: this.world.saveState(), meter: this.inside().costMeter.saveState(), wakes: this.inside().blastWakes.saveState().map((e) => ({ ...e })), frame: this.frame }
  }

  /** The queue's entries are closures over this renderer's pieces: another renderer keeps its own (`withQueue: false`), the same renderer takes the saved ones. */
  load(saved: SavedScene, withQueue = true): boolean {
    if (!this.world.restoreState(saved.world)) return false
    this.inside().costMeter.restoreState(saved.meter)
    if (withQueue) this.inside().blastWakes.restoreState(saved.wakes)
    this.frame = saved.frame
    return true
  }
}

export const runScene = (options: SceneOptions, frames: number): string[] => {
  const scene = new Scene(options)
  const out: string[] = []
  for (let i = 0; i < frames; i++) {
    scene.step()
    out.push(scene.hash())
  }
  return out
}

export type { DebrisCostSample }
