import { createLightBudget } from '@adatechnology/game-render-three'
import { describe, expect, it } from 'vitest'

import { rectsOf } from '../src'
import { THREE, houseOf, planOf } from './helpers/houses'

const EMPTY = [1e9, 1e9, -1e9, -1e9]

/** The mask uniforms of the renderer: the arrays every masked material shares. */
const maskUniforms = (renderer: any): Record<string, { value: Float32Array }> => renderer.internals.K.LZU

function setup(options: Record<string, unknown> = {}) {
  const { house, renderer } = houseOf(planOf('casaA', 3), options, { night: true })
  const scene = new THREE.Scene()
  const budget = createLightBudget(THREE, scene, { point: 6, spot: 0, pointShadows: 0 })
  const rooms = (house as any).r.rooms.filter((room: any) => room.type !== 'void')
  const [first, second] = rooms
  const centerOf = (room: any): [number, number, number] => {
    const [a, b, c, d] = rectsOf(room)[0]
    return [(a + c) / 2, (house as any).y0(room.floor) + 1.2, (b + d) / 2]
  }
  const blast = (position: [number, number, number]) => budget.acquire({ owner: 'vfx.blast', priority: 900, urgent: true, color: 0xffaa55, intensity: 5, distance: 10, position })!
  const rectOf = (slot: number) => Array.from(maskUniforms(renderer).uRB0.value.slice(slot * 4, slot * 4 + 4))
  const lit = (): void => {
    budget.present([0, 1.6, 0], 1)
    renderer.effectLights({ budget }).update([house])
  }
  return { house, renderer, budget, first, second, centerOf, blast, rectOf, lit }
}

describe('effect lights indoors', () => {
  it('points the mask of a blast slot at the room where the blast is', () => {
    const { first, centerOf, blast, rectOf, lit } = setup()
    const handle = blast(centerOf(first))
    lit()
    const box = rectOf(handle.slot)
    const [a, b, c, d] = rectsOf(first)[0]
    expect(box).not.toEqual(EMPTY)
    expect(box[0]).toBeLessThanOrEqual(Math.fround(a))
    expect(box[1]).toBeLessThanOrEqual(Math.fround(b))
    expect(box[2]).toBeGreaterThanOrEqual(Math.fround(c))
    expect(box[3]).toBeGreaterThanOrEqual(Math.fround(d))
  })

  it('leaves a blast far from every room, and a light that went out, with the empty box', () => {
    const { first, centerOf, blast, rectOf, lit } = setup()
    const far = blast([80, 1.2, 80])
    lit()
    expect(rectOf(far.slot)).toEqual(EMPTY)
    const near = blast(centerOf(first))
    lit()
    const slot = near.slot
    expect(rectOf(slot)).not.toEqual(EMPTY)
    near.release({ fadeMs: 0 })
    lit()
    expect(rectOf(slot)).toEqual(EMPTY)
  })

  it('keeps the old behaviour (every effect light masked out of the house) with effectLightsIndoors off', () => {
    const { first, centerOf, blast, rectOf, lit } = setup({ effectLightsIndoors: false })
    const handle = blast(centerOf(first))
    lit()
    expect(rectOf(handle.slot)).toEqual(EMPTY)
  })

  it('lights the rooms either side of an open door when the blast is in the doorway', () => {
    const { house, renderer, budget, blast, rectOf, lit } = setup()
    const door = (house as any).r.doors.find((candidate: any) => !candidate.exterior)
    expect(door).toBeDefined()
    const alongU = door.axis === 'u'
    const doorway: [number, number, number] = [alongU ? door.at : door.pos, (house as any).y0(door.floor) + 1, alongU ? door.pos : door.at]
    ;(renderer as any).effectLights({ budget })
    ;(house as any).internal.doorState.set(door.id, true)
    const handle = blast(doorway)
    lit()
    const open = rectOf(handle.slot)
    ;(house as any).internal.doorState.set(door.id, false)
    lit()
    expect(open).not.toEqual(EMPTY)
  })

  it('does not touch the slots a lighting() lease holds', () => {
    const { house, renderer, budget, blast } = setup()
    const rooms = renderer.lighting({ scene: new THREE.Scene(), n: 2, shadows: 0, budget })
    rooms.update([house], new THREE.Vector3(0, 1.6, 0), {})
    const mine = rooms.lights.map((handle: any) => handle.slot)
    const before = mine.map((slot: number) => Array.from(maskUniforms(renderer).uRB0.value.slice(slot * 4, slot * 4 + 4)))
    blast([0, 1, 0])
    budget.present([0, 1.6, 0], 1)
    rooms.update([house], new THREE.Vector3(0, 1.6, 0), {})
    const after = mine.map((slot: number) => Array.from(maskUniforms(renderer).uRB0.value.slice(slot * 4, slot * 4 + 4)))
    expect(after).toEqual(before)
  })
})
