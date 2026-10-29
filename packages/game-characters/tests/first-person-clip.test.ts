import { describe, expect, it } from 'vitest'

import { clipEventsBetween, sampleFirstPersonClip } from '../src'
import type { FirstPersonClip } from '../src'

const clip: FirstPersonClip = {
  id: 't',
  duration: 1,
  keys: [
    { t: 0, R: { p: [0, 0, 0], r: [0, 0, 0], grip: 0, w: 0 }, L: 'mirror' },
    { t: 0.5, R: { p: [1, 2, 3], r: [0, 1, 0], grip: 1 }, F: { p: [0, -1, 0], r: [0, 0, 0] } },
    { t: 1, R: { p: [0, 0, 0], r: [0, 0, 0], w: 0 }, F: { p: [0, -2, 0], r: [0, 0, 0], w: 0 } },
  ],
  events: [{ t: 0.5, type: 'impact' }],
}

describe('sampleFirstPersonClip', () => {
  it('holds the first and last keys outside the clip and eases between them with the smoothstep of the pose clips', () => {
    expect(sampleFirstPersonClip(clip, -1).R).toMatchObject({ p: [0, 0, 0], w: 0 })
    expect(sampleFirstPersonClip(clip, 9).R).toMatchObject({ p: [0, 0, 0], w: 0 })
    const quarter = sampleFirstPersonClip(clip, 0.25).R!
    expect(quarter.p[0]).toBeCloseTo(0.5, 10)
    expect(quarter.w).toBeCloseTo(0.5, 10)
    expect(sampleFirstPersonClip(clip, 0.5).R).toMatchObject({ p: [1, 2, 3], r: [0, 1, 0], grip: 1, w: 1 })
  })

  it('a channel only moves between the keys that name it', () => {
    expect(sampleFirstPersonClip(clip, 0.1).F).toMatchObject({ p: [0, -1, 0] }) // before its first key it holds that key
    expect(sampleFirstPersonClip(clip, 0.75).F!.p[1]).toBeCloseTo(-1.5, 10)
    expect(sampleFirstPersonClip({ keys: [{ t: 0, R: { p: [0, 0, 0], r: [0, 0, 0] } }] }, 0.3).F).toBeUndefined()
  })

  it('the left hand asks for the mirror image of the right where the key says so, and has a grip only where a key gives one', () => {
    const left = sampleFirstPersonClip(clip, 0).L!
    expect(left.mirror).toBe(true)
    expect(sampleFirstPersonClip({ keys: [{ t: 0, R: { p: [0, 0, 0], r: [0, 0, 0] } }] }, 0).R!.grip).toBeUndefined()
    expect(sampleFirstPersonClip(clip, 0.25).R!.grip).toBeCloseTo(0.5, 10)
  })

  it('shares the event helper of the pose clips', () => {
    expect(clipEventsBetween(clip, 0.4, 0.6).map((event) => event.type)).toEqual(['impact'])
  })
})
