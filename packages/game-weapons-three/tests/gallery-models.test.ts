import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { assertMatchesGolden, createGoldenRecord, snapshotScene } from '@adatechnology/golden-tool'
import type { GoldenRecord, SceneNodeLike } from '@adatechnology/golden-tool'
import { createArsenal } from '@adatechnology/game-weapons'
import { MODEL_ENTRIES, buildWeaponModelById } from '../src/models'
import { buildCartridge, cartridgeShape } from '../src/models/cartridge'
import { modelKit } from '../src/models/kit'
import goldenModels from './fixtures/team-golden/gallery-models.json'
import goldenHashes from './fixtures/team-golden/gallery-model-hashes.json'

// Recorded from the Galeria 3D do Arsenal with tools/golden/captures/arsenal-models.js (three r128, seed 1): the page's own builders, hashed node by node.
// The page keeps its colours in linear values by hand (`convertSRGBToLinear`) and reads them back with r128's truncating `getHexString`; r160 converts
// by itself and rounds, so the SDK side reads the same linear values the same way. Node names are the SDK's own addition and are left out of the hash.
const legacyHex = (color: THREE.Color): string => (`000000${(((color.r * 255) << 16) ^ ((color.g * 255) << 8) ^ ((color.b * 255) << 0)).toString(16)}`).slice(-6)

const asGalleryNode = (node: THREE.Object3D): SceneNodeLike => {
  const mesh = node as THREE.Mesh
  const material = mesh.material as THREE.MeshStandardMaterial | undefined
  return {
    type: node.type,
    name: node.name,
    visible: node.visible,
    position: node.position,
    quaternion: node.quaternion,
    scale: node.scale,
    traverse: (visit) => node.traverse((child) => visit(asGalleryNode(child))),
    ...(mesh.geometry ? { geometry: mesh.geometry } : {}),
    ...(material ? { material: { type: material.type, color: { getHexString: () => legacyHex(material.color) }, opacity: material.opacity } } : {}),
  }
}

const ids = Object.keys(MODEL_ENTRIES)
const arsenal = createArsenal({ rules: { faults: false } })
const sceneOf = (id: string): SceneNodeLike => {
  const model = buildWeaponModelById(THREE, id)
  if (!model) throw new Error(`no model for ${id}`)
  return asGalleryNode(model.root)
}

type Recorded = { type: string; data: { index: number; name: string; caliber?: string; length?: number; barrel?: number } }

describe('Galeria 3D do Arsenal: weapon models', () => {
  const golden = goldenModels as unknown as GoldenRecord
  const representatives = (golden.events as unknown as Recorded[]).filter((event) => event.type === 'weapon')

  for (const { data } of representatives) {
    const id = ids[data.index] as string
    it(`${data.name} (${id}) is the same model node by node: shapes, colours, transforms`, () => {
      expect(MODEL_ENTRIES[id]).toMatchObject({ caliber: data.caliber, length: data.length, barrel: data.barrel })
      const label = `weapon_${String(data.index).padStart(2, '0')}`
      const sdk = createGoldenRecord({ name: golden.name, seed: golden.seed, events: golden.events, scenes: { [label]: sceneOf(id) }, hashOptions: { ignoreNames: true } })
      assertMatchesGolden({ ...golden, scenes: { [label]: golden.scenes[label] as GoldenRecord['scenes'][string] } }, sdk)
    })
  }

  it('all 77 gallery weapons hash like the page, and the weapon of the gallery behind each id is the one the table names', () => {
    const recorded = goldenHashes as unknown as GoldenRecord
    const mismatches: string[] = []
    ;(recorded.events as unknown as Recorded[])
      .filter((event) => event.type === 'weapon')
      .forEach(({ data }) => {
        const id = ids[data.index] as string
        expect(MODEL_ENTRIES[id]).toMatchObject({ caliber: data.caliber, length: data.length, barrel: data.barrel })
        const snapshot = snapshotScene(sceneOf(id), { ignoreNames: true })
        const expected = recorded.scenes[`weapon_${String(data.index).padStart(2, '0')}`]
        if (snapshot.hash !== expected?.hash || snapshot.objects !== expected.objects) mismatches.push(`${id}: ${expected?.hash}/${expected?.objects} -> ${snapshot.hash}/${snapshot.objects}`)
      })
    expect(mismatches).toEqual([])
  })

  it('the variant of a weapon is built like the weapon', () => {
    const variant = buildWeaponModelById(THREE, 'remington_700_300wm')
    const base = buildWeaponModelById(THREE, 'remington_700')
    expect(snapshotScene(asGalleryNode(variant!.root), { ignoreNames: true }).hash).toBe(snapshotScene(asGalleryNode(base!.root), { ignoreNames: true }).hash)
  })
})

// the page's cartridge list, by name, and the calibre of the SDK each one is
const CARTRIDGES: Record<string, string> = {
  '.22 LR': '22lr', '.380 ACP': '380acp', '9×18 Makarov': '9x18', '9×19 mm': '9x19', '.40 S&W': '40sw', '.45 ACP': '45acp', '5,7×28 mm': '5_7x28', '.38 SPL': '38spl',
  '.357 Magnum': '357mag', '.44 Magnum': '44mag', '.50 AE': '50ae', '12 ga': '12ga_00buck', '5,56×45 mm': '5_56x45', '5,45×39 mm': '5_45x39', '7,62×39 mm': '7_62x39',
  '.30-30 Win': '30_30', '7,62×51 mm': '7_62x51', '7,62×54R': '7_62x54r', '.30-06': '30_06', '.300 Win Mag': '300wm', '.338 Lapua': '338lapua', '.50 BMG': '50bmg',
}

// The page draws the .50 BMG bullet 13,0 mm; the SDK keeps the real 12,7 mm (decision A6 of the data task), the only difference of the list.
const PAGE_BULLET_MM: Record<string, number> = { '50bmg': 13 }

describe('Galeria 3D do Arsenal: cartridges per calibre', () => {
  const recorded = goldenHashes as unknown as GoldenRecord
  for (const event of (recorded.events as unknown as Recorded[]).filter((entry) => entry.type === 'cartridge')) {
    const calibreId = CARTRIDGES[event.data.name] as string
    it(`${event.data.name} is built from the dimensions of ${calibreId}`, () => {
      const caliber = arsenal.calibers.get(calibreId)
      expect(caliber?.cartridge).toBeDefined()
      const dims = { ...caliber!.cartridge!, ...(PAGE_BULLET_MM[calibreId] ? { projectileDiameter: PAGE_BULLET_MM[calibreId] } : {}) }
      const snapshot = snapshotScene(asGalleryNode(buildCartridge(modelKit(THREE), dims, cartridgeShape(caliber!, dims))), { ignoreNames: true })
      const expected = recorded.scenes[`cartridge_${String(event.data.index).padStart(2, '0')}`]
      expect(snapshot).toMatchObject({ hash: expected?.hash, objects: expected?.objects })
    })
  }
})
