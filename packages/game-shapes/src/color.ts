import type { Color } from './types'

/** A colour as `0xRRGGBB`: numbers as given (floored, as three's `setHex`), `'#rrggbb'` strings parsed. */
export function colorHex(color: Color | undefined, fallback = 0xffffff): number {
  if (color === undefined) return fallback
  if (typeof color === 'number') return Math.floor(color)
  const match = /^#([0-9a-fA-F]{6})$/.exec(color)
  if (!match) throw new Error(`game-shapes: colour "${color}" is not 0xRRGGBB or #rrggbb`)
  return parseInt(match[1] as string, 16)
}

/** three's `SRGBToLinear` (r160 `ColorManagement`), the same constants. */
export const srgbToLinear = (c: number): number => (c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4))

/**
 * The rgb floats of a hex colour as three's `Color.setHex` stores them: the channels over 255 (`'srgb'`), converted to the linear working space
 * when colour management is on (`'linear'`).
 */
export function colorChannels(hex: number, space: 'linear' | 'srgb'): [number, number, number] {
  const r = ((hex >> 16) & 255) / 255
  const g = ((hex >> 8) & 255) / 255
  const b = (hex & 255) / 255
  return space === 'linear' ? [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)] : [r, g, b]
}
