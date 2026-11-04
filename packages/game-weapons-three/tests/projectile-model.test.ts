import { kitOriginOf } from '@adatechnology/game-contracts'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { projectileModel } from '../src'

describe('projectileModel', () => {
  it('gives the round of a rocket launcher, long along +x, and the generic rocket to the disposable tubes', () => {
    for (const weapon of ['rpg_7', 'carl_gustaf_m4', 'm72_law', 'at4']) {
      const p = projectileModel(THREE, { weapon, kind: 'rocket' })
      expect(p, weapon).not.toBeNull()
      expect(p!.axis).toEqual([1, 0, 0])
      const size = new THREE.Box3().setFromObject(p!.model).getSize(new THREE.Vector3())
      expect(size.x, weapon).toBeGreaterThan(0.2)
      expect(size.x, weapon).toBeGreaterThan(size.y * 2)
    }
  })

  it('draws the explosives of the gallery centred on their middle, standing axis +y, and has nothing for what it does not draw', () => {
    for (const [weapon, explosive, kind] of [['frag_grenade', 'm67', 'grenade'], ['molotov', 'molotov', 'molotov'], ['c4', 'c4', 'charge'], ['claymore', 'claymore', 'charge'], ['dynamite', 'dynamite', 'grenade']] as const) {
      const round = projectileModel(THREE, { weapon, explosive, kind })
      expect(round, explosive).not.toBeNull()
      expect(round!.axis).toEqual([0, 1, 0])
      const centre = new THREE.Box3().setFromObject(round!.model).getCenter(new THREE.Vector3())
      expect(centre.length(), explosive).toBeLessThan(1e-9)
      expect(kitOriginOf(round!.model)?.owner).toBe('game-weapons-three')
    }
    expect(projectileModel(THREE, { weapon: 'm79', explosive: 'm79_40mm', kind: 'grenade' })).toBeNull()
    expect(projectileModel(THREE, { weapon: 'pistol_9mm', kind: 'rocket' })).toBeNull()
  })
})
