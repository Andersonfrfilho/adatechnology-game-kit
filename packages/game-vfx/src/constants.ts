import { hexToLinearRgb } from './color'

/** The Lab's smoke colours (L211-214), converted to linear once. Colours of an explosion in data are `0xRRGGBB` and go through `hexToLinearRgb` the same way. */
export const SMOKE_COLORS = {
  grey: hexToLinearRgb(0x6a655f),
  dark: hexToLinearRgb(0x4a4440),
  black: hexToLinearRgb(0x3a3431),
  brown: hexToLinearRgb(0x7a5c3e),
  dust: hexToLinearRgb(0x7d7368),
  concrete: hexToLinearRgb(0x8f8a82),
  white: hexToLinearRgb(0xb4b0a8),
  blood: hexToLinearRgb(0x5a0b0b),
  bile: hexToLinearRgb(0x7a8a2a),
  gas: hexToLinearRgb(0xe8ecef),
} as const

export const DEFAULT_GRAVITY = 9.8
export const DEFAULT_WIND = { x: 0.55, y: 0, z: 0.2 } as const
export const FRAME_STEP_LIMIT = 0.05
