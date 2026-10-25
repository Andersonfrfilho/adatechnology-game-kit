import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { createUrban } from '@adatechnology/game-urban'
import type { TerrainOptions, UrbanBuilder } from '@adatechnology/game-urban'
import { exactSnapshot } from '@adatechnology/golden-tool'
import * as THREE_NS from 'three'
import { describe, expect, it } from 'vitest'

import { createPrism, createRoundedBox, createUrbanTestModule, createUrbanThree } from '../src'
import { fakeDocument } from './fake-dom'
import valley from './fixtures/valley-terrain.json'

/**
 * Every bit of the urban drawing: 28 of the part cases of the capture, the sample sheet of neighbourhoods, the valley
 * terrain, the module's items and the rounded box and prism helpers. Recorded on the old path (three's own geometry constructors) before the
 * move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = join(process.cwd(), 'tests/fixtures/exact-urban.json')

const kit = createUrban()
const pole = (id: string, b: UrbanBuilder, o: Parameters<ReturnType<typeof kit.poles.get>['build']>[1]): void => kit.poles.get(id).build(b, o)
const PARTS: Record<string, (b: UrbanBuilder) => void> = {
  led_on: (b) => pole('led_double', b, { x: 0, z: 0, on: true }),
  led_rotated: (b) => pole('led_double', b, { x: 4, z: -3, on: true, ry: 0.7 }),
  led_flicker: (b) => pole('led_double', b, { x: 0, z: 0, on: true, ry: 0, flicker: true }),
  concrete_on: (b) => pole('concrete_arm', b, { x: 0, z: 0, dir: 1, on: true }),
  concrete_off: (b) => pole('concrete_arm', b, { x: 0, z: 0, dir: 1, on: false }),
  concrete_transformer: (b) => pole('concrete_arm', b, { x: 0, z: 0, dir: 1, on: true, transformer: true }),
  iron_on: (b) => pole('cast_iron', b, { x: 0, z: 0, on: true }),
  wood_on: (b) => pole('wood_crossarm', b, { x: 0, z: 0, on: true }),
  flood_on: (b) => pole('flood_tower', b, { x: 0, z: 0, on: true }),
  road_x: (b) => kit.streets.road(b, 0, 0, 7, 60, 'x'),
  road_z: (b) => kit.streets.road(b, 10, 5, 6, 42, 'z'),
  walk: (b) => kit.streets.walk(b, 3, 4, 60, 2),
  ground: (b) => kit.streets.ground(b, 0x15181a, 500),
  street_grid: (b) => kit.streets.grid(b, { block: 36, count: 2, width: 10 }),
  block_default: (b) => void kit.block.fill(b, { cx: 0, cz: 0, size: 26, minHeight: 12, maxHeight: 36, lit: 0.05, shop: 0.5 }),
  block_three_by_three: (b) => void kit.block.fill(b, { cx: 30, cz: -20, size: 40, minHeight: 8, maxHeight: 20, k: 3, gap: 0.3, lit: 0.1 }),
  building_alone: (b) => void kit.block.building(b, 0, 0, 12, 14, 20, 0x8a8a86, { lit: 0.2, shop: 1 }),
  fence: (b) => kit.props.fence(b, 0, 0, 9, 4, 1.2, 0x5a4630),
  tent: (b) => kit.props.tent(b, 2, 3, 0.4, 6, 8),
  pine: (b) => kit.props.pine(b, 1, 2, 1.4),
  tree: (b) => kit.props.tree(b, 1, 2, 1.2),
  container: (b) => kit.props.container(b, 3, 0, 4, 0.2, 0x8a3a2a),
  watchtower_plain: (b) => kit.props.watchtower(b, 0, 0, false),
  watchtower_searchlight: (b) => kit.props.watchtower(b, 2, -3, true),
  sandbags: (b) => kit.props.sandbags(b, 0, 0, 10, 'x', 3),
  sandbags_z: (b) => kit.props.sandbags(b, 2, 1, 6, 'z', 2),
  label: (b) => kit.props.label(b, 0, 20, 'CENTRO', 'avenida 2 × 7 m · LED branco a cada 25 m'),
  wires: (b) => kit.props.wires(b, [[0, 0], [10, 2], [28, -1]], 6.9),
}

type Root = { traverse(f: (o: unknown) => void): void }
const cases: Array<[string, () => Root]> = []
{
  const THREE: any = THREE_NS
  const urban = createUrbanThree(THREE, { document: fakeDocument })
  const draw = (run: (b: UrbanBuilder) => void, seed = 7): Root => {
    const b = kit.builder({ seed, budget: 99 })
    run(b)
    return urban.draw(b.scene()).root as Root
  }
  for (const [label, run] of Object.entries(PARTS)) cases.push([`part/${label}`, () => draw(run)])
  cases.push([`patterns`, () => draw((b) => void kit.neighbourhoods.composeSampleSheet(b, { ground: { color: 0x1e2124, size: 500 } }))])
  cases.push([`terrain`, () => draw((b) => kit.drawTerrain(b, kit.terrain(valley as unknown as TerrainOptions)))])
  const module = createUrbanTestModule({ locale: 'en', document: fakeDocument })
  for (const item of module.items('en')) cases.push([`item/${item.id}`, () => item.build(THREE) as Root])
  cases.push([
    `helpers`,
    () => {
      const group = new THREE.Group()
      for (const [w, h, d, r] of [[1, 1, 1, 0], [2, 0.5, 1, 0.1], [0.4, 1.2, 0.3, 0.05]]) group.add(new THREE.Mesh(createRoundedBox(THREE, w, h, d, r)))
      for (const [w, h, d] of [[1, 1, 1], [6, 2.5, 8], [0.3, 0.2, 2]]) group.add(new THREE.Mesh(createPrism(THREE, w, h, d)))
      return group
    },
  ])
}

const recorded: Record<string, { hash: string; objects: number }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the urban drawing, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; objects: number }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, objects: nodes.length }
      }
      writeFileSync(FIXTURE, JSON.stringify(out).replace(/},"/g, '},\n"') + '\n')
    }, 900000)
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    expect({ hash: snapshot.hash, objects: snapshot.nodes.length }).toEqual(recorded[id])
  })
})
