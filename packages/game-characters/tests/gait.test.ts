import { describe, expect, it } from 'vitest'

import {
  CASCADE,
  INSTANCE_POSES,
  LIMP,
  MOVES,
  animateProfile,
  blendMoves,
  crawlPose,
  decodePoseHeight,
  deadPose,
  encodePoseHeight,
  humanPose,
  lerpPose,
  moveBlendOf,
  stepCascade,
  strideFor,
  walkCadence,
  walkGait,
} from '../src'
import type { GaitProfile, RestPose } from '../src'
import goldenWalk from './fixtures/team-golden/game-walk-gait.json'
import goldenRig from '../../game-characters-three/tests/fixtures/team-golden/bestiary-gait.json'
import undeadTypes from '../../game-characters-undead/src/data/types.json'

const round4 = (value: number): number => Math.round(value * 1e4) / 1e4

type WalkEvent = { type: string; data: { speed: number; height: number; cadence: number; amplitude: number } }

describe('G-gait (vm): the game walkCad and walkGait', () => {
  const events = goldenWalk.events as unknown as WalkEvent[]

  it('replays the 100 recorded points exactly', () => {
    expect(events).toHaveLength(100)
    for (const { data } of events) {
      expect(round4(walkCadence(data.speed))).toBe(data.cadence)
      expect(round4(walkGait(data.speed, data.height))).toBe(data.amplitude)
    }
  })

  it('stands still below 0.05 m/s and never swings past asin(0.9) twice', () => {
    expect(walkGait(0.04)).toBe(0)
    expect(walkGait(1e6)).toBeCloseTo(2 * Math.asin(0.9), 12)
  })

  it('strideFromSpeed follows the ground; false keeps the profile numbers', () => {
    const own = { frequency: 1.1, swing: 0.28, kneeBend: 0.35 }
    expect(strideFor({ speed: 3, strideFromSpeed: false }, own)).toBe(own)
    const stride = strideFor({ speed: 3 }, own)
    expect(stride.frequency).toBe(walkCadence(3))
    expect(stride.swing).toBeCloseTo(walkGait(3) / 2, 12)
    // the foot meets the ground: the swing times the leg length over the cadence gives the speed back
    expect(2 * Math.sin(walkGait(3)) * 0.9 * 2 * walkCadence(3)).toBeGreaterThan(0)
  })
})

describe('cascade and poses', () => {
  it('each joint covers dt times its rate of the distance, never more than all of it', () => {
    expect(stepCascade(0, 1, 0.01, 'hip')).toBeCloseTo(0.16, 12)
    expect(stepCascade(0, 1, 1, 'head')).toBe(1)
    expect(CASCADE).toEqual({ hip: 16, spine: 11, shoulder: 9, elbow: 7, leg: 14, knee: 11, head: 6 })
  })

  it('lerpPose starts a joint it does not know at the target', () => {
    expect(lerpPose({ lean: 0 }, { lean: 1, headX: 0.5 }, 0.25)).toEqual({ lean: 0.25, headX: 0.5 })
  })

  it('blends a move toward the target at dt times 4', () => {
    const blend = moveBlendOf('idle')
    blendMoves(blend, 'run', 0.1)
    expect(blend.freq).toBeCloseTo(9.2 * 0.4, 12)
    blendMoves(blend, 'run', 10)
    for (const key of Object.keys(MOVES.run) as (keyof typeof blend)[]) expect(blend[key]).toBeCloseTo(MOVES.run[key], 9)
  })

  it('encodes the pose and the ground height like the shader reads them', () => {
    expect(INSTANCE_POSES).toHaveLength(8)
    const encoded = encodePoseHeight('leap', 1.25)
    expect(encoded).toBe(6 + 16 * Math.round(3.25 * 1000))
    expect(decodePoseHeight(encoded)).toEqual({ pose: 'leap', height: 1.25 })
    expect(decodePoseHeight(encodePoseHeight('walk', 99)).height).toBe(8)
  })
})

