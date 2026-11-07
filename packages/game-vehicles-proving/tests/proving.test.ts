import { describe, expect, it } from 'vitest'

import { certify, createProvingTests, gateVehicles, runTest, startRun, subjectFromCard, withResult } from '../src'
import type { ProvingCertificate } from '../src'

// cards of the kit's fleet (game-vehicles-fleet data), written out so the core is tested without its content pack
const hatch = subjectFromCard('compact_hatch', { stats: { acceleration: 7, handling: 7, maxSpeedKmh: 170 }, dims: { length: 4.212, width: 1.919, height: 1.472 }, group: 'cars', mass: 1034 })
const bus = subjectFromCard('city_bus', { stats: { acceleration: 5, handling: 4, maxSpeedKmh: 90 }, dims: { length: 12.741, width: 2.92, height: 3.4 }, group: 'heavy', mass: 12000 })
const pickup = subjectFromCard('midsize_pickup', { stats: { acceleration: 7, handling: 6, maxSpeedKmh: 180 }, dims: { length: 5.339, width: 2.022, height: 2.029 }, group: 'pickups', mass: 2000, fourWheelDrive: true })
const speedboat = subjectFromCard('speedboat', { stats: { acceleration: 7, handling: 6, maxSpeedKmh: 85 }, dims: { length: 8.023, width: 2.65, height: 2.122 }, group: 'water' })
const tests = createProvingTests()

describe('subjects from a card', () => {
  it('reads the ratings, the size and the domain, and estimates what the card does not say', () => {
    expect(hatch.domain).toBe('land')
    expect(hatch.category).toBe('cars')
    expect(hatch.stats.maxSpeedKmh).toBe(170)
    expect(speedboat.domain).toBe('water')
    expect(speedboat.body.mass).toBeGreaterThan(1000)
    expect(hatch.body.wheelbase).toBeCloseTo(2.53, 2)
    expect(pickup.body.fourWheelDrive).toBe(true)
  })
})

describe('measured tests', () => {
  it('a hatch reaches 100 km/h, tops out near its card and stops from 100 km/h like a real car', () => {
    const accel = runTest(tests.get('accel_0_100')!, hatch)
    expect(accel.verdict).toBe('pass')
    expect(accel.value).toBeGreaterThan(6)
    expect(accel.value).toBeLessThan(14)
    const top = runTest(tests.get('top_speed')!, hatch)
    expect(Math.abs((top.value ?? 0) - 170)).toBeLessThan(17)
    const brake = runTest(tests.get('brake_100_0')!, hatch)
    expect(brake.value).toBeGreaterThan(30)
    expect(brake.value).toBeLessThan(50)
    const wet = runTest(tests.get('wet_brake_80_0')!, hatch)
    expect(wet.verdict).toBe('pass')
  })

  it('turns a car in about ten metres', () => {
    const circle = runTest(tests.get('turn_circle')!, hatch)
    expect(circle.value).toBeGreaterThan(7)
    expect(circle.value).toBeLessThan(13.5)
  })

  it('lowers the target speed of a slow vehicle and says so', () => {
    const accel = runTest(tests.get('accel_0_100')!, bus)
    expect(accel.note).toMatch(/target 72 km\/h/)
  })

  it('a four-wheel drive gets through the mud and a two-wheel drive sinks', () => {
    expect(runTest(tests.get('mud_traction')!, pickup).value).toBeGreaterThan(10)
    expect(runTest(tests.get('mud_traction')!, hatch).value).toBeLessThan(5)
  })

  it('steps live with the frame and keeps a trace for the chart', () => {
    const run = startRun(tests.get('accel_0_100')!, hatch)
    run.step(1)
    expect(run.done).toBe(false)
    expect(run.result().verdict).toBe('pending')
    expect(run.driver.state.u).toBeGreaterThan(1)
    for (let i = 0; i < 40 && !run.done; i++) run.step(0.5)
    expect(run.done).toBe(true)
    expect(run.trace.length).toBeGreaterThan(20)
  })

  it('tells what the procedure asks of the controls, so the host plays a brake test on the brakes', () => {
    const run = startRun(tests.get('brake_100_0')!, hatch)
    expect(run.input).toEqual({ throttle: 0, brake: 0, steer: 0, handbrake: false })
    run.step(1)
    expect(run.input.throttle).toBe(1)
    expect(run.input.brake).toBe(0)
    for (let i = 0; i < 80 && run.input.brake === 0 && !run.done; i++) run.step(0.25)
    expect(run.input.brake).toBe(1)
    expect(run.input.throttle).toBe(0)
  })
})

describe('certificates and the gate', () => {
  it('keeps a land vehicle pending until a person signs the visual checks and the later rooms report', () => {
    const cert = certify(hatch, { tests })
    expect(cert.status).toBe('pending')
    expect(cert.results.find((r) => r.test === 'cabin')?.verdict).toBe('pending')
    expect(cert.results.filter((r) => r.kind === 'measured').every((r) => r.verdict === 'pass')).toBe(true)
  })

  it('approves when every check passes and rejects when one fails', () => {
    const only = createProvingTests({ remove: ['terrain', 'wind_tunnel', 'crash_test', 'pedestrian', 'performance'] })
    const signOffs = ['cabin', 'cameras', 'mirrors'].map((test) => ({ vehicle: 'compact_hatch', test, ok: true, by: 'Anderson', evidence: 'shots/cabin.png' }))
    const cert = certify(hatch, { tests: only, signOffs })
    expect(cert.status).toBe('approved')
    const refused = withResult(cert, { test: 'mirrors', kind: 'visual', unit: '', range: {}, value: null, verdict: 'fail' })
    expect(refused.status).toBe('rejected')
  })

  it('leaves water and air vehicles pending until their rooms exist', () => {
    const boat = certify(speedboat, { tests })
    expect(boat.status).toBe('pending')
    expect(boat.results.some((r) => r.test === 'buoyancy')).toBe(true)
    expect(boat.results.some((r) => r.test === 'accel_0_100')).toBe(false)
  })

  it('lets only approved vehicles into a game, with its own allow and deny lists', () => {
    const cert = (vehicle: string, status: ProvingCertificate['status']): ProvingCertificate => ({ vehicle, domain: 'land', category: 'cars', status, results: [] })
    const certs = [cert('a', 'approved'), cert('b', 'rejected'), cert('c', 'pending')]
    expect(gateVehicles(['a', 'b', 'c', 'd'], certs)).toEqual(['a'])
    expect(gateVehicles(['a', 'b', 'c', 'd'], certs, { allowPending: true })).toEqual(['a', 'c', 'd'])
    expect(gateVehicles(['a', 'b', 'c'], certs, { allow: ['b'], deny: ['a'] })).toEqual(['b'])
  })

  it('lets a game replace the ranges and add its own tests', () => {
    const strict = createProvingTests({ ranges: { turnCircle: { default: [7, 8] } }, packs: [{ tests: [{ id: 'horn', kind: 'visual', domains: ['land'], unit: '' }] }] })
    expect(runTest(strict.get('turn_circle')!, hatch).verdict).toBe('fail')
    expect(strict.forDomain('land').some((t) => t.id === 'horn')).toBe(true)
  })
})
