import { describe, expect, it } from 'vitest'

import { structureLayer } from '../src'
import { engine } from './support'

type Call = [string, ...unknown[]]

function fakeContext(plan: unknown, floor = 0) {
  const calls: Call[] = []
  const hits: string[] = []
  const g = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { calls.push([name, ...args]) }, set: () => true }) as unknown as CanvasRenderingContext2D
  return {
    calls, hits,
    context: {
      g, plan, floor, all: false, scale: 40, X: (u: number) => u * 40, Z: (v: number) => v * 40,
      rect: (...args: unknown[]) => { calls.push(['rect', ...args]) },
      hit: (_rect: unknown, text: string) => { hits.push(text) },
    },
  }
}

describe('the structure layer of the 2D viewer', () => {
  it('is registered once with the engine and starts hidden', () => {
    expect(engine.viewerLayers.filter((layer) => layer.id === 'structure')).toHaveLength(1)
    expect(structureLayer.defaultOn).toBe(false)
  })

  it('draws concrete pillars filled and wood posts hollow, beams dashed', () => {
    const plan: any = engine.generate('single_storey_a', { seed: 1, state: 'normal' })
    const { calls, hits, context } = fakeContext(plan)
    structureLayer.draw(context as never)
    const rects = calls.filter((call) => call[0] === 'rect')
    expect(rects.some((call) => call[2] !== null && call[3] === null)).toBe(true)
    expect(calls.some((call) => call[0] === 'setLineDash')).toBe(true)
    expect(hits.some((text) => text.startsWith('column_0_0 · column · concrete'))).toBe(true)
  })

  it('draws a timber plan with hollow posts', () => {
    const plan: any = engine.generate('single_storey_a', { seed: 1, state: 'normal', construction: 'wood_frame' })
    const { calls, context } = fakeContext(plan)
    structureLayer.draw(context as never)
    expect(calls.filter((call) => call[0] === 'rect' && call[2] === null && call[3] !== null && call[4] === 2).length).toBeGreaterThan(0)
  })

  it('shows the trusses or rafters only on the top storey and the porch posts with their own footings', () => {
    const plan: any = engine.generate('townhouse', { seed: 1, state: 'normal' })
    const ground = fakeContext(plan, 0)
    const top = fakeContext(plan, 1)
    structureLayer.draw(ground.context as never)
    structureLayer.draw(top.context as never)
    const strokes = (calls: Call[]) => calls.filter((call) => call[0] === 'stroke').length
    expect(strokes(top.calls)).toBeGreaterThan(strokes(ground.calls))
  })

  it('the legend lists what is drawn, by key of the ui locale', () => {
    const plan: any = engine.generate('townhouse', { seed: 1, state: 'normal' })
    const labels = structureLayer.legend!(plan).map((entry) => entry.label)
    expect(labels).toContain('structure_column_concrete')
    expect(labels).toContain('structure_beam_concrete')
    expect(labels).toContain('structure_roof_frame')
    for (const key of labels) expect(engine.translate('ui', key, 'pt-BR')).not.toBe(key)
    expect(engine.translate('ui', 'structure_layer', 'en')).toBe('Structure')
  })

  it('draws nothing for a plan without structure', () => {
    const { calls, context } = fakeContext({ rooms: [] })
    structureLayer.draw(context as never)
    expect(calls).toEqual([])
  })
})
