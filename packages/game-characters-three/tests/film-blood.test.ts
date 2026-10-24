import { createRng } from '@adatechnology/game-characters'
import type { DestructionEvent } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { bloodLookOfAge, createBestBuilder, createFluidsBridge, createWounds, woundBodyOf } from '../src'
import type { BloodLook, FilmSink } from '../src'

const best = createBestBuilder(THREE, { types: [{ name: 'Lento', eye: 0xff2020 }], random: () => 0.5 })

type Splat = Parameters<FilmSink['splat']>[0]

const setup = (look?: BloodLook) => {
  const scene = new THREE.Scene()
  const root = best.build({ type: 'Lento', decay: 1, seed: 4, phase: 0 }) as THREE.Object3D
  scene.add(root)
  scene.updateMatrixWorld(true)
  const world: { liquid: string; liters: number }[] = []
  const splats: Splat[] = []
  const film: FilmSink = { splat: (splat) => (splats.push(splat), splat.count ?? 1) }
  const bridge = createFluidsBridge({ sink: { splash: (liquid, _point, liters) => void world.push({ liquid, liters }) }, film })
  const wounds = createWounds(THREE, { random: createRng(9), scene, bridge })
  const body = wounds.track(woundBodyOf(root)!)
  if (look) body.blood = look
  return { wounds, body, splats, world }
}

const bodyEvent = (change: 'wound' | 'severed' | 'destroyed' | 'split', part?: string, extra: object = {}): DestructionEvent =>
  ({ type: 'body', object: 'z1', time: 0, change, ...(part ? { part } : {}), ...extra }) as DestructionEvent

describe('bloodLookOfAge', () => {
  it('reads the fresh and dry colours of ages.json as numbers and keeps the thin ones as old blood', () => {
    expect(bloodLookOfAge({ id: 'fresh', blood: 1, freshBloodColor: '8A0A0A', dryBloodColor: '3B1D14' })).toEqual({ tint: { fresh: 0x8a0a0a, dry: 0x3b1d14 }, amount: 1 })
    expect(bloodLookOfAge({ id: 'old', blood: 0.25, freshBloodColor: '3A1C12', dryBloodColor: '2A160E' })).toMatchObject({ liquid: 'old_blood', amount: 0.25 })
    expect(bloodLookOfAge({ id: 'old', blood: 0.25, freshBloodColor: '#3A1C12', dryBloodColor: '2A160E' }, { thinBelow: 0.2 })).not.toHaveProperty('liquid')
    expect(bloodLookOfAge({ id: 'old', blood: 0.25, freshBloodColor: '3A1C12', dryBloodColor: '2A160E' }, { thinLiquid: 'bile' })).toMatchObject({ liquid: 'bile' })
  })
})

describe('body events into the film', () => {
  const recent = bloodLookOfAge({ id: 'recent', blood: 0.6, freshBloodColor: '5A0C10', dryBloodColor: '2E1810' })

  it('a wound throws drops of blood in the colours of the body, along the way out', () => {
    const { wounds, body, splats } = setup(recent)
    wounds.handle(body, bodyEvent('wound', 'thighL', { exit: [0, 0, 1] }))
    expect(splats).toHaveLength(1)
    expect(splats[0]).toMatchObject({ fluid: 'blood', count: 2, tint: { fresh: 0x5a0c10, dry: 0x2e1810 }, direction: [0, 0, 1] })
    expect(splats[0]!.point[1]).toBeGreaterThan(0.2)
  })

  it('a wound with no look uses the liquid colours and straight-down drops', () => {
    const { wounds, body, splats } = setup()
    wounds.handle(body, bodyEvent('wound', 'torso'))
    expect(splats[0]).toMatchObject({ fluid: 'blood', count: 3 })
    expect(splats[0]).not.toHaveProperty('tint')
    expect(splats[0]).not.toHaveProperty('direction')
  })

  it('a severed, destroyed or split segment spills into the world and the film', () => {
    const { wounds, body, splats, world } = setup(recent)
    wounds.handle(body, bodyEvent('severed', 'upperArmL'))
    wounds.handle(body, bodyEvent('destroyed', 'forearmR', { exit: [0, 0.3, 1] }))
    wounds.handle(body, bodyEvent('split', 'torso'))
    expect(world.map((entry) => entry.liters)).toEqual([0.35, 0.6, 0.9])
    expect(splats.map((splat) => splat.count)).toEqual([2, 4, 6])
    expect(splats.every((splat) => splat.tint?.fresh === 0x5a0c10)).toBe(true)
  })

  it('an old body bleeds old blood and a dried-out one throws no drops', () => {
    const old = setup(bloodLookOfAge({ id: 'old', blood: 0.25, freshBloodColor: '3A1C12', dryBloodColor: '2A160E' }))
    old.wounds.handle(old.body, bodyEvent('severed', 'upperArmL'))
    expect(old.splats[0]).toMatchObject({ fluid: 'old_blood' })
    expect(old.world[0]).toMatchObject({ liquid: 'old_blood' })
    const dry = setup(bloodLookOfAge({ id: 'decrepit', blood: 0, freshBloodColor: '1A1612', dryBloodColor: '1A1612' }))
    dry.wounds.handle(dry.body, bodyEvent('wound', 'torso'))
    dry.wounds.handle(dry.body, bodyEvent('severed', 'upperArmL'))
    expect(dry.splats).toHaveLength(0)
  })

  it('without a film only the world gets the blood', () => {
    const scene = new THREE.Scene()
    const root = best.build({ type: 'Lento', decay: 1, seed: 4, phase: 0 }) as THREE.Object3D
    scene.add(root)
    scene.updateMatrixWorld(true)
    const world: string[] = []
    const wounds = createWounds(THREE, { random: createRng(9), scene, bridge: createFluidsBridge({ sink: { splash: (liquid) => void world.push(liquid) } }) })
    const body = wounds.track(woundBodyOf(root)!)
    wounds.handle(body, bodyEvent('wound', 'torso'))
    wounds.handle(body, bodyEvent('severed', 'upperArmL'))
    expect(world).toEqual(['blood'])
  })
})
