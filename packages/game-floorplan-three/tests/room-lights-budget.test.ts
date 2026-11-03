import { createLightBudget } from '@adatechnology/game-render-three'
import { describe, expect, it } from 'vitest'

import { THREE, houseOf, planOf } from './helpers/houses'

const EMPTY = [1e9, 1e9, -1e9, -1e9]

function maskUniforms(renderer: any) {
  const material = Object.values(renderer.materials as Record<string, any>).find((m) => m?.onBeforeCompile && m.userData?.roomLightMask)
  const shader: any = { uniforms: {}, vertexShader: 'void main() {\n#include <begin_vertex>', fragmentShader: 'void main() {\ngetPointLightInfo( pointLight, geometryPosition, directLight );' }
  material.onBeforeCompile(shader, null)
  return shader.uniforms
}

describe('room lights through a LightBudget', () => {
  it('writes each room mask at the slot of its light, even when other lights hold the slots before it', () => {
    const { house, renderer } = houseOf(planOf('casaA', 3), {}, { night: true })
    const scene = new THREE.Scene()
    const budget = createLightBudget(THREE, scene, { point: 8, spot: 0, pointShadows: 2, shadowSettings: { bias: -0.0012, normalBias: 0.05, near: 0.12 } })
    const blast = budget.acquire({ owner: 'vfx.blast', priority: 900, urgent: true, color: 0xffffff, intensity: 1, distance: 10, position: [50, 0, 50] })!
    const rooms = renderer.lighting({ scene, n: 4, shadows: 2, budget })
    expect(rooms.lights.map((handle: any) => handle.slot)).not.toContain(blast.slot)
    const focus = new THREE.Vector3(0, 1.6, 0)
    rooms.update([house], focus, {})
    expect(rooms.stats.rooms).toBeGreaterThan(1)
    const uniforms = maskUniforms(renderer)
    expect(uniforms.uRB0.value.length).toBe(8 * 4)
    expect(Array.from(uniforms.uRB0.value.slice(blast.slot * 4, blast.slot * 4 + 4))).toEqual(EMPTY)
    for (let index = 0; index < rooms.n; index++) {
      const slot = rooms.lights[index].slot
      const crate = rooms.crates[index]
      if (!crate) continue
      expect(Array.from(uniforms.uRB0.value.slice(slot * 4, slot * 4 + 4))).toEqual(crate.rects[0].map((value: number) => Math.fround(value)))
    }
    const lit = rooms.lights.filter((_: any, index: number) => rooms.crates[index]).map((handle: any) => (budget.group.children[handle.slot] as THREE.PointLight).intensity)
    expect(lit.every((intensity: number) => intensity > 0)).toBe(true)
  })

  it('fails loudly when the budget cannot lease the slots, and gives them back on dispose', () => {
    const { renderer } = houseOf(planOf('casaA', 3), {}, { night: true })
    const budget = createLightBudget(THREE, new THREE.Scene(), { point: 3, spot: 0, pointShadows: 2 })
    expect(() => renderer.lighting({ n: 6, shadows: 2, budget })).toThrow(/no 6 free point slots/)
    const rooms = renderer.lighting({ n: 3, shadows: 2, budget })
    expect(budget.stats().leased).toBe(3)
    rooms.dispose()
    expect(budget.stats().leased).toBe(0)
  })
})
