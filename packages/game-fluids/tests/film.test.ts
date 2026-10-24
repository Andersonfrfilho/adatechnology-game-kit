import { describe, expect, it } from 'vitest'
import { FILM_PROFILES, PADRAO_LAYOUT, WORKSHOP_LAYOUT, createFilm, createFilmLcg, filmProfileOf, layoutFromSurfaces } from '../src'
import type { FilmSimulator, SurfaceSpec } from '../src'

const FLOOR: SurfaceSpec = { id: 'floor', point: [0, 0, 0], normal: [0, 1, 0], halfSize: [5, 5], porosity: 0.1 }
const WALL: SurfaceSpec = { id: 'wall', point: [0, 0, -1], normal: [0, 0, 1], halfSize: [5, 2], porosity: 0.2 }
const LOW: SurfaceSpec = { id: 'road', point: [0, -0.1, 0], normal: [0, 1, 0], halfSize: [5, 5], porosity: 0.5 }

const makeFilm = (layout = PADRAO_LAYOUT, liquid = 'blood' as const) => createFilm({ layout, profile: filmProfileOf(liquid)!, random: createFilmLcg(7) })

describe('film profiles', () => {
  it('has the five liquids, with the Workshop variants as the defaults', () => {
    expect(FILM_PROFILES.map((profile) => profile.id)).toEqual(['blood', 'old_blood', 'bile', 'motor_oil', 'fuel'])
    expect(filmProfileOf('bile')?.spikes).toBe(0.3)
    expect(filmProfileOf('motor_oil')?.landsAsBlob).toBe(true)
    expect(filmProfileOf('fuel')?.landsAsBlob).toBe(true)
    expect(filmProfileOf('blood')?.landsAsBlob).toBe(false)
  })
  it('can be overridden per game, and a liquid without a film has no profile', () => {
    expect(filmProfileOf('bile', { spikes: 1 })?.spikes).toBe(1)
    expect(filmProfileOf('water')).toBeUndefined()
  })
})

describe('film', () => {
  it('is deterministic from the random stream it is given', () => {
    const run = (): string => {
      const film = makeFilm()
      film.splat(60, 100, 3, 1, 0, 0.5, 1.5)
      for (let frame = 0; frame < 30; frame++) film.update({ dt: 1 / 60, dryingSeconds: 1 / 3 })
      return Array.from(film.field.thickness.slice(0, 60000)).join(',')
    }
    expect(run()).toBe(run())
  })

  it('spreads a wet body downhill, and dries it from the edge', () => {
    const film = makeFilm()
    film.blob(200, 100, 6, 6, 1, 0, 2, 0.1)
    const before = film.wetCells()
    for (let frame = 0; frame < 120; frame++) film.update({ dt: 1 / 60, dryingSeconds: 5 })
    expect(film.wetCells()).toBeGreaterThan(before)
    expect(film.field.dryness.some((value) => value > 0.5)).toBe(true)
  })

  it('never runs more than maxSteps flow steps in a frame, and drops the leftover time', () => {
    const film = createFilm({ layout: PADRAO_LAYOUT, profile: filmProfileOf('blood')!, random: createFilmLcg(1), maxSteps: 6 })
    film.blob(200, 100, 6, 6, 1, 0, 2, 0.1)
    expect(film.simulator.advance({ dt: 0.5, dryingSeconds: 0 })).toBe(6)
    expect(film.simulator.advance({ dt: 1 / 180, dryingSeconds: 0 })).toBe(1)
  })

  it('stops drying and spreads faster while it rains', () => {
    const dry = makeFilm()
    const rainy = makeFilm()
    rainy.setWeather({ rain: 1 })
    expect(rainy.weather().rain).toBe(1)
    for (const film of [dry, rainy]) film.blob(200, 100, 6, 6, 1, 0, 2, 0.1)
    for (let frame = 0; frame < 60; frame++) for (const film of [dry, rainy]) film.update({ dt: 1 / 60, dryingSeconds: 20 })
    expect(Math.max(...dry.field.dryness)).toBeGreaterThan(0.5)
    expect(Math.max(...rainy.field.dryness)).toBe(0)
    expect(rainy.wetCells()).toBeGreaterThan(dry.wetCells())
  })

  it('lands a launched drop on the wall and lets the replacement simulator run', () => {
    const calls: string[] = []
    const simulator: FilmSimulator = {
      bounds: { firstRow: 0, lastRow: -1, firstColumn: 0, lastColumn: -1 },
      refreshBounds: () => calls.push('bounds'),
      advance: () => {
        calls.push('advance')
        return 0
      },
      resetClock: () => undefined,
    }
    const film = createFilm({ layout: PADRAO_LAYOUT, profile: filmProfileOf('blood')!, random: createFilmLcg(3), simulator: () => simulator })
    film.launch([0, 1.2, 0.5], [0, 0, -6], 2)
    for (let frame = 0; frame < 10; frame++) film.update({ dt: 1 / 60, dryingSeconds: 0 })
    expect(film.wetCells()).toBeGreaterThan(0)
    expect(film.drops.active.some(Boolean)).toBe(false)
    expect(calls).toContain('advance')
  })

  it('draws a drip as a swelling bead and throws its drop', () => {
    const film = makeFilm()
    film.drip = { position: [0, 1, 0.4], every: 0.2, base: 0.2, elapsed: 0, radius: 4 }
    film.update({ dt: 0.1, dryingSeconds: 0 })
    expect(film.bead.visible).toBe(true)
    expect(film.bead.swell).toBeCloseTo(0.5)
    film.update({ dt: 0.1, dryingSeconds: 0 })
    expect(film.drops.launched).toBe(1)
  })

  it('has the Fluid Standard and Workshop grids', () => {
    expect([PADRAO_LAYOUT.width, PADRAO_LAYOUT.height]).toEqual([256, 396])
    expect([WORKSHOP_LAYOUT.width, WORKSHOP_LAYOUT.height]).toEqual([160, 448])
  })
})

