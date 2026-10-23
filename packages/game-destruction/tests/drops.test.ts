import { describe, expect, it } from 'vitest'
import { createDestruction, fragility } from '../src'
import type { DestructibleSpec } from '../src'

const G = 9.81

/** Drop an object of `kg` from `height` metres: the landing hit the renderer reports (energy = m g h, straight down onto the lowest part). */
const drop = (spec: DestructibleSpec, kg: number, height: number, point: [number, number, number], dir: [number, number, number] = [0, -1, 0]) => {
  const w = createDestruction()
  const id = w.add(spec)
  w.hit(id, { type: 'blunt', point, direction: dir, energy: kg * G * height, radius: 0.08, source: 'fall' })
  return { w, id, status: (part: string) => w.part(id, part)!.status, cracks: (part: string) => w.part(id, part)!.cracks.length }
}

const bottle = (): DestructibleSpec => ({
  parts: [
    { id: 'body', material: 'glass', shape: { kind: 'cylinder', radius: 0.037, height: 0.17 }, position: [0, 0.085, 0], mass: 0.3, thickness: 0.003 },
    { id: 'neck', material: 'glass', shape: { kind: 'cylinder', radius: 0.015, height: 0.09 }, position: [0, 0.215, 0], mass: 0.08, thickness: 0.002 },
  ],
  joints: [{ a: 'neck', b: 'body', kind: 'fused' }],
})
const mug = (): DestructibleSpec => ({
  parts: [{ id: 'cup', material: 'ceramic', shape: { kind: 'cylinder', radius: 0.05, height: 0.11 }, position: [0, 0.055, 0], mass: 0.3, thickness: 0.004 }],
})
const pane = (material: string): DestructibleSpec => ({
  parts: [{ id: 'pane', material, shape: { kind: 'box', size: [0.8, 1, 0.006] }, position: [0, 0.5, 0] }],
})
const block = (): DestructibleSpec => ({
  parts: [{ id: 'block', material: 'concrete', shape: { kind: 'box', size: [0.4, 0.2, 0.2] }, position: [0, 0.1, 0] }],
})

describe('drops of brittle things', () => {
  it('fragility grows with brittleness and thinness and is 1 for ductile materials', () => {
    expect(fragility(0.9, 0.001)).toBe(1)
    expect(fragility(0.02, 0.1)).toBeCloseTo(1 + (4 * 0.28) / 0.3, 5)
    expect(fragility(0.02, 0.003)).toBeGreaterThan(fragility(0.02, 0.006))
    expect(fragility(0.02, 0.006)).toBeGreaterThan(fragility(0.02, 0.02))
    expect(fragility(0.02, 1e-6)).toBeLessThanOrEqual(25 * 4.74)
  })

  it('a glass bottle (0.38 kg, 3 mm wall) shatters when dropped from 1.5 m onto concrete', () => {
    const d = drop(bottle(), 0.38, 1.5, [0, 0.0, 0])
    expect(d.status('body')).toBe('broken')
  })

  it('a ceramic mug cracks or breaks from 1.5 m, and just a bump from 0.2 m does not break it', () => {
    const d = drop(mug(), 0.34, 1.5, [0, 0, 0])
    expect(d.status('cup') === 'broken' || d.cracks('cup') > 0).toBe(true)
    expect(drop(mug(), 0.34, 0.2, [0, 0, 0]).status('cup')).not.toBe('broken')
  })

  it('a glass pane (12 kg) breaks when dropped flat from 1 m, tempered glass survives 0.5 m', () => {
    expect(drop(pane('glass'), 12, 1, [0, 0.5, -0.1], [0, 0, 1]).status('pane')).toBe('broken')
    expect(drop(pane('tempered_glass'), 12, 0.5, [0, 0.5, -0.1], [0, 0, 1]).status('pane')).not.toBe('broken')
  })

  it('a concrete block never breaks from a drop', () => {
    for (const h of [1, 3, 10]) expect(drop(block(), 36.8, h, [0, 0, 0]).status('block')).not.toBe('broken')
  })
})
