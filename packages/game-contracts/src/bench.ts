import type { Vec3 } from './destruction'

/**
 * The bench of a module: controls, layers and counters it declares as data. The host keeps the values, draws them in a generic way and hands
 * every change back through `ModuleHost.bench`. Nothing here is specific to a kind of module.
 */
export type ControlValue = number | boolean | string

export interface ChoiceOption {
  readonly id: string
  readonly name: string
}

interface ControlBase {
  /** snake_case, unique across the module's controls, layers and metrics. */
  readonly id: string
  /** Display name, already translated for the locale the host asked for. */
  readonly name: string
  readonly hint?: string
  readonly hidden?: boolean
}

export interface NumberControl extends ControlBase {
  readonly kind: 'number'
  readonly min: number
  readonly max: number
  readonly step?: number
  readonly unit?: string
  readonly default: number
}

export interface BooleanControl extends ControlBase {
  readonly kind: 'boolean'
  readonly default: boolean
}

export interface ChoiceControl extends ControlBase {
  readonly kind: 'choice'
  readonly options: readonly ChoiceOption[]
  readonly default: string
}

/** A button: no value, only the press. */
export interface ActionControl extends ControlBase {
  readonly kind: 'action'
}

export type ModuleControl = NumberControl | BooleanControl | ChoiceControl | ActionControl

/** Something of the module the viewer turns on or off (smoke, flash, casings). */
export interface ModuleLayer {
  readonly id: string
  readonly name: string
  /** On unless `false`. */
  readonly default?: boolean
}

/** Pulled: the room calls read only when it samples (~4 Hz, or on TestRoom.metrics()). */
export interface ModuleMetric {
  readonly id: string
  readonly name: string
  readonly unit?: string
  /** Budget: the host shows a bar and warns past it. */
  readonly max?: number
  readonly digits?: number
  read(): number | string
}

export type BenchChange =
  | { readonly kind: 'control'; readonly id: string; readonly value: ControlValue }
  | { readonly kind: 'layer'; readonly id: string; readonly on: boolean }
  | { readonly kind: 'action'; readonly id: string }

export interface ControlPatch {
  readonly hidden?: boolean
  readonly disabled?: boolean
  readonly options?: readonly ChoiceOption[]
  readonly value?: ControlValue
}

/** What the host lends a module that declares a bench: the current values and the changes. */
export interface ModuleBench {
  value(id: string): ControlValue | undefined
  layer(id: string): boolean
  /** Right after attach returns, the host sends one change per control (not actions) and per layer, in declaration order. */
  onChange(listener: (change: BenchChange) => void): () => void
  /** `value` sets without emitting (no echo loops); `options` falls back to the first option if the value is no longer offered. */
  patch(id: string, patch: ControlPatch): void
  /** Move the host camera (a near / middle / far choice). */
  look(eye: Vec3, target: Vec3): void
}

export interface BenchReport {
  readonly ok: boolean
  readonly problems: readonly string[]
}

export interface BenchDeclaration {
  readonly controls?: readonly ModuleControl[]
  readonly layers?: readonly ModuleLayer[]
  readonly metrics?: readonly ModuleMetric[]
}

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

function checkControl(control: ModuleControl, problems: string[]): void {
  const label = `control "${control.id}"`
  if (control.kind === 'number') {
    if (!finite(control.min) || !finite(control.max) || control.min >= control.max) problems.push(`${label} needs min < max`)
    if (control.step !== undefined && !(finite(control.step) && control.step > 0)) problems.push(`${label} needs a step > 0`)
    if (!finite(control.default) || control.default < control.min || control.default > control.max) problems.push(`${label} default ${String(control.default)} is outside ${control.min}..${control.max}`)
    return
  }
  if (control.kind !== 'choice') return
  if (control.options.length === 0) {
    problems.push(`${label} needs at least one option`)
    return
  }
  const seen = new Set<string>()
  for (const option of control.options) {
    if (seen.has(option.id)) problems.push(`${label} repeats option "${option.id}"`)
    seen.add(option.id)
  }
  if (!seen.has(control.default)) problems.push(`${label} default "${control.default}" is not among its options`)
}

/** snake_case ids unique across controls, layers and metrics; min < max; step > 0; default in range; options non-empty, unique, default among them; metric max > 0. */
export function checkBench(declared: BenchDeclaration): BenchReport {
  const problems: string[] = []
  const ids = new Set<string>()
  const claim = (kind: string, id: string): void => {
    if (!SNAKE_CASE.test(id)) problems.push(`${kind} id "${id}" must be snake_case`)
    if (ids.has(id)) problems.push(`duplicate id "${id}" across controls, layers and metrics`)
    ids.add(id)
  }
  for (const control of declared.controls ?? []) {
    claim('control', control.id)
    checkControl(control, problems)
  }
  for (const layer of declared.layers ?? []) claim('layer', layer.id)
  for (const metric of declared.metrics ?? []) {
    claim('metric', metric.id)
    if (metric.max !== undefined && !(finite(metric.max) && metric.max > 0)) problems.push(`metric "${metric.id}" needs a max > 0`)
  }
  return { ok: problems.length === 0, problems }
}
