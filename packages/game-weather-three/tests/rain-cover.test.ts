import { createRainCover, createGridRainCover, rainCoverTopOf } from '@adatechnology/game-contracts'
import type { RainCoverHole } from '@adatechnology/game-contracts'
import { createVfx } from '@adatechnology/game-vfx'
import { createWeather } from '@adatechnology/game-weather'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { RAIN_COVER_CELL, RAIN_COVER_CELLS, RAIN_CURTAIN_COVERED_VERTEX, createNearRain, createRainCurtain } from '../src'

const storm = createWeather({ seed: 3, start: 'storm', startHour: 12, autoSchedule: false }).sample()
const ROOF_TOP = 3
const ROOF = { bounds: [-6, -3, 6, 8] as const, top: ROOF_TOP }
const EYE: [number, number, number] = [0, 1.7, 0]

const houseCover = (holes: RainCoverHole[] = []) => {
  const cover = createRainCover()
  const source = createGridRainCover({ bounds: [-7, -4, 7, 9], coverTopAt: (x, z) => rainCoverTopOf([ROOF], holes, x, z) })
  cover.add(source)
  return { cover, source, holes }
}
const inside = (x: number, z: number): boolean => x >= -6 && x <= 6 && z >= -3 && z <= 8
/** Away from the edge by a drop's slant of one frame: the wind pushes a streak under the eave, and the next frame takes it out. */
const deep = (x: number, z: number): boolean => x >= -5.5 && x <= 5.5 && z >= -2.5 && z <= 7.5

/** The streaks of the field that are in the box now: bottom point of each, from the field's own array. */
const streaks = (vfx: ReturnType<typeof createVfx>): Array<{ x: number; y: number; z: number }> => {
  const field = vfx.workshop().rain
  return Array.from({ length: field.count }, (_, index) => ({ x: field.positions[index * 6 + 3]!, y: field.positions[index * 6 + 4]!, z: field.positions[index * 6 + 5]! }))
}

const rain = (cover: ReturnType<typeof createRainCover> | undefined, frames = 200) => {
  const vfx = createVfx({ seed: 5 })
  const near = createNearRain(vfx, { puddleAt: () => true, ...(cover ? { cover } : {}) })
  for (let i = 0; i < frames; i++) near.update(storm, 0.05, EYE)
  return vfx
}

describe('near rain under a cover', () => {
  it('rains in an uncovered yard: streaks fall low over it and splash with rings', () => {
    const vfx = rain(undefined)
    expect(streaks(vfx).filter((s) => inside(s.x, s.z) && s.y < ROOF_TOP).length).toBeGreaterThan(50)
    expect(vfx.workshop().rings.rings.filter((ring) => ring.on).length).toBeGreaterThan(0)
  })

  it('has no streak under the roof, and the rain stops at the roof height, not at the ground', () => {
    const { cover } = houseCover()
    const vfx = rain(cover)
    const all = streaks(vfx)
    expect(all.filter((s) => deep(s.x, s.z) && s.y < ROOF_TOP)).toEqual([])
    expect(all.filter((s) => inside(s.x, s.z) && s.y >= ROOF_TOP).length).toBeGreaterThan(0)
    expect(all.filter((s) => !inside(s.x, s.z) && s.y < ROOF_TOP).length).toBeGreaterThan(50)
  })

  it('makes no splash and no ring under the roof, only outside it', () => {
    const rings = (cover?: ReturnType<typeof createRainCover>): Array<{ x: number; z: number }> => {
      const vfx = rain(cover, 160)
      return vfx.workshop().rings.rings.filter((ring) => ring.on).map((ring) => ({ x: ring.point[0], z: ring.point[2] }))
    }
    const open = rings()
    expect(open.some((ring) => inside(ring.x, ring.z))).toBe(true)
    const covered = rings(houseCover().cover)
    expect(covered.length).toBeGreaterThan(0)
    expect(covered.filter((ring) => deep(ring.x, ring.z))).toEqual([])
  })

  it('rains through a hole in the roof, onto the floor under it, and nowhere else under the roof', () => {
    const hole = { x: 2, z: 3, radius: 1.2 }
    const { cover } = houseCover([hole])
    const vfx = rain(cover, 300)
    const under = streaks(vfx).filter((s) => inside(s.x, s.z) && s.y < ROOF_TOP)
    expect(under.length).toBeGreaterThan(3)
    expect(under.every((s) => (s.x - hole.x) ** 2 + (s.z - hole.z) ** 2 <= (hole.radius + 0.5) ** 2)).toBe(true)
  })
})

describe('rain curtain under a cover', () => {
  it('keeps the page shader without a cover and cuts the cover into a texture with one', () => {
    const plain = createRainCurtain(THREE, { random: () => 0.5 })
    expect((plain.object.material as THREE.ShaderMaterial).vertexShader).not.toBe(RAIN_CURTAIN_COVERED_VERTEX)
    const { cover } = houseCover()
    const curtain = createRainCurtain(THREE, { random: () => 0.5, cover })
    const material = curtain.object.material as THREE.ShaderMaterial
    expect(material.vertexShader).toBe(RAIN_CURTAIN_COVERED_VERTEX)
    curtain.update(storm, { x: 0, y: 1.7, z: 0 }, 1, 1)
    const texture = material.uniforms.uCover!.value as THREE.DataTexture
    const data = texture.image.data as unknown as Float32Array
    const box = material.uniforms.uCoverBox!.value as THREE.Vector3
    const at = (x: number, z: number): number => data[Math.floor((z - box.y) / RAIN_COVER_CELL) * RAIN_COVER_CELLS + Math.floor((x - box.x) / RAIN_COVER_CELL)]!
    expect(at(0, 2)).toBe(ROOF_TOP)
    expect(at(10, 2)).toBe(-1)
  })

  it('cuts the texture again when a roof opens (source invalidated)', () => {
    const holes: RainCoverHole[] = []
    const { cover, source } = houseCover(holes)
    const curtain = createRainCurtain(THREE, { random: () => 0.5, cover })
    const material = curtain.object.material as THREE.ShaderMaterial
    curtain.update(storm, { x: 0, y: 1.7, z: 0 }, 1, 1)
    const data = (material.uniforms.uCover!.value as THREE.DataTexture).image.data as unknown as Float32Array
    const box = material.uniforms.uCoverBox!.value as THREE.Vector3
    const at = (x: number, z: number): number => data[Math.floor((z - box.y) / RAIN_COVER_CELL) * RAIN_COVER_CELLS + Math.floor((x - box.x) / RAIN_COVER_CELL)]!
    expect(at(0, 2)).toBe(ROOF_TOP)
    holes.push({ x: 0, z: 2, radius: 1 })
    source.invalidate()
    curtain.update(storm, { x: 0, y: 1.7, z: 0 }, 1, 1)
    expect(at(0, 2)).toBe(-1)
    expect(at(4, 6)).toBe(ROOF_TOP)
  })
})
