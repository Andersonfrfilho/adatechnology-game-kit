import { createHousehold } from '@adatechnology/game-interactables-household'
import { create as createProps, TYPE_DEFS } from '@adatechnology/game-props3d'
import * as THREE from 'three'
import { createMeshApi } from '../src'
import type { MeshApiOptions } from '../src'

/** The pieces of the catalog every catalog test walks (exact golden, z-fighting): built from the package's own lists, so a new piece is in them. */
function stubDocument(): Document {
  const gradient = { addColorStop() {} }
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => gradient : () => {}), set: () => true })
  return { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } as unknown as Document
}

const props = createProps(undefined, { document: stubDocument() })
const household = createHousehold({ region: 'br', locale: 'en' })

export type Case = [string, () => THREE.Object3D]
export const cases: Case[] = []
for (const quality of ['high', 'game'] as const) {
  for (const def of TYPE_DEFS) {
    cases.push([
      `props3d/${def.id}:${quality}`,
      () => {
        const mesh = createMeshApi(THREE, { quality })
        props.builders[def.id]({ w: def.w, d: def.d, h: def.h, seed: 'exact', x: 0.4, z: -1.2, ry: 0.7 }, mesh.api)
        return mesh.finish().group
      },
    ])
  }
  for (const type of household.types) {
    cases.push([
      `household/${type.id}:${quality}`,
      () => {
        const mesh = createMeshApi(THREE, { quality })
        const spec = household.build(type.id, { seed: 3 }, mesh.api)
        return mesh.finish(spec).group
      },
    ])
  }
}
// options that change the output: materials given by the host, double sided planes, a material per draw, no shadows, merged parts in high
const special = new THREE.MeshPhongMaterial({ name: 'host' })
const withOptions = (id: string, options: MeshApiOptions, spec = true): Case => [
  `options/${id}:${Object.keys(options).join('+')}`,
  () => {
    const mesh = createMeshApi(THREE, options)
    const built = household.build(id, { seed: 5 }, mesh.api)
    return mesh.finish(spec ? built : undefined).group
  },
]
cases.push(withOptions('wardrobe', { materials: { wood: special, metal: special } }))
cases.push(withOptions('fridge', { doubleSidedPlanes: true, shadows: false }))
cases.push(withOptions('stove', { materialFor: (key, part) => (part !== null && key === 'metal' ? special : undefined) }))
cases.push(withOptions('blinds', { quality: 'high', mergeParts: true }))
cases.push(withOptions('wardrobe', { quality: 'game' }, false))
