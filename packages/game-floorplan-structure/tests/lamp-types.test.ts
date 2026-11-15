import { describe, expect, it } from 'vitest'

import type { Electrical, Outbuilding } from '../src'
import { LAMP_TYPE_BY_ROOM, lampTypeOfRoom, outbuildingCeilingLight } from '../src'
import { engine } from './support'

type Generated = { outbuildings: Outbuilding[]; rooms: { id: string; type: string; floor: number }[]; items: { id: string; category: string; outdoor?: boolean }[]; utilities: { electrical: Electrical } }

const generate = (template: string, seed: number): Generated => engine.generate(template, { seed, state: 'normal' }) as unknown as Generated

describe('the lamp of each lighting point follows its room', () => {
  it('gives a batten to the working rooms, a flush base to the damp ones and a bulb to the rest', () => {
    expect(lampTypeOfRoom('kitchen')).toBe('tube_t8')
    expect(lampTypeOfRoom('bathroom')).toBe('plafon')
    expect(lampTypeOfRoom('bedroom')).toBe('bulb_e27')
    expect(lampTypeOfRoom('living')).toBe('bulb_e27')
    expect(lampTypeOfRoom('bedroom', true)).toBe('tube_t8')
    expect(Object.values(LAMP_TYPE_BY_ROOM).every((lamp) => ['tube_t8', 'plafon'].includes(lamp))).toBe(true)
  })

  for (const template of ['single_storey_a', 'townhouse', 'mid_modern_single_storey']) {
    it(`${template}: every indoor ceiling light is a lighting point with the lamp of its room`, () => {
      for (const seed of [1, 2, 3]) {
        const plan = generate(template, seed)
        const electrical = plan.utilities.electrical
        const lights = plan.items.filter((item) => item.category === 'ceiling_light' && !item.outdoor)
        const outbuildingLights = plan.outbuildings.map((building) => outbuildingCeilingLight(building).id)
        expect(electrical.lightPoints.length, `${template} #${seed}`).toBe(lights.length + outbuildingLights.length)
        for (const point of electrical.lightPoints) {
          const outbuilding = plan.outbuildings.find((building) => building.id === point.room)
          const room = plan.rooms.find((candidate) => candidate.id === point.room && candidate.floor === point.floor)
          const roomType = outbuilding ? 'living' : room?.type
          expect(roomType, point.id).toBeDefined()
          expect(point.lamp, `${point.id} in ${point.room}`).toBe(lampTypeOfRoom(roomType as string, outbuilding !== undefined))
        }
      }
    })
  }
})
