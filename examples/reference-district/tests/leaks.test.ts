// @vitest-environment happy-dom
import * as THREE from 'three'
import { afterEach, describe, expect, it } from 'vitest'

import { createKitWorld } from '@adatechnology/game-kit-defaults/world'
import type { KitWorld } from '@adatechnology/game-kit-defaults/world'
import { pipePiecesOf, surfacePiecesOf } from '@adatechnology/game-urban/networks'
import type { PipePiece } from '@adatechnology/game-urban/networks'

import { createDistrictLeaks } from '../src/game/assemble/leaks'
import { planLots } from '../src/game/assemble/houses'
import { DOWNTOWN_UNDERGROUND, buildNetworks, drawDistrictSewers, isUndergroundLot } from '../src/game/assemble/networks'
import { groundLayoutOf, terrainBoundsOf } from '../src/game/ground'
import { POLE_MIN_GAP } from '../src/game/roads'
import { keepOutOf } from '../src/game/service'
import { plan, site } from './helpers'

const lots = planLots(site)
const generated = buildNetworks({ plan, site, lots, avoid: keepOutOf(lots, POLE_MIN_GAP) })
const pipes = pipePiecesOf(generated.networks)
const covers = surfacePiecesOf(generated.networks, { surfaceAt: generated.surfaceAt, roadLevel: 0 })

const worlds: KitWorld[] = []
afterEach(() => {
  for (const world of worlds.splice(0)) world.dispose()
})

async function makeDistrictWorld(): Promise<KitWorld> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const world = await createKitWorld(THREE, {
    container,
    renderer: { domElement: document.createElement('canvas'), shadowMap: { enabled: false, type: 0 }, setSize: () => undefined, setPixelRatio: () => undefined, render: () => undefined, dispose: () => undefined } as unknown as THREE.WebGLRenderer,
    bounds: terrainBoundsOf(plan),
    ground: groundLayoutOf(plan),
    physics: 'own',
    workers: 0,
    audio: { samplesBaseUrl: null, userSamplesBaseUrl: null },
  })
  worlds.push(world)
  return world
}

/** A blast big enough to dig the whole column of the road, right over a point. */
const BLAST_JOULES = 1e8
/** Seconds of the fixed step. */
const TICK = 1 / 60

async function district({ isRaining = false }: { readonly isRaining?: boolean } = {}) {
  const calls: Array<readonly [string, boolean]> = []
  const houses = { setLotWater: (lot: string, on: boolean): boolean => (calls.push([lot, on]), true), setLotGrid: (): boolean => true }
  const world = await makeDistrictWorld()
  const sewers = drawDistrictSewers({ THREE, generated, world })
  world.view.scene.add(sewers.surface.root, sewers.buried.root)
  const leaks = createDistrictLeaks({ world, scene: world.view.scene, generated, sewers, isRaining: () => isRaining, houses })
  return { world, sewers, leaks, calls }
}

function blastOver(world: KitWorld, [x, z]: readonly [number, number]): void {
  world.ground.showBlow(world.ground.terrain.strike('explosive', { x, z, energy: BLAST_JOULES }))
}

const middleOf = (pipe: PipePiece): readonly [number, number] => [(pipe.from[0] + pipe.to[0]) / 2, (pipe.from[2] + pipe.to[2]) / 2]
const pipeOf = (kind: PipePiece['kind']): PipePiece => pipes.filter((entry) => entry.kind === kind)[3]!

/** Steps the leaks until nothing runs, a second at a time; the most steps a leak of the rules lasts is its seconds. */
function drain(leaks: { readonly running: readonly unknown[]; step(dt: number): void }): number {
  let seconds = 0
  while (leaks.running.length > 0 && seconds < 5000) {
    leaks.step(1)
    seconds++
  }
  return seconds
}

