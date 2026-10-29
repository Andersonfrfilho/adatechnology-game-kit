export type Rgb = readonly [number, number, number]

const BYTE_MAX = 255
const SRGB_LINEAR_SLOPE = 0.0773993808
const SRGB_THRESHOLD = 0.04045

/** The channels of `0xRRGGBB` exactly as three.js r128 reads them (no colour-space conversion): the numbers the Lab's shaders and lights were tuned with. */
export function hexToRgb(hex: number): Rgb {
  const whole = Math.floor(hex)
  return [((whole >> 16) & BYTE_MAX) / BYTE_MAX, ((whole >> 8) & BYTE_MAX) / BYTE_MAX, (whole & BYTE_MAX) / BYTE_MAX]
}

export function srgbChannelToLinear(channel: number): number {
  return channel < SRGB_THRESHOLD ? channel * SRGB_LINEAR_SLOPE : Math.pow(channel * 0.9478672986 + 0.0521327014, 2.4)
}

/** `new Color(hex).convertSRGBToLinear()` of r128: the smoke, dust and fire colours the puff shader multiplies the light with. Converted once, at spawn. */
export function hexToLinearRgb(hex: number): Rgb {
  const [red, green, blue] = hexToRgb(hex)
  return [srgbChannelToLinear(red), srgbChannelToLinear(green), srgbChannelToLinear(blue)]
}

export function linearRgbFromRaw(color: Rgb): Rgb {
  return [srgbChannelToLinear(color[0]), srgbChannelToLinear(color[1]), srgbChannelToLinear(color[2])]
}
