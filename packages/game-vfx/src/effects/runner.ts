import type { RandomStream } from '../random'
import type { WorkshopEngine } from '../workshop/engine'
import type { Vec3Tuple } from '../workshop/types'
import type { Behavior } from './behavior'
import { EffectCamera } from './camera'
import { EffectInstance } from './instance'
import type { CueRequest, EffectDef, EffectStep } from './types'

const SHAKE_SCALE = 0.06
const SHAKE_DEPTH = 0.5

export interface EffectRunnerOptions {
  readonly engine: WorkshopEngine
  readonly effects: Readonly<Record<string, EffectDef>>
  readonly behaviors?: Readonly<Record<string, Behavior>>
  readonly onCue?: (cue: CueRequest) => void
}

/**
 * The Workshop's one-effect-at-a-time view (W1253-1295): choosing an effect clears the set and runs it; each frame fires the timers due, runs the tick, ages
 * the pools, glides the camera and draws the camera shake. This is what the bench shows and what the golden replays; `createEffectPlayer` plays many at once.
 */
export class EffectRunner {
  readonly camera = new EffectCamera()
  readonly instance: EffectInstance
  /** The camera shake of the last frame, three draws per frame as in the page. */
  shake: Vec3Tuple = [0, 0, 0]

  constructor(private readonly options: EffectRunnerOptions) {
    const behaviors = options.behaviors ?? {}
    this.instance = new EffectInstance({
      engine: options.engine,
      view: this.camera,
      behavior: (id) => behaviors[id]!,
      behaviors: () => Object.values(behaviors),
      ...(options.onCue ? { onCue: options.onCue } : {}),
    })
  }

  get current(): EffectDef | undefined {
    return this.instance.def
  }

  get variables(): Map<string, unknown> {
    return this.instance.variables
  }

  get param(): number {
    return this.instance.param
  }

  get fresh(): boolean {
    return this.instance.fresh
  }

  get time(): number {
    return this.instance.time
  }

  /** Seconds since the effect was chosen: unlike `time`, a restart of the loop does not reset it (`el`). */
  get elapsed(): number {
    return this.instance.elapsed
  }

  get random(): RandomStream {
    return this.options.engine.random
  }

  /** `select` + `startLoop` (W1253-1257): clears everything, then runs the effect's setup and timeline. */
  start(id: string, param?: number): boolean {
    const def = this.options.effects[id]
    if (!def) return false
    if (def.view) this.camera.goTo(def.view.eye, def.view.target)
    else this.camera.hold()
    this.options.engine.clear()
    this.instance.begin(def, param)
    return true
  }

  /** `startLoop` again: the same effect from its start (the replay button and the end of the loop). */
  restart(): void {
    if (!this.instance.def) return
    this.options.engine.clear()
    this.instance.restart()
  }

  /** One frame of the page (W1280-1295). */
  update(dt: number): void {
    const engine = this.options.engine
    engine.post = {}
    this.instance.step(dt)
    engine.update(dt)
    this.camera.update(dt)
    const amplitude = engine.screen.shake * SHAKE_SCALE + this.instance.tremor
    const random = this.random
    this.shake = [random.between(-1, 1) * amplitude, random.between(-1, 1) * amplitude, random.between(-1, 1) * amplitude * SHAKE_DEPTH]
  }

  execute(steps: readonly EffectStep[]): void {
    this.instance.execute(steps)
  }
}
