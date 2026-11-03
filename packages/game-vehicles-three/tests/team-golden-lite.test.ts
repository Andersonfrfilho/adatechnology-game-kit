import { defaultVehicleFleet } from '@adatechnology/game-kit-defaults'
import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createVehicleKit, legacyZoneId } from '@adatechnology/game-vehicles'
import { installFleet, legacyVehicleSeeds } from '@adatechnology/game-vehicles-fleet'
import { createVehiclesThree } from '../src'
import { fakeDocument } from './fake-dom'
import golden from './fixtures/team-golden/lite.json'

/* the builds are long synchronous loops: let the worker report between tests */
afterEach(() => new Promise((resolve) => setImmediate(resolve)))

/** Where `tools/vehicles-catalog/src/record-lite.ts` ran the team's Frota Leve (three r160, seed 7); the same names in English here. */
const CLASS_NAMES: Record<string, string> = { pintura: 'paint', acabamento: 'trim', metal: 'metal', vidro: 'glass', luz: 'light', placa: 'plate' }
const MATERIALS: Record<string, string> = { metal: 'metal', vidro: 'glass', borracha: 'rubber', combustivel: 'fuel' }
const PARTS: Record<string, string> = { porta: 'door', capo: 'hood', tampa: 'lid', parachoque: 'bumper', parabrisa: 'windshield', janela: 'window', lanterna: 'taillight', farol: 'headlight', roda: 'wheel', tanque: 'fuel_tank' }
const SIDES: Record<string, string> = { centro: 'center', esquerdo: 'left', direito: 'right' }

const round = (x: number): number => Math.round(x * 1e4) / 1e4

function fnv(values: ArrayLike<number>): string {
  let h = 2166136261
  for (let i = 0; i < values.length; i++) {
    const v = Math.round(values[i] * 1e4)
    h ^= v & 0xffff
    h = Math.imul(h, 16777619)
    h ^= (v >> 16) & 0xffff
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

const kit = createVehicleKit({ THREE, document: fakeDocument, locale: 'pt-BR' })
installFleet(kit)
const vehicles = createVehiclesThree(THREE, { kit, fleet: defaultVehicleFleet() })
const idOf = (pageKey: string): string => Object.keys(legacyVehicleSeeds).find((id) => legacyVehicleSeeds[id] === pageKey) as string
const entries = Object.entries(golden.vehicles as Record<string, any>)

describe('team golden: Frota Leve, light and high quality', () => {
  it.each(entries)('%s has the same triangles, draw calls, size and colour as the page', (name, want) => {
    const [pageKey, quality] = name.split(':') as [string, 'lite' | 'high']
    const built = vehicles.build(idOf(pageKey), { quality, seed: golden.seed })
    expect(built.color).toBe(want.color)
    expect(built.triangles, 'triangles').toBe(want.tris)
    expect(built.drawCalls, 'draw calls').toBe(want.drawCalls)
    expect([built.length, built.width, built.height]).toEqual([want.L, want.W, want.H])
    expect(built.pruned, 'pruned pieces').toBe(want.pruned)
    built.dispose()
  })

  it.each(entries.filter(([name]) => name.endsWith(':lite')))('%s fuses into the same six classes with the same vertices', (name, want) => {
    const built = vehicles.build(idOf(name.split(':')[0] as string), { quality: 'lite', seed: golden.seed })
    const got: Record<string, unknown> = {}
    built.group.traverse((m: any) => {
      if (m.isMesh) got[m.name] = { vertices: m.geometry.attributes.position.count, indices: m.geometry.index.count, hash: fnv(m.geometry.attributes.position.array) }
    })
    const expected = Object.fromEntries(Object.entries(want.classes as Record<string, unknown>).map(([cls, value]) => [CLASS_NAMES[cls], value]))
    expect(got).toEqual(expected)
    built.dispose()
  })

  it.each(entries)('%s lists the same damageable boxes as the page', (name, want) => {
    const [pageKey, quality] = name.split(':') as [string, 'lite' | 'high']
    const built = vehicles.build(idOf(pageKey), { quality, seed: golden.seed })
    const vehicle = built.context ?? (kit.build(idOf(pageKey), 'intact') as any)
    const zones = new Map<string, string>((vehicle.zones as any[]).map((z) => [z.id, legacyZoneId(z)]))
    const got = built.damageables.map((d) => ({
      material: d.material,
      zone: zones.get(d.zone),
      part: d.part,
      side: d.side,
      min: [d.box.min.x, d.box.min.y, d.box.min.z].map(round),
      max: [d.box.max.x, d.box.max.y, d.box.max.z].map(round),
    }))
    const expected = (want.damageables as any[]).map((d) => ({ material: MATERIALS[d.material], zone: d.zone, part: PARTS[d.part], side: SIDES[d.side], min: d.min, max: d.max }))
    expect(got).toEqual(expected)
    built.dispose()
  })
})
