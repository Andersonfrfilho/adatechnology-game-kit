import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createTestRoom, demoItems } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import type { ModuleHost } from '@adatechnology/game-contracts'
import { createWeaponsTestModule } from '../src'
import { createAccessoryBench } from '../src/accessory-bench'
import { ACCESSORY_TEXT } from '../src/accessory-text'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

const rooms: TestRoom[] = []
// every room listens on the window: a room left alive would answer the keys and the mouse of the next test
afterEach(() => {
  for (const room of rooms.splice(0)) room.dispose()
})

function areaRoom(locale = 'en'): { room: TestRoom; module: ReturnType<typeof createWeaponsTestModule> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, rules: { faults: false } })
  const room = createTestRoom({ THREE, container, locale, catalog: demoItems(locale), renderer: stubRenderer(), ui: false, arsenal })
  const module = createWeaponsTestModule({ locale, arsenal })
  rooms.push(room)
  expect(room.loadModule(module).problems).toEqual([])
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, module }
}
const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) room.update(0.02)
}
const equip = (room: TestRoom, weapon: string): void => {
  room.setTool(weapon)
  run(room, 0.5)
}
const key = (code: string): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { code, cancelable: true })
  window.dispatchEvent(event)
  return event
}
const hands = (room: TestRoom): THREE.Object3D => room.scene.getObjectByName('weapon-viewmodel')!
const bench = (room: TestRoom) => room.bench('weapons_area')!
const optionsOf = (room: TestRoom, id: string): string[] => {
  const control = bench(room).controls().find((entry) => entry.id === id)
  return control && control.kind === 'choice' ? control.options.map((option) => option.id) : []
}

