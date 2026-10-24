import { hashText } from '@adatechnology/golden-tool'
import type { GoldenRecord } from '@adatechnology/golden-tool'
import { createUrban } from '@adatechnology/game-urban'
import type { TerrainOptions } from '@adatechnology/game-urban'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import { createUrbanThree } from '../src'
import { fakeDocument } from './fake-dom'
import goldenFile from './fixtures/team-golden/urban-terrain.json'
import valley from './fixtures/valley-terrain.json'

const golden = goldenFile as unknown as GoldenRecord
const events = golden.events as unknown as { type: string; data: Record<string, any> }[]
const eventOf = (type: string) => events.find((event) => event.type === type)?.data as Record<string, any>
const round4 = (value: number): number => Math.round(value * 1e4) / 1e4 + 0

describe('the ground mesh against buildWorld of the Galeria do Vale Cinzento', () => {
  const kit = createUrban()
  const terrain = kit.terrain(valley as unknown as TerrainOptions)
  const b = kit.builder({ seed: 7 })
  kit.drawTerrain(b, terrain)
  const drawn = createUrbanThree(THREE, { document: fakeDocument }).draw(b.scene())
  const mesh = drawn.root.children[0]
  const water = drawn.root.children[1]
  const expected = eventOf('terrain')

  it('has the same 181 x 181 vertices at the same positions', () => {
    const position = mesh.geometry.attributes.position
    expect(position.count).toBe(expected.vertices)
    expect(hashText(JSON.stringify(Array.from(position.array as Float32Array, round4)))).toBe(expected.positionsHash)
  })

  it('has the same vertex colours', () => {
    const color = mesh.geometry.attributes.color
    expect(hashText(JSON.stringify(Array.from(color.array as Float32Array, round4)))).toBe(expected.colorsHash)
  })

  it('has the same relief, the same material and the same shadows', () => {
    const heights = Array.from({ length: mesh.geometry.attributes.position.count }, (_, index) => mesh.geometry.attributes.position.getY(index))
    expect(round4(Math.min(...heights))).toBe(expected.minHeight)
    expect(round4(Math.max(...heights))).toBe(expected.maxHeight)
    expect(mesh.material.flatShading).toBe(expected.flatShading)
    expect(mesh.material.roughness).toBe(expected.roughness)
    expect(mesh.material.vertexColors).toBe(true)
    expect(mesh.receiveShadow).toBe(expected.receiveShadow)
    expect(mesh.castShadow).toBe(expected.castShadow)
  })

  it('puts the water plane at -0.35 m under the whole ground, receiving shadows', () => {
    expect(water.position.y).toBeCloseTo(-0.35, 9)
    expect(water.receiveShadow).toBe(true)
    expect(water.geometry.parameters.width).toBe(320)
    expect(water.material.roughness).toBe(0.3)
    expect(water.material.metalness).toBe(0.25)
  })

  it('answers heights and forest density as the page does at the 81 points of the capture', () => {
    for (const [px, py, height, forest] of eventOf('samples').rows as number[][]) {
      expect(round4(terrain.heightAt(px as number, py as number))).toBeCloseTo(height as number, 3)
      expect(round4(terrain.forestAt(px as number, py as number))).toBeCloseTo(forest as number, 3)
    }
  })
})
