import { assertMatchesGolden, createGoldenRecord, snapshotScene } from '@adatechnology/golden-tool'
import type { GoldenRecord, SceneNodeLike } from '@adatechnology/golden-tool'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'

import { createItemKit, setWear, SHIPPED_MODELS } from '../src'
import golden from './fixtures/team-golden/items-showcase.json'

// Recorded from the Itens do Vale Cinzento page with tools/golden/captures/items-showcase.js (three r128, seed 1): the page's own builders, hashed node by node
// as they return, before the page's normalisation to 1.55 units, and the material of each model at the three wear stages.
// r128 stores a hex colour as given and reads it back by truncating (`getHexString`); r160 converts to linear and rounds. The SDK side reads the colour back the way r128 did
// (the channel over 255, times 255, truncated), so a colour that went through the conversion and came out one step off is not a difference of the drawing.
const channel = (value: number): number => Math.round(value * 255) / 255
const legacyHex = (color: THREE.Color): string => {
  const rgb = { r: 0, g: 0, b: 0 }
  color.getRGB(rgb, 'srgb')
  return (`000000${(((channel(rgb.r) * 255) << 16) ^ ((channel(rgb.g) * 255) << 8) ^ ((channel(rgb.b) * 255) << 0)).toString(16)}`).slice(-6)
}

const asPageNode = (node: THREE.Object3D): SceneNodeLike => {
  const mesh = node as THREE.Mesh
  const material = mesh.material as THREE.MeshStandardMaterial | undefined
  return {
    type: node.type,
    name: node.name,
    visible: node.visible,
    position: node.position,
    quaternion: node.quaternion,
    scale: node.scale,
    traverse: (visit) => node.traverse((child) => visit(asPageNode(child))),
    ...(mesh.geometry ? { geometry: mesh.geometry } : {}),
    ...(material ? { material: { type: material.type, color: { getHexString: () => legacyHex(material.color) }, opacity: material.opacity } } : {}),
  }
}

type Recorded = { type: string; data: { index: number; id: string; box?: number[]; stage?: number; rows?: Array<[string, number, number, number, number, number, number]> } }
const record = golden as unknown as GoldenRecord
const events = record.events as unknown as Recorded[]
const label = (index: number): string => `model_${String(index).padStart(2, '0')}`

// The positions of a few shapes that three r160 builds a little differently than r128 are compared with a tolerance; none so far.
const KNOWN_DEVIATIONS: ReadonlySet<string> = new Set([])

describe('Itens do Vale Cinzento: the 24 showcase models', () => {
  const models = events.filter((event) => event.type === 'model')

  it('ships the models in the order of the page, with the teamId and the box the page has', () => {
    expect(models.map((event) => event.data.id)).toEqual(SHIPPED_MODELS.map(({ entry }) => entry.teamId))
    for (const [index, event] of models.entries()) expect(SHIPPED_MODELS[index]?.entry.teamBox, event.data.id).toEqual(event.data.box)
  })

  for (const [index, event] of models.entries()) {
    const shipped = SHIPPED_MODELS[index]!
    if (KNOWN_DEVIATIONS.has(shipped.entry.id)) continue
    it(`${event.data.id} (${shipped.entry.id}) is the same group node by node: shapes, colours, transforms`, () => {
      const kit = createItemKit(THREE)
      const sdk = createGoldenRecord({ name: record.name, seed: record.seed, events: record.events, scenes: { [label(index)]: asPageNode(shipped.builder(kit)) }, hashOptions: { ignoreNames: true } })
      assertMatchesGolden({ ...record, scenes: { [label(index)]: record.scenes[label(index)] as GoldenRecord['scenes'][string] } }, sdk)
    })
  }

  it('all 24 hash like the page', () => {
    const mismatches: string[] = []
    for (const [index, { entry, builder }] of SHIPPED_MODELS.entries()) {
      if (KNOWN_DEVIATIONS.has(entry.id)) continue
      const snapshot = snapshotScene(asPageNode(builder(createItemKit(THREE))), { ignoreNames: true })
      const expected = record.scenes[label(index)]
      if (snapshot.hash !== expected?.hash || snapshot.objects !== expected.objects) mismatches.push(`${entry.id}: ${expected?.hash}/${expected?.objects} -> ${snapshot.hash}/${snapshot.objects}`)
    }
    expect(mismatches).toEqual([])
  })

  it('has the materials of the page at the three wear stages: colour, roughness, metalness and opacity', () => {
    const wear = events.filter((event) => event.type === 'wear')
    expect(wear).toHaveLength(24 * 3)
    for (const { data } of wear) {
      const shipped = SHIPPED_MODELS[data.index]!
      const kit = createItemKit(THREE)
      shipped.builder(kit)
      setWear(kit.materials, data.stage as 0 | 1 | 2)
      const rows = kit.materials.map((material) => {
        const rgb = { r: 0, g: 0, b: 0 }
        material.color.getRGB(rgb, 'srgb')
        return [material.userData.tag, rgb.r, rgb.g, rgb.b, material.roughness, material.metalness, material.opacity] as const
      })
      expect(rows.length, `${shipped.entry.id} stage ${data.stage}`).toBe(data.rows?.length)
      rows.forEach((row, at) => {
        const expected = data.rows?.[at] as [string, number, number, number, number, number, number]
        expect(row[0], `${shipped.entry.id}#${at} stage ${data.stage} tag`).toBe(expected[0])
        for (let field = 1; field <= 6; field++) expect(Math.abs((row[field] as number) - (expected[field] as number)), `${shipped.entry.id}#${at} stage ${data.stage} field ${field}`).toBeLessThan(0.0011)
      })
    }
  })
})
