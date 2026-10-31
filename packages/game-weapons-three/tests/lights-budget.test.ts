import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createLightBudget } from '@adatechnology/game-render-three'
import { createArsenal } from '@adatechnology/game-weapons'
import type { FittedAttachment } from '@adatechnology/game-weapons'
import { buildWeaponModelById, fitAttachmentModels } from '../src'
import { createRocketLight, launchRocket } from '../src/fx/heavy'
import type { HeavyContext } from '../src/fx/heavy'
import { modelKit } from '../src/models/kit'

const kit = modelKit(THREE)
const catalogue = createArsenal({ rules: { faults: false } }).attachments
const fit = (id: string, mount: FittedAttachment['mount'], extra: Partial<FittedAttachment> = {}): FittedAttachment => ({ id, mount, ...extra })

describe('the weapon light through a LightBudget', () => {
  it('is a source that holds a slot only while on, aimed along the barrel, with no light of its own in the model', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 1, spot: 1, pointShadows: 0 })
    const model = buildWeaponModelById(THREE, 'colt_m4a1')!
    scene.add(model.root)
    const rig = fitAttachmentModels(model, [fit('weapon_light', 'rail_left')], kit, { catalogue, lights: budget })
    expect(model.root.getObjectByProperty('isSpotLight', true)).toBeUndefined()
    scene.updateMatrixWorld(true)
    budget.present([0, 0, 0], 0.016)
    expect(budget.stats().lit).toBe(0)
    rig.sync([fit('weapon_light', 'rail_left', { on: true })])
    budget.present([0, 0, 0], 1)
    expect(budget.stats().lit).toBe(1)
    const spot = budget.group.children.find((child) => (child as THREE.SpotLight).isSpotLight) as THREE.SpotLight
    expect(spot.intensity).toBeGreaterThan(0)
    expect(spot.angle).toBeCloseTo((30 / 2) * (Math.PI / 180), 5)
    expect(spot.distance).toBe(60)
    const aim = spot.target.position.clone().sub(spot.position).normalize()
    const barrel = new THREE.Vector3(1, 0, 0).transformDirection(model.root.matrixWorld)
    expect(aim.dot(barrel)).toBeGreaterThan(0.999)
    rig.sync([fit('weapon_light', 'rail_left', { on: false })])
    budget.present([0, 0, 0], 1)
    expect(budget.stats().lit).toBe(0)
    rig.dispose()
    expect(budget.stats().sources).toBe(0)
  })
})

describe('the rocket in flight through a LightBudget', () => {
  it('asks for a light while it flies and gives it back when it lands, without a light of its own in the scene', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 2, spot: 0, pointShadows: 0 })
    const model = buildWeaponModelById(THREE, 'rpg_7')!
    scene.add(model.root)
    const tasks: Array<{ step: (progress: number, dt: number) => void; done?: () => void }> = []
    const noop = (): void => undefined
    const effects = { backblast: noop, smoke: noop, flameJet: noop, muzzleFlash: noop } as unknown as HeavyContext['effects']
    const context: HeavyContext = {
      kit,
      scene,
      particles: {} as HeavyContext['particles'],
      effects,
      random: () => 0.5,
      parts: model.parts,
      forward: () => new THREE.Vector3(1, 0, 0),
      positionOf: (part) => part.getWorldPosition(new THREE.Vector3()),
      orientation: () => new THREE.Quaternion(),
      every: (_seconds, step, done) => void tasks.push({ step, ...(done ? { done } : {}) }),
      groundAt: () => 0,
      lights: budget,
    }
    launchRocket(context)
    expect(budget.stats().lit).toBe(1)
    tasks[0]!.step(0.5, 0.016)
    const lamp = budget.group.children.find((child) => (child as THREE.PointLight).isPointLight && (child as THREE.PointLight).intensity > 0) as THREE.PointLight
    expect(lamp.intensity).toBe(3)
    expect(lamp.position.x).toBeGreaterThan(0.5)
    tasks[0]!.done?.()
    expect(budget.stats().lit).toBe(0)
    let own = 0
    scene.traverse((node) => {
      if ((node as THREE.Light).isLight && !budget.group.getObjectById(node.id)) own++
    })
    expect(own).toBe(0)
  })
})

describe('the rocket in flight without a LightBudget (deprecated path)', () => {
  it('keeps the light of its own: lit while it flies, parked when it lands', () => {
    const scene = new THREE.Scene()
    const model = buildWeaponModelById(THREE, 'rpg_7')!
    scene.add(model.root)
    const rocketLight = createRocketLight(THREE)
    scene.add(rocketLight)
    const tasks: Array<{ step: (progress: number, dt: number) => void; done?: () => void }> = []
    const noop = (): void => undefined
    const context: HeavyContext = {
      kit,
      scene,
      particles: {} as HeavyContext['particles'],
      effects: { backblast: noop, smoke: noop, flameJet: noop, muzzleFlash: noop } as unknown as HeavyContext['effects'],
      random: () => 0.5,
      parts: model.parts,
      forward: () => new THREE.Vector3(1, 0, 0),
      positionOf: (part) => part.getWorldPosition(new THREE.Vector3()),
      orientation: () => new THREE.Quaternion(),
      every: (_seconds, step, done) => void tasks.push({ step, ...(done ? { done } : {}) }),
      groundAt: () => 0,
      rocketLight,
    }
    launchRocket(context)
    tasks[0]!.step(0.5, 0.016)
    expect(rocketLight.intensity).toBe(3)
    tasks[0]!.done?.()
    expect(rocketLight.intensity).toBe(0)
    expect(rocketLight.position.y).toBe(-50)
  })
})
