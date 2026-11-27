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
    expect(sampleToolMotion(TOOL_MOTIONS.get('knife')!.get('stab')!, 0.43).offset[2]).toBeLessThan(-0.15)
  })
})