describe('accessory bench: fit and remove per mount', () => {
  it('offers, for each mount of the weapon in hand, only what is compatible with it', () => {
    const { room } = areaRoom()
    equip(room, 'colt_m4a1')
    expect(optionsOf(room, 'fit_muzzle')).toEqual(expect.arrayContaining(['none', 'suppressor', 'oil_filter_suppressor', 'compensator']))
    expect(optionsOf(room, 'fit_underbarrel')).toEqual(expect.arrayContaining(['none', 'm203']))
    expect(optionsOf(room, 'fit_underbarrel')).not.toContain('gp_25')
    equip(room, 'ak_47')
    expect(optionsOf(room, 'fit_underbarrel')).toEqual(expect.arrayContaining(['none', 'gp_25']))
    expect(optionsOf(room, 'fit_underbarrel')).not.toContain('m203')
    equip(room, 'glock_17')
    const hidden = bench(room).controls().filter((control) => control.id.startsWith('fit_') && control.hidden).map((control) => control.id)
    expect(hidden).toEqual(expect.arrayContaining(['fit_muzzle', 'fit_underbarrel', 'fit_sling']))
  })

  it('UGL is offered only where the weapon has its mount', () => {
    const { room } = areaRoom()
    for (const weapon of ['colt_m4a1', 'glock_17', 'hk_mp5a3', 'browning_m2']) {
      equip(room, weapon)
      const offered = optionsOf(room, 'fit_underbarrel').some((id) => ['m203', 'gp_25', 'ag36'].includes(id))
      expect(offered, weapon).toBe(['colt_m4a1'].includes(weapon))
    }
  })

  it('fits a suppressor on an M4 through the bench, draws it, and the shot sound is the suppressed one', () => {
    const { room, module } = areaRoom()
    const shot = vi.spyOn(module.audio!, 'shot')
    equip(room, 'colt_m4a1')
    expect(bench(room).set('fit_muzzle', 'suppressor')).toBe(true)
    run(room, 16)
    expect(room.tool.attachments.some((part) => part.id === 'suppressor')).toBe(true)
    expect(room.tool.suppressed).toBe(true)
    expect(optionsOf(room, 'fit_muzzle')).toContain('suppressor')
    expect((bench(room).controls().find((control) => control.id === 'fit_muzzle') as { value?: string }).value).toBe('suppressor')
    expect(room.metrics().module.suppressed).toBe('yes')
    expect(hands(room).getObjectByProperty('isSpotLight', true)).toBeUndefined()
    room.use()
    run(room, 0.3)
    expect(shot).toHaveBeenCalledWith(expect.any(Number), 'rifle', expect.objectContaining({ suppressed: true }))
    expect(bench(room).set('fit_muzzle', 'none')).toBe(true)
    run(room, 16)
    expect(room.tool.suppressed).toBe(false)
  })

  it('fits an M203, switches to it with U, fires a grenade and reloads it through the breech stages', () => {
    const { room, module } = areaRoom()
    const play = vi.spyOn(module.audio!, 'play')
    equip(room, 'colt_m4a1')
    bench(room).set('fit_underbarrel', 'm203')
    run(room, 35)
    expect(room.tool.attachments.some((part) => part.id === 'm203')).toBe(true)
    const tube = hands(room).getObjectByName('ugl')!
    expect(tube.children.length).toBeGreaterThan(2)
    expect(key('KeyU').defaultPrevented).toBe(true)
    run(room, 1.2)
    expect(room.tool.underbarrelActive).toBe(true)
    room.use()
    run(room, 0.3)
    expect(play).toHaveBeenCalledWith('explosion', expect.any(Number), expect.any(Number))
    const ammo = room.tool.underbarrel?.ammo ?? -1
    expect(ammo).toBe(0)
    key('KeyR')
    let slid = 0
    for (let elapsed = 0; elapsed < 3; elapsed += 0.02) {
      room.update(0.02)
      slid = Math.max(slid, tube.position.x - tube.userData.restX)
    }
    expect(room.tool.underbarrel?.ammo).toBe(1)
    expect(room.tool.reloading).toBe(false)
  })

  it('collapses a stock with V and the stock pivot ends where the rule says; V is the kick on a weapon with no stock that moves', () => {
    const { room } = areaRoom()
    equip(room, 'hk_mp5a3')
    const pivot = hands(room).getObjectByName('stock')!
    expect(pivot).toBeDefined()
    expect(key('KeyV').defaultPrevented).toBe(true)
    run(room, 1)
    expect(room.tool.stock).toBe('collapsed')
    expect(pivot.position.x).toBeGreaterThan(0.1)
    key('KeyV')
    run(room, 1)
    expect(room.tool.stock).toBe('extended')
    expect(pivot.position.x).toBeCloseTo(0, 5)
    equip(room, 'glock_17')
    expect(key('KeyV').defaultPrevented).toBe(false)
  })

  it('a collapsed stock stays collapsed when the weapon is put away and taken again', () => {
    const { room } = areaRoom()
    equip(room, 'hk_g36')
    key('KeyV')
    run(room, 1)
    expect(room.tool.stock).toBe('collapsed')
    equip(room, 'glock_17')
    equip(room, 'hk_g36')
    const pivot = hands(room).getObjectByName('stock')!
    expect(Math.abs(pivot.rotation.y)).toBeCloseTo(Math.PI, 4)
  })

  it('L and K turn a fitted light and laser on and off, a light casts a spot cone and a laser draws its beam and dot', () => {
    const { room } = areaRoom()
    equip(room, 'colt_m4a1')
    bench(room).set('fit_rail_left', 'weapon_light')
    run(room, 3)
    bench(room).set('fit_rail_right', 'laser_sight')
    run(room, 3)
    expect(room.tool.attachments.map((part) => part.id)).toEqual(expect.arrayContaining(['weapon_light', 'laser_sight']))
    const spot = hands(room).getObjectByProperty('isSpotLight', true) as THREE.SpotLight
    expect(spot.intensity).toBe(0)
    expect(key('KeyL').defaultPrevented).toBe(true)
    run(room, 0.2)
    expect(spot.intensity).toBeGreaterThan(0)
    expect(room.tool.attachments.find((part) => part.id === 'weapon_light')?.on).toBe(true)
    key('KeyK')
    run(room, 0.2)
    expect(room.tool.attachments.find((part) => part.id === 'laser_sight')?.on).toBe(true)
    key('KeyL')
    run(room, 0.2)
    expect(spot.intensity).toBe(0)
    expect(spot.visible).toBe(true)
    expect(bench(room).setLayer('beams', false)).toBe(true)
    run(room, 0.1)
    expect(spot.intensity).toBe(0)
  })

  it('the layer for the accessory models hides what the rig drew and the metrics follow the weapon', () => {
    const { room } = areaRoom()
    equip(room, 'colt_m4a1')
    const massBefore = room.metrics().module.weapon_mass as number
    bench(room).set('fit_muzzle', 'suppressor')
    run(room, 16)
    expect(room.metrics().module.weapon_mass as number).toBeGreaterThan(massBefore)
    expect(room.metrics().module.accessories_fitted).toBe(room.tool.attachments.length)
    expect(bench(room).setLayer('attachments', false)).toBe(true)
    run(room, 0.1)
    const root = hands(room).getObjectByName('colt_m4a1')!
    const drawn = root.children[root.children.length - 1]!
    expect(drawn.visible).toBe(false)
    expect(bench(room).setLayer('attachments', true)).toBe(true)
    run(room, 0.1)
    expect(drawn.visible).toBe(true)
  })
})

