const WARNED_KEY = Symbol.for('@adatechnology/game-contracts.warned')

type WarnedHolder = { [WARNED_KEY]?: Set<string> }

const warnedKeys = (): Set<string> => {
  const holder = globalThis as WarnedHolder
  return (holder[WARNED_KEY] ??= new Set<string>())
}

declare const process: { readonly env: { readonly NODE_ENV?: string } }

// The literal `process.env.NODE_ENV` is what bundlers replace; where there is no `process` the reference throws and counts as development.
const isProduction = (): boolean => {
  try {
    return process.env.NODE_ENV === 'production'
  } catch {
    return false
  }
}

const isQuiet = (): boolean => (globalThis as { __GAME_KIT_QUIET__?: unknown }).__GAME_KIT_QUIET__ === true

/**
 * Warns on the console the first time `key` is seen, and only outside production and when `globalThis.__GAME_KIT_QUIET__` is not `true`: for a silent fallback that keeps working (an adapter that made its own effects
 * world or audio engine because the host lent none). The seen keys live on `globalThis`, so several bundles of the kit on one page warn once together.
 */
export const warnOnce = (key: string, message: string): void => {
  if (isQuiet() || isProduction()) return
  const seen = warnedKeys()
  if (seen.has(key)) return
  seen.add(key)
  console.warn(`[game-kit] ${message}`)
}

/** Forgets what `warnOnce` has seen (tests that count warnings). */
export const resetWarnOnce = (): void => warnedKeys().clear()
