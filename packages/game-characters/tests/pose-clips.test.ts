import { describe, expect, it } from 'vitest'

import { POSE_CLIPS, POSE_CLIP_LOCALES, clipEventsBetween, createPoseClipRegistry, filterPoseChannels, samplePoseClip } from '../src'
import type { PoseClip } from '../src'

const human = POSE_CLIPS.find((clip) => clip.id === 'grabbed_bitten_human') as PoseClip
const zombie = POSE_CLIPS.find((clip) => clip.id === 'grab_bite_zombie') as PoseClip

describe('pose clips (Bestiário grab and bite)', () => {
  it('ports the two scenes with 7 keys each', () => {
    expect(human.keys).toHaveLength(7)
    expect(zombie.keys).toHaveLength(7)
    expect(zombie.keys[0]!.pose).toMatchObject({ x: -6, run: 1 })
    expect(human.source).toMatchObject({ variable: 'HK' })
  })

  it('equals the key pose at each key time', () => {
    for (const clip of [human, zombie]) {
      clip.keys.forEach((key, index) => {
        const sampled = samplePoseClip(clip, key.t)
        // at the key time the segment starting there gives its start; a joint the next key does not name is absent, as in the page
        for (const [name, value] of Object.entries(key.pose)) {
          if (index < clip.keys.length - 1) {
            if (name in clip.keys[index + 1]!.pose) expect(sampled[name]).toBeCloseTo(value, 10)
          } else expect(sampled[name]).toBeCloseTo(value, 10)
        }
      })
    }
  })

  it('eases midpoints with smoothstep (0.5 stays 0.5) and quarter points do not stay linear', () => {
    const clip: PoseClip = { id: 't', duration: 2, keys: [{ t: 0, pose: { lean: 0 } }, { t: 2, pose: { lean: 1 } }] }
    expect(samplePoseClip(clip, 1).lean).toBeCloseTo(0.5, 10)
    expect(samplePoseClip(clip, 0.5).lean).toBeCloseTo(0.25 * 0.25 * (3 - 0.5), 10)
    expect(samplePoseClip(clip, -3).lean).toBe(0)
    expect(samplePoseClip(clip, 9).lean).toBe(1)
  })

  it('a joint the start key does not name starts at the target', () => {
    const clip: PoseClip = { id: 't', duration: 1, keys: [{ t: 0, pose: {} }, { t: 1, pose: { headZ: 0.8 } }] }
    expect(samplePoseClip(clip, 0.25).headZ).toBe(0.8)
  })

  it('returns the events crossed in (t0, t1]', () => {
    expect(clipEventsBetween(human, 4.3, 5.6).map((event) => event.type + '@' + event.t)).toEqual(['impact@4.4', 'phase@5.6'])
    expect(clipEventsBetween(human, 0, 0).length).toBe(0)
    expect(clipEventsBetween(human, -1, 0).map((event) => event.t)).toEqual([0])
  })

  it('phase labels are locale keys with pt-BR and en text', () => {
    const labels = human.events!.filter((event) => event.type === 'phase').map((event) => event.data!.label as string)
    expect(labels).toHaveLength(5)
    for (const label of labels) {
      expect(POSE_CLIP_LOCALES['pt-BR']![label]).toBeTruthy()
      expect(POSE_CLIP_LOCALES.en![label]).toBeTruthy()
    }
    expect(POSE_CLIP_LOCALES['pt-BR']![labels[0]!]).toBe('1. Aproximação')
  })

  it('upper channels drop the legs and the hips', () => {
    const upper = filterPoseChannels({ lean: 1, legL: 2, drop: 3, armR: 4, x: 5 }, 'upper')
    expect(upper).toEqual({ lean: 1, armR: 4 })
    expect(filterPoseChannels({ legL: 2, x: 5 }, 'full')).toEqual({ legL: 2, x: 5 })
  })

  it('the registry adds, replaces and removes clips', () => {
    const registry = createPoseClipRegistry(POSE_CLIPS)
    expect(registry.list().map((clip) => clip.id)).toEqual(['grabbed_bitten_human', 'grab_bite_zombie'])
    const mine: PoseClip = { id: 'grabbed_bitten_human', duration: 1, keys: [{ t: 0, pose: {} }, { t: 1, pose: {} }] }
    registry.register(mine)
    expect(registry.get('grabbed_bitten_human')).toBe(mine)
    expect(registry.list()).toHaveLength(2)
    expect(registry.remove('grab_bite_zombie')).toBe(true)
    expect(registry.get('grab_bite_zombie')).toBeUndefined()
  })
})
