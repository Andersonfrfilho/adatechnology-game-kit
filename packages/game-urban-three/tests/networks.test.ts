import { createLightBudget } from '@adatechnology/game-render-three'
import { DEFAULT_POLES, lampStateOf } from '@adatechnology/game-urban'
import type { CityPlanInput, DistributionSpec } from '@adatechnology/game-urban'
import { generateNetworks, poleHeightsOf } from '@adatechnology/game-urban/networks'
import type { NetworkLot } from '@adatechnology/game-urban/networks'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createUrbanThree } from '../src'
import { indexOf, poleFramesOf } from '../src/networks/pole-frames'
import { wireRunsOf } from '../src/networks/wire-runs'
import { fakeDocument } from './fake-dom'

/** A cut like the reference district's: a main street cut by a river, a cross street, the centre west and the periphery east. */
const PLAN: CityPlanInput = {
  id: 'network_cut',
  scale: 'town',
  size: [445, 270],
  districts: [
    { id: 'centre', kind: 'mixed', rect: [-220, -120, -40, 120] },
    { id: 'periphery', kind: 'residential_popular', rect: [0, -135, 225, 135] },
  ],
  lines: [
    { id: 'main_street', kind: 'street', width: 10, points: [[-220, 0], [225, 0]] },
    { id: 'crossing_street', kind: 'street', width: 10, points: [[-100, -120], [-100, 120]] },
    { id: 'river', kind: 'river', width: 30, points: [[-20, -135], [-20, 135]] },
  ],
}
const row = (prefix: string, z0: number, z1: number, xs: readonly number[]): NetworkLot[] => xs.slice(1).map((x, index) => ({ id: `${prefix}_${index + 1}`, rect: [xs[index] as number, z0, x, z1] }))
const LOTS: readonly NetworkLot[] = [
  ...row('north', -32.5, -7.5, [50, 62, 74, 86, 98, 110]),
  ...row('south', 7.5, 32.5, [50, 62, 74, 86, 98, 110]),
  { id: 'centre_pharmacy', rect: [-150, -37.5, -124, -7.5] },
  { id: 'centre_church', rect: [-150, 70, -120, 100] },
]
const generated = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11 })
const { networks } = generated
const spec = DEFAULT_POLES.find((pole) => pole.id === 'concrete_distribution')!.spec as DistributionSpec
const heights = poleHeightsOf(spec.slots)
const index = indexOf(networks)
const frames = new Map(poleFramesOf({ networks, index, specOf: () => spec }).map((frame) => [frame.id, frame]))
const runs = new Map(wireRunsOf({ frames, index }, networks.edges).map((run) => [run.id, run]))
const three = createUrbanThree(THREE, { document: fakeDocument })
const ends = (id: string): Array<readonly [readonly number[], readonly number[]]> => runs.get(id)!.conductors.map((points) => [points[0]!, points[points.length - 1]!])