describe('accessory bench: aiming with the right mouse button', () => {
  const canvas = document.createElement('canvas')
  beforeAll(() => document.body.append(canvas))
  afterAll(() => canvas.remove())
  const mouse = (type: 'mousedown' | 'mouseup', button: number, target: Element = canvas): MouseEvent => {
    const event = new MouseEvent(type, { button, cancelable: true, bubbles: true })
    target.dispatchEvent(event)
    return event
  }

  it('zooms by the optic that is fitted over the seconds the weapon takes to the sights, and goes back on release', () => {
    const { room } = areaRoom()
    equip(room, 'colt_m4a1')
    const camera = room.camera as THREE.PerspectiveCamera
    const fov = camera.fov
    expect(room.tool.attachments.some((part) => part.id === 'acog_4x')).toBe(true)
    expect(mouse('mousedown', 2).defaultPrevented).toBe(true)
    run(room, 0.05)
    expect(camera.fov).toBeLessThan(fov)
    expect(camera.fov).toBeGreaterThan(fov / 4)
    run(room, 2)
    expect(camera.fov).toBeCloseTo((2 * Math.atan(Math.tan((fov * Math.PI) / 360) / 4) * 180) / Math.PI, 3)
    mouse('mouseup', 2)
    run(room, 2)
    expect(camera.fov).toBeCloseTo(fov, 5)
  })

  it('does nothing for a weapon that does not fire (the room keeps grabbing with the right button) and for the other buttons', () => {
    const { room } = areaRoom()
    equip(room, 'hand')
    expect(mouse('mousedown', 2).defaultPrevented).toBe(false)
    equip(room, 'colt_m4a1')
    expect(mouse('mousedown', 0).defaultPrevented).toBe(false)
  })
})

describe('accessory bench: the right button only aims on the room', () => {
  it('leaves a click on a panel or an overlay alone, and aims anywhere while the pointer is locked', () => {
    const { room } = areaRoom()
    equip(room, 'colt_m4a1')
    const camera = room.camera as THREE.PerspectiveCamera
    const fov = camera.fov
    const outside = document.createElement('button')
    document.body.append(outside)
    const press = new MouseEvent('mousedown', { button: 2, cancelable: true, bubbles: true })
    outside.dispatchEvent(press)
    run(room, 2)
    expect(press.defaultPrevented).toBe(false)
    expect(camera.fov).toBe(fov)
    Object.defineProperty(document, 'pointerLockElement', { value: document.body, configurable: true })
    try {
      const locked = new MouseEvent('mousedown', { button: 2, cancelable: true, bubbles: true })
      outside.dispatchEvent(locked)
      run(room, 2)
      expect(locked.defaultPrevented).toBe(true)
      expect(camera.fov).toBeLessThan(fov)
    } finally {
      Reflect.deleteProperty(document, 'pointerLockElement')
      window.dispatchEvent(new MouseEvent('mouseup', { button: 2 }))
      outside.remove()
    }
  })
})

describe('accessory bench: supported', () => {
  it('declares a supported toggle and sends it to the tool as the stance, so a bipod can be exercised', () => {
    const { room } = areaRoom()
    equip(room, 'barrett_mrad')
    const control = bench(room).controls().find((entry) => entry.id === 'supported_stance')
    expect(control).toMatchObject({ kind: 'boolean', default: false })
    const commands: unknown[] = []
    const host = {
      camera: new THREE.PerspectiveCamera(),
      bench: undefined,
      tool: () => ({ weapon: 'barrett_mrad', category: 'snp', ammo: 0, capacity: 0, reserve: 0, reloading: false }),
      command: (request: unknown) => (commands.push(request), { ok: true }),
      onFrame: () => () => undefined,
      on: () => () => undefined,
      log: () => undefined,
    }
    const standalone = createAccessoryBench({ arsenal: createArsenal({ rules: { faults: false } }), host: host as unknown as ModuleHost, text: ACCESSORY_TEXT.en! })
    expect(standalone.handleChange({ kind: 'control', id: 'supported_stance', value: true })).toBe(true)
    expect(commands).toEqual([{ type: 'stance', supported: true }])
    standalone.dispose()
  })
})

describe('accessory bench: words', () => {
  it('names the accessories in the language of the room', () => {
    const { room } = areaRoom('pt-BR')
    equip(room, 'colt_m4a1')
    const control = bench(room).controls().find((entry) => entry.id === 'fit_muzzle') as unknown as { name: string; options: Array<{ id: string; name: string }> }
    expect(control.name).toBe('Boca do cano')
    expect(control.options.find((option) => option.id === 'suppressor')?.name).toBe('Supressor')
  })
})