describe('a blast that reaches a water main', () => {
  it('breaks it, sprays water from the break into the crater and cuts the water to the houses downstream', async () => {
    const { world, leaks, calls } = await district()
    const main = pipeOf('water_main')
    blastOver(world, middleOf(main))
    const leak = leaks.events.flatMap((event) => (event.type === 'network_leak' && event.leak.id === main.id ? [event.leak] : []))[0]
    expect(leak?.content).toBe('water')
    expect(leak?.isPressurised).toBe(true)
    const tap = world.liquids.fluids.taps().find((entry) => entry.id === `leak:${main.id}`)
    expect(tap?.liquid).toBe('water')
    expect(tap?.direction[1]).toBeGreaterThan(0.9)
    const outage = leaks.events.flatMap((event) => (event.type === 'network_outage' ? [event.outage] : []))[0]
    expect(outage?.causes).toContain(main.id)
    expect(outage?.lots.length).toBeGreaterThan(0)
    expect([...leaks.dryLots]).toEqual(expect.arrayContaining([...outage!.lots]))
    expect(calls.filter(([, on]) => !on).map(([lot]) => lot).sort()).toEqual([...outage!.lots].sort())
  })

  it('lets out a finite volume: the taps stop when the break is empty and the litres add up to what there was', async () => {
    const { world, leaks } = await district()
    const main = pipeOf('water_main')
    blastOver(world, middleOf(main))
    const volumes = leaks.running.map((state) => state.leak.volume)
    expect(volumes.length).toBeGreaterThan(0)
    const seconds = drain(leaks)
    expect(seconds).toBeLessThan(1000)
    expect(world.liquids.fluids.taps().filter((entry) => entry.id.startsWith('leak:'))).toEqual([])
    expect(volumes.every((volume) => Number.isFinite(volume))).toBe(true)
  })
})

describe('a blast that reaches the sewer and the drainage', () => {
  it('leaks sewage as a slow dark run, slower than the water', async () => {
    const { world, leaks } = await district()
    const lateral = pipeOf('sewer_lateral')
    blastOver(world, middleOf(lateral))
    const tap = world.liquids.fluids.taps().find((entry) => entry.id === `leak:${lateral.id}`)
    expect(tap?.liquid).toBe('sewage')
    expect(tap?.direction[1]).toBeLessThan(0)
    expect(tap?.rate).toBeLessThan(1)
    expect(world.liquids.fluids.liquids.get('sewage')?.stainColor).toBeLessThan(0x404040)
    expect(leaks.events.some((event) => event.type === 'network_leak' && event.leak.id === lateral.id && event.leak.isPressurised)).toBe(false)
  })

  it('runs the drainage only while it rains', async () => {
    const lateral = pipeOf('storm_lateral')
    const dry = await district()
    blastOver(dry.world, middleOf(lateral))
    expect(dry.leaks.events.filter((event) => event.type === 'network_leak' && event.leak.content === 'stormwater')).toEqual([])
    expect(dry.world.liquids.fluids.taps().some((entry) => entry.id === `leak:${lateral.id}`)).toBe(false)
    const wet = await district({ isRaining: true })
    blastOver(wet.world, middleOf(lateral))
    expect(wet.world.liquids.fluids.taps().some((entry) => entry.id === `leak:${lateral.id}`)).toBe(true)
  })
})

describe('a blast over a cover', () => {
  const manhole = covers.find((piece) => piece.kind === 'manhole_cover' && generated.surfaceAt(piece.at[0], piece.at[2]) === 'road')!

  it('opens the shaft in the ground, where the player falls in, and throws the cover as a plate of cast iron', async () => {
    const { world, leaks, sewers } = await district()
    blastOver(world, [manhole.at[0], manhole.at[2]])
    expect(leaks.events.filter((event) => event.type === 'network_hole').map((event) => (event.type === 'network_hole' ? event.id : ''))).toContain(manhole.id)
    expect(world.ground.terrain.heightAt(manhole.at[0], manhole.at[2])).toBeLessThan(-manhole.shaft!.depth * 0.9)
    expect(world.ground.at(manhole.at[0], manhole.at[2])).toBeLessThan(-manhole.shaft!.depth * 0.9)
    const id = `cover:${manhole.id}`
    expect(leaks.lids).toContain(id)
    expect(world.destruction.world.part(id, 'plate')?.material).toBe('cast_iron')
    const piece = world.destruction.renderer.piece(id)
    expect(piece).not.toBeNull()
    expect(piece!.velocity[1]).toBeGreaterThan(0)
    expect(sewers.surface.pieces.some((entry) => entry.id === manhole.id)).toBe(true)
  })

  it('lands and stays: after a few seconds the plate rests on the ground, not in the air and not under it', async () => {
    const { world, leaks } = await district()
    blastOver(world, [manhole.at[0], manhole.at[2]])
    const id = `cover:${manhole.id}`
    for (let step = 0; step < 60 * 8; step++) {
      leaks.step(TICK)
      world.frame.scheduler.advance(TICK)
    }
    const piece = world.destruction.renderer.piece(id)!
    expect(piece.sleeping).toBe(true)
    const [x, y, z] = [piece.root.position.x, piece.root.position.y, piece.root.position.z]
    expect(Math.abs(y - world.ground.at(x, z))).toBeLessThan(0.2)
  })
})

