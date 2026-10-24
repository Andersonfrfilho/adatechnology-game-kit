import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createAnimalsThree } from '@adatechnology/game-animals-three'
import { createRng } from '@adatechnology/game-characters'
import { bakeBody, buildInstancedBody, createBestBuilder, createPersonBuilder } from '@adatechnology/game-characters-three'
import { UNDEAD_TYPES } from '@adatechnology/game-characters-undead'
import { SPECIES } from '@adatechnology/game-animals-species'
import { createHousehold } from '@adatechnology/game-interactables-household'
import { createMeshApi } from '@adatechnology/game-interactables-three'
import { createGoodsItems } from '@adatechnology/game-items-goods'
import { buildItem, SHAPES, SHIPPED_MODELS } from '@adatechnology/game-items-three'
import { create as createProps, TYPE_DEFS } from '@adatechnology/game-props3d'
import { buildPrimitive, clearTemplateCache, generate } from '@adatechnology/game-shapes'
import type { PrimitiveNode, ShapeSchema } from '@adatechnology/game-shapes'
import { shapeGeometries } from '@adatechnology/game-shapes-three'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet } from '@adatechnology/game-vehicles-fleet'
import { createVehiclesThree } from '@adatechnology/game-vehicles-three'
import { buildWeaponModelById, MODEL_ENTRIES } from '@adatechnology/game-weapons-three'
import * as THREE from 'three'

import type { BenchEntry } from './timing'

/** A canvas 2d context and document that accept everything and do nothing (the props atlas and the coat and vehicle textures draw on canvases). */
function stubDocument(): Document {
  const gradient = { addColorStop() {} }
  const target: Record<string, unknown> = {
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({}),
    createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (t: string) => ({ width: String(t).length * 6 }),
  }
  const ctx = new Proxy(target, { get: (t, k) => (typeof k === 'symbol' ? undefined : k in t ? t[k] : () => {}), set: () => true })
  const canvas = (): unknown => ({ width: 0, height: 0, style: {}, getContext: () => ctx, addEventListener() {}, tagName: 'CANVAS' })
  return { createElement: canvas, createElementNS: (_ns: string, _tag: string) => canvas() } as unknown as Document
}

/** The light vehicles the bench builds (fused from the full build: the slowest builders of the kit, so only a few). */
export const BENCH_VEHICLES = ['compact_hatch', 'midsize_pickup', 'sport_bike'] as const

/** The game-shapes generators, each through the template cache (cleared) and the bake of one schema. */
const GENERATOR_NODES: Record<string, PrimitiveNode> = {
  box: { kind: 'box', size: [1, 2, 3], segments: [2, 3, 4] },
  cylinder: { kind: 'cylinder', radiusTop: 0.3, radiusBottom: 0.5, height: 1, radialSegments: 32, heightSegments: 4 },
  sphere: { kind: 'sphere', radius: 0.5, widthSegments: 32, heightSegments: 16 },
  torus: { kind: 'torus', radius: 0.4, tube: 0.05, radialSegments: 12, tubularSegments: 48 },
  lathe: { kind: 'lathe', points: [[0, -0.5], [0.3, -0.5], [0.35, -0.2], [0.2, 0.3], [0.1, 0.5], [0, 0.5]], segments: 32 },
  extrude: { kind: 'extrude', shape: { outer: [[0, 0], [0.42, -0.16], [0.5, 0.05], [0.48, 0.3], [0.4, 0.42], [0, 0.22]], holes: [[[0.1, 0.05], [0.2, 0.05], [0.2, 0.15], [0.1, 0.15]]] }, depth: 0.07, bevel: { thickness: 0.015, size: 0.015, segments: 3 } },
}

/** A cabinet of a few dozen primitives and one moving part: the cost of `generate` itself (bake, merge, ranges). */
const CABINET: ShapeSchema = {
  version: 1,
  name: 'bench-cabinet',
  root: {
    kind: 'group',
    children: [
      ...Array.from({ length: 24 }, (_, i) => ({ kind: 'box' as const, size: [0.9, 0.02, 0.4] as [number, number, number], position: [0, 0.1 + i * 0.08, 0] as [number, number, number], material: i % 2 ? 'wood' : 'plain' })),
      ...Array.from({ length: 8 }, (_, i) => ({ kind: 'cylinder' as const, radiusTop: 0.015, radiusBottom: 0.015, height: 0.12, radialSegments: 12, position: [-0.4 + i * 0.11, 2, 0.21] as [number, number, number], material: 'metal' })),
      { kind: 'group', part: 'door', position: [0.45, 0, 0.2], children: [{ kind: 'box', size: [0.9, 2, 0.02], position: [-0.45, 1, 0], material: 'wood' }, { kind: 'sphere', radius: 0.03, widthSegments: 12, heightSegments: 8, position: [-0.85, 1, 0.03], material: 'metal' }] },
    ],
  },
  lod: [{ distance: 12, detail: 0.5 }],
}

export interface EntryOptions {
  /** Keep only the entries whose id contains this. */
  readonly filter?: string
}

