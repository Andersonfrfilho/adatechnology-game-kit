import type { WeatherSample } from '@adatechnology/game-weather'

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value)
const smoothstep = (from: number, to: number, value: number): number => {
  const t = clamp01((value - from) / (to - from))
  return t * t * (3 - 2 * t)
}

/** Share of the sky the clouds cover with nothing else in the sample: a clear sky keeps a few scattered clouds, every state that dims the sky (`skyScale` below 1) or rains is a full overcast. */
export const CLOUD_COVER = { clear: 0.2, perSkyDimming: 7, perRainMm: 0.4, rainFullAtMm: 5, windMax: 0.15, windFullAt: 20 } as const
/** `skyScale` where the clouds start to darken, and the dimming at which they are as dark as a typhoon's. */
const DARK_FROM_SKY_SCALE = 0.95
const DARK_SPAN = 0.45

/** 0..1 cloud cover for this weather: scattered when clear, full overcast when it rains or the sky is dimmed. Pure. */
export function cloudCoverOf(sample: WeatherSample): number {
  const dimming = clamp01(1 - sample.skyScale)
  const rain = Math.min(1, sample.rain / CLOUD_COVER.rainFullAtMm)
  const wind = Math.min(1, Math.hypot(sample.windX, sample.windZ) / CLOUD_COVER.windFullAt) * CLOUD_COVER.windMax
  return clamp01(CLOUD_COVER.clear + dimming * CLOUD_COVER.perSkyDimming + rain * CLOUD_COVER.perRainMm + wind)
}

/** 0..1 how dark the cloud undersides are: grey in rain, near black in a storm or typhoon. Pure. */
export function cloudDarknessOf(sample: WeatherSample): number {
  return clamp01((DARK_FROM_SKY_SCALE - sample.skyScale) / DARK_SPAN)
}

/** 0..1 how dark the sky is: the stars and the moon come out only once the dusk is over. Pure. */
export const nightnessOf = (sample: WeatherSample): number => clamp01(sample.nightFactor) ** 3

/** 0..1 how many stars show: the night's, hidden by the clouds (none under a full overcast). Pure. */
export function starVisibilityOf(sample: WeatherSample): number {
  return nightnessOf(sample) * clamp01(1 - cloudCoverOf(sample) * 1.25)
}

/** 0..1 sunrise or sunset warmth: the sun is low (a bell over `sun`), less under clouds. Pure. */
export function sunsetOf(sample: WeatherSample): number {
  const low = smoothstep(0.02, 0.15, sample.sun) * (1 - smoothstep(0.15, 0.5, sample.sun))
  return low * (1 - cloudCoverOf(sample) * 0.75)
}

/** 0..1 how much of the sun disc and its glow shows (before the clouds put themselves in front): none at night. Pure. */
export const sunVisibilityOf = (sample: WeatherSample): number => smoothstep(0.02, 0.15, sample.sun)

type Direction = { x: number; y: number; z: number }
export type HostSun = { readonly position: Direction; readonly target?: { readonly position: Direction } }

/** The unit direction to the sun, written into `out`: the host sun's (its position seen from its target) or, with none, an arc over the day (rises east at 06:00, sets west at 18:00). */
export function sunDirectionOf(sample: WeatherSample, host: HostSun | undefined, out: Direction): Direction {
  if (host) {
    const target = host.target?.position
    out.x = host.position.x - (target?.x ?? 0)
    out.y = host.position.y - (target?.y ?? 0)
    out.z = host.position.z - (target?.z ?? 0)
  } else {
    const angle = (sample.dayFraction - 0.25) * Math.PI * 2
    out.x = Math.cos(angle)
    out.y = Math.sin(angle)
    out.z = -0.3
  }
  const length = Math.hypot(out.x, out.y, out.z) || 1
  out.x /= length
  out.y /= length
  out.z /= length
  return out
}
