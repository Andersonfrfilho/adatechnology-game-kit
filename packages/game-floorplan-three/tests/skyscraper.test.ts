import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { houseOf, planOf } from './helpers/houses'

// The skyscraper templates (design T10-estrutura-real.md §11) render like any other plan: a group a storey, every door and window of the plan, with the
// elevators, the stairs and the corridors of the core. Twenty storeys, the smallest tower the typologies accept.
describe('skyscraper plans in the renderer', () => {
  for (const template of ['office_tower', 'residential_tower']) {
    describe(template, () => {
      const tower = planOf(template, 4, 'normal', { floors: 20 })
      const { house } = houseOf(tower)

      it('draws a group a storey with meshes in each, and every door of the plan with its id', () => {
        expect(tower.floors).toHaveLength(20)
        expect(house.floors).toHaveLength(20)
        for (const floor of house.floors) expect(floor.children.length).toBeGreaterThan(3)
        expect(house.doors.map((d) => d.id)).toEqual(tower.doors.map((d) => d.id))
      })

      it('has meshes with geometry on the top storey and on the ground one (walls and floors), and the stairs between them', () => {
        for (const group of [house.floors[0], house.floors[19]]) {
          let vertices = 0
          group.traverse((node) => { const geometry = (node as Partial<THREE.Mesh>).geometry; if (geometry?.attributes?.position) vertices += geometry.attributes.position.count })
          expect(vertices).toBeGreaterThan(1000)
        }
        expect(tower.items.some((i) => i.category === 'stairs' && i.floor === 5)).toBe(true)
      })
    })
  }
})