describe('human moves (Elenco)', () => {
  const arms = [{ side: 1 as const }, { side: -1 as const }] as const
  const base = { time: 1.3, phase: 0.4, cycle: 2.1, hunch: 0, armRaise: 0, stage: 0, arms, legSides: [-1, 1] as const }

  it('a standing body does not swing its legs, a walking one does', () => {
    const idle = humanPose({ ...base, moves: MOVES.idle })
    const walk = humanPose({ ...base, moves: MOVES.walk })
    expect(Math.abs(idle.legs[0]!.hip)).toBeLessThan(1e-9)
    expect(Math.abs(walk.legs[0]!.hip)).toBeGreaterThan(0.05)
    expect(walk.legs[0]!.hip).toBeCloseTo(-Math.sin(2.1) * 0.42, 12)
  })

  it('the reanimated stage raises both arms and keeps the elbows at -0.18', () => {
    const pose = humanPose({ ...base, moves: MOVES.walk, stage: 4, armRaise: 1 })
    expect(pose.arms.every((arm) => arm.elbow === -0.18)).toBe(true)
    expect(pose.arms[0]!.shoulder).toBeLessThan(-1)
  })

  it('reduced motion stops the idle sway', () => {
    const pose = humanPose({ ...base, moves: MOVES.walk, reduced: true })
    expect(pose.legs[0]!.hip).toBeCloseTo(-0.95 * 0, 12)
    expect(pose.chestScaleY).toBe(1)
  })

  it('crawl and dead poses are targets with a tilt', () => {
    expect(crawlPose(0, 0, [1, -1]).figTilt).toBe(1.38)
    expect(deadPose([1, -1]).legs.map((leg) => leg.hipZ)).toEqual([-0.15, 0.15])
    expect(LIMP).toEqual({ swing: 0.3, knee: 0.05, lean: 0.07 })
  })
})

type Posture = Partial<{ s: number; lean: number; armL: number; armR: number; elbL: number; elbR: number; legL: number; legR: number; kneeL: number; kneeR: number; headX: number; headZ: number; drop: number; noLegs: boolean }>
const BASE = { s: 1, lean: 0.15, armL: -1.15, armR: -0.85, elbL: -0.25, elbR: -0.4, legL: -0.15, legR: 0.25, kneeL: 0.15, kneeR: 0.35, headX: 0.08, headZ: 0.22, drop: -0.02 }
const PHASE = 0.7

type PoseEvent = { data: { type: string; time: number; hipY: number; upper: number[]; head: number[]; arms: number[][]; legs: number[][] } }

describe('G-gait (rig, pure part): the Bestiário animate0 as numbers', () => {
  const byId = new Map(undeadTypes.map((type) => [type.id, type]))

  for (const { data } of goldenRig.events as unknown as PoseEvent[]) {
    if (data.time % 0.5 !== 0) continue
    it(`${data.type} at t=${data.time}: joints equal the page's, to 4 decimals`, () => {
      const type = byId.get(data.type)!
      const posture = { ...BASE, ...(type.posture as Posture) }
      const lost = posture.noLegs === true
      const rest: RestPose = {
        hipY: posture.drop * posture.s,
        lean: posture.lean,
        headX: posture.headX,
        arms: [
          { shoulder: posture.armR, elbow: posture.elbR },
          { shoulder: posture.armL, elbow: posture.elbL },
        ],
        legs: [
          { hip: lost ? 1.45 : posture.legL, knee: posture.kneeL, lost },
          { hip: lost ? 1.45 : posture.legR, knee: posture.kneeR, lost },
        ],
      }
      const sample = animateProfile({ profile: type.gait as GaitProfile, rest, time: data.time, phase: PHASE })
      expect(round4(sample.hipY ?? rest.hipY)).toBe(data.hipY)
      expect([sample.upper.x ?? rest.lean, sample.upper.y ?? 0, sample.upper.z ?? 0].map(round4)).toEqual(data.upper)
      expect([sample.head.x ?? rest.headX, sample.head.y ?? 0, posture.headZ].map(round4)).toEqual(data.head)
      expect(rest.arms.map((arm, index) => [sample.arms[index]!.shoulder ?? arm.shoulder, sample.arms[index]!.elbow ?? arm.elbow].map(round4))).toEqual(data.arms)
      const legs = rest.legs.map((leg, index) => (leg.lost ? [0, 0] : [sample.legs[index]!.hip ?? leg.hip, sample.legs[index]!.knee ?? leg.knee].map(round4)))
      expect(legs).toEqual(data.legs)
    })
  }
})