describe('drawNetworks: the conductors hang from the slots of the poles', () => {
  it('a medium-voltage span leaves and reaches the tops of the insulators, three phases', () => {
    const spans = networks.edges.filter((edge) => edge.kind === 'mv_span' && frames.has(edge.from) && frames.has(edge.to))
    expect(spans.length).toBeGreaterThan(3)
    for (const edge of spans) {
      expect(ends(edge.id).length, edge.id).toBe(3)
      for (const [from, to] of ends(edge.id)) {
        expect(from[1], edge.id).toBeCloseTo(spec.slots.bands.mv[1], 6)
        expect(to[1], edge.id).toBeCloseTo(spec.slots.bands.mv[1], 6)
      }
    }
  })

  it('the low voltage is one cable in the clamp of its band at both poles', () => {
    for (const edge of networks.edges.filter((item) => item.kind === 'lv_span' && frames.has(item.from) && frames.has(item.to))) {
      expect(ends(edge.id).length).toBe(1)
      const [[from, to]] = ends(edge.id) as [readonly [readonly number[], readonly number[]]]
      expect(from[1]).toBeCloseTo(heights.lv, 6)
      expect(to[1]).toBeCloseTo(heights.lv, 6)
      for (const y of [from[1]!, to[1]!]) expect(y >= spec.slots.bands.lv[0] && y <= spec.slots.bands.lv[1]).toBe(true)
    }
  })

  it('each telecom cable has its own clamp in the telecom band, the first on top', () => {
    const spans = networks.edges.filter((item) => item.kind === 'telecom_span' && frames.has(item.from) && frames.has(item.to))
    expect(spans.some((edge) => (edge.conductors ?? 1) >= 3), 'a bundle in the periphery').toBe(true)
    for (const edge of spans) {
      const cables = ends(edge.id)
      expect(cables.length).toBe(edge.conductors ?? 1)
      cables.forEach(([from], k) => {
        expect(from[1]).toBeCloseTo(heights.telecom - k * networks.rules.layout.telecom.cableGap, 6)
        expect(from[1]! >= spec.slots.bands.telecom[0] - 1e-9 && from[1]! <= spec.slots.bands.telecom[1] + 1e-9).toBe(true)
      })
    }
  })

  it('a drop runs from the pole\'s low-voltage clamp to the lot\'s anchor', () => {
    const drops = networks.edges.filter((edge) => edge.kind === 'service_drop')
    expect(drops.length).toBe(LOTS.length)
    for (const edge of drops) {
      const [[from, to]] = ends(edge.id) as [readonly [readonly number[], readonly number[]]]
      const anchor = index.nodes.get(edge.to)!.at
      expect(from[1]).toBeCloseTo(heights.lv, 6)
      expect(to).toEqual(anchor)
    }
  })
})

describe('drawNetworks: merged meshes, budget and lamps', () => {
  const triangles = (root: THREE.Object3D): number => {
    let count = 0
    root.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh || !mesh.visible) return
      const per = (mesh.geometry.index?.count ?? mesh.geometry.attributes.position!.count) / 3
      count += per * ((mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1)
    })
    return count
  }

  it('the index ranges of the spans cover each class\'s mesh once, tubes and far lines', () => {
    const drawn = three.drawNetworks(networks)
    const meshes = new Map<string, THREE.BufferGeometry>()
    drawn.root.traverse((node) => {
      if (node.name.startsWith('network:') && (node as THREE.Mesh).geometry) meshes.set(node.name, (node as THREE.Mesh).geometry)
    })
    const check = (ranges: Array<readonly [number, number]>, total: number): void => {
      const sorted = [...ranges].sort((a, b) => a[0] - b[0])
      let at = 0
      for (const [start, count] of sorted) {
        expect(start).toBe(at)
        expect(count).toBeGreaterThan(0)
        at += count
      }
      expect(at).toBe(total)
    }
    const spans = [...drawn.spans.values()]
    for (const wireClass of new Set(spans.map((span) => span.wireClass))) check(spans.filter((span) => span.wireClass === wireClass).map((span) => span.near), meshes.get(`network:${wireClass}`)!.index!.count)
    check(spans.map((span) => span.far), meshes.get('network:far')!.index!.count)
    for (const edge of networks.edges.filter((item) => ['mv_span', 'lv_span', 'telecom_span', 'service_drop', 'telecom_drop'].includes(item.kind))) expect(drawn.spans.has(edge.id), edge.id).toBe(true)
    drawn.dispose()
  })

  it('draws the whole cut in at most 25 calls and 20 000 triangles near, its far level in at most 8', () => {
    const drawn = three.drawNetworks(networks, { surfaceAt: generated.surfaceAt })
    expect(drawn.drawCalls().near).toBeLessThanOrEqual(25)
    expect(drawn.drawCalls().far).toBe(0)
    expect(triangles(drawn.root)).toBeLessThanOrEqual(20000)
    drawn.setFocus(150, 0)
    const { near, far } = drawn.drawCalls()
    expect(near).toBeLessThanOrEqual(25)
    expect(far).toBeGreaterThan(0)
    expect(far).toBeLessThanOrEqual(8)
    const tubes = drawn.root.getObjectByName('network:mv') as THREE.Mesh
    const index = tubes.geometry.index!.array as Uint32Array
    const west = [...drawn.spans.entries()].find(([, span]) => span.wireClass === 'mv' && (index.subarray(span.near[0], span.near[0] + span.near[1]).every((value) => value === 0)))
    expect(west, 'a span far from the focus is hidden in the tubes').toBeDefined()
    drawn.dispose()
  })

  it('every lamp keeps the state of #470 by the seed and its place, and only the lit ones take a light of the budget', () => {
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 16, spot: 0, pointShadows: 0 })
    const lit = createUrbanThree(THREE, { document: fakeDocument, lights: budget, physicalLights: true })
    const shares = { lit: 0.7, flicker: 0.2 }
    const drawn = lit.drawNetworks(networks, { isNight: true, lamps: shares })
    const lights = networks.nodes.filter((node) => node.kind === 'light')
    expect(drawn.lamps.length).toBe(lights.length)
    for (const lamp of drawn.lamps) expect({ on: lamp.on, flicker: lamp.flicker }).toEqual(lampStateOf({ seed: networks.seed, x: lamp.at[0], z: lamp.at[2], shares }))
    expect(drawn.lamps.some((lamp) => !lamp.on) && drawn.lamps.some((lamp) => lamp.flicker)).toBe(true)
    expect(drawn.lights.length).toBe(drawn.lamps.filter((lamp) => lamp.on).length)
    expect(budget.stats().sources).toBe(drawn.lights.length)
    drawn.animate(0.37)
    drawn.dispose()
    expect(budget.stats().sources).toBe(0)
    const day = lit.drawNetworks(networks, { isNight: false })
    expect(day.lights.length).toBe(0)
    day.dispose()
  })

  it('a guy anchors on the sidewalk only', () => {
    const drawn = three.drawNetworks(networks, { surfaceAt: generated.surfaceAt })
    const guys = [...drawn.spans.keys()].filter((id) => id.startsWith('guy:'))
    expect(guys.length).toBeGreaterThan(0)
    const tubes = drawn.root.getObjectByName('network:guys') as THREE.Mesh
    const position = tubes.geometry.attributes.position!
    for (let vertex = 0; vertex < position.count; vertex++) if (position.getY(vertex) < 0.05) expect(generated.surfaceAt(position.getX(vertex), position.getZ(vertex))).toBe('sidewalk')
    drawn.dispose()
  })
})

