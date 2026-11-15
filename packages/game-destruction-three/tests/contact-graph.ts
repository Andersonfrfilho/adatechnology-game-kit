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
 * R3: the pieces (by object id) whose continuous-motion body (Jolt `LinearCast`) touches something now and touched nothing in the previous update: its first contact after flight,
 * where the engine's pull-back to the instant of impact can make the centre move less than its speed says. One tracker per renderer; call it once per update, after the update.
 * Undefined on a world with no log or no way to read the body's motion quality (the kit's own solver).
 */
export const createFirstContactTracker = (): ((renderer: unknown) => ReadonlySet<string> | undefined) => {
  let previous = new Map<number, number>()
  return (renderer) => {
    const engine = engineOf(renderer)
    if (!engine || !engine.world.trackPairs || !engine.world.entry || !engine.world.bi || !engine.world.J) return undefined
    const log = engine.world.pairLog as readonly number[]
    const partners = new Map<number, number>()
    for (let i = 0; i < log.length; i += 2) {
      partners.set(log[i] as number, (partners.get(log[i] as number) ?? 0) + 1)
      partners.set(log[i + 1] as number, (partners.get(log[i + 1] as number) ?? 0) + 1)
    }
    const first = new Set<string>()
    for (const [objectId, body] of engine.byObject) {
      const link = engine.links.get(body)
      if (!link || !partners.has(link.id) || previous.has(link.id)) continue
      if (engine.world.bi.GetMotionQuality(engine.world.entry(link.id).id) === engine.world.J.EMotionQuality_LinearCast) first.add(objectId)
    }
    previous = partners
    return first
  }
}
