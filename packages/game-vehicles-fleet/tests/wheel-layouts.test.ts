import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { fleetProvingSubject, fleetVehicleIds, fleetWheelLayout } from '../src'
import type { FleetWheelLayout } from '../src'
import { makeFleetKit } from './helpers/kit'

/** Aircraft of the `military` group: `fleetProvingSubject` calls them land, but they have no road wheels worth a layout. */
const AIRCRAFT = ['transport_helicopter', 'light_attack_turboprop', 'attack_helicopter']
/** Wheels closer than this along x are on the same axle. */
const AXLE_GAP = 0.3
/** A road wheel of a track sits on the ground: its centre is lower than this. */
const ROAD_WHEEL_CENTRE = 0.5

const round = (value: number): number => Math.round(value * 100) / 100

interface BuiltWheel {
  readonly x: number
  readonly z: number
  readonly radius: number
}

const axlesOf = (wheels: readonly BuiltWheel[]): FleetWheelLayout => {
  const groups: BuiltWheel[][] = []
  for (const wheel of [...wheels].sort((a, b) => b.x - a.x)) {
    const group = groups.find((candidate) => Math.abs(candidate[0]!.x - wheel.x) < AXLE_GAP)
    if (group) group.push(wheel)
    else groups.push([wheel])
  }
  return {
    axles: groups.map((group) => ({
      x: round(group[0]!.x),
      track: round(Math.max(...group.map((w) => w.z)) - Math.min(...group.map((w) => w.z))),
      radius: round(group[0]!.radius),
      wheels: group.length,
    })),
  }
}

interface BuiltTrackWheel {
  readonly o: { readonly position: { readonly x: number; readonly y: number; readonly z: number }; readonly children: ReadonlyArray<{ readonly geometry?: { readonly parameters?: { readonly radiusTop?: number } } }> }
  readonly track?: boolean
}

const tracksOf = (spin: readonly BuiltTrackWheel[]): FleetWheelLayout => {
  const road = spin.filter((entry) => entry.track && entry.o.position.y < ROAD_WHEEL_CENTRE)
  const left = road.filter((entry) => entry.o.position.z > 0)
  const xs = left.map((entry) => entry.o.position.x)
  const zs = road.map((entry) => entry.o.position.z)
  return { tracks: { gauge: round(Math.max(...zs) - Math.min(...zs)), rearX: round(Math.min(...xs)), frontX: round(Math.max(...xs)), roadWheels: left.length, radius: round(left[0]!.o.children[0]!.geometry!.parameters!.radiusTop!) } }
}

const landIds = fleetVehicleIds.filter((id) => fleetProvingSubject(id)?.domain === 'land' && !AIRCRAFT.includes(id))

describe('the wheel layout of the land fleet is the one the models are built with', () => {
  const kit = makeFleetKit('en')
  const built: Record<string, FleetWheelLayout> = {}
  for (const id of landIds) {
    const vehicle = kit.build(id, 'intact') as unknown as { wheels: Array<{ position: { x: number; z: number }; userData: { r: number } }>; spin: BuiltTrackWheel[] }
    const wheels = vehicle.wheels.map((wheel) => ({ x: wheel.position.x, z: wheel.position.z, radius: wheel.userData.r }))
    built[id] = wheels.length ? axlesOf(wheels) : tracksOf(vehicle.spin)
  }

  it('is up to date', () => {
    if (process.env.UPDATE_WHEEL_LAYOUTS) writeFileSync(fileURLToPath(new URL('../src/data/wheel-layouts.json', import.meta.url)), `${JSON.stringify(built, null, 2)}\n`)
    for (const id of landIds) expect(fleetWheelLayout(id), id).toEqual(built[id])
  })

  it('has every land model and nothing else', () => {
    expect(landIds).toHaveLength(48)
    for (const id of fleetVehicleIds) expect(fleetWheelLayout(id) !== undefined, id).toBe(landIds.includes(id))
  })
})
