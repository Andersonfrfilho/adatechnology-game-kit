import { describe, expect, it } from 'vitest'
import { MELEE_FAMILIES } from '@adatechnology/game-weapons'

import { FAMILY_MOTIONS, TOOL_MOTIONS, sampleToolMotion } from '../src/fx/tool-motion'

describe('tool motions of the melee families', () => {
  it('gives every blow of every family a motion, on each of its weapons', () => {
    for (const family of MELEE_FAMILIES) {
      for (const blow of family.blows) {
        expect(FAMILY_MOTIONS.get(family.id)?.get(blow.motion), `${family.id}.${blow.motion}`).toBeDefined()
        for (const weapon of family.weapons) expect(TOOL_MOTIONS.get(weapon)?.get(blow.motion), `${weapon}.${blow.motion}`).toBeDefined()
      }
    }
  })

  it('starts and ends the knife blows at the hold, and the thrust reaches out along the aim', () => {
    for (const name of ['slash', 'stab']) {
      const motion = TOOL_MOTIONS.get('knife')!.get(name)!
      expect(sampleToolMotion(motion, 0).offset).toEqual([0, 0, 0])
      expect(sampleToolMotion(motion, 1).offset).toEqual([0, 0, 0])
    }
    expect(sampleToolMotion(TOOL_MOTIONS.get('knife')!.get('stab')!, 0.43).offset[2]).toBeLessThan(-0.1)
  })

  it('swings a bat as a batter: turned about the hands, drawn back over the right shoulder, level through the chest, round over the left', () => {
    const bat = TOOL_MOTIONS.get('baseball_bat')!.get('bat_swing')!
    expect(bat.pivot).toBe('grip')
    for (const club of ['iron_pipe', 'crowbar', 'sledgehammer']) expect(TOOL_MOTIONS.get(club)?.get('bat_swing')).toBe(bat)
    const windup = sampleToolMotion(bat, 0.29)
    const impact = sampleToolMotion(bat, 0.43)
    const follow = sampleToolMotion(bat, 0.64)
    // the hands right and up at the windup, left of it at the impact and farther left after; the point raised back past upright, then level, then up again
    expect(windup.offset[0]).toBeGreaterThan(0.08)
    expect(impact.offset[0]).toBeLessThan(windup.offset[0])
    expect(follow.offset[0]).toBeLessThan(impact.offset[0])
    expect(windup.turn[0]).toBeGreaterThan(1.5)
    expect(Math.abs(impact.turn[0] + 0.3)).toBeLessThan(0.05)
    expect(impact.turn[1]).toBeGreaterThan(1)
    expect(follow.turn[0]).toBeGreaterThan(1.5)
  })

  it('turns the knife about the grip, the blade crossing the view in the cut and leaning in for the thrust', () => {
    const knife = TOOL_MOTIONS.get('knife')!
    expect(knife.get('slash')!.pivot).toBe('grip')
    expect(sampleToolMotion(knife.get('slash')!, 0.43).turn[1]).toBeGreaterThan(0.8)
    expect(sampleToolMotion(knife.get('stab')!, 0.43).turn[1]).toBeGreaterThan(0.4)
  })
})
