import type { TouchingPair } from './energy-ruler'

/** What the pieces' engine glue holds, as the ruler needs it (private to the renderer; the probes and the bowl read it by shape). */
type EngineGlue = {
  readonly world: {
    trackPairs?: boolean
    readonly pairLog?: readonly number[]
    readonly entry?: (key: number) => { readonly id: unknown }
    readonly bi?: { GetMotionQuality(id: unknown): unknown }
    readonly J?: { readonly EMotionQuality_LinearCast: unknown }
  }
  readonly links: ReadonlyMap<unknown, { readonly id: number }>
  readonly byObject: ReadonlyMap<string, unknown>
}

const engineOf = (renderer: unknown): EngineGlue | null => {
  const engine = (renderer as { pieceSys?: { engine?: EngineGlue | null } }).pieceSys?.engine
  return engine && engine.world.pairLog ? engine : null
}

/** Turns on the Jolt adapter's contact log (`JoltWorld.trackPairs`). False on a world that has none (the kit's own solver): the ruler then falls back to bounding spheres. */
export const trackContactGraph = (renderer: unknown): boolean => {
  const engine = engineOf(renderer)
  if (!engine) return false
  engine.world.trackPairs = true
  return true
}

/** The pieces (by object id) the engine had touching at some point of the last frame: those touching when it began plus every contact added in it. Undefined without a log. */
export const touchingPairsOf = (renderer: unknown): TouchingPair[] | undefined => {
  const engine = engineOf(renderer)
  if (!engine || !engine.world.trackPairs) return undefined
  const objectOf = new Map<number, string>()
  for (const [objectId, body] of engine.byObject) {
    const link = engine.links.get(body)
    if (link) objectOf.set(link.id, objectId)
  }
  const log = engine.world.pairLog as readonly number[]
  const pairs: TouchingPair[] = []
  for (let i = 0; i < log.length; i += 2) {
    const a = objectOf.get(log[i] as number)
    const b = objectOf.get(log[i + 1] as number)
    if (a !== undefined && b !== undefined && a !== b) pairs.push([a, b])
  }
  return pairs
}

/**
 * R3: the pieces (by object id) whose continuous-motion body (Jolt `LinearCast`) has a contact in this update that it did not have in the previous one: a new pair, where the
 * engine's pull-back to the instant of impact can make the centre move less than its speed says. One tracker per renderer; call it once per update, after the update.
 * Undefined on a world with no log or no way to read the body's motion quality (the kit's own solver).
 */
export const createFirstContactTracker = (): ((renderer: unknown) => ReadonlySet<string> | undefined) => {
  let previous = new Map<number, Set<number>>()
  return (renderer) => {
    const engine = engineOf(renderer)
    if (!engine || !engine.world.trackPairs || !engine.world.entry || !engine.world.bi || !engine.world.J) return undefined
    const log = engine.world.pairLog as readonly number[]
    const partners = new Map<number, Set<number>>()
    const add = (key: number, other: number): void => {
      const set = partners.get(key) ?? new Set<number>()
      set.add(other)
      partners.set(key, set)
    }
    for (let i = 0; i < log.length; i += 2) {
      add(log[i] as number, log[i + 1] as number)
      add(log[i + 1] as number, log[i] as number)
    }
    const first = new Set<string>()
    for (const [objectId, body] of engine.byObject) {
      const link = engine.links.get(body)
      const now = link ? partners.get(link.id) : undefined
      if (!link || !now) continue
      const before = previous.get(link.id)
      if (![...now].some((other) => !before?.has(other))) continue
      if (engine.world.bi.GetMotionQuality(engine.world.entry(link.id).id) === engine.world.J.EMotionQuality_LinearCast) first.add(objectId)
    }
    previous = partners
    return first
  }
}
