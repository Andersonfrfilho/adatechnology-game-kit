import type { WindowFrame } from '@adatechnology/game-floorplan'

/** What the houses area opens with, read from the page address. */
export interface FloorplanAreaParams {
  readonly template?: string
  readonly seed?: number
  readonly state?: string
  /** `?windowFrame=wood|aluminium|frameless`: every window of the house with that frame (`BuildOptions.windowFrame`). */
  readonly windowFrame?: WindowFrame
  /** `?shadowBatches=0`: each mesh of the house casts its own shadow, as before the shadow batches (to compare the two). */
  readonly shadowBatches?: false
}
const FRAMES: readonly WindowFrame[] = ['wood', 'aluminium', 'frameless']

const ID = /^[a-z0-9_]+$/

/**
 * The house the area opens on from the page address: `?template=mansion&seed=4&state=abandoned` (`?area=floorplan_area` opens the area). Unknown or
 * malformed values are left out, so the bench falls back to its defaults; the module drops a template or state its engine does not know.
 */
export function floorplanAreaParams(search: string): FloorplanAreaParams {
  const params = new URLSearchParams(search)
  const template = params.get('template') ?? undefined
  const state = params.get('state') ?? undefined
  const seed = Number(params.get('seed'))
  const frame = FRAMES.find((f) => f === params.get('windowFrame'))
  return {
    ...(params.get('shadowBatches') === '0' ? { shadowBatches: false as const } : {}),
    ...(frame ? { windowFrame: frame } : {}),
    ...(template && ID.test(template) ? { template } : {}),
    ...(Number.isInteger(seed) && seed >= 1 && seed <= 999 ? { seed } : {}),
    ...(state && ID.test(state) ? { state } : {}),
  }
}
