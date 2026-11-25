import { describe, expect, it } from 'vitest'

import { createStepPose } from '../src'

const STEP = 1 / 60
const SPEED = 2.16

/** A body walking at SPEED in fixed steps, drawn at a display of `fps`: the distance it draws between frames, in m/s. */
const drawnSpeeds = (fps: number, isBlended: boolean): number[] => {
  const pose = createStepPose({ x: 0, y: 0, z: 0 })
  let x = 0
  let accumulator = 0
  let last = 0
  const speeds: number[] = []
  for (let frame = 0; frame < 240; frame++) {
    accumulator += 1 / fps
    while (accumulator >= STEP) {
      accumulator -= STEP
      x += SPEED * STEP
      pose.record({ x, y: 0, z: 0 })
    }
    const drawn = isBlended ? pose.blend(accumulator / STEP).x : x
    if (frame > 30) speeds.push(Math.abs(drawn - last) * fps)
    last = drawn
  }
  return speeds
}

const spread = (values: readonly number[]): number => Math.max(...values) - Math.min(...values)

describe('a body drawn between its fixed steps', () => {
  it.each([144, 90, 75])('at %i fps the step pose stutters and the blend does not', (fps) => {
    expect(spread(drawnSpeeds(fps, false))).toBeGreaterThan(SPEED * 0.4)
    expect(spread(drawnSpeeds(fps, true))).toBeLessThan(SPEED * 0.05)
  })

  it('draws the step before the last at alpha 0 and the last step at alpha 1', () => {
    const pose = createStepPose({ x: 0, y: 0, z: 0 })
    pose.record({ x: 1, y: 0, z: 0 })
    pose.record({ x: 2, y: 1, z: 0 })
    expect(pose.blend(0)).toEqual({ x: 1, y: 0, z: 0 })
    expect(pose.blend(1)).toEqual({ x: 2, y: 1, z: 0 })
    expect(pose.blend(0.5)).toEqual({ x: 1.5, y: 0.5, z: 0 })
  })

  it('does not sweep across a teleport or a reset', () => {
    const pose = createStepPose({ x: 0, y: 0, z: 0 })
    pose.record({ x: 50, y: 0, z: 0 })
    expect(pose.blend(0).x).toBe(50)
    pose.reset({ x: -7, y: 1, z: 2 })
    expect(pose.blend(0.5)).toEqual({ x: -7, y: 1, z: 2 })
  })
})
