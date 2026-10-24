import { describe, expect, it } from 'vitest'

import { createLightBudget, createUrban, DEFAULT_POLES } from '../src'
import type { UrbanPart } from '../src'

const lights = (parts: readonly UrbanPart[]) => parts.filter((part) => part.shape === 'light')

describe('light budget', () => {
  it('spends one per ask and keeps counting below zero, as the page does', () => {
    const budget = createLightBudget(2)
    expect([budget.take(), budget.take(), budget.take(), budget.take()]).toEqual([true, true, false, false])
    expect(budget.left).toBe(-2)
  })
})

describe('poles', () => {
  const kit = createUrban()

  it('ships the five poles of the Galeria', () => {
    expect(kit.poles.ids()).toEqual(['led_double', 'concrete_arm', 'cast_iron', 'wood_crossarm', 'flood_tower'])
  })

  it('a lamp that is off draws no light and spends nothing', () => {
    const b = kit.builder({ budget: 1 })
    kit.poles.get('led_double').build(b, { x: 0, z: 0, on: false })
    expect(lights(b.parts)).toHaveLength(0)
    expect(b.lights.left).toBe(1)
  })

  it('the first lamps get the real lights and the rest keep the glowing lens', () => {
    const b = kit.builder({ budget: 2 })
    for (let index = 0; index < 4; index++) kit.poles.get('cast_iron').build(b, { x: index * 10, z: 0 })
    expect(lights(b.parts)).toHaveLength(2)
    expect(b.parts.filter((part) => part.shape === 'box' && part.emissive)).toHaveLength(4)
  })

  it('heights and light colours are the numbers of the neighbourhood table', () => {
    const top = (id: string): number => {
      const b = kit.builder()
      kit.poles.get(id).build(b, { x: 0, z: 0 })
      return Math.max(...b.parts.map((part) => ('height' in part && 'y' in part ? part.y + part.height / 2 : 0)))
    }
    expect(top('led_double')).toBeCloseTo(9, 6)
    expect(top('concrete_arm')).toBeCloseTo(8, 6)
    expect(top('cast_iron')).toBeCloseTo(4.8, 6)
    expect(top('wood_crossarm')).toBeCloseTo(7, 6)
    expect(top('flood_tower')).toBeCloseTo(12.55, 6)
  })

  it('a patch changes a number and keeps the rest; a pack adds a pole; remove takes one out', () => {
    const custom = createUrban({
      patch: { poles: { led_double: { spec: { light: { distance: 40 } } } } },
      packs: { poles: [{ id: 'tall_led', shape: 'double_arm', spec: { ...(DEFAULT_POLES[0]?.spec as object), mast: { radiusTop: 0.1, radiusBottom: 0.14, height: 12, color: 0x55595e } } }] },
      remove: { poles: ['wood_crossarm'] },
    })
    expect(custom.poles.ids()).toEqual(['led_double', 'concrete_arm', 'cast_iron', 'flood_tower', 'tall_led'])
    const b = custom.builder()
    custom.poles.get('led_double').build(b, { x: 0, z: 0 })
    const light = lights(b.parts)[0]
    expect(light && 'distance' in light ? light.distance : 0).toBe(40)
    expect(light && 'intensity' in light ? light.intensity : 0).toBe(1.3)
    expect(() => custom.poles.get('wood_crossarm')).toThrow(/Unknown pole/)
  })

  it('a pole with a shape nobody registered says so, and a game can register it', () => {
    const custom = createUrban({ packs: { poles: [{ id: 'banner', shape: 'banner', spec: { height: 5 } }] } })
    expect(() => custom.poles.get('banner')).toThrow(/shape "banner"/)
    const withShape = createUrban({
      packs: { poles: [{ id: 'banner', shape: 'banner', spec: { height: 5 } }] },
      shapes: { banner: (b, spec: { height: number }, o) => b.box(o.x, 0, o.z, 0.2, spec.height, 0.2, 0xffffff) },
    })
    const b = withShape.builder()
    withShape.poles.get('banner').build(b, { x: 1, z: 2 })
    expect(b.parts).toHaveLength(1)
  })

  it('the default budget is the Galeria\'s 16 and an option changes it', () => {
    expect(createUrban().builder().lights.left).toBe(16)
    expect(createUrban({ lights: { budget: 4 } }).builder().lights.left).toBe(4)
  })
})

describe('streets and blocks', () => {
  const kit = createUrban()

  it('a road puts a dash every 5 m from 2 m after its start', () => {
    const b = kit.builder()
    kit.streets.road(b, 0, 0, 7, 60, 'x')
    expect(b.items).toHaveLength(12)
    expect(b.items[0]?.x).toBe(-28)
    expect(b.items[1]?.x).toBe(-23)
  })

  it('the street grid has 2n+1 roads each way and a walk on each of the 2n x 2n blocks', () => {
    const b = kit.builder()
    kit.streets.grid(b, { block: 36, count: 2, width: 10 })
    expect(b.parts.filter((part) => part.shape === 'plane')).toHaveLength(10)
    expect(b.parts.filter((part) => part.shape === 'box')).toHaveLength(16)
  })

  it('the same seed fills the same block and another seed another', () => {
    const fill = (seed: number) => {
      const b = kit.builder({ seed })
      return kit.block.fill(b, { cx: 0, cz: 0, size: 40, minHeight: 8, maxHeight: 30, k: 3 })
    }
    expect(fill(7)).toEqual(fill(7))
    expect(fill(7)).not.toEqual(fill(8))
  })

  it('taller buildings are rarer: heights follow lerp(min, max, random^1.6)', () => {
    const b = kit.builder({ seed: 3 })
    const placed = kit.block.fill(b, { cx: 0, cz: 0, size: 200, minHeight: 10, maxHeight: 50, k: 20, gap: 0.01 })
    const median = placed.map((p) => p.height).sort((a, c) => a - c)[Math.floor(placed.length / 2)] as number
    expect(median).toBeLessThan(30)
    expect(Math.min(...placed.map((p) => p.height))).toBeGreaterThanOrEqual(10)
    expect(Math.max(...placed.map((p) => p.height))).toBeLessThanOrEqual(50)
  })

  it('a game\'s facade palette is the one the buildings use', () => {
    const custom = createUrban({ facades: [0xff0000] })
    const b = custom.builder()
    const placed = custom.block.fill(b, { cx: 0, cz: 0, size: 30, minHeight: 5, maxHeight: 9 })
    expect(placed.every((p) => p.color === 0xff0000)).toBe(true)
  })

  it('building windows join the scene lists, lit apart from dark', () => {
    const b = kit.builder()
    kit.block.building(b, 0, 0, 12, 14, 20, 0x8a8a86, { lit: 1 })
    const scene = b.scene()
    expect(scene.windows.lit.length).toBeGreaterThan(0)
    expect(scene.windows.dark).toHaveLength(0)
  })
})
