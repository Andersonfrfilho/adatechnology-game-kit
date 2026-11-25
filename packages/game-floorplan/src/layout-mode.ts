let visor = false

/**
 * The furniture is being laid out as the Visor de casas 3D did (`FloorplanOptions.visorLayout`, the team's golden only): no room kept for doors and drawers to
 * open, a nightstand in the bed's corner, the lights and curtains hung without looking at what stands under them.
 */
export const visorLayout = (): boolean => visor

/** Runs `fn` with the Visor's layout on or off (generation is synchronous: the value is restored before anything else runs). */
export function withVisorLayout<T>(on: boolean, fn: () => T): T {
  const previous = visor
  visor = on
  try {
    return fn()
  } finally {
    visor = previous
  }
}
