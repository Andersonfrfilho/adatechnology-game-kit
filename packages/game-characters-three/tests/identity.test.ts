import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { ACCESSORY_BIT, GAIT_STYLE, KIT_ACCESSORIES, TROUSER_PALETTE, accessoryPlacement, buildInstancedBody, buildKitAccessory, createBodyBatch, createBodyChunkExt, createBodyMaterial, packIdentity, unpackIdentity } from '../src'

const time = { value: 0 }

const compiled = (params: Parameters<typeof createBodyMaterial>[1]) => {
  const material = createBodyMaterial(THREE, params)
  const shader = {
    uniforms: {} as Record<string, unknown>,
    vertexShader: '#include <common>\n#include <begin_vertex>\n#include <beginnormal_vertex>\nvarying vec3 vTint;\nvGlow = mat==3.',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <dithering_fragment>\nvarying vec3 vTint;',
  }
  ;(material.onBeforeCompile as (shader: unknown) => void)(shader)
  return { material, shader }
}

describe('the identity layout', () => {
  it('packs every field into floats and reads it back', () => {
    const look = { wounds: 0b100110010001, freshness: 11, trousers: 13, gaitStyle: GAIT_STYLE.DRAG, accessories: ACCESSORY_BIT.CAP | ACCESSORY_BIT.BACKPACK, clipA: 5, clipB: 9, clipBlend: 0.4, clipSpeed: 12, leanAngle: 2.2, leanAmount: 0.6 }
    const packed = packIdentity(look)
    expect(packed.every((value) => Number.isInteger(value) && value < 2 ** 24)).toBe(true)
    const back = unpackIdentity(packed)
    expect(back).toMatchObject({ wounds: look.wounds, freshness: 11, trousers: 13, gaitStyle: 3, accessories: 5, clipA: 5, clipB: 9, clipSpeed: 12 })
    expect(back.clipBlend).toBeCloseTo(0.4, 2)
    expect(back.leanAngle).toBeCloseTo(2.2, 1)
    expect(back.leanAmount).toBeCloseTo(0.6, 2)
  })

  it('has 16 trousers', () => {
    expect(TROUSER_PALETTE).toHaveLength(16)
  })
})

describe('the identity body material', () => {
  it('without the option is the game material: no extension, three own program key', () => {
    const { material, shader } = compiled({ time })
    expect(material.customProgramCacheKey()).toBe(createBodyMaterial(THREE, { time }).customProgramCacheKey())
    expect(shader.vertexShader).not.toContain('bodyAnimX')
    expect(shader.vertexShader).toContain('bodyAnim(position, _n)')
    expect(shader.fragmentShader).not.toContain('woundTint')
  })

  it('with identity runs bodyAnimX, the palette trousers and the wound splashes, under another program key', () => {
    const plain = createBodyMaterial(THREE, { time })
    const { material, shader } = compiled({ time, identity: true })
    expect(shader.vertexShader).toContain('vec3 bodyAnimX(vec3 p, inout vec3 nrm)')
    expect(shader.vertexShader).toContain('bodyAnimX(position, _n)')
    expect(shader.vertexShader).toContain('bodyAnimX(position, _nn)')
    expect(shader.vertexShader).toContain('vec3 pants = trousersOf(iD.y);')
    expect(shader.vertexShader).toContain('attribute vec4 iD;')
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = woundTint(vTint);')
    expect(material.customProgramCacheKey()).not.toBe(plain.customProgramCacheKey())
    expect(material.customProgramCacheKey()).not.toBe(createBodyMaterial(THREE, { time, accessory: true }).customProgramCacheKey())
  })

  it('the shadow passes move the vertices the same way and leave the fragment alone', () => {
    for (const kind of [{ depth: true }, { distance: true }] as const) {
      const { shader } = compiled({ time, identity: true, ...kind })
      expect(shader.vertexShader).toContain('bodyAnimX(position, _n)')
      expect(shader.fragmentShader).toBe('#include <common>\n#include <color_fragment>\n#include <dithering_fragment>\nvarying vec3 vTint;')
    }
  })

  it('an accessory sets its pivot from the reference one and the variant offset', () => {
    const { shader } = compiled({ time, accessory: true })
    expect(shader.vertexShader).toContain('attribute vec3 refPivot; vec3 pivot;')
    expect(shader.vertexShader).toContain('pivot = refPivot*iAcc.w + iAcc.xyz;')
    expect(shader.vertexShader).toContain('bodyAnimX(_p, _n)')
    expect(shader.vertexShader).not.toContain('attribute vec3 pivot;')
  })

  it('the extension follows the hip height of the chunk', () => {
    expect(createBodyChunkExt({ hipHeight: 0.92 })).toContain('vec3 hipJ = vec3(0.,0.92,0.)')
    expect(createBodyChunkExt()).toContain('vec3 hipJ = vec3(0.,0.95,0.)')
  })
})

