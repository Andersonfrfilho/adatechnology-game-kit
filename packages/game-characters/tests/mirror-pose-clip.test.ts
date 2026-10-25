import { describe, expect, it } from 'vitest'
import { mirrorPoseClip } from '../src'
import type { PoseClip } from '../src'

const clip: PoseClip = {
  id: 'kick',
  duration: 0.6,
  keys: [
    { t: 0, pose: { legR: 0.05, legL: -0.05, kneeR: 0.1, kneeL: 0.2, armRz: -0.1, armLz: 0.1, twist: 0.2, side: 0.04, lean: -0.1 } },
    { t: 0.3, pose: { legR: -1.4, legL: 0.1, kneeR: 0.1, kneeL: 0.3, armRz: -0.2, armLz: 0.2, twist: 0, side: 0.04, lean: -0.2 } },
  ],
  events: [{ t: 0.32, type: 'impact', data: { kind: 'kick' } }],
}

describe('mirrorPoseClip', () => {
  const mirrored = mirrorPoseClip(clip, 'kick_left')
  it('swaps the legs and keeps the times, the duration and the events', () => {
    expect(mirrored.id).toBe('kick_left')
    expect(mirrored.duration).toBe(0.6)
    expect(mirrored.keys.map((key) => key.t)).toEqual([0, 0.3])
    expect(mirrored.events).toEqual(clip.events)
    expect(mirrored.keys[1]!.pose.legL).toBe(-1.4)
    expect(mirrored.keys[1]!.pose.legR).toBe(0.1)
    expect(mirrored.keys[0]!.pose.kneeR).toBe(0.2)
  })
  it('flips the sideways channels and leaves the forward ones', () => {
    expect(mirrored.keys[0]!.pose.side).toBe(-0.04)
    expect(mirrored.keys[0]!.pose.twist).toBe(-0.2)
    expect(mirrored.keys[0]!.pose.lean).toBe(-0.1)
    expect(mirrored.keys[0]!.pose.armRz).toBe(-0.1)
    expect(mirrored.keys[0]!.pose.armLz).toBe(0.1)
  })
  it('mirroring twice gives the original back', () => {
    expect(mirrorPoseClip(mirrored, 'kick').keys).toEqual(clip.keys)
  })
})
