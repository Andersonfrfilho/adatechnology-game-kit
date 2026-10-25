import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { createVfxRenderer } from '../src'

// The first-person muzzle flash and its smoke as the weapons package drew them before they became the recipe `viewmodel_muzzle_flash`: fx/effects.ts and fx/particles.ts of
// game-weapons-three at commit d15e990, run unchanged on three.js (tools/golden/bin/record-viewmodel-flash.mjs). The recipe must draw the same solids at the same places.
type Solid = { geometry: string; parameters: Record<string, unknown>; material: { type: string; color: number; opacity: number; additive: boolean; transparent: boolean; depthWrite: boolean }; position: number[]; turn: number[]; scale: number }
type Sample = { frame: number; flash: Solid[]; light: { intensity: number; distance: number; decay: number; color: number; position: number[] }; puffs: Solid[] }
type Run = { name: string; seed: number; size: number; point: [number, number, number]; dt: number; orientation: [number, number, number, number]; frames: Sample[] }
type Fixture = { source: { commit: string }; frames: number; runs: Run[] }
const fixture = JSON.parse(readFileSync(new URL('../../../tools/golden/fixtures/weapons/viewmodel-flash.json', import.meta.url), 'utf8')) as Fixture

const DIGITS = 9
const near = (actual: readonly number[], expected: readonly number[], label: string): void => {
  expect(actual.length, label).toBe(expected.length)
  expected.forEach((value, index) => expect(actual[index]!, `${label}[${index}]`).toBeCloseTo(value, DIGITS))
}
// two quaternions of the same turn may differ by sign
const sameTurn = (actual: readonly number[], expected: readonly number[], label: string): void => {
  const sign = actual.reduce((sum, value, index) => sum + value * expected[index]!, 0) < 0 ? -1 : 1
  near(actual.map((value) => value * sign), expected, label)
}

function solidOf(mesh: THREE.Mesh): Solid {
  mesh.updateWorldMatrix(true, false)
  const position = new THREE.Vector3()
  const rotation = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  mesh.matrixWorld.decompose(position, rotation, scale)
  const material = mesh.material as THREE.MeshBasicMaterial
  return {
    geometry: mesh.geometry.type,
    parameters: (mesh.geometry as THREE.BufferGeometry & { parameters: Record<string, unknown> }).parameters,
    material: { type: material.type, color: material.color.getHex(), opacity: material.opacity, additive: material.blending === THREE.AdditiveBlending, transparent: material.transparent, depthWrite: material.depthWrite },
    position: position.toArray(),
    turn: rotation.toArray(),
    scale: scale.x,
  }
}

function compare(actual: Solid, expected: Solid, label: string): void {
  expect(actual.geometry, label).toBe(expected.geometry)
  for (const [key, value] of Object.entries(expected.parameters)) {
    if (typeof value === 'number') expect(actual.parameters[key] as number, `${label}.${key}`).toBeCloseTo(value, DIGITS)
    else expect(actual.parameters[key], `${label}.${key}`).toBe(value)
  }
  expect(actual.material.type, label).toBe(expected.material.type)
  expect(actual.material.color, label).toBe(expected.material.color)
  expect(actual.material.opacity, `${label} opacity`).toBeCloseTo(expected.material.opacity, DIGITS)
  expect(actual.material.additive, label).toBe(expected.material.additive)
  expect(actual.material.transparent, label).toBe(expected.material.transparent)
  expect(actual.material.depthWrite, label).toBe(expected.material.depthWrite)
  near(actual.position, expected.position, `${label} position`)
  sameTurn(actual.turn, expected.turn, `${label} turn`)
  expect(actual.scale, `${label} scale`).toBeCloseTo(expected.scale, DIGITS)
}

describe(`the muzzle flash of the weapon in the hands, against fx/effects.ts at ${fixture.source.commit}`, () => {
  for (const run of fixture.runs) {
    it(`draws the same flash, light and smoke frame by frame: ${run.name}`, () => {
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()
      const renderer = createVfxRenderer(THREE, { scene, camera, vfx: { profile: 'high' }, reducedMotion: true })
      const handle = renderer.play({ effect: 'viewmodel_muzzle_flash', point: run.point, orientation: run.orientation, seed: run.seed, values: { size: run.size } })
      expect(handle).not.toBeNull()
      const wanted = new Map(run.frames.map((sample) => [sample.frame, sample]))
      for (let frame = 1; frame <= fixture.frames; frame++) {
        renderer.update(run.dt)
        const sample = wanted.get(frame)
        if (!sample) continue
        const label = `frame ${frame}`
        const meshes = (scene.getObjectByName('workshop-meshes')?.children ?? []) as THREE.Mesh[]
        const solids = meshes.map(solidOf)
        const flash = solids.filter((solid) => solid.material.type === 'MeshBasicMaterial')
        const puffs = solids.filter((solid) => solid.material.type === 'MeshStandardMaterial')
        expect(flash.length, `${label} pieces`).toBe(sample.flash.length)
        sample.flash.forEach((expected, index) => compare(flash[index]!, expected, `${label} piece ${index}`))
        expect(puffs.length, `${label} puffs`).toBe(sample.puffs.length)
        sample.puffs.forEach((expected, index) => compare(puffs[index]!, expected, `${label} puff ${index}`))
        const lit: THREE.PointLight[] = []
        scene.getObjectByName('workshop')?.traverse((node) => {
          if ((node as THREE.PointLight).isPointLight && (node as THREE.PointLight).intensity > 0) lit.push(node as THREE.PointLight)
        })
        if (sample.light.intensity === 0) expect(lit, `${label} light`).toHaveLength(0)
        else {
          expect(lit, `${label} light`).toHaveLength(1)
          const light = lit[0]!
          expect(light.intensity, `${label} intensity`).toBeCloseTo(sample.light.intensity, DIGITS)
          expect(light.distance).toBeCloseTo(sample.light.distance, DIGITS)
          expect(light.decay).toBe(sample.light.decay)
          expect(light.color.getHex()).toBe(sample.light.color)
          near(light.position.toArray(), sample.light.position, `${label} light position`)
        }
      }
      renderer.dispose()
    })
  }

  it('holds the gallery numbers: 55 ms, a scale from 0.6 growing by 0.9, a light of 4 k over 2 k metres', () => {
    const first = fixture.runs[0]!
    expect(first.frames[0]!.light.intensity).toBeCloseTo(4 * first.size, DIGITS)
    expect(first.frames[0]!.light.distance).toBeCloseTo(2 * first.size, DIGITS)
    const [one, two] = first.frames
    expect(two!.flash[0]!.scale - one!.flash[0]!.scale).toBeCloseTo((0.9 * first.dt) / 0.055, 8)
  })
})
