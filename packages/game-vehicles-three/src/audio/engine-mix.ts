import type { EngineProfile } from './profiles'

/** What one engine loop is set to this frame. `frequency` is absent for the load layer (noise has no pitch). */
export type EngineLayerSetting = { readonly sound: string; readonly volume: number; readonly frequency?: number; readonly cutoff: number }

export type EngineMixInput = {
  readonly rpm: number
  /** 0..1, how open the throttle is (the engine's load). */
  readonly throttle: number
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** The firing frequency of a four-stroke engine, Hz: every cylinder fires once every two turns. */
export const firingHz = (profile: EngineProfile, rpm: number): number => (rpm / 60) * (profile.cylinders / 2)

/** RPM as a share of the range: 0 at idle, 1 at the redline. */
export const rpmShare = (profile: EngineProfile, rpm: number): number => clamp01((rpm - profile.idleRpm) / (profile.redlineRpm - profile.idleRpm))

/** Equal-power weight of a layer centred at `centre` with `width` at the normalised RPM `n`. */
export const layerWeight = (centre: number, width: number, n: number): number => {
  const d = Math.abs(n - centre) / width
  return d >= 1 ? 0 : Math.cos((d * Math.PI) / 2)
}

/**
 * The engine's loops for an RPM and a throttle: every tone layer at the firing frequency times its harmonic, faded in and out across the RPM range so
 * the sum stays even, louder and brighter under load; the load layer opens with the throttle. A stopped engine (`rpm` 0) is silent.
 */
export function engineMix(profile: EngineProfile, input: EngineMixInput): EngineLayerSetting[] {
  const throttle = clamp01(input.throttle)
  const on = input.rpm > 0
  const n = rpmShare(profile, input.rpm)
  const level = on ? profile.closedThrottle + (1 - profile.closedThrottle) * throttle : 0
  const open = 0.5 * n + 0.5 * throttle
  const hz = firingHz(profile, input.rpm)
  const tones = profile.layers.map((layer) => ({
    sound: layer.sound,
    volume: layer.gain * level * layerWeight(layer.centre, layer.width, n),
    frequency: hz * layer.harmonic,
    cutoff: layer.cutoff[0] + (layer.cutoff[1] - layer.cutoff[0]) * open,
  }))
  const load = profile.load
  return [
    ...tones,
    { sound: load.sound, volume: on ? load.gain * (0.15 + 0.85 * throttle) * (0.35 + 0.65 * n) : 0, cutoff: load.cutoff[0] + (load.cutoff[1] - load.cutoff[0]) * open },
  ]
}

/**
 * A guess of the RPM from the speed for a driver without an engine model: the gear is kept between calls (up above 85% of the redline, down below
 * 40%), so the RPM climbs and drops at each shift as it does in a real car.
 */
export function createGearGuess(profile: EngineProfile): { rpm(speed: number, throttle: number): number; readonly gear: number } {
  let gear = 0
  return {
    rpm(speed, throttle) {
      const v = Math.abs(speed)
      const ratios = profile.rpmPerMps
      if (v < 0.3) {
        gear = 0
        return profile.idleRpm + (profile.redlineRpm - profile.idleRpm) * 0.12 * clamp01(throttle)
      }
      const at = (g: number): number => v * (ratios[g] as number)
      while (gear < ratios.length - 1 && at(gear) > profile.redlineRpm * 0.85) gear++
      while (gear > 0 && at(gear) < profile.redlineRpm * 0.4) gear--
      return Math.max(profile.idleRpm, Math.min(profile.redlineRpm, at(gear)))
    },
    get gear() {
      return gear
    },
  }
}
