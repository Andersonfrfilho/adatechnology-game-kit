/**
 * The seal of a closed container (a food tin, a drink can, a jar, a bottle with a cap): what opens it and whether a breach spoils what is inside.
 * Plain data and one pure check, shared by the item rules (`resolveUse` of game-items) and any host that lets the player open and eat (the test room).
 */
export interface SealSpec {
  /** Ids of the tools that open it (items or weapons: `can_opener`, `knife`); any one of them is enough. */
  readonly openWith?: readonly string[]
  /** It opens by hand (a pull tab, a ring pull, a screw cap): no tool needed. */
  readonly byHand?: boolean
  /** A hole through the container or a leak spoils what is inside: it can no longer be eaten or drunk. */
  readonly spoilsWhenBreached?: boolean
}

/** The state of one container: opened, holed through (a shot, a blade) or leaking. */
export interface SealState {
  readonly opened?: boolean
  readonly breached?: boolean
  readonly leaked?: boolean
}

/** Why a sealed container cannot be eaten or drunk now. */
export type SealBlock = 'sealed' | 'breached' | 'leaked'

/** Whether it can be opened with the tools at hand, and with which one (undefined when it opens by hand). */
export const sealOpener = (seal: SealSpec, tools: Iterable<string>): { readonly ok: boolean; readonly tool?: string } => {
  if (seal.byHand || !seal.openWith || seal.openWith.length === 0) return { ok: true }
  const have = new Set(tools)
  const tool = seal.openWith.find((id) => have.has(id))
  return tool === undefined ? { ok: false } : { ok: true, tool }
}

/** What stops eating or drinking it now, or undefined when nothing does. A spoiled container (breached, leaked) is blocked even once open. */
export const sealBlock = (seal: SealSpec, state: SealState): SealBlock | undefined => {
  if (seal.spoilsWhenBreached && state.breached) return 'breached'
  if (seal.spoilsWhenBreached && state.leaked) return 'leaked'
  if (!state.opened) return 'sealed'
  return undefined
}
