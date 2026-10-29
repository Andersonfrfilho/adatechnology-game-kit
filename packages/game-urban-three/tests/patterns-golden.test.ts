import { hashText, snapshotScene } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { createUrban } from '@adatechnology/game-urban'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createUrbanThree } from '../src'
import { fakeDocument } from './fake-dom'
import goldenFile from './fixtures/team-golden/urban-patterns.json'

const golden = goldenFile as unknown as GoldenRecord
type Event = { type: string; data: Record<string, unknown> }
const events = golden.events as unknown as Event[]
const eventOf = (type: string): Event['data'] => {
  const found = events.find((event) => event.type === type)
  if (!found) throw new Error(`The golden has no ${type} event`)
  return found.data
}

const round = (list: readonly (readonly unknown[])[]): unknown[][] => list.map((entry) => entry.map((value) => (typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value)))
const itemRows = (items: readonly { x: number; y: number; z: number; width: number; height: number; depth: number; color: number; rx: number; ry: number; rz: number }[]) =>
  items.map((i) => [i.x, i.y, i.z, i.width, i.height, i.depth, i.color, i.rx, i.ry, i.rz])
const windowRows = (windows: readonly { x: number; y: number; z: number; ry: number; width: number; height: number }[]) => windows.map((w) => [w.x, w.y, w.z, w.ry, w.width, w.height])

function surfaceOf(root: any): { nodes: number; hash: string } {
  const extra: unknown[][] = []
  root.traverse((node: any) => {
    const material = node.material
    extra.push([
      node.type,
      node.castShadow ? 1 : 0,
      node.receiveShadow ? 1 : 0,
      material ? [material.type, material.roughness, material.metalness, material.flatShading ? 1 : 0, material.transparent ? 1 : 0, material.side, material.depthWrite ? 1 : 0].join(':') : '',
      node.isLight ? [node.color.getHex(), node.intensity, node.distance, node.decay, node.angle, node.penumbra].join(':') : '',
      node.count ?? '',
    ])
  })
  return { nodes: extra.length, hash: hashText(JSON.stringify(extra)) }
}

describe('the sample sheet of neighbourhood patterns against the Galeria do Vale Cinzento', () => {
  const kit = createUrban()
  const b = kit.builder({ seed: 7 })
  const sheet = kit.neighbourhoods.composeSampleSheet(b, { ground: { color: 0x1e2124, size: 500 } })
  const scene = b.scene()
  const drawn = createUrbanThree(THREE, { document: fakeDocument }).draw(scene)

  it('draws the same scene: every object, geometry, material and transform', () => {
    const expected = golden.scenes.sample_sheet
    const got = snapshotScene(drawn.root)
    expect(got.lines.length).toBe(expected?.lines.length)
    expect(got.lines).toEqual(expected?.lines)
    expect(got.hash).toBe(expected?.hash)
  })

  it('keeps the same lists of instances and windows and the same light budget left', () => {
    const lists = eventOf('lists')
    expect(scene.items.length).toBe(lists.items)
    expect(hashText(JSON.stringify(round(itemRows(scene.items))))).toBe(lists.itemsHash)
    expect(scene.windows.lit.length).toBe(lists.lit)
    expect(hashText(JSON.stringify(round(windowRows(scene.windows.lit))))).toBe(lists.litHash)
    expect(scene.windows.dark.length).toBe(lists.dark)
    expect(hashText(JSON.stringify(round(windowRows(scene.windows.dark))))).toBe(lists.darkHash)
    expect(b.lights.left).toBe(lists.lightBudgetLeft)
  })

  it('draws the same number of times from the random: the next number is the page\'s', () => {
    expect(b.random()).toBeCloseTo(eventOf('after').next as number, 2)
  })

  it('has the shadows, material surface and light settings of the page', () => {
    const surface = eventOf('surface')
    expect(surfaceOf(drawn.root)).toEqual({ nodes: surface.nodes, hash: surface.hash })
  })

  it('gives the markers of the page: place, height and the texts of the pins', () => {
    const pins = events.filter((event) => event.type === 'pin').map((event) => event.data)
    const mine = sheet.markers.map((marker) => ({ x: marker.x, y: marker.y, z: marker.z, kind: 'local', label: marker.label, detail: marker.detail }))
    const byLabel = (list: { label: unknown }[]) => [...list].sort((a, c) => String(a.label).localeCompare(String(c.label)))
    expect(byLabel(mine)).toEqual(byLabel(pins as { label: unknown }[]))
  })

  it('tells what it put in each cell', () => {
    expect(sheet.plans.map((plan) => plan.id)).toEqual(['downtown', 'suburb', 'working_class', 'historic_street', 'industrial_port', 'railway_village', 'mountain_resort', 'stilt_village', 'military', 'rural'])
    const by = Object.fromEntries(sheet.plans.map((plan) => [plan.id, plan]))
    expect(by.downtown?.buildings).toHaveLength(8)
    expect(by.downtown?.vehicles).toHaveLength(1)
    expect(by.suburb?.houses).toHaveLength(10)
    expect(by.working_class?.houses).toHaveLength(20)
    expect(by.historic_street?.houses.every((house) => house.typology === 'colonial')).toBe(true)
    expect(by.mountain_resort?.plants.every((plant) => plant.kind === 'pine')).toBe(true)
    expect(by.rural?.plants).toHaveLength(8)
  })
})
