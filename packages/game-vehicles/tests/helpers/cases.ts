import * as THREE from 'three'
import type { VehicleKit } from '../../src'

const V3 = THREE.Vector3

function ticks(kit: VehicleKit, c: any, n: number): void {
  for (let i = 0; i < n; i++) kit.tick(c, 1 / 30)
}

/** Interactions applied to a freshly built `proto`; the names are the keys of `tests/fixtures/golden.json`. */
export const OPERATIONS: Record<string, (kit: VehicleKit, c: any) => void> = {
  'zoneImpact front': (kit, c) => {
    kit.zoneImpact(c, 'front', 1.0)
    ticks(kit, c, 60)
    kit.settle(c, 2)
  },
  'zoneImpact rear': (kit, c) => {
    kit.zoneImpact(c, 'rear', 1.0)
    ticks(kit, c, 60)
    kit.settle(c, 2)
  },
  'zoneImpact left': (kit, c) => {
    kit.zoneImpact(c, 'left', 1.0)
    ticks(kit, c, 60)
    kit.settle(c, 2)
  },
  'zoneImpact right': (kit, c) => {
    kit.zoneImpact(c, 'right', 1.0)
    ticks(kit, c, 60)
    kit.settle(c, 2)
  },
  impact: (kit, c) => {
    kit.impact(c, new V3(1.5, 0.6, 0.3), new V3(-1, 0, -0.2), 1.1)
    kit.impact(c, new V3(0, 1.3, 0.3), new V3(0, -1, 0), 0.9)
    ticks(kit, c, 30)
  },
  'impact windshield': (kit, c) => {
    kit.impact(c, new V3(0.3, 1.2, 0.2), new V3(-1, -0.3, 0), 1.3)
  },
  explode: (kit, c) => {
    kit.explode(c, { now: true })
    ticks(kit, c, 120)
  },
  'explode delayed': (kit, c) => {
    kit.explode(c, {})
    ticks(kit, c, 400)
  },
  roll: (kit, c) => {
    kit.roll(c, 1)
    ticks(kit, c, 200)
    kit.settle(c, 1)
  },
  'roll left after hit': (kit, c) => {
    kit.zoneImpact(c, 'front', 1)
    kit.roll(c, -1)
    ticks(kit, c, 150)
  },
  hood: (kit, c) => {
    kit.setHood(c, true)
    ticks(kit, c, 60)
  },
  splat: (kit, c) => {
    kit.splat(c, new V3(1, 0.7, 0.5), new V3(0, 1, 0), 0.2, {})
    ticks(kit, c, 90)
    kit.wipe(c, 'rain')
  },
  puddle: (kit, c) => {
    kit.puddle(c, 'oil', new V3(0, 0, 1), 0.5)
    ticks(kit, c, 60)
  },
  particles: (kit, c) => {
    kit.spawn(c, 'spark', new V3(0, 1, 0), new V3(1, 1, 0))
    kit.burst(c, 'shard', new V3(0, 1, 0), 10, {})
    kit.addEmitter(c, new V3(1, 1, 0), 'black', { rate: 12 })
    ticks(kit, c, 90)
  },
  'flag burnt': (kit, c) => {
    kit.applyZones(c, { health: {}, flags: { burnt: true } })
  },
  'flag abandoned': (kit, c) => {
    kit.applyZones(c, { health: {}, flags: { abandoned: true } })
  },
  'flag flipped': (kit, c) => {
    kit.applyZones(c, { health: {}, flags: { flipped: true } })
  },
  'flags combined': (kit, c) => {
    kit.applyZones(c, { health: {}, flags: { burnt: true, abandoned: true, flipped: true } })
  },
}

/** Scenario used by the "scenario" golden case and by the plugin test. */
export function registerCaseScenario(kit: VehicleKit): void {
  kit.scenario({
    id: 'sc1',
    name: 'Scenario one',
    init: (x: any) => {
      x.limit = x.front - 0.4 * x.length
    },
    zone: (z: any, x: any) => {
      if (x.center.x > x.limit) x.set(z, 15 + x.rand() * 20)
      if (z.type === 'roof') x.set(z, 10)
      if (x.isWindshield) x.set(z, 5)
      if (z.type === 'door') x.set(z, 50 + x.rand() * 10)
      x.flags.burnt = true
    },
  })
}
