import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { generate } from '../src'
import type { PlantPiece, PlantSpec } from '../src'

/**
 * G-veg-pieces: the Viveiro artifact (newer than the site page) bundles `GameVegetation` with the geometry of every wood piece (`radius`, `length`, `axis`, `base`). Its bundle runs here
 * as the golden, and the SDK must give the same pieces for the same plants.
 */
const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(resolve(here, '../../../specs/001-migracao-entregas-dos-times/artefatos/Bs3p84TFhG1A9YfdXSGZaQ.html'), 'utf8')
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] as string)
const bundle = (head: string): string => scripts.find((s) => s.startsWith(head)) as string
const teamEngine = new Function(`${bundle('/* @adatechnology/game-vegetation (dist')}; return GameVegetation`)() as { generate(spec: unknown, options: unknown): { pieces: PlantPiece[] } }
const teamSpecies = new Function(`${bundle('/* @adatechnology/game-vegetation-species')}; return GameVegetationSpecies`)() as { getSpecies(id: string): unknown; toSpec(species: unknown): PlantSpec }

const IDS = ['mango_tree', 'coconut_palm', 'araucaria', 'mandacaru', 'prickly_pear', 'crown_cactus', 'banana_with_bunch', 'potted_fern']
const WOOD = new Set(['trunk', 'branch', 'stem', 'arm', 'pad'])
const plain = (pieces: PlantPiece[]): unknown => JSON.parse(JSON.stringify(pieces))

describe('team golden: Viveiro piece geometry', () => {
  const cases = IDS.flatMap((id) => [1, 2, 3, 4, 5].map((seed) => [id, seed] as const))
  it.each(cases)('%s seed %i has the same pieces as the artifact', (id, seed) => {
    const spec = teamSpecies.toSpec(teamSpecies.getSpecies(id))
    const want = teamEngine.generate(spec, { seed }).pieces
    const got = generate(spec, { seed }).pieces
    expect(plain(got)).toEqual(plain(want))
  })

  it('gives every wood piece a radius, a length, an axis and a base, and no other piece', () => {
    for (const id of IDS) {
      const pieces = generate(teamSpecies.toSpec(teamSpecies.getSpecies(id)), { seed: 1 }).pieces
      for (const piece of pieces) {
        const has = piece.radius !== undefined
        if (!WOOD.has(piece.kind)) expect(has, `${id}/${piece.id}`).toBe(false)
        if (has) {
          expect(piece.radius).toBeGreaterThan(0)
          expect(piece.length).toBeGreaterThan(0)
          expect(Math.hypot(...(piece.axis as [number, number, number]))).toBeCloseTo(1, 6)
          expect(piece.base).toHaveLength(3)
        }
      }
      // a potted fern has no wood: its pieces are the pot, the soil and the fronds
      expect(pieces.some((p) => p.radius !== undefined), id).toBe(id !== 'potted_fern')
    }
  })

  it('measures the trunk of the mango tree at its own thickness, and scales with the plant', () => {
    const spec = teamSpecies.toSpec(teamSpecies.getSpecies('mango_tree'))
    const trunk = generate(spec, { seed: 1 }).pieces.find((p) => p.kind === 'trunk') as PlantPiece
    const big = generate(spec, { seed: 1, scale: 2 }).pieces.find((p) => p.kind === 'trunk') as PlantPiece
    expect(trunk.radius).toBeGreaterThan(0.1)
    expect(trunk.radius).toBeLessThan(0.4)
    expect(big.radius).toBeCloseTo((trunk.radius as number) * 2, 6)
    expect(big.length).toBeCloseTo((trunk.length as number) * 2, 6)
  })

  it('keeps the cactus pads as the archetype sets them (radius 0.085 of the pad length)', () => {
    const spec = teamSpecies.toSpec(teamSpecies.getSpecies('prickly_pear'))
    const pads = generate(spec, { seed: 1 }).pieces.filter((p) => p.kind === 'pad' && p.radius !== undefined)
    expect(pads.length).toBeGreaterThan(2)
    for (const pad of pads) expect((pad.radius as number) / (pad.length as number)).toBeCloseTo(0.085, 6)
  })
})
