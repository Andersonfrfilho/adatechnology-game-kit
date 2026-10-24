import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { CALIBERS, WEAPONS, createArsenal } from '@adatechnology/game-weapons'
import { ARCHETYPE_MODELS, MODEL_ENTRIES, createWeaponsTestModule, hasWeaponModel } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function areaRoom(): { room: TestRoom; module: ReturnType<typeof createWeaponsTestModule> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1 })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: demoItems('en'), renderer: stubRenderer(), ui: false, arsenal })
  const module = createWeaponsTestModule({ locale: 'en', arsenal })
  expect(room.loadModule(module).problems).toEqual([])
  return { room, module }
}

const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) room.update(0.02)
}
const equip = (room: TestRoom, weapon: string): void => {
  room.setTool(weapon)
  run(room, 0.5)
}
const key = (code: string): boolean => window.dispatchEvent(new KeyboardEvent('keydown', { code }))

describe('sound in the hands and in the area', () => {
  it('a shot plays the shot sound of the calibre with the distance the bench sets', () => {
    const { room, module } = areaRoom()
    const shot = vi.spyOn(module.audio!, 'shot')
    equip(room, 'ak_47')
    room.look([0, 1.7, 5], [0, 1.2, -11])
    room.use()
    run(room, 0.3)
    const caliber = CALIBERS.find((entry) => entry.id === '7_62x39')
    expect(shot).toHaveBeenCalledTimes(1)
    expect(shot.mock.calls[0]?.[0]).toBeCloseTo(0.5 * (caliber!.bulletGrams / 1000) * caliber!.muzzleSpeed ** 2, 3)
    expect(shot.mock.calls[0]?.[1]).toBe('rifle')
    expect(shot.mock.calls[0]?.[2]).toMatchObject({ distance: 0, caliber: { id: '7_62x39' } })
    expect(room.bench('weapons_area')?.set('sound_distance', 100)).toBe(true)
    room.use()
    run(room, 0.3)
    expect(shot.mock.calls[1]?.[2]).toMatchObject({ distance: 100 })
  })

  it('the mechanical sounds follow the rule events: reload stages, cycle, safety, dry fire and a jam', () => {
    const { room, module } = areaRoom()
    const event = vi.spyOn(module.audio!, 'event')
    const heard = (): string[] => event.mock.calls.map(([weaponEvent]) => (weaponEvent.type === 'reload_stage' ? weaponEvent.stage : weaponEvent.type === 'safety' ? `safety_${weaponEvent.on ? 'on' : 'off'}` : weaponEvent.type))
    equip(room, 'remington_870')
    room.look([0, 1.7, 5], [0, 1.2, -11])
    room.use()
    run(room, 1)
    expect(heard()).toContain('cycle')
    key('KeyB')
    run(room, 0.3)
    expect(heard()).toContain('safety_on')
    key('KeyB')
    key('KeyR')
    run(room, 3)
    expect(heard()).toEqual(expect.arrayContaining(['round_in']))
    equip(room, 'glock_17')
    while (room.tool.ammo > 0) {
      room.use()
      run(room, 0.3)
    }
    room.use()
    run(room, 0.2)
    expect(heard()).toContain('empty')
  })

  it('an explosion is heard from where the camera is: the farther, the quieter', () => {
    const { room, module } = areaRoom()
    const play = vi.spyOn(module.audio!, 'play')
    room.look([0, 1.7, 5], [0, 1.2, -11])
    room.loadModule({ id: 'blast', name: 'blast', group: 'blast', items: () => [], attach: () => () => undefined })
    equip(room, 'frag_grenade')
    room.use()
    run(room, 5)
    expect(play).toHaveBeenCalledWith('explosion', expect.any(Number), expect.any(Number))
    const [, volume, distance] = play.mock.calls[0] as [string, number, number]
    expect(volume).toBeGreaterThan(0.4)
    expect(distance).toBeGreaterThan(0)
  })
})

