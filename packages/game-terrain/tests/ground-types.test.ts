import { MATERIALS } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'
import { createFootprints, createTerrain, TERRAIN_MATERIALS, TERRAIN_PROFILES, waterLift } from '../src'

const GRENADE = 800_000
const PISTOL = 500
const on = (surface: string) => createTerrain({ bounds: [-10, -10, 10, 10], layout: { surface }, seed: 3 })
const settle = (terrain: ReturnType<typeof on>, seconds = 3): void => {
  for (let t = 0; t < seconds; t += 1 / 30) terrain.update(1 / 30)
}

describe('the new grounds', () => {
  it('every stratum of every profile has a material of the destruction catalogue', () => {
    const known = new Set(MATERIALS.map((material) => material.id))
    const ground = new Set(TERRAIN_MATERIALS.map((material) => material.id))
    for (const id of ['mud', 'clay', 'snow', 'cobble', 'paver']) expect(known.has(id), id).toBe(true)
    for (const profile of TERRAIN_PROFILES) for (const stratum of profile.strata) expect(ground.has(stratum.material), stratum.material).toBe(true)
  })

  it('mud takes a foot in, slows it and keeps its print; a slab does neither', () => {
    const mud = on('mud')
    expect(mud.footAt(0, 0)).toBeLessThan(mud.heightAt(0, 0))
    expect(mud.walkFactorAt(0, 0)).toBeLessThan(1)
    expect(mud.press({ x: 0, z: 0, radius: 0.15 })).toBe(true)
    expect(mud.decals()[0]?.kind).toBe('print')
    const slab = on('concrete_slab')
    expect(slab.footAt(0, 0)).toBe(slab.heightAt(0, 0))
    expect(slab.walkFactorAt(0, 0)).toBe(1)
    expect(slab.press({ x: 0, z: 0, radius: 0.15 })).toBe(false)
  })

  it('a walker leaves prints a stride apart, left and right, and none on a teleport', () => {
    const snow = on('snow')
    const trail = createFootprints(snow)
    for (let z = 0; z <= 3; z += 0.1) trail.update(0, z)
    const prints = snow.decals()
    expect(prints.length).toBeGreaterThanOrEqual(3)
    expect(Math.sign(prints[0]!.x)).toBe(-Math.sign(prints[1]!.x))
    const count = prints.length
    trail.update(5, 8)
    expect(snow.decals().length).toBe(count)
  })

  it('a blast on mud digs more than on dirt and its clods splat where they land', () => {
    const mud = on('mud')
    const dirt = on('dirt')
    const inMud = mud.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(inMud.radius).toBeGreaterThan(dirt.strike('explosive', { x: 0, z: 0, energy: GRENADE }).radius)
    settle(mud)
    expect(mud.decals().some((decal) => decal.kind === 'splat')).toBe(true)
  })

  it('gravel scatters its stones and takes a shallow crater', () => {
    const gravel = on('gravel_bed')
    const dirt = on('dirt')
    const result = gravel.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(result.depth).toBeLessThan(dirt.strike('explosive', { x: 0, z: 0, energy: GRENADE }).depth)
    settle(gravel)
    const resting = gravel.debris().filter((piece) => piece.atRest && piece.material === 'gravel')
    expect(resting.length).toBeGreaterThan(5)
  })

  it('dry clay cracks around a blow', () => {
    const clay = on('dry_clay')
    const result = clay.strike('ballistic', { x: 0, z: 0, energy: PISTOL })
    const cracks = clay.decals().filter((decal) => decal.kind === 'crack')
    expect(cracks).toHaveLength(1)
    expect(cracks[0]!.radius).toBeGreaterThan(result.radius)
  })

  it('fire melts snow down to the soil, and it does not blacken it first', () => {
    const snow = on('snow')
    snow.burn({ x: 0, z: 0, radius: 0.5, temperature: 800, seconds: 25 })
    expect(snow.columnAt(0, 0).material).toBe('soil')
    expect(snow.heightAt(0, 0)).toBeLessThan(-0.29)
  })

  for (const surface of ['cobblestone', 'paver_floor']) {
    it(`${surface}: a shot only chips it, enough shots lift the piece whole, a blast throws many`, () => {
      const floor = on(surface)
      const first = floor.strike('ballistic', { x: 0.05, z: 0.05, energy: PISTOL })
      expect(first.removed).toEqual([])
      expect(first.radius).toBeGreaterThan(0)
      expect(floor.heightAt(0.05, 0.05)).toBe(0)
      let lifted = false
      for (let shot = 0; shot < 30 && !lifted; shot++) lifted = floor.strike('ballistic', { x: 0.05, z: 0.05, energy: PISTOL }).removed.length > 0
      expect(lifted).toBe(true)
      expect(floor.columnAt(0.05, 0.05).material).toBe('sand')
      expect(floor.debris().some((piece) => piece.kind === 'blocks')).toBe(true)
      const open = on(surface)
      open.strike('explosive', { x: 0, z: 0, energy: GRENADE })
      expect(open.debris().filter((piece) => piece.kind === 'blocks').length).toBeGreaterThan(3)
      settle(open)
      expect(open.debris().some((piece) => piece.kind === 'blocks' && piece.atRest)).toBe(true)
    })
  }
})