describe('the light columns of an underground street', () => {
  const generated = generateNetworks({ plan: PLAN, lots: LOTS, seed: 11, power: { districts: { centre: 'underground' } } })
  const columns = generated.networks.nodes.filter((node) => node.kind === 'pole' && node.carries.length === 1 && node.carries[0] === 'lighting')

  it('stands each column with its arm and lamp and no clamp of a conductor', () => {
    const frames = poleFramesOf({ networks: generated.networks, index: indexOf(generated.networks), specOf: () => DEFAULT_POLES.find((pole) => pole.id === 'concrete_distribution')!.spec as DistributionSpec })
    const own = frames.filter((frame) => columns.some((column) => column.id === frame.id))
    expect(own.length).toBe(columns.length)
    for (const frame of own) {
      expect(frame.hardware.boxes.some((box) => box.role === 'lv_clamp' || box.role === 'telecom_clamp' || box.role === 'crossarm')).toBe(false)
      expect(frame.hardware.lens).toBeDefined()
    }
  })

  it('darkens the lamps an outage cuts and lights them again when the power comes back', () => {
    const budget = createLightBudget(THREE, new THREE.Scene(), { point: 16, spot: 0, pointShadows: 0 })
    const drawn = createUrbanThree(THREE, { document: fakeDocument, lights: budget }).drawNetworks(generated.networks, { isNight: true })
    const lenses = drawn.root.getObjectByName('network:lenses') as THREE.InstancedMesh
    const lit = drawn.lamps.filter((lamp) => lamp.on && columns.some((column) => lamp.pole === column.id)).map((lamp) => lamp.id)
    expect(lit.length).toBeGreaterThan(0)
    const before = Array.from(lenses.instanceColor!.array)
    drawn.setLampsPowered(lit, false)
    expect(Array.from(lenses.instanceColor!.array)).not.toEqual(before)
    drawn.setLampsPowered(lit, true)
    expect(Array.from(lenses.instanceColor!.array)).toEqual(before)
    drawn.dispose()
  })
})