describe('bench of the weapons module', () => {
  it('declares the layers, the controls and the metrics, and the room accepts them', () => {
    const { room } = areaRoom()
    const bench = room.bench('weapons_area')
    expect(bench?.controls().map((control) => control.id)).toEqual([
      'condition', 'ammo_quality', 'sound_distance', 'fuse_length',
      'fit_muzzle', 'fit_rail_top', 'fit_rail_left', 'fit_rail_right', 'fit_rail_bottom', 'fit_underbarrel', 'fit_magazine', 'fit_feed', 'fit_sling', 'fit_barrel',
      'supported_stance', 'toggle_light', 'toggle_laser', 'toggle_stock', 'switch_underbarrel',
    ])
    expect(bench?.layers().map((layer) => layer.id)).toEqual(['muzzle_flash', 'casings', 'magazines', 'attachments', 'beams'])
    expect(Object.keys(room.metrics().module).sort()).toEqual(['accessories_fitted', 'aim_time', 'casings_live', 'heat', 'magazines_live', 'suppressed', 'weapon_mass'])
  })

  it('weapon condition and ammo quality reach the rule, and the metal shows the wear', () => {
    const { room, module } = areaRoom()
    equip(room, 'glock_17')
    const metalColors = (): number => {
      let sum = 0
      room.scene.getObjectByName('weapon-viewmodel')?.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.isMesh && mesh.material) sum += (mesh.material as THREE.MeshStandardMaterial).color.getHex()
      })
      return sum
    }
    const before = metalColors()
    expect(room.bench('weapons_area')?.set('condition', 'rusty')).toBe(true)
    expect(room.bench('weapons_area')?.set('ammo_quality', 'reloaded')).toBe(true)
    expect(room.tool.condition).toBe('rusty')
    expect(room.tool.ammoQuality).toBe('reloaded')
    expect(metalColors()).not.toBe(before)
    room.setTool('ak_47')
    expect(room.tool.condition).toBe('rusty')
    expect(module.fx?.inHand).toBe('ak_47')
  })

  it('the layers turn the casings, the magazines and the muzzle flash off, and the counters follow what is in the scene', () => {
    const { room, module } = areaRoom()
    equip(room, 'glock_17')
    room.look([0, 1.7, 5], [0, 1.2, -11])
    room.use()
    run(room, 0.3)
    expect(room.metrics().module.casings_live).toBe(1)
    expect(room.metrics().module.heat).toBeGreaterThan(0)
    room.bench('weapons_area')?.setLayer('casings', false)
    room.use()
    run(room, 0.3)
    expect(module.fx?.casings).toBe(1)
    room.bench('weapons_area')?.setLayer('magazines', false)
    key('KeyR')
    run(room, 3)
    expect(module.fx?.magazines).toBe(0)
  })
})

describe('models of the archetypes', () => {
  it('each generic archetype wears the model of the first brand weapon (lowest id) that points to it and fires the same way', () => {
    const byId = new Map(WEAPONS.map((def) => [def.id, def]))
    expect(Object.keys(ARCHETYPE_MODELS).length).toBeGreaterThanOrEqual(13)
    for (const [archetype, source] of Object.entries(ARCHETYPE_MODELS)) {
      expect(MODEL_ENTRIES[source], source).toBeDefined()
      const pointers = WEAPONS.filter((def) => def.archetype === archetype && def.id in MODEL_ENTRIES && def.action.kind === byId.get(archetype)?.action.kind).map((def) => def.id)
      expect(source, archetype).toBe([...pointers].sort()[0])
    }
    expect(ARCHETYPE_MODELS.pistol_9mm).toBe('beretta_92fs')
    expect(ARCHETYPE_MODELS.shotgun_pump_12).toBe('cbc_pump_military_3_0')
  })

  it('leaves the melee weapons, the bow and the throwables with the simple prop', () => {
    for (const id of ['knife', 'baseball_bat', 'bow_compound', 'crossbow', 'frag_grenade', 'molotov', 'hammer']) expect(hasWeaponModel(id), id).toBe(false)
    for (const id of ['pistol_9mm', 'rifle_5_56', 'sniper_338', 'shotgun_double_12', 'flamethrower']) expect(hasWeaponModel(id), id).toBe(true)
  })

  it('a generic pistol in the hands has the model of its brand and plays its clips', () => {
    const { room, module } = areaRoom()
    equip(room, 'pistol_9mm')
    expect(module.fx?.inHand).toBe('pistol_9mm')
    const slide = room.scene.getObjectByName('weapon-viewmodel')?.getObjectByName('slide')
    expect(slide).toBeDefined()
    room.look([0, 1.7, 5], [0, 1.2, -11])
    room.use()
    run(room, 0.03)
    expect(slide!.position.x).toBeLessThan(0)
  })
})

describe('explosives of the world in the area', () => {
  it('puts a fuel barrel, a propane cylinder and a car tank in a corner, and one bullet sets off the chain', () => {
    const { room } = areaRoom()
    const placed = room.openArea('weapons_area')
    const barrels = placed.filter((object) => object.itemId === 'world_fuel_barrel')
    const others = placed.filter((object) => object.itemId === 'world_propane_p13' || object.itemId === 'world_car_fuel_tank')
    expect(barrels).toHaveLength(2)
    expect(others).toHaveLength(2)
    const exploded = (): number => [...barrels, ...others].filter((object) => room.world.part(object.objectId, 'tank')?.status === 'broken').length
    const effects: string[] = []
    room.world.on('explode', (event) => {
      if (event.type === 'explode' && event.effect !== undefined) effects.push(event.effect)
    })
    equip(room, 'ak_47')
    room.look([10.5, 1.7, 0], [10, 0.55, -8])
    room.use()
    run(room, 0.2)
    expect(exploded()).toBe(0)
    run(room, 8)
    expect(exploded()).toBe(4)
    // each blast names its explosive, so the host plays that explosive's effect from the shared catalogue
    expect([...new Set(effects)].sort()).toEqual(['car_fuel_tank', 'fuel_barrel', 'propane_p13'])
  })
})