describe('the identity body batch', () => {
  it('adds iD to the batch and writes it per instance; without the option there is no iD', () => {
    const geometry = buildInstancedBody(THREE, { segments: 5 })
    const plain = createBodyBatch(THREE, geometry, { max: 2, time })
    expect(plain.mesh.geometry.attributes.iD).toBeUndefined()
    const batch = createBodyBatch(THREE, geometry, { max: 2, time, identity: true })
    batch.begin()
    batch.push({ a: [0, 0, 0, 0], b: [1, 1, 0, 0], c: [0, 0, 0, 0], color: { r: 1, g: 1, b: 1 }, d: [7, 8, 9, 10] })
    batch.end()
    expect(Array.from((batch.mesh.geometry.attributes.iD!.array as Float32Array).slice(0, 4))).toEqual([7, 8, 9, 10])
    expect(batch.mesh.customDistanceMaterial).toBeDefined()
    expect(plain.mesh.customDistanceMaterial).toBeUndefined()
  })

  it('an accessory batch also carries iAcc and stays within the 14 slots of a WebGL2 minimum with headroom', () => {
    const batch = createBodyBatch(THREE, buildInstancedBody(THREE, { segments: 5 }), { max: 1, time, accessory: true })
    expect(batch.mesh.geometry.attributes.iAcc).toBeDefined()
    const slots = Object.values(batch.mesh.geometry.attributes).length
    expect(slots).toBe(13)
    expect(slots).toBeLessThanOrEqual(14)
  })
})

describe('the kit accessories', () => {
  it('are drawn by the kit own builders, in a unit frame, tagged for the body shader', () => {
    for (const accessory of KIT_ACCESSORIES) {
      const geometry = buildKitAccessory(THREE, accessory)
      const count = geometry.attributes.position!.count
      expect(count, accessory.id).toBeGreaterThan(60)
      for (const name of ['normal', 'bone', 'vcol', 'refPivot', 'ppivot']) expect(geometry.attributes[name]!.count, `${accessory.id} ${name}`).toBe(count)
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      expect(box.max.y - box.min.y, accessory.id).toBeLessThan(3)
      expect(Math.abs((box.max.x + box.min.x) / 2), accessory.id).toBeLessThan(0.6)
      expect((geometry.attributes.bone!.array as Float32Array)[0]).toBe(accessory.attach === 'head' ? 1 : 0)
    }
  })

  it('are placed on a variant by its own head and torso', () => {
    const body = buildInstancedBody(THREE, { segments: 5 })
    const head = accessoryPlacement(body, 'head')
    const torso = accessoryPlacement(body, 'torso')
    expect(head[3]).toBeGreaterThan(0.1)
    expect(head[3]).toBeLessThan(0.5)
    expect(head[1]).toBeGreaterThan(torso[1])
    expect(torso[3]).toBeGreaterThan(head[3])
  })
})
