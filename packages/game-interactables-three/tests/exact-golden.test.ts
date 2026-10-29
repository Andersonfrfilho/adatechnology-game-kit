import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { exactSnapshot } from '@adatechnology/golden-tool'
import { createHousehold } from '@adatechnology/game-interactables-household'
import { create as createProps, TYPE_DEFS } from '@adatechnology/game-props3d'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createMeshApi } from '../src'
import type { MeshApiOptions } from '../src'

/**
 * Every bit of what the mesh api builds, for the 57 props and the 51 household objects in both qualities (and a few options): recorded on
 * the old path (its own templates and arrays) before the move to game-shapes, so the move cannot change a byte. `UPDATE_EXACT=1` rewrites it.
 */
const FIXTURE = fileURLToPath(new URL('./fixtures/exact-mesh-api.json', import.meta.url))

function stubDocument(): Document {
  const gradient = { addColorStop() {} }
  const ctx = new Proxy({}, { get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => gradient : () => {}), set: () => true })
  return { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) } as unknown as Document
}

const props = createProps(undefined, { document: stubDocument() })
const household = createHousehold({ region: 'br', locale: 'en' })

type Case = [string, () => THREE.Object3D]
const cases: Case[] = []
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

const recorded: Record<string, { hash: string; nodes: readonly string[] }> = (() => {
  try {
    return JSON.parse(readFileSync(FIXTURE, 'utf8'))
  } catch {
    return {}
  }
})()

describe('the mesh api, bit for bit', () => {
  if (process.env.UPDATE_EXACT) {
    it('records the fixture', () => {
      const out: Record<string, { hash: string; nodes: readonly string[] }> = {}
      for (const [id, build] of cases) {
        const { hash, nodes } = exactSnapshot(build())
        out[id] = { hash, nodes }
      }
      writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + '\n')
    })
    return
  }
  it('has a recording of every case', () => {
    expect(Object.keys(recorded).sort()).toEqual(cases.map(([id]) => id).sort())
  })
  it.each(cases)('%s', (id, build) => {
    const snapshot = exactSnapshot(build())
    if (snapshot.hash !== recorded[id]?.hash) expect(snapshot.nodes).toEqual(recorded[id]?.nodes)
    expect(snapshot.hash).toBe(recorded[id]?.hash)
  })
})
