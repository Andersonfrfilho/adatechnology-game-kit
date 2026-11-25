import { describe, expect, it } from 'vitest'

import { FIT_REJECT_REASONS, SEAT_ROLES } from '../src/index'
import type { BodyMeasures, DoorOpening, FitRejectReason, FitResult, SeatRole, SeatSpace } from '../src/index'

describe('body-measures contracts', () => {
  it('exposes the canonical seat roles and reject reasons', () => {
    expect(SEAT_ROLES).toEqual(['driver', 'front_passenger', 'rear', 'cargo', 'rider', 'pilot', 'crew'])
    expect(FIT_REJECT_REASONS).toEqual(['head', 'legs', 'shoulders', 'door'])
  })

  it('models BodyMeasures, SeatSpace, DoorOpening and FitResult in metres', () => {
    const body: BodyMeasures = {
      heightMetres: 1.8,
      build: 1,
      seatedHeightMetres: 0.936,
      seatedEyeHeightMetres: 0.819,
      shoulderWidthMetres: 0.468,
      thighLengthMetres: 0.612,
      shinLengthMetres: 0.513,
    }
    const role: SeatRole = 'driver'
    const seat: SeatSpace = {
      id: 'driver',
      role,
      hipPoint: [0.1, 0.45, -0.38],
      headroomMetres: 0.98,
      legroomMetres: 0.66,
      widthMetres: 0.56,
      doorId: 'door_front_left',
    }
    const door: DoorOpening = {
      id: 'door_front_left',
      widthMetres: 1.15,
      heightMetres: 0.89,
    }
    const openSeat: SeatSpace = {
      id: 'rider',
      role: 'rider',
      hipPoint: [0, 0.78, 0],
      headroomMetres: Number.POSITIVE_INFINITY,
      legroomMetres: Number.POSITIVE_INFINITY,
      widthMetres: Number.POSITIVE_INFINITY,
    }
    const ok: FitResult = { fits: true }
    const reason: FitRejectReason = 'head'
    const rejected: FitResult = { fits: false, reason }

    expect(body.seatedHeightMetres).toBeLessThan(seat.headroomMetres)
    expect(door.id).toBe(seat.doorId)
    expect(openSeat.doorId).toBeUndefined()
    expect(ok.fits).toBe(true)
    expect(rejected.fits).toBe(false)
  })
})
