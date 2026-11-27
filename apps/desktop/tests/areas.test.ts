import { describe, expect, it } from 'vitest'

import { DEFAULT_LAUNCH, MENU_PATH, parseLaunch, pathOf, physicsQuery, resolveArea, roomAreasOf } from '../src/areas'
import type { DesktopManifest } from '../src/areas'
import { renderMenuPage } from '../src/menu-page'

const manifest: DesktopManifest = {
  examples: [
    { id: 'room', folder: 'test-room', name: '@adatechnology/test-room-example', description: 'the room', page: 'test-room.html' },
    { id: 'vehicles', folder: 'vehicles-test-area', name: 'v', description: 'cars', page: 'vehicles.html' },
    { id: 'weather', folder: 'weather-test-area', name: 'w', description: 'rain', page: null },
  ],
}

describe('desktop launch options', () => {
  it('reads --area in both forms and the environment, the flag first', () => {
    expect(parseLaunch(['electron', '.', '--area=floorplan_area']).area).toBe('floorplan_area')
    expect(parseLaunch(['--area', 'vehicles']).area).toBe('vehicles')
    expect(parseLaunch([], { KIT_DESKTOP_AREA: 'weather_area' }).area).toBe('weather_area')
    expect(parseLaunch(['--area=a'], { KIT_DESKTOP_AREA: 'b' }).area).toBe('a')
    expect(parseLaunch([])).toEqual(DEFAULT_LAUNCH)
  })

  it('asks the room for Jolt multithreaded with the JS contacts by default, and passes the other choices through', () => {
    expect(physicsQuery(DEFAULT_LAUNCH)).toBe('joltBuild=multithread')
    expect(physicsQuery(parseLaunch(['--jolt-build=single']))).toBe('')
    expect(physicsQuery(parseLaunch(['--jolt-threads=4', '--jolt-contacts=off']))).toBe('joltBuild=multithread&joltThreads=4&joltContacts=off')
    expect(physicsQuery(parseLaunch(['--lang=en']))).toBe('lang=en')
    expect(parseLaunch(['--jolt-threads=lots']).joltThreads).toBeUndefined()
  })
})

describe('desktop areas', () => {
  it('opens the menu with no area, the room by its names, a built example by id and anything else as a room area', () => {
    expect(resolveArea(undefined, manifest)).toEqual({ kind: 'menu' })
    expect(resolveArea('menu', manifest)).toEqual({ kind: 'menu' })
    expect(resolveArea('room', manifest)).toEqual({ kind: 'room', area: undefined })
    expect(resolveArea('vehicles', manifest)).toMatchObject({ kind: 'example', entry: { folder: 'vehicles-test-area' } })
    expect(resolveArea('weather', manifest)).toEqual({ kind: 'room', area: 'weather' })
    expect(resolveArea('floorplan_area', manifest)).toEqual({ kind: 'room', area: 'floorplan_area' })
  })

  it('builds the paths the server answers', () => {
    expect(pathOf({ kind: 'menu' }, DEFAULT_LAUNCH)).toBe(MENU_PATH)
    expect(pathOf({ kind: 'room', area: 'floorplan_area' }, DEFAULT_LAUNCH)).toBe('/test-room.html?area=floorplan_area&joltBuild=multithread')
    expect(pathOf(resolveArea('vehicles', manifest), DEFAULT_LAUNCH)).toBe('/vehicles-test-area/vehicles.html')
  })

  it('lists only the modules that bring an area, by name', () => {
    expect(roomAreasOf([
      { id: 'weather_area', name: 'Clima', hasArea: true },
      { id: 'helper', name: 'Ajuda', hasArea: false },
      { id: 'floorplan_area', name: 'Casas', group: 'Casas', hasArea: true },
    ])).toEqual([{ id: 'floorplan_area', name: 'Casas', group: 'Casas' }, { id: 'weather_area', name: 'Clima' }])
  })

  it('renders the start menu from the same lists, escaping what it shows', () => {
    const html = renderMenuPage({ manifest, roomAreas: [{ id: 'floorplan_area', name: 'Casas <&>' }], options: DEFAULT_LAUNCH, isIsolated: true })
    expect(html).toContain('href="/test-room.html?area=floorplan_area&amp;joltBuild=multithread"')
    expect(html).toContain('Casas &lt;&amp;&gt;')
    expect(html).toContain('href="/vehicles-test-area/vehicles.html"')
    expect(html).not.toContain('href="/test-room/test-room.html"')
    expect(html).toContain('Ainda não construídas: weather')
    expect(renderMenuPage({ manifest, roomAreas: undefined, options: DEFAULT_LAUNCH, isIsolated: true })).toContain('Lendo as áreas da sala')
  })
})
