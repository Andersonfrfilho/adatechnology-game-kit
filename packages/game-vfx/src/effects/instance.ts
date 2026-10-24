import { createSchedule } from '../schedule'
import type { ScreenState } from '../types'
import type { Placement, WorkshopEngine } from '../workshop/engine'
import type { DebrisSpawn, SpriteSpawn, Vec3Tuple } from '../workshop/types'
import type { Behavior, BehaviorHost } from './behavior'
import type { ExprContext } from './expression'
import { resolve } from './expression'
import { MACROS } from './macros'
import type { CueRequest, EffectDef, EffectStep, ScreenKey } from './types'

const DEFAULT_DIRECTION: Vec3Tuple = [0, 0, -1]
const DEFAULT_NORMAL: Vec3Tuple = [0, 1, 0]
const SCREEN_FIELDS: Readonly<Record<ScreenKey, keyof ScreenState>> = {
  shake: 'shake', white: 'white', red: 'red', dirL: 'directionLeft', dirR: 'directionRight', chroma: 'chroma', desat: 'desat', gas: 'gas', beat: 'beat',
}

/** What an effect reads off the view: where it is and which way the camera's own axes point. The Workshop's bench also moves it (`camera` steps). */
export interface EffectView {
  readonly position: Vec3Tuple
  forward(local: readonly number[]): Vec3Tuple
  goTo?(eye: Vec3Tuple, target: Vec3Tuple): void
  place?(eye: Vec3Tuple, target: Vec3Tuple): void
}

export interface InstanceDeps {
  readonly engine: WorkshopEngine
  readonly view: EffectView
  /** The prop models the recipe can call, by id (see `Behavior`). */
  readonly behavior: (id: string) => Behavior
  /** Every behaviour made so far, to age them every frame. */
  readonly behaviors: () => Iterable<Behavior>
  readonly onCue?: (cue: CueRequest) => void
}

/** Where and how a played effect sits in the world. */
export interface InstanceSetup {
  readonly placement?: Placement
  /** Which way the effect points in the world (`direction` in a recipe). */
  readonly direction?: Vec3Tuple
  /** The surface it hit (`normal` in a recipe). */
  readonly normal?: Vec3Tuple
  /** Named numbers the recipe reads with `variable(name)`; they are in place before its first step. */
  readonly values?: Readonly<Record<string, number>>
}

/**
 * One run of one effect (W1259-1295): `begin` runs the recipe's `setup` and `timeline`, `step` runs the timers that came due (from the last added to the
 * first) and the `tick`, once per frame. Step by step it draws random numbers where the page did and in the same order.
 */
export class EffectInstance {
  readonly variables = new Map<string, unknown>()
  def: EffectDef | undefined
  param = 0
  /** True until the first run of a chosen effect is over: a repeat of the loop is not fresh (`f.fresh`). */
  fresh = false
  time = 0
  /** Seconds since the effect was chosen: unlike `time`, a restart of the loop does not reset it (`el`). */
  elapsed = 0
  setup: InstanceSetup = {}
  private dt = 0
  private index = 0
  private readonly schedule = createSchedule()
  private readonly host: BehaviorHost
  private readonly context: ExprContext

  constructor(private readonly deps: InstanceDeps) {
    const instance = (): EffectInstance => this
    this.host = {
      engine: deps.engine,
      camera: deps.view,
      variables: this.variables,
      get param() { return instance().param },
      get time() { return instance().time },
      after: (seconds, action) => this.schedule.at(seconds, action),
    }
    this.context = {
      get random() { return deps.engine.random },
      get param() { return instance().param },
      get time() { return instance().time },
      get dt() { return instance().dt },
      get index() { return instance().index },
      variables: this.variables,
      scaled: (count) => deps.engine.scaled(count),
      query: (behavior, name, args) => deps.behavior(behavior).query(this.host, name, args),
      get quality() { return deps.engine.quality },
      get fresh() { return instance().fresh },
      get direction() { return instance().setup.direction ?? DEFAULT_DIRECTION },
      get normal() { return instance().setup.normal ?? DEFAULT_NORMAL },
      camera: { get position() { return deps.view.position }, forward: (local) => deps.view.forward(local) },
    }
  }

  /** The effect starts (`select` + `startLoop`): the recipe's `setup` and `timeline` run now. */
  begin(def: EffectDef, param: number | undefined, setup: InstanceSetup = {}): void {
    this.def = def
    this.param = param ?? def.params?.default ?? 0
    this.elapsed = 0
    this.fresh = true
    this.setup = setup
    this.restart()
  }

  /** The loop starts over (`startLoop`): timers, variables and props go back to the start. */
  restart(): void {
    const def = this.def
    if (!def) return
    this.schedule.clear()
    this.variables.clear()
    for (const [name, value] of Object.entries(this.setup.values ?? {})) this.variables.set(name, value)
    for (const behavior of this.deps.behaviors()) behavior.reset(this.host)
    this.time = 0
    this.within(() => {
      this.execute(def.setup ?? [])
      this.execute(def.timeline)
    })
    this.fresh = false
  }

