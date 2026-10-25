import { clipEventsBetween, samplePoseClip } from '@adatechnology/game-characters'
import type { PoseClip } from '@adatechnology/game-characters'
import { PLAYER_DEFAULTS } from '@adatechnology/game-player'
import { describe, expect, it } from 'vitest'

import { ATTACK_CLIPS, ATTACK_CLIP_LOCALES } from '../src'

/** The relaxed upper body the melee clips start and end at (the first key of the Bestiário human clip). */
const NEUTRAL_UPPER: Record<string, number> = { lean: 0, twist: 0, side: 0, headX: 0, headY: 0, headZ: 0, armR: 0.05, armL: -0.1, elbR: -0.2, elbL: -0.2, armRz: 0, armLz: 0 }
const NEUTRAL_FULL: Record<string, number> = { ...NEUTRAL_UPPER, drop: 0, legL: -0.05, legR: 0.05, kneeL: 0.05, kneeR: 0.05 }
const TOLERANCE = 0.12
const STEPS = 200

type Expectation = { duration: number; channels: 'upper' | 'full'; impactAt: [number, number]; neutral: Record<string, number>; phases: string[] }

const EXPECTED: Record<string, Expectation> = {
  punch_right: { duration: 0.35, channels: 'upper', impactAt: [0.1, 0.25], neutral: NEUTRAL_UPPER, phases: ['windup', 'strike', 'recover'] },
  shove_two_hands: { duration: 0.5, channels: 'upper', impactAt: [0.15, 0.35], neutral: NEUTRAL_UPPER, phases: ['windup', 'strike', 'recover'] },
  front_kick: { duration: 0.6, channels: 'full', impactAt: [0.2, 0.4], neutral: NEUTRAL_FULL, phases: ['windup', 'strike', 'recover'] },
}

const byId = (id: string): PoseClip => ATTACK_CLIPS.find((clip) => clip.id === id)!

describe('attack clips', () => {
  it('holds the clips of the brief, by snake_case id', () => {
    expect(ATTACK_CLIPS.map((clip) => clip.id)).toEqual(Object.keys(EXPECTED))
    for (const clip of ATTACK_CLIPS) expect(clip.id).toMatch(/^[a-z]+(_[a-z]+)*$/)
  })

  for (const [id, expected] of Object.entries(EXPECTED)) {
    describe(id, () => {
      const clip = byId(id)

      it('has the reference duration, channels and no loop', () => {
        expect(clip.duration).toBe(expected.duration)
        expect(clip.channels).toBe(expected.channels)
        expect(clip.loop).toBe(false)
        expect(clip.keys[0]!.t).toBe(0)
        expect(clip.keys.at(-1)!.t).toBe(clip.duration)
      })

      it('samples every joint without NaN, in time order', () => {
        const times = clip.keys.map((key) => key.t)
        expect([...times].sort((a, b) => a - b)).toEqual(times)
        for (let step = 0; step <= STEPS; step++) {
          const pose = samplePoseClip(clip, (clip.duration * step) / STEPS)
          for (const [joint, value] of Object.entries(pose)) {
            expect(Number.isFinite(value), `${joint} at step ${step}`).toBe(true)
            expect(Math.abs(value)).toBeLessThan(Math.PI)
          }
        }
      })

      it('starts and ends near the neutral pose', () => {
        for (const time of [0, clip.duration]) {
          const pose = samplePoseClip(clip, time)
          for (const [joint, value] of Object.entries(expected.neutral)) expect(Math.abs((pose[joint] ?? value) - value), `${joint} at ${time}`).toBeLessThanOrEqual(TOLERANCE)
        }
      })

      it('has exactly one impact, inside the strike window, and the phases in order', () => {
        const events = clip.events ?? []
        const impacts = events.filter((event) => event.type === 'impact')
        expect(impacts).toHaveLength(1)
        const impactTime = impacts[0]!.t
        expect(impactTime).toBeGreaterThanOrEqual(expected.impactAt[0])
        expect(impactTime).toBeLessThanOrEqual(expected.impactAt[1])
        expect(clipEventsBetween(clip, 0, clip.duration).filter((event) => event.type === 'impact')).toHaveLength(1)
        const phases = events.filter((event) => event.type === 'phase')
        expect(phases.map((event) => (event.data?.label as string).replace('attack_clip.phase.', ''))).toEqual(expected.phases)
        expect(phases.map((event) => event.t)).toEqual([...phases.map((event) => event.t)].sort((a, b) => a - b))
        for (const locale of Object.values(ATTACK_CLIP_LOCALES)) for (const event of phases) expect(locale[event.data?.label as string]?.length).toBeGreaterThan(0)
      })
    })
  }
})

describe('attack clips against the game-player rules', () => {
  // game-player applies the shove (stun, push) and the melee blow on the key press and has no wind-up of its own: the host fires the effect from the clip's `impact`
  it('keeps the shoved target stunned until the player has recovered (shove)', () => {
    const clip = byId('shove_two_hands')
    const impact = clip.events!.find((event) => event.type === 'impact')!
    expect(clip.duration - impact.t).toBeLessThanOrEqual(PLAYER_DEFAULTS.numbers.shoveStun)
  })
})
