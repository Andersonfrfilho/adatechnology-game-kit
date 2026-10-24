import { hashText, snapshotScene } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { createUrban } from '@adatechnology/game-urban'
import type { UrbanBuilder } from '@adatechnology/game-urban'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createUrbanThree } from '../src'
import { fakeDocument } from './fake-dom'
import goldenFile from './fixtures/team-golden/urban-parts.json'

const golden = goldenFile as unknown as GoldenRecord
type Event = { type: string; data: Record<string, unknown> }
const events = golden.events as unknown as Event[]

const round = (list: readonly (readonly unknown[])[]): unknown[][] => list.map((entry) => entry.map((value) => (typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value)))

/** The 34 cases of the capture (tools/golden/captures/urban-parts.js), each on a fresh builder with the page's rng(7) and a light budget of 99. */
const kit = createUrban()
const pole = (id: string, b: UrbanBuilder, o: Parameters<ReturnType<typeof kit.poles.get>['build']>[1]): void => kit.poles.get(id).build(b, o)
const CASES: Record<string, (b: UrbanBuilder) => void> = {
  led_on: (b) => pole('led_double', b, { x: 0, z: 0, on: true }),
  led_off: (b) => pole('led_double', b, { x: 0, z: 0, on: false }),
  led_rotated: (b) => pole('led_double', b, { x: 4, z: -3, on: true, ry: 0.7 }),
  led_flicker: (b) => pole('led_double', b, { x: 0, z: 0, on: true, ry: 0, flicker: true }),
  led_no_budget: (b) => {
    b.lights.left = 0
    pole('led_double', b, { x: 0, z: 0, on: true })
  },
  concrete_on: (b) => pole('concrete_arm', b, { x: 0, z: 0, dir: 1, on: true }),
  concrete_off: (b) => pole('concrete_arm', b, { x: 0, z: 0, dir: 1, on: false }),
  concrete_negative_arm: (b) => pole('concrete_arm', b, { x: 5, z: 2, dir: -1, on: true }),
  concrete_transformer: (b) => pole('concrete_arm', b, { x: 0, z: 0, dir: 1, on: true, transformer: true }),
  iron_on: (b) => pole('cast_iron', b, { x: 0, z: 0, on: true }),
  iron_off: (b) => pole('cast_iron', b, { x: 0, z: 0, on: false }),
  wood_on: (b) => pole('wood_crossarm', b, { x: 0, z: 0, on: true }),
  wood_off: (b) => pole('wood_crossarm', b, { x: 0, z: 0, on: false }),
  flood_on: (b) => pole('flood_tower', b, { x: 0, z: 0, on: true }),
  flood_off: (b) => pole('flood_tower', b, { x: 0, z: 0, on: false }),
  budget_of_two: (b) => {
    b.lights.left = 2
    pole('led_double', b, { x: 0, z: 0, on: true })
    pole('concrete_arm', b, { x: 8, z: 0, dir: 1, on: true })
    pole('cast_iron', b, { x: 16, z: 0, on: true })
    pole('wood_crossarm', b, { x: 24, z: 0, on: true })
    pole('flood_tower', b, { x: 32, z: 0, on: true })
  },
  road_x: (b) => kit.streets.road(b, 0, 0, 7, 60, 'x'),
  road_z: (b) => kit.streets.road(b, 10, 5, 6, 42, 'z'),
  walk: (b) => kit.streets.walk(b, 3, 4, 60, 2),
  ground: (b) => kit.streets.ground(b, 0x15181a, 500),
  street_grid: (b) => kit.streets.grid(b, { block: 36, count: 2, width: 10 }),
  block_default: (b) => void kit.block.fill(b, { cx: 0, cz: 0, size: 26, minHeight: 12, maxHeight: 36, lit: 0.05, shop: 0.5 }),
  block_three_by_three: (b) => void kit.block.fill(b, { cx: 30, cz: -20, size: 40, minHeight: 8, maxHeight: 20, k: 3, gap: 0.3, lit: 0.1 }),
  building_alone: (b) => void kit.block.building(b, 0, 0, 12, 14, 20, 0x8a8a86, { lit: 0.2, shop: 1 }),
  fence: (b) => kit.props.fence(b, 0, 0, 9, 4, 1.2, 0x5a4630),
  fence_default_colour: (b) => kit.props.fence(b, -3, 2, 3, 2, 0.9),
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

const eventOf = (type: string, label: string): Event['data'] => {
  const found = events.find((event) => event.type === type && event.data.label === label)
  if (!found) throw new Error(`The golden has no ${type} event for ${label}`)
  return found.data
}

/** What the scene hash does not read, collected the way the capture does: shadows, the surface of each material and the settings of each light. */
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

const itemRows = (items: readonly { x: number; y: number; z: number; width: number; height: number; depth: number; color: number; rx: number; ry: number; rz: number }[]) =>
  items.map((i) => [i.x, i.y, i.z, i.width, i.height, i.depth, i.color, i.rx, i.ry, i.rz])
const windowRows = (windows: readonly { x: number; y: number; z: number; ry: number; width: number; height: number }[]) => windows.map((w) => [w.x, w.y, w.z, w.ry, w.width, w.height])

describe('the urban parts against the Galeria do Vale Cinzento', () => {
  const urban = createUrbanThree(THREE, { document: fakeDocument })

  it('covers every case the capture recorded', () => {
    expect(Object.keys(CASES).sort()).toEqual(Object.keys(golden.scenes).sort())
  })

  for (const [label, run] of Object.entries(CASES)) {
    it(`${label}: the scene, its lists and its surface are the team's`, () => {
      const builder = kit.builder({ seed: 7, budget: 99 })
      run(builder)
      const scene = builder.scene()
      const lists = eventOf('lists', label)
      expect(scene.items.length).toBe(lists.items)
      expect(hashText(JSON.stringify(round(itemRows(scene.items))))).toBe(lists.itemsHash)
      expect(scene.windows.lit.length).toBe(lists.lit)
      expect(hashText(JSON.stringify(round(windowRows(scene.windows.lit))))).toBe(lists.litHash)
      expect(scene.windows.dark.length).toBe(lists.dark)
      expect(hashText(JSON.stringify(round(windowRows(scene.windows.dark))))).toBe(lists.darkHash)
      expect(builder.lights.left).toBe(lists.lightBudgetLeft)

      const drawn = urban.draw(scene)
      const expected = golden.scenes[label]
      const got = snapshotScene(drawn.root)
      expect(got.lines).toEqual(expected?.lines)
      expect(got.hash).toBe(expected?.hash)
      const surface = eventOf('surface', label)
      expect(surfaceOf(drawn.root)).toEqual({ nodes: surface.nodes, hash: surface.hash })
    })
  }
})

describe('animation and cleanup', () => {
  const urban = createUrbanThree(THREE, { document: fakeDocument })

  it('a flickering lamp dips its light on the beats of the page formula', () => {
    const builder = kit.builder({ budget: 99 })
    pole('led_double', builder, { x: 4, z: 0, on: true, flicker: true })
    const drawn = urban.draw(builder.scene())
    const light = drawn.lights[0]
    const seen = new Set<number>()
    for (let t = 0; t < 10; t += 0.05) {
      drawn.animate(t)
      seen.add(light.intensity)
    }
    expect([...seen].sort()).toEqual([1.3 * 0.15, 1.3].sort())
  })

  it('the searchlight target circles the tower', () => {
    const builder = kit.builder()
    kit.props.watchtower(builder, 2, -3, true)
    const drawn = urban.draw(builder.scene())
    const spot = drawn.lights[0]
    drawn.animate(0)
    expect(spot.target.position.x).toBeCloseTo(2 + Math.sin(2) * 25, 6)
    expect(spot.target.position.z).toBeCloseTo(-3 + Math.cos(2) * 25, 6)
  })

  it('draws into a group the caller gives and takes it off on dispose', () => {
    const builder = kit.builder()
    kit.streets.road(builder, 0, 0, 7, 20, 'x')
    const scene = new THREE.Group()
    const root = new THREE.Group()
    scene.add(root)
    const drawn = urban.draw(builder.scene(), { root })
    expect(drawn.root).toBe(root)
    drawn.dispose()
    expect(scene.children.length).toBe(0)
  })

  it('asks for a document only when a sign needs one', () => {
    const noDocument = createUrbanThree(THREE)
    const builder = kit.builder()
    kit.streets.road(builder, 0, 0, 7, 20, 'x')
    expect(() => noDocument.draw(builder.scene())).not.toThrow()
    const labelled = kit.builder()
    kit.props.label(labelled, 0, 0, 'A', 'B')
    expect(() => noDocument.draw(labelled.scene())).toThrow(/document/)
  })
})