describe('layoutFromSurfaces', () => {
  it('makes a 160 x 160 patch of the floor around the centre', () => {
    const layout = layoutFromSurfaces({ floor: FLOOR, center: [2, 0, 3] })
    expect([layout.width, layout.height]).toEqual([160, 160])
    expect(layout.regions.map((region) => region.id)).toEqual(['floor'])
    const middle = layout.cellToWorld(80, 80)
    expect(middle[0]).toBeCloseTo(2, 1)
    expect(middle[1]).toBeCloseTo(0, 6)
    expect(middle[2]).toBeCloseTo(3, 1)
  })

  it('folds a wall over the floor and a curb down to the lower surface', () => {
    const layout = layoutFromSurfaces({ floor: FLOOR, wall: WALL, curb: LOW, center: [0, 0, 0.5] })
    expect(layout.regions.map((region) => region.id)).toEqual(['wall', 'floor', 'curb', 'low'])
    expect(layout.height).toBe(160)
    const wallTop = layout.cellToWorld(0, 80)
    expect(wallTop[1]).toBeGreaterThan(0.5)
    expect(wallTop[2]).toBeCloseTo(-1, 6)
    const floorStart = layout.cellToWorld(layout.regions[1]!.firstRow, 80)
    expect(floorStart[1]).toBeCloseTo(0, 6)
    expect(floorStart[2]).toBeCloseTo(-1, 6)
  })

  it('catches a drop on the floor, snaps it to the plane and gives the cell it hit', () => {
    const layout = layoutFromSurfaces({ floor: FLOOR, center: [0, 0, 0] })
    const position: [number, number, number] = [0.1, -0.02, 0.2]
    const region = layout.collide([0.1, 0.05, 0.2], position)
    expect(region).toBe(0)
    expect(position[1]).toBeCloseTo(0, 9)
    const impact = layout.impact(region, position, [0, -3, 0])
    expect(impact.normalSpeed).toBeCloseTo(3)
    expect(layout.cellToWorld(impact.row, impact.column)[0]).toBeCloseTo(0.1, 6)
    expect(layout.collide([5, 0.05, 5], [5, -0.02, 5])).toBe(-1)
  })

  it('runs a film down the slope of a tilted floor', () => {
    const tilted = layoutFromSurfaces({ floor: { ...FLOOR, normal: [0, 0.98, -0.2] }, center: [0, 0, 0] })
    const film = createFilm({ layout: tilted, profile: filmProfileOf('blood')!, random: createFilmLcg(2) })
    film.blob(40, 80, 5, 5, 1, 0, 2.5, 0.1)
    const rowsOf = (): number => {
      let sum = 0
      let weight = 0
      film.field.thickness.forEach((value, index) => {
        sum += Math.floor(index / tilted.width) * value
        weight += value
      })
      return sum / weight
    }
    const start = rowsOf()
    for (let frame = 0; frame < 120; frame++) film.update({ dt: 1 / 60, dryingSeconds: 0 })
    expect(Math.abs(rowsOf() - start)).toBeGreaterThan(0.5)
  })
})
