import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { DestructibleSpec } from '@adatechnology/game-destruction'
import { MIN_PIECE_MASS_KG } from '@adatechnology/game-destruction-three'
import { demoItems } from './fixtures/demo-items'
import { buildFromSpec } from '../src/build-from-spec'
import { makeRoom } from './helpers'

const EMPTY_CAN_KG = 0.05
const LITERS_DRUNK = 0.15
const WATER_KG_PER_LITER = 1

const emptyCan = (): DestructibleSpec => ({
  name: 'empty can',
  parts: [{ id: 'can', material: 'steel', shape: { kind: 'cylinder', radius: 0.033, height: 0.115 }, position: [0, 0.0575, 0], mass: EMPTY_CAN_KG }],
  joints: [],
  tags: ['item'],
})

describe('the mass of a piece in the physics', () => {
  it('an empty can weighs its own 50 g, not a floor of 200 g', () => {
    expect(MIN_PIECE_MASS_KG).toBeLessThan(EMPTY_CAN_KG)
    const room = makeRoom({ catalog: demoItems('en', [{ id: 'empty_can', name: 'empty can', group: 'items', build: () => buildFromSpec(THREE, emptyCan()), spec: emptyCan }]) })
    const can = room.spawn('empty_can', [0, 0, -1], 0)
    const piece = room.renderer.piece(can.objectId)
    expect(piece?.mass).toBeCloseTo(EMPTY_CAN_KG, 3)
  })

  it('a cup that is drunk from weighs less by the litres gone, at the density of its liquid', () => {
    const room = makeRoom()
    const cup = room.spawn('coffee_cup', [0, 0, -3], 0)
    const piece = room.renderer.piece(cup.objectId)
    expect(piece).not.toBeNull()
    const before = piece!.mass
    const container = `${cup.objectId}_fluid`
    room.fluids.drink(container, LITERS_DRUNK)
    for (let i = 0; i < 10; i++) room.update(1 / 60)
    const lostKg = before - piece!.mass
    // coffee is about water: 1.0 kg per litre
    expect(lostKg).toBeGreaterThan(LITERS_DRUNK * WATER_KG_PER_LITER * 0.9)
    expect(lostKg).toBeLessThan(LITERS_DRUNK * WATER_KG_PER_LITER * 1.1)
  })
})
