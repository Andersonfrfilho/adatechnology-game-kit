import { describe, expect, it } from 'vitest'

import { makeKit } from './helpers/kit'

describe('cabin-space (Spec 012 T3.1)', () => {
  it('measures 5-ray headroom, legroom, shoulder width and door opening for an enclosed cabin', () => {
    const kit = makeKit()
    kit.register({ key: 'test_car', group: 'cars' }, (c, k) => {
      c.meta.kind = 'car'
      c.meta.front = 2.0
      c.meta.rear = -2.0
      c.meta.width = 1.7
      c.meta.clearance = 0.2
      c.meta.belt = 0.9
      c.meta.top = 1.5
      c.meta.glasshouse = { fb: 0.9, ft: 0.4, rb: -1.1, rt: -0.9, belt: 0.9, roof: 1.5, Wg: 1.5, k: 0.1 }
      c.meta.cabin = { x0: -1.1, x1: 0.9, y0: 0.25, y1: 1.55, z: 0.75 }
      // Roof panel at y = 1.48 (thickness 0.04 -> bottom face at 1.46)
      c.roundBox(1.8, 0.04, 1.4, 0.01, c.paint('#888'), 0, 1.48, 0)
      // Firewall/dash at x = 0.72 (depth 0.04 -> back face at 0.70)
      c.roundBox(0.04, 0.6, 1.4, 0.01, c.paint('#333'), 0.72, 0.6, 0)
      // Side walls at z = ±0.74 (thickness 0.04 -> inner faces at ±0.72)
      c.roundBox(1.8, 1.1, 0.04, 0.01, c.paint('#555'), 0, 0.85, -0.74)
      c.roundBox(1.8, 1.1, 0.04, 0.01, c.paint('#555'), 0, 0.85, 0.74)
      // Driver seat at x = 0.0, floor = 0.26, h = 0.22 -> hipY = 0.49
      k.seat(c, 0, 0.26, -0.38, { w: 0.5, h: 0.22, id: 'driver', role: 'driver' })
      k.seat(c, 0, 0.26, 0.38, { w: 0.5, h: 0.22, role: 'front_passenger' })
      // Rear 3-seat bench
      k.seat(c, -0.85, 0.26, 0, { w: 1.38, h: 0.22, n: 3, role: 'rear' })
      c.zone('door_front_left', 'Left door', [-0.4, 0.7, 0.25, 0.92, -0.9, -0.6], null, { type: 'door', side: -1 })
      c.zone('door_front_right', 'Right door', [-0.4, 0.7, 0.25, 0.92, 0.6, 0.9], null, { type: 'door', side: 1 })
    })

    const ctx = kit.build('test_car', 'intact')
    expect(ctx.doors.length).toBeGreaterThanOrEqual(2)
    const leftDoor = ctx.doors.find((d) => d.id === 'door_front_left')
    expect(leftDoor).toBeDefined()
    expect(leftDoor!.widthMetres).toBeCloseTo(1.1, 2)
    // Includes window opening up to roof - 0.05 (1.45 - 0.30 = 1.15)
    expect(leftDoor!.heightMetres).toBeGreaterThan(1.0)

    expect(ctx.seats).toHaveLength(5)
    const driver = ctx.seats.find((s) => s.id === 'driver')!
    expect(driver.role).toBe('driver')
    expect(driver.hipPoint[1]).toBeCloseTo(0.49, 2)
    // Roof underside at ~1.46 - 0.49 = ~0.97 m
    expect(driver.headroomMetres).toBeGreaterThan(0.95)
    expect(driver.headroomMetres).toBeLessThan(1.0)
    // Firewall back face at 0.70 - 0.0 = 0.70 m
    expect(driver.legroomMetres).toBeGreaterThan(0.68)
    expect(driver.legroomMetres).toBeLessThan(0.73)
    // Lateral room: left wall at -0.72 (0.34 m) + half-gap to passenger at +0.38 (0.38 m) = 0.72 m
    expect(driver.widthMetres).toBeGreaterThan(0.65)
    expect(driver.doorId).toBe('door_front_left')

    kit.dispose(ctx)
  })

  it('preserves explicit open seats (bikes/quads) with Infinity clearances and no doorId', () => {
    const kit = makeKit()
    kit.register({ key: 'test_bike', group: 'motorcycles' }, (c) => {
      c.meta.kind = 'bike'
      c.roundBox(1.8, 0.5, 0.4, 0.05, c.paint('#222'), 0, 0.55, 0)
      c.addSeat({
        id: 'rider',
        role: 'rider',
        hipPoint: [-0.2, 0.82, 0],
        headroomMetres: Number.POSITIVE_INFINITY,
        legroomMetres: Number.POSITIVE_INFINITY,
        widthMetres: Number.POSITIVE_INFINITY,
      })
    })

    const ctx = kit.build('test_bike', 'intact')
    expect(ctx.seats).toHaveLength(1)
    expect(ctx.seats[0]).toEqual({
      id: 'rider',
      role: 'rider',
      hipPoint: [-0.2, 0.82, 0],
      headroomMetres: Number.POSITIVE_INFINITY,
      legroomMetres: Number.POSITIVE_INFINITY,
      widthMetres: Number.POSITIVE_INFINITY,
    })
    expect(ctx.doors).toEqual([])
    kit.dispose(ctx)
  })

  it('transforms sideways bench seats (face +z / -z) into vehicle coordinates', () => {
    const kit = makeKit()
    kit.register({ key: 'test_troop', group: 'military' }, (c, k) => {
      c.meta.kind = 'truck'
      k.seat(c, -1.0, 0.9, -0.8, { w: 1.5, h: 0.4, n: 3, face: '+z', role: 'cargo' })
    })

    const ctx = kit.build('test_troop', 'intact')
    expect(ctx.seats).toHaveLength(3)
    const xs = ctx.seats.map((s) => s.hipPoint[0]).sort((a, b) => a - b)
    expect(xs[0]).toBeCloseTo(-1.5, 2)
    expect(xs[1]).toBeCloseTo(-1.0, 2)
    expect(xs[2]).toBeCloseTo(-0.5, 2)
    for (const s of ctx.seats) {
      expect(s.hipPoint[2]).toBeCloseTo(-0.8, 2)
      expect(s.role).toBe('cargo')
    }
    kit.dispose(ctx)
  })
})
