import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createTestRoom } from '@adatechnology/game-test-room'
import type { TestRoom } from '@adatechnology/game-test-room'
import { createArsenal } from '@adatechnology/game-weapons'
import { createWeaponsTestModule } from '../src'

function stubRenderer(): THREE.WebGLRenderer {
  const dom = document.createElement('canvas')
  return { domElement: dom, shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer
}

function roomWith(rules: Parameters<typeof createArsenal>[0] = { rules: { faults: false } }, moduleOptions: { flyRocket?: boolean } = {}): { room: TestRoom; module: ReturnType<typeof createWeaponsTestModule> } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const arsenal = createArsenal({ seed: 1, ...rules })
  const room = createTestRoom({ THREE, container, locale: 'en', catalog: [], renderer: stubRenderer(), ui: false, arsenal })
  const module = createWeaponsTestModule({ locale: 'en', sound: false, arsenal, ...moduleOptions })
  expect(room.loadModule(module).problems).toEqual([])
  room.look([0, 1.7, 5], [0, 1.2, -11])
  return { room, module }
}

const part = (room: TestRoom, name: string): THREE.Object3D => {
  const found = room.scene.getObjectByName('weapon-viewmodel')?.getObjectByName(name)
  if (!found) throw new Error(`no part "${name}" in the hands`)
  return found
}
const run = (room: TestRoom, seconds: number): void => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.02) room.update(0.02)
}
const equip = (room: TestRoom, weapon: string): void => {
  room.setTool(weapon)
  run(room, 0.5)
}

