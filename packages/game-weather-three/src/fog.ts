import type * as THREE_NS from 'three'
import type { WeatherSample } from '@adatechnology/game-weather'
import type { WorkshopEngine } from '@adatechnology/game-vfx'
import { ZONE_FOG_DEFAULTS } from './sky'
import type { ThreeLib, Vec3, ZoneFog } from './types'

/** The page's linear fog starts at 25 m and, in the zone, at 4 m (`scene.fog.near = lerp(25, 4, weight)`). */
export const FOG_NEAR = 25
export const FOG_ZONE_NEAR = 4
/** Below this exponential-squared density the weather uses the linear fog (the clear weathers have 0). */
export const FOG_EXP_FROM = 0.0005
/** exp2 density that sees as far as a linear fog of `far` metres (2 % left): used to blend the zone fog in the exponential case. */
export const densityForFar = (far: number): number => Math.sqrt(Math.log(50)) / far

export type FogValues = { readonly mode: 'linear'; readonly near: number; readonly far: number } | { readonly mode: 'exp2'; readonly density: number }

/** The fog the weather and the zone ask for. Pure. */
export function fogOf(sample: WeatherSample, zone?: ZoneFog, expFrom: number = FOG_EXP_FROM): FogValues {
  const weight = zone?.weight ?? 0
  const zoneFar = zone?.far ?? ZONE_FOG_DEFAULTS.far
  if (sample.fogDensity >= expFrom) return { mode: 'exp2', density: sample.fogDensity + (densityForFar(zoneFar) - sample.fogDensity) * weight }
  return { mode: 'linear', near: FOG_NEAR + (FOG_ZONE_NEAR - FOG_NEAR) * weight, far: sample.fogFar + (zoneFar - sample.fogFar) * weight }
}

export type Fog = {
  /** Puts the weather's fog on the scene (the page's `fog.far` and `fog.near`, or the exponential-squared one) with the sky's colour. */
  update(sample: WeatherSample, sky: THREE_NS.Color, zone?: ZoneFog): void
  /** Takes the fog off the scene (a layer switched off). */
  clear(): void
}

export function createFog(THREE: ThreeLib, scene: { fog: unknown }, options: { readonly expFrom?: number } = {}): Fog {
  // the fog the host had before: it comes back when the layer is switched off (the first update changes it in place, so a copy is kept)
  const original = scene.fog
  const kept = original && (original as { isFog?: boolean }).isFog ? (original as THREE_NS.Fog).clone() : original
  return {
    update(sample, sky, zone) {
      const values = fogOf(sample, zone, options.expFrom)
      const current = scene.fog as (THREE_NS.Fog & THREE_NS.FogExp2 & { isFog?: boolean; isFogExp2?: boolean }) | null | undefined
      if (values.mode === 'linear') {
        if (current?.isFog) {
          current.color.copy(sky)
          current.near = values.near
          current.far = values.far
        } else scene.fog = new THREE.Fog(sky.getHex(), values.near, values.far)
      } else if (current?.isFogExp2) {
        current.color.copy(sky)
        current.density = values.density
      } else scene.fog = new THREE.FogExp2(sky.getHex(), values.density)
      const fog = scene.fog as { color: THREE_NS.Color }
      fog.color.copy(sky)
    },
    clear() {
      scene.fog = kept && (kept as { isFog?: boolean }).isFog ? (kept as THREE_NS.Fog).clone() : (kept ?? null)
    },
  }
}

/** The Workshop's mist (W1073: low, slow, 3 to 5 m wide) and ash (fine, falling in a spiral), in a box that follows the camera. */
export const MIST = { box: { x: [-14, 10], y: [0.2, 1.1], z: [-3, 8] }, drift: [0.15, 0.35], life: [9, 13], size: [3, 5], grow: 1.4, color: 0x7d8aa0, alpha: 0.13, fadeIn: 0.35 } as const
export const ASH = { box: { x: [-10, 8], y: [4, 6], z: [-3, 7] }, fall: -0.35, life: [8, 12], size: [0.025, 0.04], color: 0xa09a90, alpha: 0.75, fadeIn: 0.1 } as const

/**
 * Feeds the `normal` sprite pool of the Workshop with `mistPerSecond` puffs of mist and `ashPerSecond` flakes of ash a second (the page's `emit('fog', ...)`
 * and `emit('ash', ...)`, at the weather's rate instead of 5 and 14), around `camera`. The renderer of game-vfx-three draws them.
 */
export function emitAirborne(engine: WorkshopEngine, sample: WeatherSample, dt: number, camera: Vec3): void {
  const { random } = engine
  const around = (box: { readonly x: readonly number[]; readonly y: readonly number[]; readonly z: readonly number[] }): [number, number, number] => [
    camera[0] + random.between(box.x[0]!, box.x[1]!),
    random.between(box.y[0]!, box.y[1]!),
    camera[2] + random.between(box.z[0]!, box.z[1]!),
  ]
  if (sample.mistPerSecond > 0) {
    engine.emit('weather-mist', 'normal', sample.mistPerSecond, dt, () => ({
      p: around(MIST.box),
      v: [random.between(MIST.drift[0], MIST.drift[1]), 0, random.between(-0.05, 0.05)],
      sp: 0,
      life: MIST.life,
      size: MIST.size,
      grow: MIST.grow,
      c0: MIST.color,
      a: MIST.alpha,
      fi: MIST.fadeIn,
    }))
  }
  if (sample.ashPerSecond > 0) {
    engine.emit('weather-ash', 'normal', sample.ashPerSecond, dt, () => ({
      p: around(ASH.box),
      v: [random.between(0.1, 0.4), ASH.fall, random.between(-0.1, 0.1)],
      sp: [0.05, 0.15],
      life: ASH.life,
      size: ASH.size,
      c0: ASH.color,
      a: ASH.alpha,
      fi: ASH.fadeIn,
      gnd: 1,
    }))
  }
}
