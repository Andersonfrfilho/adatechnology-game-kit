import type { Rgb } from './color'
import { hexToRgb, srgbChannelToLinear } from './color'

/** One of the 4 blast lights (L349-365). */
export interface BlastLight {
  x: number
  y: number
  z: number
  distance: number
  peak: number
  life: number
  t: number
  color: Rgb
  /** The level before the flash layer is applied. */
  level: number
  intensity: number
}

/** One of the 2 fire lights: they go to the two largest fires. */
export interface FireLight {
  x: number
  y: number
  z: number
  distance: number
  intensity: number
}

/** The glow the puff shader reads (`uGlowPos`, `uGlowCol`, `uGlowI`): where the brightest light is, in linear colour. */
export interface LightGlow {
  x: number
  y: number
  z: number
  color: [number, number, number]
  intensity: number
}

export interface LightPool {
  readonly blast: BlastLight[]
  readonly fire: FireLight[]
  readonly glow: LightGlow
  /** Which blast light the next explosion takes (the Lab's `xlIdx`). */
  cursor: number
}

export const BLAST_LIGHTS = 4
export const FIRE_LIGHTS = 2
const DEFAULT_BLAST_COLOR = 0xffa050
const FIRE_GLOW_COLOR: Rgb = [1, 0.42, 0.12]
const PEAK_HOLD = 0.05

export function createLightPool(): LightPool {
  return {
    blast: Array.from({ length: BLAST_LIGHTS }, () => ({ x: 0, y: -50, z: 0, distance: 30, peak: 0, life: 1, t: 9, color: hexToRgb(DEFAULT_BLAST_COLOR), level: 0, intensity: 0 })),
    fire: Array.from({ length: FIRE_LIGHTS }, () => ({ x: 0, y: -50, z: 0, distance: 16, intensity: 0 })),
    glow: { x: 0, y: 0, z: 0, color: [1, 0.5, 0.2], intensity: 0 },
    cursor: 0,
  }
}

export function resetLightPool(pool: LightPool): void {
  for (const light of pool.blast) {
    light.t = 9
    light.level = 0
    light.intensity = 0
  }
  pool.cursor = 0
}

export interface BlastLightSpec {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly peak: number
  readonly distance: number
  readonly life: number
  readonly color: number
}

/** `boomLight` (L357-358): the next blast light, round robin. */
export function lightBlast(pool: LightPool, spec: BlastLightSpec): void {
  const light = pool.blast[pool.cursor++ % pool.blast.length]!
  light.x = spec.x
  light.y = spec.y
  light.z = spec.z
  light.distance = spec.distance
  light.peak = spec.peak
  light.life = spec.life
  light.t = 0
  light.color = hexToRgb(spec.color)
}

export interface FireForLight {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly r: number
  readonly fade: number
}

export interface LightStep {
  readonly dt: number
  /** 1 while the flash layer is on, 0 while it is off (the Lab multiplies by it). */
  readonly flashLayer: number
  readonly clock: number
  readonly fires: readonly FireForLight[]
}

function largestFire(fires: readonly FireForLight[], skip: FireForLight | null): FireForLight | null {
  let best: FireForLight | null = null
  for (const fire of fires) {
    if (fire === skip) continue
    if (best === null || fire.r > best.r) best = fire
  }
  return best
}

function updateBlastLights(pool: LightPool, step: LightStep): BlastLight | null {
  let brightest: BlastLight | null = null
  for (const light of pool.blast) {
    light.t += step.dt
    const age = light.t / light.life
    const level = age < 1 ? light.peak * (light.t < PEAK_HOLD ? 1 : Math.pow(1 - age, 2.2)) * (0.85 + 0.15 * Math.sin(light.t * 60)) : 0
    light.level = level
    light.intensity = level * step.flashLayer
    if (level > (brightest?.level ?? 0)) brightest = light
  }
  return brightest
}

/** `updateLights` (L350-364): blast lights fade by their curve, the two fire lights follow the two largest fires, and the glow follows the brightest light. */
export function updateLights(pool: LightPool, step: LightStep): void {
  const brightest = updateBlastLights(pool, step)
  const brightness = brightest?.level ?? 0
  const first = largestFire(step.fires, null)
  const second = largestFire(step.fires, first)
  const largest = [first, second]
  for (let index = 0; index < FIRE_LIGHTS; index++) {
    const fire = largest[index]
    const light = pool.fire[index]!
    if (!fire) {
      light.intensity = 0
      continue
    }
    light.x = fire.x
    light.y = fire.y + Math.max(0.8, fire.r * 0.6)
    light.z = fire.z
    light.intensity = (1.4 + fire.r * 0.6) * (0.75 + 0.25 * Math.sin(step.clock * 17 + index * 3) + 0.1 * Math.sin(step.clock * 41)) * fire.fade
    light.distance = 10 + fire.r * 4
  }
  if (brightest && brightness > 0.05) {
    pool.glow.x = brightest.x
    pool.glow.y = brightest.y
    pool.glow.z = brightest.z
    pool.glow.color[0] = srgbChannelToLinear(brightest.color[0])
    pool.glow.color[1] = srgbChannelToLinear(brightest.color[1])
    pool.glow.color[2] = srgbChannelToLinear(brightest.color[2])
    pool.glow.intensity = brightness * 0.06 * step.flashLayer
  } else if (first) {
    pool.glow.x = first.x
    pool.glow.y = first.y + 0.5
    pool.glow.z = first.z
    pool.glow.color[0] = FIRE_GLOW_COLOR[0]
    pool.glow.color[1] = FIRE_GLOW_COLOR[1]
    pool.glow.color[2] = FIRE_GLOW_COLOR[2]
    pool.glow.intensity = (0.35 + first.r * 0.12) * first.fade
  } else pool.glow.intensity = 0
}
