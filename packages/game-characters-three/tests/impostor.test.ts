import * as THREE from 'three'
import { beforeAll, describe, expect, it } from 'vitest'

import { IMPOSTOR_ANGLES, IMPOSTOR_FRAMES, bakeImpostorAtlas, buildInstancedBody, createImpostorBatch, walkPoseVertex } from '../src'
import type { ImpostorAtlas } from '../src'

const body = (() => {
  const geometry = buildInstancedBody(THREE, { segments: 5 })
  geometry.computeBoundingBox()
  return { geometry, height: geometry.boundingBox!.max.y }
})()

const cellPixels = (atlas: ImpostorAtlas, silhouette: number, frame: number, angle: number): Uint8Array => {
  const cell = (silhouette * IMPOSTOR_FRAMES + frame) * IMPOSTOR_ANGLES + angle
  const x0 = (cell % atlas.columns) * atlas.cellWidth
  const y0 = Math.floor(cell / atlas.columns) * atlas.cellHeight
  const stride = atlas.columns * atlas.cellWidth
  const out = new Uint8Array(atlas.cellWidth * atlas.cellHeight * 4)
  for (let y = 0; y < atlas.cellHeight; y++) out.set(atlas.pixels.subarray(((y0 + y) * stride + x0) * 4, ((y0 + y) * stride + x0 + atlas.cellWidth) * 4), y * atlas.cellWidth * 4)
  return out
}
const covered = (pixels: Uint8Array): number => pixels.filter((_, index) => index % 4 === 3 && pixels[index] === 255).length
const bonesIn = (pixels: Uint8Array): Set<number> => {
  const bones = new Set<number>()
  for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3] === 255) bones.add(pixels[index]! / 20)
  return bones
}
const width = (atlas: ImpostorAtlas, pixels: Uint8Array): number => {
  let min = atlas.cellWidth
  let max = -1
  for (let y = 0; y < atlas.cellHeight; y++)
    for (let x = 0; x < atlas.cellWidth; x++)
      if (pixels[(y * atlas.cellWidth + x) * 4 + 3] === 255) {
        min = Math.min(min, x)
        max = Math.max(max, x)
      }
  return max - min + 1
}

describe('the impostor atlas', () => {
  let atlas: ImpostorAtlas
  beforeAll(() => {
    atlas = bakeImpostorAtlas(THREE, [body, body])
  })

  it('holds 8 views and 8 walk steps of each silhouette, RGBA8 with nearest filtering', () => {
    expect(atlas.silhouettes).toBe(2)
    expect(atlas.columns * atlas.rows).toBeGreaterThanOrEqual(2 * 64)
    expect(atlas.texture.minFilter).toBe(THREE.NearestFilter)
    expect(atlas.texture.magFilter).toBe(THREE.NearestFilter)
    expect(atlas.texture.generateMipmaps).toBe(false)
    expect(atlas.texture.format).toBe(THREE.RGBAFormat)
  })

  it('draws a body in every cell, with the bones of the shader in the texel', () => {
    for (const [frame, angle] of [[0, 0], [3, 2], [7, 6]] as const) {
      const pixels = cellPixels(atlas, 1, frame, angle)
      expect(covered(pixels), `${frame}/${angle}`).toBeGreaterThan(150)
      const bones = bonesIn(pixels)
      expect(bones.has(0)).toBe(true)
      expect([...bones].every((bone) => Number.isInteger(bone) && bone >= 0 && bone <= 11)).toBe(true)
    }
    expect(bonesIn(cellPixels(atlas, 0, 0, 0)).size).toBeGreaterThanOrEqual(8)
  })

  it('looks different from the front and from the side, and at each step of the walk', () => {
    const front = cellPixels(atlas, 0, 0, 0)
    const side = cellPixels(atlas, 0, 0, 2)
    expect(Buffer.compare(Buffer.from(front), Buffer.from(side))).not.toBe(0)
    expect(width(atlas, front)).not.toBe(width(atlas, side))
    expect(Buffer.compare(Buffer.from(cellPixels(atlas, 0, 0, 2)), Buffer.from(cellPixels(atlas, 0, 4, 2)))).not.toBe(0)
  })

  it('a body seen from the back is the mirror of the front in width', () => {
    expect(Math.abs(width(atlas, cellPixels(atlas, 0, 0, 0)) - width(atlas, cellPixels(atlas, 0, 0, 4)))).toBeLessThanOrEqual(3)
  })
})

describe('the walk of the atlas', () => {
  it('moves the legs against each other and leaves the trunk where it is', () => {
    const at = (bone: number, step: number) => walkPoseVertex([0.1, 0.4, 0], [0, 0, 1], { bone, pivot: [0.1, 0.9, 0], parentPivot: [0.1, 0.9, 0] }, step, 8).position
    expect(at(4, 2)[2]).not.toBeCloseTo(at(5, 2)[2], 3)
    expect(at(0, 0)[1]).toBeCloseTo(at(0, 4)[1], 1)
  })
})

describe('the impostor batch', () => {
  it('packs the instances and counts them; one draw call whatever the count', () => {
    const atlas = bakeImpostorAtlas(THREE, [body])
    const batch = createImpostorBatch(THREE, atlas, { max: 3 })
    batch.begin()
    for (let k = 0; k < 5; k++) batch.push({ a: [k, 2 * k, 0.5, 0.25], scale: [1.1, 0.9], silhouette: 0, y: 0.2, c: [2, 0.5, 1, 0.3], color: { r: 0.1, g: 0.2, b: 0.3 }, d: [0, 7, 0, 0] })
    batch.end()
    expect(batch.count).toBe(3)
    expect(batch.mesh.count).toBe(3)
    expect(Array.from((batch.mesh.geometry.attributes.iB!.array as Float32Array).slice(0, 4))).toEqual([expect.closeTo(1.1, 5), expect.closeTo(0.9, 5), 0, expect.closeTo(0.2, 5)])
    expect(batch.material.fragmentShader).toContain('TROUSERS[int(vTrousers)]')
    expect(batch.material.fragmentShader).toContain('if ((bone==2.||bone==7.) && missing(2.)) discard;')
    expect((batch.material.uniforms.uBox!.value as unknown[]).length).toBe(1)
  })
})
