import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cutDeclaration, cutFunction, evaluateSlice } from '@adatechnology/golden-tool/cut-source'
import { describe, expect, it } from 'vitest'

import { createTerrain } from '../src'
import type { TerrainOptions } from '../src'
import valley from './fixtures/valley-terrain.json'

/** The Galeria's own `hW`, `forestF`, `nearRiver`, `inBrejo`, `inQueimada` and the data they read, cut from the page and run in an empty context. */
const PAGE = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..', 'specs', '001-migracao-entregas-dos-times', 'artefatos', 'site__galeria-vale-cinzento.html')
const source = readFileSync(PAGE, 'utf8')

type Team = {
  hW(px: number, py: number): number
  forestF(px: number, py: number): number
  nearRiver(px: number, py: number, m: number): boolean
  inBrejo(px: number, py: number): boolean
  inQueimada(px: number, py: number): boolean
}

const team = evaluateSlice<Team>(
  [
    ...['clamp', 'lerp', 'sstep', 'hash', 'RIOS', 'RIO_W', 'LAGOS', 'CITIES'].map((name) => cutDeclaration(source, name)),
    ...['dPoly', 'nearRiver', 'inBrejo', 'inQueimada', 'inRect', 'forestF', 'hW'].map((name) => cutFunction(source, name)),
  ].join('\n'),
  ['hW', 'forestF', 'nearRiver', 'inBrejo', 'inQueimada'],
  { Math },
)

const terrain = createTerrain(valley as unknown as TerrainOptions)
const GRID = 64
const AT = (index: number): number => (index * 800) / (GRID - 1)

describe('the ground against the Galeria do Vale Cinzento', () => {
  it('the height is the page\'s hW on a 64 x 64 grid of the map (to 1e-9 m)', () => {
    let worst = 0
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) worst = Math.max(worst, Math.abs(terrain.heightAt(AT(i), AT(j)) - team.hW(AT(i), AT(j))))
    expect(worst).toBeLessThan(1e-9)
  })

  it('the forest density is the page\'s forestF on the same grid', () => {
    let worst = 0
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) worst = Math.max(worst, Math.abs(terrain.forestAt(AT(i), AT(j)) - team.forestF(AT(i), AT(j))))
    expect(worst).toBeLessThan(1e-9)
  })

  it('nearRiver agrees with the page at several margins', () => {
    for (const margin of [3, 9, 20]) {
      for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) expect(terrain.nearRiver(AT(i * 2), AT(j * 2), margin)).toBe(team.nearRiver(AT(i * 2), AT(j * 2), margin))
    }
  })

  it('the bog and the burnt area colour the same points', () => {
    const colors = terrain.options.colors
    const bog = colors.find((rule) => rule.kind === 'ellipse' && rule.color === 0x34402a)
    const burnt = colors.find((rule) => rule.kind === 'ellipse' && rule.color === 0x26231f)
    expect(bog && burnt).toBeTruthy()
    for (let j = 0; j < GRID; j++) {
      for (let i = 0; i < GRID; i++) {
        const px = AT(i)
        const py = AT(j)
        if (team.inBrejo(px, py)) expect(terrain.colorAt(px, py, 5)).toBe(0x34402a)
        else if (team.inQueimada(px, py)) expect(terrain.colorAt(px, py, 5)).toBe(0x26231f)
      }
    }
  })
})

describe('the ground as a generic terrain', () => {
  it('maps the plan to world metres with the frame: W2 and back', () => {
    const [x, z] = terrain.toWorld(410, 365)
    expect([x, z]).toEqual([410 * 0.4 - 160, 365 * 0.4 - 160])
    const [px, py] = terrain.fromWorld(x, z)
    expect(px).toBeCloseTo(410, 9)
    expect(py).toBeCloseTo(365, 9)
  })

  it('the grid has a vertex per corner, rows along z, and 32-bit coordinates', () => {
    const grid = terrain.grid(10)
    expect(grid.heights).toHaveLength(121)
    expect(grid.x[0]).toBe(-160)
    expect(grid.z[0]).toBe(-160)
    expect(grid.x[10]).toBe(160)
    expect(grid.z[110]).toBe(160)
    expect(grid.x[1]).toBe(Math.fround(-160 + 32))
  })

  it('a river carves its bed below the land and the lake sits at its level', () => {
    const turvo = valley.rivers.find((river) => river.id === 'Rio Turvo')
    const [px, py] = (turvo?.points[3] ?? [0, 0]) as [number, number]
    expect(terrain.heightAt(px, py)).toBeCloseTo(-1.6, 6)
    const lake = valley.lakes.find((l) => l.id === 'Lagoa Escura')
    expect(terrain.heightAt(lake?.center[0] ?? 0, lake?.center[1] ?? 0)).toBeCloseTo(-1.8, 6)
  })

  it('a game that gives no layers, rivers or lakes gets a rolling plain, and `custom` has the last word', () => {
    const plain: TerrainOptions = {
      world: { size: 100, scale: 1, origin: -50, segments: 10 },
      base: { level: 2, waves: [] },
      layers: [],
      flatten: [],
      rivers: [],
      lakes: [],
      forest: { zones: [] },
      colors: [{ kind: 'below', height: 1, color: 0x112233 }],
      fields: { colors: [0xaa0000, 0x00aa00], cell: [10, 10] },
      water: { level: 0, color: 0x0000ff, roughness: 0.3, metalness: 0 },
    }
    const flat = createTerrain(plain)
    expect(flat.heightAt(3, 4)).toBe(2)
    expect(flat.forestAt(3, 4)).toBe(0)
    expect([0xaa0000, 0x00aa00]).toContain(flat.colorAt(3, 4))
    const raised = createTerrain({ ...plain, custom: (px, _py, h) => h + px })
    expect(raised.heightAt(3, 4)).toBe(5)
    expect(createTerrain({ ...plain, base: { level: 0.5, waves: [] } }).colorAt(3, 4)).toBe(0x112233)
  })

  it('flattens a city towards its level from the margin inwards', () => {
    const city = valley.flatten.find((f) => f.id === 'Santa Aurora')
    const [x0, y0, x1, y1] = city?.rect ?? [0, 0, 0, 0]
    expect(terrain.heightAt((x0 + x1) / 2 + 40, (y0 + y1) / 2)).toBeCloseTo(1.8, 6)
  })
})
