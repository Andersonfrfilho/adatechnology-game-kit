const POOLED = '__pooled'

type Disposable = { dispose(): void; userData: Record<string, unknown> }

function isDevelopment(): boolean {
  return typeof process === 'undefined' || process.env.NODE_ENV !== 'production'
}

/** Marks a pool resource and, in development, warns when something disposes it directly instead of releasing it to the pool. */
export function markPooled(resource: Disposable, key: string, owner: string): { disposeForPool(): void } {
  resource.userData[POOLED] = key
  const original = resource.dispose.bind(resource)
  let fromPool = false
  if (isDevelopment()) {
    resource.dispose = () => {
      if (!fromPool) console.warn(`[game-render-three] ${owner} "${key}" was disposed directly; release it to its pool instead`)
      original()
    }
  }
  return {
    disposeForPool() {
      fromPool = true
      original()
      fromPool = false
    },
  }
}

export function pooledKey(resource: { userData: Record<string, unknown> }): string | undefined {
  const key = resource.userData[POOLED]
  return typeof key === 'string' ? key : undefined
}

/** A number as a short stable string, rounded to `step`. */
export function roundedNumber(value: number, step: number): string {
  return String(Number((Math.round(value / step) * step).toFixed(6)))
}
