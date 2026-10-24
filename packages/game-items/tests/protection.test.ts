import { describe, expect, it } from 'vitest'

import { blockChance, createItems, pieceBlock, repairPiece, wearBlocked } from '../src'
import type { ItemDef, WornPiece } from '../src'
import { item } from './fixtures'

const clothing = (id: string, slots: ItemDef['protection'] & object): ItemDef => item(id, { category: 'clothing', protection: slots })
const piece = (def: ItemDef, condition = 100): WornPiece => ({ item: def, condition })

const denimJacket = clothing('denim_jacket', { slots: ['torso', 'arms'], bite: 0.25, scratch: 0.4 })
const magazineGuard = clothing('magazine_guard', { slots: ['arms'], bite: 0.35, scratch: 0.5 })
const leatherJacket = clothing('leather_jacket', { slots: ['torso', 'arms'], bite: 0.45, scratch: 0.7 })
const plateGuard = clothing('plate_guard', { slots: ['arms'], bite: 0.7, scratch: 0.9 })
const tshirt = clothing('tshirt', { slots: ['torso', 'arms'], bite: 0, scratch: 0.1 })

describe('blockChance', () => {
  it('reproduces the examples of the team page on the arm', () => {
    expect(blockChance([piece(tshirt)], 'arms', 'bite')).toBe(0)
    expect(blockChance([piece(denimJacket)], 'arms', 'bite')).toBeCloseTo(0.25)
    expect(blockChance([piece(denimJacket), piece(magazineGuard)], 'arms', 'bite')).toBeCloseTo(1 - 0.75 * 0.65)
    expect(blockChance([piece(leatherJacket), piece(plateGuard)], 'arms', 'bite')).toBeCloseTo(1 - 0.55 * 0.3)
  })

  it('is 0 with nothing on the slot and only counts pieces that cover it', () => {
    expect(blockChance([], 'arms', 'bite')).toBe(0)
    expect(blockChance([piece(magazineGuard)], 'legs', 'bite')).toBe(0)
  })

  it('scales a piece by its condition', () => {
    expect(blockChance([piece(denimJacket, 50)], 'torso', 'bite')).toBeCloseTo(0.125)
  })

  it('never reaches 100%: capped at 90%', () => {
    const armor = clothing('armor', { slots: ['torso'], bite: 0.99, scratch: 1 })
    expect(blockChance([piece(armor), piece(armor)], 'torso', 'bite')).toBe(0.9)
    expect(blockChance([piece(armor)], 'torso', 'scratch')).toBe(0.9)
  })

  it('lets a game change the cap', () => {
    const { rules } = createItems({ rules: { protection: { cap: 0.5 } } })
    expect(blockChance([piece(leatherJacket)], 'torso', 'scratch', rules)).toBe(0.5)
  })
})

describe('wear and repair', () => {
  it('wears -8 on a bitten piece and -3 on a scratched one', () => {
    const worn = wearBlocked([piece(denimJacket), piece(tshirt)], 'torso', 'bite')
    expect(worn.map((entry) => entry.condition)).toEqual([92, 100])
    expect(wearBlocked([piece(denimJacket)], 'torso', 'scratch')[0]?.condition).toBe(97)
  })

  it('wears only the pieces that cover the slot and never below 0', () => {
    const [guard, jacket] = wearBlocked([piece(magazineGuard, 5), piece(leatherJacket)], 'legs', 'bite')
    expect(guard?.condition).toBe(5)
    expect(jacket?.condition).toBe(100)
    expect(wearBlocked([piece(magazineGuard, 5)], 'arms', 'bite')[0]?.condition).toBe(0)
  })

  it('keeps a torn piece at 25% of its value', () => {
    expect(pieceBlock(piece(denimJacket, 0), 'bite')).toBeCloseTo(0.0625)
    expect(blockChance([piece(denimJacket, 0)], 'arms', 'bite')).toBeCloseTo(0.0625)
  })

  it('repairs up to the maximum minus 10 and leaves a better piece alone', () => {
    expect(repairPiece(piece(denimJacket, 0)).condition).toBe(90)
    expect(repairPiece(piece(denimJacket, 95)).condition).toBe(95)
    expect(repairPiece(piece(denimJacket, 10), undefined, 40).condition).toBe(30)
  })
})
