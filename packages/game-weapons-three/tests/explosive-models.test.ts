import { kitOriginOf } from '@adatechnology/game-contracts'
import { createArsenal } from '@adatechnology/game-weapons'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { buildExplosiveModel, buildWeaponModel, EXPLOSIVE_MODEL_IDS, hasThrowableModel } from '../src'

const arsenal = createArsenal()

// the gallery's measures (Galeria 3D do Arsenal, explosivos): the M67 is a 64 mm sphere, the dynamite three 20 cm sticks, the C4 block 28 cm, the Claymore three 75 mm panels bowed to 225 mm
const SIZES: Record<string, { readonly axis: 'x' | 'y'; readonly metres: number }> = {
  m67: { axis: 'y', metres: 0.0921 },
  molotov: { axis: 'y', metres: 0.345 },
  dynamite: { axis: 'x', metres: 0.29 },
  c4: { axis: 'x', metres: 0.44 },
  claymore: { axis: 'x', metres: 0.225 },
}

describe('the explosives of the gallery', () => {
  it('draws every explosive the throwables of the arsenal carry, marked as the kit\'s, standing on its base with a handle in its body', () => {
    const throwables = [...arsenal.weapons.values()].filter((def) => def.action.kind === 'throwable')
    expect(throwables.length).toBeGreaterThan(0)
    for (const def of throwables) {
      expect(hasThrowableModel(def), def.id).toBe(true)
      const model = buildWeaponModel(THREE, def)
      expect(kitOriginOf(model), def.id).toEqual({ owner: 'game-weapons-three', kind: 'explosive', id: def.action.kind === 'throwable' ? def.action.explosive : '' })
      const box = new THREE.Box3().setFromObject(model)
      expect(box.min.y, def.id).toBeGreaterThanOrEqual(-0.02)
      expect(model.getObjectByName('handle'), def.id).toBeDefined()
    }
  })

  it('keeps the measures of the page', () => {
    for (const [id, { axis, metres }] of Object.entries(SIZES)) {
      const model = buildExplosiveModel(THREE, id)
      expect(model, id).toBeDefined()
      const size = new THREE.Box3().setFromObject(model!).getSize(new THREE.Vector3())
      expect(size[axis], id).toBeCloseTo(metres, 2)
    }
  })

  it('has no model for what the gallery did not draw (the kit adds the smoke canister and the Semtex block)', () => {
    expect(EXPLOSIVE_MODEL_IDS).toEqual(['m67', 'molotov', 'pipe_bomb', 'dynamite', 'c4', 'claymore', 'flashbang', 'smoke_grenade', 'semtex'])
    expect(buildExplosiveModel(THREE, 'm79_40mm')).toBeUndefined()
  })
})
