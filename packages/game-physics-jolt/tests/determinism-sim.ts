import { createHash } from 'node:crypto'

import { KIT_WORLD, PhysicsCostMeter, WakeQueue } from '@adatechnology/game-physics'
import type { BodyId, PhysicsCostMeterState, PhysicsWorld, Vec3, WakeQueueState } from '@adatechnology/game-physics'
import { createJoltEngine } from '../src/index'
import type { JoltWorld } from '../src/index'

/** How the wake batches get their cost: `fixed` from the configuration alone (the clock is never read), `measured` from a step time the machine reports (here an injected `msPerBody`). */
export type CostMode = 'fixed' | 'measured'

interface Shove {
  readonly index: number
  readonly impulse: Vec3
}

export interface SavedSim {
  readonly world: Uint8Array
  readonly queue: WakeQueueState<Shove>
  readonly meter: PhysicsCostMeterState
  readonly frame: number
  readonly lastStepMs: number
}

const FRAME = 1 / 60
const BLAST_FRAME = 10

/**
 * A fixed scene: a 20:1 stack, a rolling can, a sliding box, an ignored pair, and a sleeping pile (jitter from a seed) that a blast at frame 10 shoves through a wake queue
 * sized by the cost; `msPerBody` is the fake machine's step cost per awake body (a different machine is a different number).
 */
export class Sim {
  readonly world: JoltWorld
  readonly everyBody: BodyId[] = []
  readonly pile: BodyId[] = []
  readonly queue = new WakeQueue<Shove>({ costTargetMs: 0.5, maxDelay: 0.2, minPerFrame: 4 })
  readonly meter = new PhysicsCostMeter()
  frame = 0
  lastStepMs = 0

  private constructor(world: JoltWorld, private readonly mode: CostMode, private readonly msPerBody: number) {
    this.world = world
  }

  static async create(seed: number, mode: CostMode, msPerBody: number): Promise<Sim> {
    const engine = await createJoltEngine()
    const sim = new Sim(engine.createWorld({ ...KIT_WORLD, fixedStep: 1 / 120 }) as JoltWorld, mode, msPerBody)
    sim.build(seed)
    return sim
  }

  private add(world: PhysicsWorld, desc: Parameters<PhysicsWorld['createBody']>[0]): BodyId {
    const id = world.createBody(desc)
    this.everyBody.push(id)
    return id
  }

  private build(seed: number): void {
    const world = this.world
    let state = seed * 9301 + 49297
    const next = (): number => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648
    this.add(world, { shape: { kind: 'box', half: [30, 0.5, 30] }, motion: 'static', position: [0, -0.5, 0], user: 0 })
    for (let i = 0; i < 4; i++) this.add(world, { shape: { kind: 'box', half: [0.3, 0.15, 0.3] }, motion: 'dynamic', mass: i === 3 ? 200 : 10, position: [-4, 0.15 + i * 0.3, 0], user: 1 + i })
    this.add(world, { shape: { kind: 'sphere', radius: 0.1 }, motion: 'dynamic', mass: 0.3, position: [-2, 0.1, 2], user: 10, linearVelocity: [2, 0, 0], rolling: { coefficient: 0.02, radius: 0.1 } })
    const sliding = this.add(world, { shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 4, position: [3, 0.2, -2], user: 11, linearVelocity: [0, 0, 3] })
    const above = this.add(world, { shape: { kind: 'box', half: [0.2, 0.2, 0.2] }, motion: 'dynamic', mass: 4, position: [3, 0.7, -2], user: 12 })
    world.ignorePair(sliding, above, true)
    for (let i = 0; i < 48; i++) {
      const at: Vec3 = [(i % 8) * 0.45 + (next() - 0.5) * 0.05, 0.15 + Math.floor(i / 16) * 0.31, Math.floor((i % 16) / 8) * 0.45 + (next() - 0.5) * 0.05]
      const id = this.add(world, { shape: { kind: 'box', half: [0.2, 0.15, 0.2] }, motion: 'dynamic', mass: 6 + next() * 4, position: at, user: 20 + i })
      this.pile.push(id)
    }
    for (const id of this.pile) world.sleep(id)
  }

  private awake(): number {
    return this.world.activeCount
  }

  private release(): void {
    const stepMs = this.mode === 'fixed' ? 0 : this.lastStepMs
    for (const shove of this.queue.release(FRAME, stepMs, this.meter.wakeCostPerBodyMs)) {
      const id = this.pile[shove.index]
      if (id === undefined) continue
      this.world.wake(id)
      this.world.addImpulse(id, shove.impulse)
    }
  }

  /** One frame: the queue's batch, the world's two steps, then the (fake) cost of the frame, read by the next one. */
  step(): void {
    if (this.frame === BLAST_FRAME) {
      this.pile.forEach((id, index) => {
        const pose = new Float64Array(7)
        this.world.readPose(id, pose, 0)
        const distance = Math.hypot(pose[0]! - 1.5, pose[2]! - 0.2)
        this.queue.push(distance, { index, impulse: [(pose[0]! - 1.5) * 20, 30, (pose[2]! - 0.2) * 20] })
      })
    }
    this.release()
    this.world.step(FRAME)
    this.frame++
    this.lastStepMs = this.msPerBody * this.awake()
    if (this.mode === 'measured') this.meter.observe(this.lastStepMs, this.awake())
  }

  /** The bits of every body's pose and velocity, the queue and the meter. */
  hash(): string {
    const hash = createHash('sha256')
    const out = new Float64Array(7)
    const velocity = new Float64Array(6)
    for (const id of this.everyBody) {
      this.world.readPose(id, out, 0)
      this.world.readVelocity(id, velocity, 0)
      hash.update(out).update(velocity)
    }
    hash.update(JSON.stringify([this.queue.saveState().map((e) => [e.priority, e.waited, e.item.index]), this.meter.saveState(), this.world.activeCount]))
    return hash.digest('hex').slice(0, 24)
  }

  save(): SavedSim {
    return { world: this.world.saveState(), queue: this.queue.saveState().map((e) => ({ ...e })), meter: this.meter.saveState(), frame: this.frame, lastStepMs: this.lastStepMs }
  }

  load(saved: SavedSim): boolean {
    if (!this.world.restoreState(saved.world)) return false
    this.queue.restoreState(saved.queue)
    this.meter.restoreState(saved.meter)
    this.frame = saved.frame
    this.lastStepMs = saved.lastStepMs
    return true
  }
}
