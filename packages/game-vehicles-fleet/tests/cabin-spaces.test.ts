import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { DoorOpening, SeatSpace } from '@adatechnology/game-contracts'
import { cabinMinimumOf, createVehicleKit } from '@adatechnology/game-vehicles'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { fleetCabinCategoryOf, fleetVehicleIds, installFleet } from '../src/index'
import type { FleetVehicleId } from '../src/index'

const FIXTURE = join(process.cwd(), 'tests/fixtures/cabin-spaces.json')

const round3 = (n: number): number | 'Infinity' => (Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 'Infinity')

type RecordedSeat = {
  id: string
  role: SeatSpace['role']
  hipPoint: [number, number, number]
  headroomMetres: number | 'Infinity'
  legroomMetres: number | 'Infinity'
  widthMetres: number | 'Infinity'
  doorId?: string
}

type RecordedDoor = {
  id: string
  widthMetres: number | 'Infinity'
  heightMetres: number | 'Infinity'
}

type RecordedVehicleSpace = {
  category: string
  seats: RecordedSeat[]
  doors: RecordedDoor[]
}

const serializeSeat = (s: SeatSpace): RecordedSeat => {
  const base: RecordedSeat = {
    id: s.id,
    role: s.role,
    hipPoint: [Math.round(s.hipPoint[0] * 1000) / 1000, Math.round(s.hipPoint[1] * 1000) / 1000, Math.round(s.hipPoint[2] * 1000) / 1000],
    headroomMetres: round3(s.headroomMetres),
    legroomMetres: round3(s.legroomMetres),
    widthMetres: round3(s.widthMetres),
  }
  return s.doorId !== undefined ? { ...base, doorId: s.doorId } : base
}

const serializeDoor = (d: DoorOpening): RecordedDoor => ({
  id: d.id,
  widthMetres: round3(d.widthMetres),
  heightMetres: round3(d.heightMetres),
})

function makeStubDocument() {
  const noop = () => undefined
  const grad = { addColorStop: noop }
  const ctx2d = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    strokeText: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    setLineDash: noop,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: () => ({ width: 10 }),
  }
  return {
    createElement: () => ({
      width: 64,
      height: 64,
      getContext: () => ctx2d,
      toDataURL: () => 'data:image/png;base64,',
    }),
  } as unknown as Document
}

describe('fleet cabin spaces (Spec 012 Criterion 3, R5 & R6)', () => {
  it('covers all 69 fleet vehicles against the R6 cabin table and matches the cabin-spaces golden', () => {
    expect(fleetVehicleIds).toHaveLength(69)
    const kit = createVehicleKit({ THREE, locale: 'en', document: makeStubDocument() })
    installFleet(kit)

    const measured: Record<string, RecordedVehicleSpace> = {}
    const problems: string[] = []

    for (const id of fleetVehicleIds as readonly FleetVehicleId[]) {
      const c = kit.build(id, 'intact')
      const category = fleetCabinCategoryOf(id)
      const min = cabinMinimumOf(category)

      if (c.seats.length === 0) {
        problems.push(`${id}: no seats recorded`)
      } else {
        const primary = c.seats.find((s) => s.role === 'driver' || s.role === 'pilot' || s.role === 'rider') ?? c.seats[0]!
        if (primary.headroomMetres < min.frontHeadroomMetres) {
          problems.push(`${id} (${category}): primary headroom ${primary.headroomMetres} < ${min.frontHeadroomMetres}`)
        }
        if (primary.legroomMetres < min.frontLegroomMetres) {
          problems.push(`${id} (${category}): primary legroom ${primary.legroomMetres} < ${min.frontLegroomMetres}`)
        }
        if (primary.widthMetres < min.widthMetres) {
          problems.push(`${id} (${category}): primary width ${primary.widthMetres} < ${min.widthMetres}`)
        }
        if (category === 'passenger_car' && primary.headroomMetres < 0.95) {
          problems.push(`${id}: passenger car front headroom ${primary.headroomMetres} < 0.95`)
        }
        if (min.rearHeadroomMetres !== undefined && category !== 'open_vehicle') {
          for (const seat of c.seats) {
            if (seat.role === 'rear' && seat.headroomMetres < min.rearHeadroomMetres) {
              problems.push(`${id} (${category}): rear seat ${seat.id} headroom ${seat.headroomMetres} < ${min.rearHeadroomMetres}`)
            }
          }
        }
      }

      if (min.door !== undefined) {
        if (c.doors.length === 0) {
          problems.push(`${id} (${category}): no door opening recorded`)
        } else {
          const hasValidDoor = c.doors.some((d) => d.widthMetres >= min.door!.widthMetres && d.heightMetres >= min.door!.heightMetres)
          if (!hasValidDoor) {
            problems.push(`${id} (${category}): no door meets ${min.door.widthMetres}x${min.door.heightMetres}`)
          }
        }
      }

      measured[id] = {
        category,
        seats: c.seats.map(serializeSeat),
        doors: c.doors.map(serializeDoor),
      }
      kit.dispose(c)
    }

    expect(problems, problems.join('\n')).toEqual([])

    if (process.env.UPDATE_CABIN_SPACES) {
      writeFileSync(FIXTURE, JSON.stringify(measured, null, 2) + '\n')
      return
    }

    const recorded = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, RecordedVehicleSpace>
    expect(measured).toEqual(recorded)
  }, 120_000)
})