/** Every builder the bench knows, in a stable order. */
export function benchEntries(options: EntryOptions = {}): BenchEntry[] {
  const document = stubDocument()
  const entries: BenchEntry[] = []

  // props3d: the 57 builders, drawn through the interactables mesh api (what the house and the test room use)
  const props = createProps(undefined, { document })
  for (const def of TYPE_DEFS) {
    const item = { w: def.w, d: def.d, h: def.h, seed: 'bench' }
    entries.push({
      id: `props3d/${def.id}`,
      run: () => {
        const mesh = createMeshApi(THREE)
        props.builders[def.id](item, mesh.api as never)
        return mesh.finish()
      },
    })
  }

  // household: the 51 types, the same mesh api
  const household = createHousehold({ region: 'br', locale: 'en' })
  for (const type of household.types) {
    entries.push({
      id: `household/${type.id}`,
      run: () => {
        const mesh = createMeshApi(THREE)
        const spec = household.build(type.id, { seed: 3 }, mesh.api)
        return mesh.finish(spec)
      },
    })
  }

  // items: the 24 models of the showcase and the 25 simple shapes
  const goods = createGoodsItems()
  const GAME_ONLY: Record<string, readonly [number, number, number]> = { survivor_diary: [0.16154, 0.21, 0.05452] }
  for (const { entry } of SHIPPED_MODELS) {
    const size = (GAME_ONLY[entry.id] ?? goods.get(entry.id).size) as [number, number, number]
    entries.push({ id: `items/model:${entry.id}`, run: () => buildItem(THREE, { id: entry.id, category: 'x', size, model: entry.id }) })
  }
  for (const shape of SHAPES) {
    entries.push({ id: `items/shape:${shape}`, run: () => buildItem(THREE, { id: shape, category: 'x', size: [0.3, 0.2, 0.12], shape }) })
  }

  // weapons: every model of models.json
  for (const id of Object.keys(MODEL_ENTRIES)) entries.push({ id: `weapons/${id}`, run: () => buildWeaponModelById(THREE, id) })

  // animals: the 13 species (the kit makes its coat textures once; the build is the geometry)
  const animals = createAnimalsThree(THREE, { document })
  for (const species of SPECIES) entries.push({ id: `animals/${species.id}`, run: () => animals.build(species, { phase: 0 }) })

  // vehicles: a few, light quality
  const vehicleKit = createVehicleKit({ THREE, document, locale: 'en' })
  installFleet(vehicleKit)
  const vehicles = createVehiclesThree(THREE, { kit: vehicleKit })
  for (const key of BENCH_VEHICLES) entries.push({ id: `vehicles/${key}:lite`, run: () => vehicles.build(key, { quality: 'lite', seed: 7 }) })

  // characters: the first 12 people of the Retratos, the 13 Bestiário bodies (decay 1, full detail), three bakes and the instanced body
  const people = JSON.parse(readFileSync(fileURLToPath(new URL('../../../specs/001-migracao-entregas-dos-times/game-slice/characters/people.json', import.meta.url)), 'utf8')) as Array<Record<string, unknown>>
  const createCanvas = (): HTMLCanvasElement => document.createElement('canvas') as HTMLCanvasElement
  for (const person of people.slice(0, 12)) {
    entries.push({ id: `characters/person:${String(person.id)}`, run: () => createPersonBuilder(THREE, { random: createRng(77), createCanvas }).buildPerson(person, false) })
  }
  const cards = UNDEAD_TYPES.map((type) => ({ name: type.name['pt-BR'], eye: Number.parseInt(type.eye.color, 16) }))
  const best = createBestBuilder(THREE, { types: cards, random: () => 0.5 })
  for (const card of cards) {
    entries.push({
      id: `characters/best:${card.name}`,
      run: () => {
        best.setLOD(1)
        return best.build({ type: card.name, decay: 1, seed: 2 })
      },
    })
  }
  for (const card of cards.slice(0, 3)) {
    const builders = { buildBest: (spec: Record<string, unknown>, lod: number) => (best.setLOD(lod), best.build(spec)), topMaterial: () => best.topM() }
    entries.push({ id: `characters/bake:${card.name}`, run: () => bakeBody(THREE, builders as never, { type: card.name, decay: 1, seed: 3 }, 1) })
  }
  entries.push({ id: 'characters/instanced:8', run: () => buildInstancedBody(THREE, { segments: 8 }) })

  // game-shapes: each generator from scratch, the three namespace, and a whole shape
  for (const [name, node] of Object.entries(GENERATOR_NODES)) {
    entries.push({
      id: `shapes/generator:${name}`,
      run: () => {
        clearTemplateCache()
        return buildPrimitive(node)
      },
    })
  }
  const T = shapeGeometries(THREE)
  entries.push({ id: 'shapes/three:cylinder-cached', run: () => new T.CylinderGeometry(0.05, 0.065, 1.1, 24, 2) })
  entries.push({
    id: 'shapes/generate:cabinet',
    run: () => {
      clearTemplateCache()
      return generate(CABINET)
    },
  })

  return options.filter ? entries.filter((e) => e.id.includes(options.filter as string)) : entries
}
