import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createFilmLcg } from '@adatechnology/game-fluids'
import type { Vec3 } from '@adatechnology/game-fluids'
import { createFilmManager, FILM_FRAGMENT } from '../src'
import type { FilmBake, FilmGpu } from '../src'

function setup(extra: Partial<Parameters<typeof createFilmManager>[1]> = {}) {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 1.6, 4)
  const bakes: FilmBake[] = []
  const splash = vi.fn()
  const manager = createFilmManager(THREE, {
    scene,
    camera,
    random: createFilmLcg(7),
    onBake: (bake) => bakes.push(bake),
    fluids: { splash } as never,
    // a frozen clock: the budget never runs out unless a test says so (a loaded machine would starve grids)
    now: () => 0,
    ...extra,
  })
  return { scene, camera, manager, bakes, splash }
}

const run = (manager: ReturnType<typeof createFilmManager>, seconds: number, dt = 1 / 60): void => {
  for (let t = 0; t < seconds; t += dt) manager.update(dt)
}

describe('film shader', () => {
  it('keeps the page code and uses the r160 colour-space chunk', () => {
    expect(FILM_FRAGMENT).toContain('float m=smoothstep(.035,.08,hn);')
    expect(FILM_FRAGMENT).toContain('vec2 g=vec2(hr-hl,hu-hd)/37.5;')
    expect(FILM_FRAGMENT).toContain('float shin=mix(30.,320.,wv);')
    expect(FILM_FRAGMENT).toContain('#include <colorspace_fragment>')
  })
})

describe('film manager', () => {
  it('makes a grid under a drop, lands it, spreads the film and encodes the texture as the page does', () => {
    const { manager, scene } = setup()
    const grid = manager.launch({ fluid: 'blood', point: [0, 0.5, 0], radius: 5 })!
    expect(grid).not.toBeNull()
    expect(scene.getObjectByName('film_manager')!.children).toHaveLength(1)
    run(manager, 1.2)
    expect(grid.film.wetCells()).toBeGreaterThan(10)
    const { thickness } = grid.film.field
    let at = -1
    for (let i = 0; i < thickness.length; i++) if (thickness[i]! > 0.5) at = i
    expect(at).toBeGreaterThanOrEqual(0)
    expect(grid.data[at * 4]).toBe(Math.min(255, Math.sqrt(Math.min(6, thickness[at]!) / 6) * 255 + 0.5) | 0)
    expect(grid.data[at * 4 + 3]).toBe(255)
    expect(manager.stats().wetCells).toBeGreaterThan(10)
  })

  it('reuses the grid that covers a point and makes a new one beside it', () => {
    const { manager } = setup()
    const a = manager.launch({ fluid: 'blood', point: [0, 0.4, 0] })!
    expect(manager.launch({ fluid: 'blood', point: [0.3, 0.4, 0.2] })).toBe(a)
    const b = manager.launch({ fluid: 'blood', point: [0, 0.4, 1.8] })!
    expect(b).not.toBe(a)
    // another liquid on the same spot is another grid
    expect(manager.launch({ fluid: 'bile', point: [0, 0.4, 0] })).not.toBe(a)
    expect(manager.gridCount).toBe(3)
  })

  it('keeps at most 6 grids: the seventh bakes the one that has been still longest into the stains', () => {
    const { manager, bakes, splash } = setup()
    for (let i = 0; i < 6; i++) manager.launch({ fluid: 'blood', point: [i * 3 - 7, 0.4, 0], radius: 5 })
    run(manager, 0.8)
    expect(manager.gridCount).toBe(6)
    manager.launch({ fluid: 'blood', point: [12, 0.4, 0], radius: 5 })
    expect(manager.gridCount).toBe(6)
    expect(bakes).toHaveLength(1)
    expect(bakes[0]!.reason).toBe('budget')
    expect(bakes[0]!.liters).toBeGreaterThan(0)
    expect(splash).toHaveBeenCalledWith('blood', bakes[0]!.point, bakes[0]!.liters, undefined, { tint: bakes[0]!.tint })
  })

  it('does not take a splash beyond 30 m, and bakes a grid the player walks away from', () => {
    const { manager, camera, bakes } = setup()
    expect(manager.launch({ fluid: 'blood', point: [0, 0.4, -40] })).toBeNull()
    manager.launch({ fluid: 'blood', point: [0, 0.4, 0], radius: 5 })
    run(manager, 0.8)
    camera.position.set(0, 1.6, 50)
    manager.update(1 / 60)
    expect(manager.gridCount).toBe(0)
    expect(bakes.map((bake) => bake.reason)).toEqual(['range'])
  })

  it('bakes a grid that stays still, and frees one that has nothing wet', () => {
    const { manager, bakes } = setup({ settleSeconds: 3 })
    manager.launch({ fluid: 'motor_oil', point: [0, 0.4, 0], radius: 5 })
    run(manager, 2)
    expect(manager.gridCount).toBe(1)
    run(manager, 150, 0.5)
    expect(manager.gridCount).toBe(0)
    expect(bakes.at(-1)!.reason).toBe('settled')
    expect(bakes.at(-1)!.fluid).toBe('motor_oil')
  })

  it('stops simulating the grids the millisecond budget has no room for', () => {
    let clock = 0
    const { manager } = setup({ budgetMs: 1, now: () => (clock += 0.6) })
    for (let i = 0; i < 4; i++) manager.launch({ fluid: 'blood', point: [i * 3 - 4, 0.4, 0], radius: 5 })
    manager.update(1 / 60)
    expect(manager.stats().starved).toBeGreaterThan(0)
    expect(manager.stats().starved).toBeLessThan(4)
  })

  it('uploads only the dirty rectangle through the renderer once the texture is on the GPU', () => {
    const copied: Array<[number, number, number]> = []
    const gpu: FilmGpu = {
      copyTextureToTexture: (position, source) => void copied.push([position.x, position.y, (source.image as { width: number }).width]),
    }
    const { manager } = setup({ gpu })
    const grid = manager.launch({ fluid: 'blood', point: [0, 0.4, 0], radius: 4 })!
    run(manager, 0.5)
    expect(copied).toHaveLength(0) // not on the GPU yet: the whole texture goes up
    grid.texture.onUpdate?.() // what three calls once the texture is on the GPU
    run(manager, 0.5)
    expect(copied.length).toBeGreaterThan(0)
    expect(copied.every(([, , width]) => width < grid.film.layout.width)).toBe(true)
  })

  it('passes the rain to every grid', () => {
    const { manager } = setup()
    const grid = manager.launch({ fluid: 'blood', point: [0, 0.4, 0] })!
    manager.setWeather({ rain: 1 })
    expect(grid.film.weather().rain).toBe(1)
    const other = manager.launch({ fluid: 'blood', point: [0, 0.4, 5 as number] as Vec3 })!
    expect(other.film.weather().rain).toBe(1)
  })

  it('shows a drip: a bead that swells and a drop that falls', () => {
    const { manager } = setup()
    const grid = manager.drip({ fluid: 'fuel', point: [0, 0.8, 0], every: 0.4, radius: 3 })!
    let seen = false
    for (let i = 0; i < 90; i++) {
      manager.update(1 / 60)
      seen ||= grid.film.bead.visible && grid.group.getObjectByName('film_bead')!.visible
    }
    expect(seen).toBe(true)
    expect(grid.film.drops.launched).toBeGreaterThan(0)
  })
})
