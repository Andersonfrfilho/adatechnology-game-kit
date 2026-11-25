import { MATERIALS } from '@adatechnology/game-destruction'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'

type Lit = { readonly name: string; readonly mesh: THREE.Mesh }

const luminanceOf = (color: THREE.Color): number => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b
const BY_ID = new Set(MATERIALS.map((def) => def.id))

/** The merged diffuser meshes (`<group>/emissive`) of every ceiling lamp of a house. */
function diffusersOf(root: THREE.Object3D): Lit[] {
  const found: Lit[] = []
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && /^ix:light:.*(ceiling_light|@).*\/emissive/.test(mesh.name)) found.push({ name: mesh.name, mesh })
  })
  return found
}

const materialOf = (mesh: THREE.Mesh): THREE.Material => [mesh.material].flat()[0] as THREE.Material

describe('ceiling lamp diffuser', () => {
  for (const [template, quality] of [['casaA', 'high'], ['casaA', 'game'], ['media_terrea_moderna', 'high']] as const) {
    describe(`${template} (${quality})`, () => {
      const { house } = houseOf(planOf(template, 3), {}, { quality })
      const diffusers = diffusersOf(house.group)

      it('has diffusers', () => expect(diffusers.length).toBeGreaterThan(0))

      it('is milky white when the light is off', () => {
        for (const { name, mesh } of diffusers) {
          const material = materialOf(mesh) as THREE.MeshPhongMaterial
          expect(material.vertexColors, name).toBe(false)
          expect(luminanceOf(material.color), name).toBeGreaterThan(0.8)
          // white, not caramel: no channel far from the others
          expect(Math.max(material.color.r, material.color.g, material.color.b) - Math.min(material.color.r, material.color.g, material.color.b), name).toBeLessThan(0.1)
          expect(material.emissive?.getHex() ?? 0, name).toBe(0)
          expect(material.transparent, name).toBe(true)
        }
      })

      it('is made of glass for the destruction world', () => {
        for (const { name, mesh } of diffusers) {
          expect(mesh.userData.destructionMaterial, name).toBe('glass')
          expect(BY_ID.has(mesh.userData.destructionMaterial as string)).toBe(true)
        }
      })

      it('glows when the light is switched on and not when it is off', () => {
        const rooms = [...new Set(diffusers.map(({ name }) => /^ix:light:([^./@]+)/.exec(name)?.[1]).filter(Boolean))] as string[]
        expect(rooms.length).toBeGreaterThan(0)
        const off = materialOf(diffusers[0]!.mesh)
        for (const room of rooms) house.toggleLight(room)
        const on = materialOf(diffusers[0]!.mesh)
        expect(on).not.toBe(off)
        expect(on.type).toBe('MeshBasicMaterial')
        expect((on as THREE.MeshBasicMaterial).vertexColors).toBe(true)
        for (const room of rooms) house.toggleLight(room)
        expect(materialOf(diffusers[0]!.mesh)).toBe(off)
      })
    })
  }
})
