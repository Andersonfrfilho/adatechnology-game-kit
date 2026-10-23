import { mixHex } from './math'

/** Blackbody-ish stops: [temperature °C, colour]. Luminance grows with the temperature. */
const STOPS: Array<[number, number]> = [
  [450, 0x000000],
  [500, 0x2a0400],
  [650, 0x8a1500],
  [800, 0xd84a08],
  [950, 0xff8c14],
  [1100, 0xffc23a],
  [1250, 0xffe8a0],
  [1400, 0xffffff],
]

/**
 * Glow colour of a hot surface as `0xRRGGBB`: black (no glow) below about 450 °C, dark red around 500, orange around 800, yellow around 1100 and
 * white from 1400 °C. Brightness never decreases as the temperature rises. Use it as an emissive colour.
 */
export function heatColor(temperatureC: number): number {
  if (!(temperatureC > STOPS[0][0])) return 0
  const last = STOPS[STOPS.length - 1]
  if (temperatureC >= last[0]) return last[1]
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i]
    if (temperatureC <= t1) {
      const [t0, c0] = STOPS[i - 1]
      return mixHex(c0, c1, (temperatureC - t0) / (t1 - t0))
    }
  }
  return last[1]
}
