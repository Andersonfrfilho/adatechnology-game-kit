// PROTÓTIPO DESCARTÁVEL (spec 018 T0.1): sonda de tempo dentro de `world.explode`. Não vai para a main.
//
// Ligada só quando o host põe `globalThis.__destructionExplodeProbe = { mode, now, records }` antes de criar o mundo (lido uma vez, em
// `createExplodeProbe`). Desligada, `wrap` devolve a própria função e `enter`/`leave`/`count` não fazem nada: a simulação não muda.
// O relógio vem do host (`now`): o pacote não cria relógio próprio.

/** `fine`: every label; `coarse`: only the labels in COARSE_LABELS (the frequent per-call ones are left out, to check the probe's own cost). */
export type ExplodeProbeMode = 'fine' | 'coarse'

/** One outermost `explode` call: its wall time, the exclusive time of each label (the rest of the call is `explodeRest`) and the counts. */
export type ExplodeProbeRecord = {
  readonly mode: ExplodeProbeMode
  readonly totalMs: number
  readonly labels: Record<string, number>
  readonly calls: Record<string, number>
  readonly counts: Record<string, number>
}

export type ExplodeProbeHost = {
  readonly mode: ExplodeProbeMode
  readonly now: () => number
  readonly records: ExplodeProbeRecord[]
}

export type ExplodeProbe = {
  readonly isOn: boolean
  wrap<F extends (...args: never[]) => unknown>(label: string, fn: F): F
  root<T>(fn: () => T): T
  enter(label: string): void
  leave(label: string): void
  count(name: string, amount?: number): void
}

/** The labels the coarse mode keeps: under ~100 calls per explosion (the per-part ones are left out), so their timers cost nothing measurable. */
const COARSE_LABELS = new Set(['knockOutUnits', 'solveStructure', 'groups', 'flushCollapse', 'detachEvents', 'implHit', 'implInRange', 'implDescribe', 'koGrid', 'koFragments', 'koCollapse', 'ssGraph', 'ssSolve', 'ssSpan', 'ssLoads', 'ssApply'])

const OFF: ExplodeProbe = {
  isOn: false,
  wrap: (_label, fn) => fn,
  root: (fn) => fn(),
  enter: () => undefined,
  leave: () => undefined,
  count: () => undefined,
}

const isProbeHost = (value: unknown): value is ExplodeProbeHost =>
  typeof value === 'object' && value !== null && 'now' in value && typeof value.now === 'function' && 'records' in value && Array.isArray(value.records) && 'mode' in value && (value.mode === 'fine' || value.mode === 'coarse')

type OpenFrame = { label: string; started: number; child: number }

export function createExplodeProbe(globalKey = '__destructionExplodeProbe'): ExplodeProbe {
  const host: unknown = (globalThis as Record<string, unknown>)[globalKey]
  if (!isProbeHost(host)) return OFF
  const { mode, now } = host
  const isKept = (label: string): boolean => mode === 'fine' || COARSE_LABELS.has(label) || label.startsWith('impl:')
  const open: OpenFrame[] = []
  let labels: Record<string, number> = {}
  let calls: Record<string, number> = {}
  let counts: Record<string, number> = {}
  let depth = 0

  const enter = (label: string): void => {
    if (depth === 0 || !isKept(label)) return
    open.push({ label, started: now(), child: 0 })
  }
  const close = (frame: OpenFrame): void => {
    const spent = now() - frame.started
    labels[frame.label] = (labels[frame.label] ?? 0) + spent - frame.child
    calls[frame.label] = (calls[frame.label] ?? 0) + 1
    const parent = open[open.length - 1]
    if (parent) parent.child += spent
  }
  const leave = (label?: string): void => {
    // a section the coarse mode skipped was never opened: nothing to close
    if (label !== undefined && open[open.length - 1]?.label !== label) return
    const frame = open.pop()
    if (frame) close(frame)
  }

  return {
    isOn: true,
    wrap<F extends (...args: never[]) => unknown>(label: string, fn: F): F {
      if (!isKept(label)) return fn
      const wrapped = function (this: unknown, ...args: Parameters<F>): ReturnType<F> {
        if (depth === 0) return fn.apply(this, args) as ReturnType<F>
        const frame: OpenFrame = { label, started: now(), child: 0 }
        open.push(frame)
        try {
          return fn.apply(this, args) as ReturnType<F>
        } finally {
          // an early return between `enter` and `leave` would leave a section open: close down to this frame
          while (open.length > 0 && open[open.length - 1] !== frame) leave()
          open.pop()
          close(frame)
        }
      }
      return wrapped as unknown as F
    },
    root<T>(fn: () => T): T {
      if (depth > 0) return fn()
      labels = {}
      calls = {}
      counts = {}
      depth = 1
      const rootFrame: OpenFrame = { label: 'explodeRest', started: now(), child: 0 }
      open.length = 0
      open.push(rootFrame)
      try {
        return fn()
      } finally {
        while (open.length > 1) leave()
        open.pop()
        const totalMs = now() - rootFrame.started
        labels.explodeRest = totalMs - rootFrame.child
        depth = 0
        host.records.push({ mode, totalMs, labels, calls, counts })
      }
    },
    enter,
    leave,
    count(name: string, amount = 1): void {
      if (depth === 0) return
      counts[name] = (counts[name] ?? 0) + amount
    },
  }
}
