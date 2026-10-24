import type { BenchChange, BenchSheet, ControlPatch, ControlValue, ModuleControl, ModuleLayer, ModuleMetric, TestableModule } from '@adatechnology/game-contracts'
import type { BenchControl, BenchHandle, BenchLayer } from './types'

/** What the room keeps per module bench: the declarations, the module's patches, the values and the layers. Pure: no DOM, no three.js. */
export interface BenchStore extends BenchHandle {
  readonly moduleId: string
  readonly metrics: readonly ModuleMetric[]
  readonly declared: { readonly controls: readonly ModuleControl[]; readonly layers: readonly ModuleLayer[]; readonly metrics: readonly ModuleMetric[] }
  /** Changes for the module (the `ModuleBench.onChange` listeners). */
  onChange(listener: (change: BenchChange) => void): () => void
  /** Any change of state, the module's patches included (the panel and the URL follow it). */
  watch(listener: () => void): () => void
  patch(id: string, patch: ControlPatch): void
  /** The sheet the module put on the panel, if any. */
  sheet(): BenchSheet | null
  setSheet(sheet: BenchSheet | null): void
  /** One change per control (not actions) and per layer, in declaration order. */
  sendInitial(): void
  /** Apply an encoded state without emitting. */
  restore(encoded: string): void
  /** Drops every listener and watcher (the room is gone). */
  dispose(): void
}

type ControlState = ModuleControl & { disabled: boolean }

const snap = (control: Extract<ModuleControl, { kind: 'number' }>, value: number): number => {
  const clamped = Math.min(control.max, Math.max(control.min, value))
  if (!control.step) return clamped
  const stepped = control.min + Math.round((clamped - control.min) / control.step) * control.step
  return Number(Math.min(control.max, stepped).toFixed(10))
}

/** The value a control takes for `value`, or undefined when it does not fit (wrong type, option not offered, action). */
function fitValue(control: ModuleControl, value: unknown): ControlValue | undefined {
  if (control.kind === 'number') return typeof value === 'number' && Number.isFinite(value) ? snap(control, value) : undefined
  if (control.kind === 'boolean') return typeof value === 'boolean' ? value : undefined
  if (control.kind === 'choice') return typeof value === 'string' && control.options.some((option) => option.id === value) ? value : undefined
  return undefined
}

const fromText = (control: ModuleControl, text: string): unknown => {
  if (control.kind === 'number') return text.trim() === '' ? Number.NaN : Number(text)
  if (control.kind === 'boolean') return text === '1' ? true : text === '0' ? false : undefined
  return text
}

const toText = (value: ControlValue): string => (typeof value === 'boolean' ? (value ? '1' : '0') : String(value))

/** `id=value;id=value`, values with `encodeURIComponent`, booleans and layers as `1` / `0`. */
export function encodeBenchState(controls: readonly BenchControl[], layers: readonly BenchLayer[]): string {
  const pairs: string[] = []
  for (const control of controls) if (control.value !== undefined) pairs.push(`${control.id}=${encodeURIComponent(toText(control.value))}`)
  for (const layer of layers) pairs.push(`${layer.id}=${layer.on ? '1' : '0'}`)
  return pairs.join(';')
}

/** Reads an encoded state as hostile input: unknown ids, NaN, options not offered and malformed pairs are dropped; numbers are clamped. */
export function decodeBenchState(encoded: string, controls: readonly ModuleControl[], layers: readonly ModuleLayer[]): Map<string, ControlValue> {
  const out = new Map<string, ControlValue>()
  for (const pair of encoded.split(';')) {
    const at = pair.indexOf('=')
    if (at <= 0) continue
    const id = pair.slice(0, at)
    let text: string
    try {
      text = decodeURIComponent(pair.slice(at + 1))
    } catch {
      continue
    }
    const control = controls.find((c) => c.id === id)
    if (control) {
      const value = fitValue(control, fromText(control, text))
      if (value !== undefined) out.set(id, value)
      continue
    }
    if (layers.some((layer) => layer.id === id) && (text === '1' || text === '0')) out.set(id, text === '1')
  }
  return out
}