describe('bare rock', () => {
  it('a blast only spalls it and a shot leaves a chip, where dirt takes a crater', () => {
    const rock = on('bedrock')
    const dirt = on('dirt')
    const blast = rock.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(blast.depth).toBeLessThan(dirt.strike('explosive', { x: 0, z: 0, energy: GRENADE }).depth / 5)
    expect(blast.exposed).toBe('stone')
    expect(on('bedrock').strike('ballistic', { x: 0, z: 0, energy: PISTOL }).fine).toBe(true)
  })
  it('fire only blackens it a little', () => {
    const rock = on('bedrock')
    rock.burn({ x: 0, z: 0, radius: 0.5, temperature: 900, seconds: 30 })
    expect(rock.columnAt(0, 0).scorch).toBeLessThan(0.41)
    expect(rock.heightAt(0, 0)).toBe(0)
  })
})

describe('shallow water', () => {
  const pool = () => createTerrain({ bounds: [-10, -10, 10, 10], layout: { surface: 'dirt', zones: [{ rect: [-4, -4, 4, 4], surface: 'shallow_water' }] }, seed: 3 })

  it('stands over a bed that banks up to the shore', () => {
    const terrain = pool()
    expect(terrain.heightAt(0, 0)).toBeCloseTo(-0.3, 5)
    expect(terrain.waterAt(0, 0)).toMatchObject({ liquid: 'water', level: 0 })
    expect(terrain.waterAt(6, 6)).toBeNull()
    expect(terrain.heightAt(3.95, 0)).toBeGreaterThan(-0.3)
    expect(terrain.walkFactorAt(0, 0)).toBeLessThan(1)
  })

  it('a shot says where the splash goes and digs the bed, with less than it had', () => {
    const wet = pool()
    const dry = on('mud')
    const result = wet.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    expect(result.water?.level).toBe(0)
    expect(wet.heightAt(0, 0)).toBeLessThan(-0.3)
    const shot = pool().strike('ballistic', { x: 0, z: 0, energy: PISTOL * 4 })
    expect(shot.removed[0]!.volume).toBeLessThan(dry.strike('ballistic', { x: 0, z: 0, energy: PISTOL * 4 }).removed[0]!.volume)
    expect(wet.decals().some((decal) => decal.kind === 'ripple')).toBe(true)
  })

  it('does not burn, and a foot leaves rings instead of a print', () => {
    const terrain = pool()
    terrain.burn({ x: 0, z: 0, radius: 1, temperature: 900, seconds: 10 })
    expect(terrain.columnAt(0, 0).scorch).toBe(0)
    terrain.press({ x: 0, z: 0, radius: 0.15 })
    expect(terrain.decals()[0]?.kind).toBe('ripple')
    settle(terrain)
    expect(terrain.decals()).toHaveLength(0)
  })

  it('survives a save', () => {
    const terrain = pool()
    terrain.strike('explosive', { x: 0, z: 0, energy: GRENADE })
    const height = terrain.heightAt(0, 0)
    const copy = pool()
    copy.load(JSON.parse(JSON.stringify(terrain.serialize())))
    expect(copy.heightAt(0, 0)).toBeCloseTo(height, 5)
  })
})

describe('water lifts by what a body displaces', () => {
  it('a light log floats, a concrete block does not', () => {
    const log = waterLift({ mass: 20, volume: 0.04, submerged: 1 })
    expect(log.floats).toBe(true)
    expect(log.acceleration).toBeGreaterThan(9.81)
    const block = waterLift({ mass: 60, volume: 0.03, submerged: 1 })
    expect(block.floats).toBe(false)
    expect(block.acceleration).toBeLessThan(9.81)
  })
  it('out of the water nothing lifts it', () => {
    expect(waterLift({ mass: 20, volume: 0.04, submerged: 0 }).acceleration).toBe(0)
  })
})
