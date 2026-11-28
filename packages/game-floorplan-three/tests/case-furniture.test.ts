import { defaultFurnitureCatalog } from '@adatechnology/game-kit-defaults'
import * as THREE from 'three'
import { createDestruction } from '@adatechnology/game-destruction'
import type { DestructionEvent } from '@adatechnology/game-destruction'
import type { PartSpec } from '@adatechnology/game-contracts'
import { describe, expect, it } from 'vitest'

import { furnitureSpec } from '../src'
import { fakeDocument } from './helpers/fake-document'

/**
 * Case furniture is a box of boards, not a solid block (the owner, 2026-11-27: a shot at a cupboard turned it into solid rectangles). The builders draw the body
 * as one block behind the doors; `furnitureSpec` makes it the carcass it is: MDF sides, top, bottom and shelves on a plywood back, MDF doors and drawer fronts,
 * and a drawer box behind each drawer front. A shot breaks the board it hits, where it hits, into thin pieces.
 */
const CASES = ['dresser', 'nightstand', 'console_table', 'sideboard', 'tv_unit', 'tv_unit_small', 'tv_unit_large', 'china_cabinet', 'pantry', 'laundry_cabinet', 'wardrobe', 'wardrobe_small', 'wardrobe_large', 'kitchen_cabinet']
const made = (type: string) => furnitureSpec(THREE, type, { catalog: defaultFurnitureCatalog(), document: fakeDocument, options: { chairs: false } })
const sizeOf = (p: PartSpec): number[] => (p.shape.kind === 'box' ? [...p.shape.size] : [])
const BOARD_MAX = 0.025