  /** The effect's part of one frame: the timers due, then the tick, then the props. The pools are aged by whoever owns the engine. */
  step(dt: number): void {
    const def = this.def
    this.dt = dt
    if (def) {
      this.time += dt
      this.elapsed += dt
      this.within(() => {
        this.schedule.update(this.time)
        this.execute(def.tick ?? [])
      })
    }
    for (const behavior of this.deps.behaviors()) behavior.update(this.host, dt, this.elapsed)
  }

  /** True once a looping effect has run its seconds, or a one-shot has nothing left to fire. */
  get finished(): boolean {
    const def = this.def
    if (!def) return true
    if (def.loop && def.loop > 0) return this.time >= def.loop
    return false
  }

  /** The recipe's own camera shake on top of the screen's (`panico` trembles the aim). */
  get tremor(): number {
    return (this.variables.get('tremor') as number | undefined) ?? 0
  }

  private within(action: () => void): void {
    const engine = this.deps.engine
    const previous = engine.placement
    engine.placement = this.setup.placement
    try {
      action()
    } finally {
      engine.placement = previous
    }
  }

  private value(expression: unknown): unknown {
    return resolve(expression, this.context)
  }

  execute(steps: readonly EffectStep[]): void {
    for (const step of steps) this.run(step)
  }

  private run(step: EffectStep): void {
    const engine = this.deps.engine
    switch (step.op) {
      case 'burst': return engine.burst(step.system, this.value(step.count) as number, this.value(step.spawn) as SpriteSpawn)
      case 'spawn': return engine.spawn(step.system, this.value(step.spawn) as SpriteSpawn)
      case 'emit': return engine.emit(step.key, step.system, this.value(step.rate) as number, this.dt, () => this.value(step.spawn) as SpriteSpawn)
      case 'debris': return engine.debrisPiece(this.value(step.spawn) as DebrisSpawn)
      case 'decal': return engine.decal(this.value(step.args) as Parameters<WorkshopEngine['decal']>[0])
      case 'ring': return engine.ring(this.value(step.args) as Parameters<WorkshopEngine['ring']>[0])
      case 'flash': return engine.flash(this.value(step.args) as Parameters<WorkshopEngine['flash']>[0])
      case 'lens': return engine.lensBlob(...(this.value(step.args) as [number, number, number, string, number]))
      case 'screen': return this.changeScreen(step)
      case 'fire_light': return engine.fireLight(step.slot, this.value(step.point) as Vec3Tuple, this.value(step.intensity) as number, this.value(step.time) as number)
      case 'fire_light_off': engine.lights.fire[step.slot]!.intensity = 0; return
      case 'cue': return this.cue(step)
      case 'call': return MACROS[step.macro]!({ engine, cameraPosition: this.deps.view.position, dt: this.dt }, this.value(step.args) as readonly unknown[])
      case 'at': return this.scheduleSteps(step)
      case 'when': return this.execute(this.value(step.if) ? step.steps : (step.otherwise ?? []))
      case 'repeat': return this.repeat(step)
      case 'set': { this.variables.set(step.name, this.value(step.value)); return }
      case 'append': { this.variables.set(step.name, [...((this.variables.get(step.name) as unknown[] | undefined) ?? []), this.value(step.value)]); return }
      case 'camera': return this.moveView(step)
      case 'post': { Object.assign(engine.post, this.value(step.values)); return }
      case 'behavior': return this.deps.behavior(step.id).act(this.host, step.action, this.value(step.args))
    }
  }

  private moveView(step: Extract<EffectStep, { op: 'camera' }>): void {
    const eye = this.value(step.eye) as Vec3Tuple
    const target = this.value(step.target) as Vec3Tuple
    if (step.instant) this.deps.view.place?.(eye, target)
    else this.deps.view.goTo?.(eye, target)
  }

  private changeScreen(step: Extract<EffectStep, { op: 'screen' }>): void {
    const screen = this.deps.engine.screen
    for (const [key, expression] of Object.entries(step.add ?? {})) screen[SCREEN_FIELDS[key as ScreenKey]] += this.value(expression) as number
    for (const [key, expression] of Object.entries(step.set ?? {})) screen[SCREEN_FIELDS[key as ScreenKey]] = this.value(expression) as number
    for (const [key, expression] of Object.entries(step.max ?? {})) screen[SCREEN_FIELDS[key as ScreenKey]] = Math.max(screen[SCREEN_FIELDS[key as ScreenKey]], this.value(expression) as number)
  }

  private cue(step: Extract<EffectStep, { op: 'cue' }>): void {
    const args = this.value(step.args)
    for (let draw = 0; draw < (step.draws ?? 0); draw++) this.deps.engine.random.next()
    this.deps.onCue?.({ cue: step.cue, args, time: this.time })
  }

  private scheduleSteps(step: Extract<EffectStep, { op: 'at' }>): void {
    const captured = this.index
    this.schedule.at(this.value(step.time) as number, () => {
      const previous = this.index
      this.index = captured
      this.execute(step.steps)
      this.index = previous
    })
  }

  private repeat(step: Extract<EffectStep, { op: 'repeat' }>): void {
    const previous = this.index
    const count = this.value(step.count) as number
    for (let index = 0; index < count; index++) {
      this.index = index
      this.execute(step.steps)
    }
    this.index = previous
  }
}