export function createBenchStore(module: TestableModule<unknown>, locale: string, onListenerError?: (error: unknown) => void): BenchStore {
  const declared = { controls: module.controls?.(locale) ?? [], layers: module.layers?.(locale) ?? [], metrics: module.metrics?.(locale) ?? [] }
  const controls: ControlState[] = declared.controls.map((control) => ({ ...control, disabled: false }))
  const values = new Map<string, ControlValue>()
  for (const control of controls) if (control.kind !== 'action') values.set(control.id, control.default)
  const layers = new Map<string, boolean>(declared.layers.map((layer) => [layer.id, layer.default !== false]))
  const listeners = new Set<(change: BenchChange) => void>()
  const watchers = new Set<() => void>()
  const emit = (change: BenchChange): void => {
    for (const listener of listeners) {
      try {
        listener(change)
      } catch (error) {
        onListenerError?.(error)
      }
    }
  }
  const changed = (): void => {
    for (const watcher of watchers) watcher()
  }
  let sheet: BenchSheet | null = null
  const controlOf = (id: string): ControlState | undefined => controls.find((control) => control.id === id)

  const store: BenchStore = {
    moduleId: module.id,
    metrics: declared.metrics,
    declared,
    controls: () => controls.map((control) => ({ ...control, value: values.get(control.id) })),
    layers: () => declared.layers.map((layer) => ({ ...layer, on: layers.get(layer.id) === true })),
    value: (id) => values.get(id),
    layer: (id) => layers.get(id) === true,
    set(id, value) {
      const control = controlOf(id)
      if (!control || control.disabled) return false
      const fitted = fitValue(control, value)
      if (fitted === undefined) return false
      values.set(id, fitted)
      emit({ kind: 'control', id, value: fitted })
      changed()
      return true
    },
    setLayer(id, on) {
      if (!layers.has(id)) return false
      layers.set(id, on)
      emit({ kind: 'layer', id, on })
      changed()
      return true
    },
    act(id) {
      const control = controlOf(id)
      if (!control || control.kind !== 'action' || control.disabled) return false
      emit({ kind: 'action', id })
      return true
    },
    encode: () => encodeBenchState(store.controls(), store.layers()),
    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    watch(listener) {
      watchers.add(listener)
      return () => watchers.delete(listener)
    },
    sheet: () => sheet,
    setSheet(next) {
      sheet = next
      changed()
    },
    patch(id, patch) {
      const index = controls.findIndex((control) => control.id === id)
      if (index < 0) return
      let control = controls[index]
      if (patch.hidden !== undefined) control = { ...control, hidden: patch.hidden }
      if (patch.disabled !== undefined) control = { ...control, disabled: patch.disabled }
      if (patch.options && control.kind === 'choice' && patch.options.length > 0) {
        control = { ...control, options: [...patch.options] }
        const offered = control.options
        if (!offered.some((option) => option.id === values.get(id))) values.set(id, offered[0].id)
      }
      controls[index] = control
      if (patch.value !== undefined) {
        const fitted = fitValue(control, patch.value)
        if (fitted !== undefined) values.set(id, fitted)
      }
      changed()
    },
    sendInitial() {
      for (const control of controls) {
        const value = values.get(control.id)
        if (value !== undefined) emit({ kind: 'control', id: control.id, value })
      }
      for (const layer of declared.layers) emit({ kind: 'layer', id: layer.id, on: layers.get(layer.id) === true })
      changed()
    },
    restore(encoded) {
      for (const [id, value] of decodeBenchState(encoded, controls, declared.layers)) {
        if (typeof value === 'boolean' && layers.has(id)) layers.set(id, value)
        else values.set(id, value)
      }
    },
    dispose() {
      listeners.clear()
      watchers.clear()
    },
  }
  return store
}
