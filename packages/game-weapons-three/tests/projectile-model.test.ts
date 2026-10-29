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

  it('has nothing for what the gallery does not draw: grenades, molotovs, charges, the weapons that fire no rocket', () => {
    expect(projectileModel(THREE, { weapon: 'frag_grenade', explosive: 'm67', kind: 'grenade' })).toBeNull()
    expect(projectileModel(THREE, { weapon: 'molotov', explosive: 'molotov', kind: 'molotov' })).toBeNull()
    expect(projectileModel(THREE, { weapon: 'c4', explosive: 'c4', kind: 'charge' })).toBeNull()
    expect(projectileModel(THREE, { weapon: 'pistol_9mm', kind: 'rocket' })).toBeNull()
  })
})