describe('memory: what a blast made leaves with the reset', () => {
  it('takes out the taps, the lids, the holes and the pools, and puts the pipes and covers back', async () => {
    const { world, leaks, sewers, calls } = await district()
    const scene = world.view.scene
    const before = new Set<THREE.Object3D>()
    scene.traverse((object) => before.add(object))
    const manhole = covers.find((piece) => piece.kind === 'manhole_cover' && generated.surfaceAt(piece.at[0], piece.at[2]) === 'road')!
    blastOver(world, [manhole.at[0], manhole.at[2]])
    blastOver(world, middleOf(pipeOf('water_main')))
    expect(leaks.running.length).toBeGreaterThan(0)
    expect(leaks.lids.length).toBeGreaterThan(0)
    const dry = [...leaks.dryLots]
    leaks.reset()
    expect(calls.filter(([, on]) => on).map(([lot]) => lot).sort()).toEqual(dry.sort())
    sewers.reset()
    world.reset()
    expect(leaks.running).toEqual([])
    expect(leaks.lids).toEqual([])
    expect(leaks.events).toEqual([])
    expect(leaks.dryLots.size).toBe(0)
    expect(sewers.breaches).toEqual([])
    expect(world.liquids.fluids.taps()).toEqual([])
    expect(world.destruction.world.ids().filter((id) => id.startsWith('cover:'))).toEqual([])
    expect(world.ground.terrain.heightAt(manhole.at[0], manhole.at[2])).toBeCloseTo(0, 1)
    const after = new Set<THREE.Object3D>()
    scene.traverse((object) => after.add(object))
    expect([...after].filter((object) => !before.has(object))).toEqual([])
  })

  it('leaves nothing in the scene when disposed', async () => {
    const { world, leaks, sewers } = await district()
    const scene = world.view.scene
    const before = new Set<THREE.Object3D>()
    scene.traverse((object) => before.add(object))
    const manhole = covers.find((piece) => piece.kind === 'manhole_cover' && generated.surfaceAt(piece.at[0], piece.at[2]) === 'road')!
    blastOver(world, [manhole.at[0], manhole.at[2]])
    leaks.dispose()
    sewers.dispose()
    const after = new Set<THREE.Object3D>()
    scene.traverse((object) => after.add(object))
    expect([...after].filter((object) => !before.has(object))).toEqual([])
  })
})

describe('a blast that reaches the duct bank of an underground street', () => {
  it('cuts the cables: the houses past the break lose their grid and the lamps past it go out, and a reset gives both back', async () => {
    const undergroundLots = planLots(site, { underground: (lot) => isUndergroundLot({ plan, power: DOWNTOWN_UNDERGROUND, rect: lot.rect }) })
    const underground = buildNetworks({ plan, site, lots: undergroundLots, avoid: keepOutOf(undergroundLots, POLE_MIN_GAP), power: DOWNTOWN_UNDERGROUND })
    const grids: Array<readonly [string, boolean]> = []
    const lamps: Array<readonly [number, boolean]> = []
    const houses = { setLotWater: (): boolean => true, setLotGrid: (lot: string, on: boolean): boolean => (grids.push([lot, on]), true) }
    const world = await makeDistrictWorld()
    const sewers = drawDistrictSewers({ THREE, generated: underground, world })
    const leaks = createDistrictLeaks({ world, scene: world.view.scene, generated: underground, sewers, isRaining: () => false, houses, lamps: { setLampsPowered: (ids, on) => void lamps.push([ids.length, on]) } })
    // the medium voltage where it leaves the feed: every downtown circuit past it
    const feed = underground.networks.nodes.find((node) => node.spec === 'underground_feed')!
    const first = underground.networks.edges.find((edge) => edge.kind === 'mv_duct' && edge.from === feed.id)!
    const bank = pipePiecesOf(underground.networks).find((pipe) => pipe.id === first.id)!
    blastOver(world, middleOf(bank))
    // the bank's cables are cut (the blast may break a water pipe beside it too, which leaks; a duct never does)
    expect(sewers.breaches.flatMap((breach) => breach.pipes).some((pipe) => pipe.id === first.id && pipe.severed)).toBe(true)
    expect(leaks.running.every((state) => state.leak.content !== ('power' as string))).toBe(true)
    expect(leaks.darkLots.size).toBeGreaterThan(0)
    expect(grids.every(([, on]) => !on)).toBe(true)
    expect(lamps.some(([count, on]) => count > 0 && !on)).toBe(true)
    expect(leaks.events.some((event) => event.type === 'network_outage' && event.outage.network === 'power')).toBe(true)
    leaks.reset()
    expect(grids.filter(([, on]) => on).length).toBe(grids.filter(([, on]) => !on).length)
    expect(lamps[lamps.length - 1]?.[1]).toBe(true)
    leaks.dispose()
    sewers.dispose()
  })
})
