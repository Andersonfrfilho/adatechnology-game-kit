import { emptySample } from './profile'
import type { GaitProfile, GaitSample, RestPose } from './profile'
import { strideFor } from './stride'
import type { StrideParams } from './stride'

const TWO_PI = Math.PI * 2
const LEAP_AIR_SHARE = 0.38
const LEAP_PHASE_DIVISOR = 6.3
const DEFAULT_PROFILE: GaitProfile = { f: 1.1, a: 0.28, k: 0.35, drag: true, arm: 0.08 }

export type AnimateProfileParams = {
  readonly profile?: GaitProfile
  readonly rest: RestPose
  /** Seconds. */
  readonly time: number
  /** Per-body phase offset, radians (the page's `rig.ph`). */
  readonly phase: number
  /** With `strideFromSpeed`, the speed and height that set cadence and swing. Without it the profile's own numbers are used. */
  readonly stride?: StrideParams
}

/** The leap, as a cycle: crouched, then airborne for 38% of it. */
const leap = ({ rest, time, phase, profile }: Required<Pick<AnimateProfileParams, 'rest' | 'time' | 'phase'>> & { profile: GaitProfile }): GaitSample => {
  const sample = emptySample()
  const cycle = (time * profile.f + phase / LEAP_PHASE_DIVISOR) % 1
  const air = cycle < LEAP_AIR_SHARE ? Math.sin((cycle / LEAP_AIR_SHARE) * Math.PI) : 0
  sample.hipY = rest.hipY + air * 0.95
  sample.upper.x = rest.lean - air * 0.45
  rest.legs.forEach((leg, index) => (sample.legs[index] = { hip: leg.hip * (1 - air * 0.7), knee: leg.knee * (1 - air * 0.75) }))
  rest.arms.forEach((arm, index) => (sample.arms[index] = { shoulder: arm.shoulder - air * 2.3, elbow: arm.elbow * (1 - air) }))
  return sample
}

/** Joint targets of one gait at `time` (the Bestiário's `animate0`), as numbers; the rig applies the ones that are set. */
export const animateProfile = ({ profile = DEFAULT_PROFILE, rest, time, phase, stride }: AnimateProfileParams): GaitSample => {
  const own = { frequency: profile.f, swing: profile.a ?? 0, kneeBend: profile.k ?? 0 }
  const { frequency, swing, kneeBend } = stride ? strideFor(stride, own) : own
  const angle = time * frequency * TWO_PI + phase
  const sine = Math.sin(angle)
  const cosine = Math.cos(angle)
  const sample = emptySample()
  if (profile.leap) return leap({ rest, time, phase, profile })
  if (profile.listen) {
    sample.head.y = Math.sin(time * 0.7 + phase) * 0.6
    rest.arms.forEach((arm, index) => (sample.arms[index] = { shoulder: arm.shoulder + Math.sin(time * 0.9 + index) * 0.08 }))
    return sample
  }
  if (profile.eat) {
    const wave = Math.sin(time * profile.f * TWO_PI + phase)
    sample.head.x = rest.headX + Math.max(0, wave) * 0.35
    sample.upper.x = rest.lean + Math.max(0, wave) * 0.08
    rest.arms.forEach((arm, index) => (sample.arms[index] = { elbow: arm.elbow + wave * 0.2 }))
    return sample
  }
  if (profile.crawl) {
    rest.arms.forEach((arm, index) => {
      const wave = index ? sine : -sine
      sample.arms[index] = { shoulder: arm.shoulder + wave * 0.35, elbow: arm.elbow - Math.max(0, wave) * 0.6 }
    })
    sample.upper.z = sine * 0.06
    return sample
  }
  if (profile.idle) {
    const scare = Math.max(0, Math.sin(time * 0.9 + phase))
    sample.upper.x = rest.lean - scare * 0.18
    sample.head.x = rest.headX - scare * 0.25
    rest.arms.forEach((arm, index) => (sample.arms[index] = { shoulder: arm.shoulder + scare * 0.25 }))
    return sample
  }
  rest.legs.forEach((leg, index) => {
    if (leg.lost) return
    const wave = index ? -sine : sine
    if (profile.drag && index === 1) return void (sample.legs[index] = { hip: leg.hip + wave * swing * 0.35, knee: leg.knee })
    sample.legs[index] = { hip: leg.hip + wave * swing, knee: leg.knee + Math.max(0, index ? cosine : -cosine) * kneeBend }
  })
  rest.arms.forEach((arm, index) => (sample.arms[index] = { shoulder: arm.shoulder + (index ? sine : -sine) * (profile.arm || 0.1) }))
  sample.hipY = rest.hipY - Math.abs(cosine) * (profile.bob || 0.02)
  sample.upper.y = sine * 0.06
  sample.upper.z = (profile.sway || 0) * sine + (profile.drag ? 0.04 : 0)
  if (profile.stalk) sample.upper.x = rest.lean + sine * 0.04
  if (profile.sniff) sample.head.y = Math.sin(time * 3.1 + phase) * 0.35
  return sample
}