describe('case furniture is a box of boards', () => {
  it.each(CASES)('%s: no solid block, a carcass of thin MDF boards on a plywood back', (type) => {
    const { spec } = made(type)
    for (const part of spec.parts) {
      const size = sizeOf(part)
      if (size.length === 0) continue
      // nothing is a block: the thickest box of a case is its top or plinth, under 12 cm in one direction
      expect(Math.min(...size), `${type} ${part.id}`).toBeLessThan(0.12)
    }
    const board = (suffix: string) => spec.parts.find((p) => p.id.endsWith(`_${suffix}`))
    for (const suffix of ['side_l', 'side_r', 'top', 'bottom']) {
      const p = board(suffix)
      expect(p?.material, `${type} ${suffix}`).toBe('mdf')
      expect(Math.min(...sizeOf(p!))).toBeLessThanOrEqual(BOARD_MAX)
    }
    expect(board('back')?.material).toBe('plywood')
    expect(Math.min(...sizeOf(board('back')!))).toBeLessThanOrEqual(0.01)
  })

  it('the doors and drawer fronts are MDF; a chest of drawers has a drawer box behind each front, a door case its shelves', () => {
    const dresser = made('dresser').spec
    const fronts = dresser.parts.filter((p) => p.material === 'mdf' && /^wood_\d+$/.test(p.id))
    expect(fronts.length).toBe(3)
    for (const k of [0, 1, 2]) for (const s of ['side_l', 'side_r', 'back', 'bottom']) expect(dresser.parts.some((p) => p.id.endsWith(`_drawer${k}_${s}`))).toBe(true)
    expect(dresser.parts.filter((p) => /_rail\d$/.test(p.id)).length).toBe(2)
    expect(made('pantry').spec.parts.filter((p) => /_shelf\d$/.test(p.id)).length).toBeGreaterThanOrEqual(3)
    expect(made('wardrobe').spec.parts.filter((p) => /_shelf\d$/.test(p.id)).length).toBe(1)
  })

  it.each(CASES)('%s: no board of the case lies on another face to face the same way round (no z-fighting)', (type) => {
    const boxes = made(type).spec.parts.filter((p) => p.shape.kind === 'box' && !p.rotation).map((p) => {
      const size = sizeOf(p)
      return { id: p.id, ranges: [0, 1, 2].map((k) => [p.position[k]! - size[k]! / 2, p.position[k]! + size[k]! / 2]) }
    })
    const faces = boxes.flatMap((b) => [0, 1, 2].flatMap((axis) => [-1, 1].map((sign) => ({ id: b.id, axis, sign, at: b.ranges[axis]![sign > 0 ? 1 : 0]!, rect: b.ranges.filter((_, k) => k !== axis) }))))
    const overlap = (a: number[][], b: number[][]): boolean => a.every((r, k) => Math.min(r[1]!, b[k]![1]!) - Math.max(r[0]!, b[k]![0]!) > 1e-6)
    const ours = (id: string) => /_(side_[lr]|top|bottom|back|shelf\d|rail\d|drawer\d_\w+)$/.test(id)
    const clashes = faces.flatMap((a, ia) =>
      faces.slice(ia + 1).filter((b) => a.id !== b.id && (ours(a.id) || ours(b.id)) && a.axis === b.axis && a.sign === b.sign && Math.abs(a.at - b.at) < 1e-4 && overlap(a.rect, b.rect)).map((b) => `${a.id}/${b.id} axis ${a.axis}`),
    )
    expect(clashes).toEqual([])
  })

  it('weighs what a real one weighs, not a block of hardwood', () => {
    const w = createDestruction()
    const id = w.add(made('dresser').spec, { id: 'dresser' })
    const mass = (w.state(id)?.parts ?? []).reduce((sum, p) => sum + p.mass, 0)
    // a 1 m chest of three drawers in MDF: some 40-80 kg (the solid block it was weighed 250)
    expect(mass).toBeGreaterThan(25)
    expect(mass).toBeLessThan(90)
  })

  it.each(['dresser', 'sideboard', 'wardrobe'])('%s stands whole', (type) => {
    const w = createDestruction()
    const id = w.add(made(type).spec, { id: type })
    expect(w.state(id)!.groups.length).toBe(1)
  })

  it('a blow on the side breaks that board where it lands, into thin MDF slabs and lumps; the rest of the case stays', () => {
    const { spec } = made('sideboard')
    const side = spec.parts.find((p) => p.id.endsWith('_side_r'))!
    const w = createDestruction({ seed: 3 })
    const id = w.add(spec, { id: 'sideboard' })
    const point: [number, number, number] = [side.position[0] + 0.02, side.position[1] + 0.12, side.position[2] - 0.05]
    const events: DestructionEvent[] = []
    for (let k = 0; k < 20 && w.state(id)!.parts.find((p) => p.id === side.id)?.status !== 'broken'; k++) {
      events.push(...w.hit(id, { type: 'blunt', point, direction: [-1, 0, 0], energy: 3000, radius: 0.05 }).events)
    }
    const fracture = events.find((e): e is Extract<DestructionEvent, { type: 'fracture' }> => e.type === 'fracture' && e.part === side.id)
    expect(fracture).toBeDefined()
    // every piece of the board is as thin as the board: no block
    for (const f of fracture!.fragments) expect(Math.min(...f.size)).toBeLessThanOrEqual(0.0181)
    expect(fracture!.fragments.some((f) => f.shape === 'chunk')).toBe(true)
    // the slabs meet where it was hit: each slab has a corner within a few cm of the point
    const slabs = fracture!.fragments.filter((f) => f.shape === 'slab')
    expect(slabs.length).toBeGreaterThanOrEqual(3)
    for (const s of slabs) {
      // the board is not turned, so a slab's size is along the axes of the case (x across the board)
      const gap = (axis: number) => Math.max(0, Math.abs(s.center[axis]! - point[axis]) - s.size[axis]! / 2)
      expect(Math.hypot(gap(1), gap(2))).toBeLessThan(0.01)
    }
    const broken = w.state(id)!.parts.filter((p) => p.status === 'broken').map((p) => p.id)
    expect(broken).toEqual([side.id])
  })
})