describe('weapon in the hands: the gallery model and its clips', () => {
  it('a pistol shot throws a case from the port, blows the slide back and returns it, and the last round leaves it back', () => {
    const { room, module } = roomWith()
    equip(room, 'glock_17')
    expect(module.fx?.inHand).toBe('glock_17')
    const slide = part(room, 'slide')
    const rest = slide.position.x
    room.use()
    run(room, 0.03)
    expect(slide.position.x).toBeLessThan(rest - 0.01)
    run(room, 0.25)
    expect(slide.position.x).toBeCloseTo(rest, 5)
    expect(module.fx?.casings).toBe(1)
    while (room.tool.ammo > 1) {
      room.use()
      run(room, 0.2)
    }
    room.use()
    run(room, 0.4)
    expect(room.tool.ammo).toBe(0)
    expect(slide.position.x).toBeLessThan(rest - 0.01)
  })

  it('a magazine reload drops the magazine, moves it out and in, and leaves the weapon as it was', () => {
    const { room, module } = roomWith()
    equip(room, 'glock_17')
    room.use()
    run(room, 0.3)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    const magazine = part(room, 'mag')
    const rest = magazine.position.y
    run(room, 0.35)
    expect(magazine.position.y).not.toBeCloseTo(rest, 3)
    expect(module.fx?.magazines).toBe(1)
    run(room, 3)
    expect(magazine.position.y).toBeCloseTo(rest, 5)
    expect(room.tool.reloading).toBe(false)
  })

  it('a revolver opens the crane to reload, drops as many cases as it holds (7 on the 686, owner decision) and loads the cylinder', () => {
    const { room, module } = roomWith()
    equip(room, 'sw_686')
    while (room.tool.ammo > 0) {
      room.use()
      run(room, 0.3)
    }
    expect(module.fx?.casings).toBe(0)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    const crane = part(room, 'crane')
    run(room, 0.8)
    expect(Math.abs(crane.rotation.x)).toBeGreaterThan(0.5)
    run(room, 2)
    expect(module.fx?.casings).toBe(7)
    run(room, 12)
    expect(crane.rotation.x).toBeCloseTo(0, 3)
  })

  it('a pump gun cycles its pump after each shot, over the seconds the rule gives', () => {
    const { room } = roomWith()
    equip(room, 'remington_870')
    const pump = part(room, 'pump')
    room.use()
    run(room, 0.1)
    expect(pump.position.x).toBe(0)
    run(room, 0.2)
    expect(pump.position.x).toBeLessThan(-0.01)
    run(room, 0.6)
    expect(pump.position.x).toBeCloseTo(0, 5)
  })

  it('a stovepipe shows in the weapon, X clears it with the motion of the slide, and the case that stuck is thrown out', () => {
    const { room, module } = roomWith({ rules: { faultChance: () => 1 } })
    equip(room, 'glock_17')
    for (let attempt = 0; attempt < 60 && room.tool.fault !== 'stovepipe'; attempt++) {
      if (room.tool.fault) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }))
        run(room, 1.4)
      }
      room.use()
      run(room, 0.4)
    }
    expect(room.tool.fault).toBe('stovepipe')
    const slide = part(room, 'slide')
    expect(slide.position.x).toBeLessThan(-0.005)
    const casings = module.fx?.casings ?? 0
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }))
    run(room, 0.6)
    expect(module.fx?.casings).toBe(casings + 1)
    run(room, 1.5)
    expect(room.tool.fault).toBeNull()
    expect(slide.position.x).toBeCloseTo(0, 5)
  })

  it('the safety lever of a weapon that has one moves with B', () => {
    const { room } = roomWith()
    equip(room, 'glock_18')
    const lever = part(room, 'safety')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))
    run(room, 0.3)
    expect(lever.rotation.z).toBeLessThan(-0.3)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB' }))
    run(room, 0.3)
    expect(lever.rotation.z).toBeCloseTo(0, 5)
  })

  it('a burst fires its rounds one after another, each throwing a case', () => {
    const { room, module } = roomWith()
    equip(room, 'colt_m16a2')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
    expect(room.tool.mode).toBe('burst')
    room.use()
    run(room, 0.6)
    expect(module.fx?.casings).toBe(3)
  })

  it('a belt-fed gun lifts the cover and swaps the belt box to reload', () => {
    const { room } = roomWith()
    equip(room, 'fn_minimi')
    room.use()
    run(room, 0.5)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    const cover = part(room, 'cover')
    run(room, 0.7)
    expect(cover.rotation.z).toBeGreaterThan(0.5)
  })

  it('a launcher sends its round out and a disposable tube is dropped and a new one seated', () => {
    const { room } = roomWith()
    equip(room, 'm72_law')
    const root = room.scene.getObjectByName('weapon-viewmodel')?.getObjectByName('m72_law')
    expect(root?.visible).toBe(true)
    room.use()
    run(room, 0.2)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))
    run(room, 0.2)
    expect(root?.visible).toBe(false)
    run(room, 1.5)
    expect(root?.visible).toBe(true)
  })

  it('a host that draws the projectile itself asks the viewmodel not to fly a rocket of its own', () => {
    const flying = (flyRocket: boolean | undefined): number => {
      const { room } = roomWith(undefined, flyRocket === undefined ? {} : { flyRocket })
      equip(room, 'rpg_7')
      const before = new Set(room.scene.children)
      room.use()
      run(room, 0.1)
      // the rocket is a group of cylinders that the viewmodel puts in the scene
      return room.scene.children.filter((c) => !before.has(c) && c.type === 'Group' && c.children.some((m) => (m as THREE.Mesh).geometry?.type === 'CylinderGeometry')).length
    }
    expect(flying(undefined)).toBeGreaterThan(0)
    expect(flying(false)).toBe(0)
  })

  it('wear paints the metal: a rusty weapon swaps its materials and a new one gets them back', () => {
    const { room, module } = roomWith()
    equip(room, 'ak_47')
    const meshOf = (): THREE.Mesh => {
      let found: THREE.Mesh | undefined
      room.scene.getObjectByName('weapon-viewmodel')?.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!found && mesh.isMesh && (mesh.userData.baseMaterial as THREE.Material | undefined)?.type === 'MeshStandardMaterial') found = mesh
      })
      if (!found) throw new Error('no mesh')
      return found
    }
    const before = (meshOf().userData.baseMaterial as THREE.MeshStandardMaterial).color.getHex()
    module.fx?.setCondition('rusty')
    const colours = new Set<number>()
    room.scene.getObjectByName('weapon-viewmodel')?.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) colours.add((mesh.material as THREE.MeshStandardMaterial).color.getHex())
    })
    expect(colours.size).toBeGreaterThan(1)
    module.fx?.setCondition('new')
    expect((meshOf().material as THREE.MeshStandardMaterial).color.getHex()).toBe(before)
  })
})
