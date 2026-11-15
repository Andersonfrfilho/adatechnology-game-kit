import { SLAB_PANEL_DEFAULTS } from './options'
import type { SlabPanelOptions } from './options'

export type SlabSpan = { readonly short: number; readonly long: number }

const ceilToCentimetre = (value: number): number => Math.ceil(value * 100 - 1e-9) / 100

/**
 * Thickness of a slab of a house or an outbuilding: what the most demanding of its panels asks (its short side over 35 when it spans both ways, over 25
 * when it spans one way, sides 2:1 or longer), not under the minimum of the use (NBR 6118 13.2.4.1: 7 cm a roof, 8 cm a floor, kept at 8 and 10 here) and
 * not under the precast slab every one of them is cast with (block plus topping). The only place that decides it: house and outbuilding take it from here.
 */
export function slabThicknessFor(spans: readonly SlabSpan[], roof: boolean, options: SlabPanelOptions = SLAB_PANEL_DEFAULTS): number {
  const asked = Math.max(...spans.map(({ short, long }) => short / (long >= 2 * short ? options.oneWayThicknessRatio : options.thicknessRatio)))
  return Math.max(roof ? options.roofMinThickness : options.floorMinThickness, options.precastThickness, ceilToCentimetre(asked))
}
