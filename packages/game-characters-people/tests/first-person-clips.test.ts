import { clipEventsBetween, sampleFirstPersonClip } from '@adatechnology/game-characters'
import { describe, expect, it } from 'vitest'

import { ATTACK_CLIPS, ATTACK_CLIP_LOCALES, FIRST_PERSON_CLIPS } from '../src'

const IDS = ['punch_right', 'shove_two_hands', 'front_kick']
const attack = (id: string) => ATTACK_CLIPS.find((clip) => clip.id === id)!
const firstPerson = (id: string) => FIRST_PERSON_CLIPS.find((clip) => clip.id === id)!

describe('first-person strike clips', () => {
  it('has the three strikes that the third person has', () => {
    expect(FIRST_PERSON_CLIPS.map((clip) => clip.id)).toEqual(IDS)
  })

  for (const id of IDS) {
    it(`${id}: same duration, same events and the same impact second as the third-person clip`, () => {
      expect(firstPerson(id).duration).toBe(attack(id).duration)
      expect(firstPerson(id).events).toEqual(attack(id).events)
      const impacts = (firstPerson(id).events ?? []).filter((event) => event.type === 'impact')
      expect(impacts).toHaveLength(1)
      expect(impacts[0]!.t).toBe((attack(id).events ?? []).find((event) => event.type === 'impact')!.t)
      expect(clipEventsBetween(firstPerson(id), 0, firstPerson(id).duration).filter((event) => event.type === 'impact')).toHaveLength(1)
    })

    it(`${id}: its keys sit inside the clip and the phase labels have text`, () => {
      const clip = firstPerson(id)
      expect(clip.keys[0]!.t).toBe(0)
      expect(clip.keys.at(-1)!.t).toBe(clip.duration)
      for (const key of clip.keys) expect(key.t).toBeLessThanOrEqual(clip.duration)
      for (const event of clip.events ?? []) if (event.type === 'phase') for (const locale of Object.values(ATTACK_CLIP_LOCALES)) expect(locale[event.data?.label as string]?.length).toBeGreaterThan(0)
    })
  }

  it('starts and ends handing the hands back (weight 0) and is fully in at the impact', () => {
    for (const id of IDS) {
      const clip = firstPerson(id)
      const channel = id === 'front_kick' ? 'F' : 'R'
      expect(sampleFirstPersonClip(clip, 0)[channel]!.w).toBe(0)
      expect(sampleFirstPersonClip(clip, clip.duration)[channel]!.w).toBe(0)
      const impact = clip.events!.find((event) => event.type === 'impact')!.t
      expect(sampleFirstPersonClip(clip, impact)[channel]!.w).toBe(1)
    }
  })

  it('the kick drives the foot only, so the arms keep holding what they hold; the shove drives both hands', () => {
    expect(Object.keys(sampleFirstPersonClip(firstPerson('front_kick'), 0.3))).toEqual(['F'])
    expect(Object.keys(sampleFirstPersonClip(firstPerson('shove_two_hands'), 0.3)).sort()).toEqual(['L', 'R'])
    expect(Object.keys(sampleFirstPersonClip(firstPerson('punch_right'), 0.3))).toEqual(['R'])
  })
})
