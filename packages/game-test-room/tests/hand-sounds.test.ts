import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LEAF_FOLEY_SETS, kitSampleBank } from '@adatechnology/game-audio'
import type { SfxManifest } from '@adatechnology/game-audio'
import { createDestruction } from '@adatechnology/game-destruction'
import { HAND_RECORDED_IDS, leafFoleyOf, openSoundOf, pickupClassOf, pickupSoundOf, useSoundOf } from '../src/hand-sounds'

const materials = createDestruction().materials

describe('hand sounds', () => {
  it('picks the pickup class from the material', () => {
    expect(pickupClassOf(materials.get('aluminium'))).toBe('metal')
    expect(pickupClassOf(materials.get('glass'))).toBe('glass')
    expect(pickupClassOf(materials.get('paper'))).toBe('paper')
    expect(pickupClassOf(materials.get('plastic'))).toBe('plastic')
    expect(pickupClassOf(materials.get('fabric'))).toBe('fabric')
    expect(pickupSoundOf({ handling: 'food' }, materials.get('aluminium'))).toBe('item_pickup_food')
  })
  it('uses the leaf set the item names, else the material, else a drawer for a slide', () => {
    expect(leafFoleyOf({ leaves: { '*': 'fridge', freezer: 'drawer' } }, 'door', 'impact_metal', false)).toBe(LEAF_FOLEY_SETS.fridge)
    expect(leafFoleyOf({ leaves: { '*': 'fridge', freezer: 'drawer' } }, 'freezer', 'impact_metal', false)).toBe(LEAF_FOLEY_SETS.drawer)
    expect(leafFoleyOf(undefined, 'door', 'impact_metal', false)).toBe(LEAF_FOLEY_SETS.metal_door)
    expect(leafFoleyOf(undefined, 'door', 'impact_wood', false)).toBe(LEAF_FOLEY_SETS.wood_door)
    expect(leafFoleyOf(undefined, 'drawer_1', 'impact_wood', true)).toBe(LEAF_FOLEY_SETS.drawer)
    expect(leafFoleyOf({ leaves: { '*': 'no_such_set' } }, 'door', 'impact_wood', false)).toBe(LEAF_FOLEY_SETS.wood_door)
  })
  it('opens a can with its tab and a bottle with its cap, and repeats gulps and chews', () => {
    expect(openSoundOf(undefined, materials.get('aluminium'))).toBe('can_open')
    expect(openSoundOf(undefined, materials.get('plastic'))).toBe('bottle_open')
    expect(useSoundOf(undefined, 'drink')).toBe('drink_gulp')
    expect(useSoundOf(undefined, 'eat')).toBe('eat_chew')
    expect(useSoundOf({ uses: { drink: 'can_drink' } }, 'drink')).toBe('can_drink')
    expect(useSoundOf(undefined, 'pour')).toBeUndefined()
  })
  it('every hand sound the room preloads has recorded takes in the manifest (a file of its id or an alias to one)', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '../../game-audio/assets/sfx/manifest.json'), 'utf8')) as SfxManifest
    const recorded = new Set((kitSampleBank(manifest).samples ?? []).map((sound) => sound.id))
    for (const id of HAND_RECORDED_IDS) expect(recorded.has(id), id).toBe(true)
  })
})
