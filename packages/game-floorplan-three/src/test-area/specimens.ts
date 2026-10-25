import { create } from '../create.js'
import type { HouseRendererOptions } from '../types.js'
import type { FloorplanEngineLike, SpecimenDef } from './types.js'

/**
 * The five items of the team's house area (sala-de-testes/area-casas): a frame house, a whole house, a wood-frame house, a log cabin and a tent. The team's frame house is its single-storey house A; here it is the
 * two-storey townhouse, because the ceiling slab of the single-storey plan keeps standing on its bearing partitions when two pillars go (see evidence, T2.6). The frame house is sized for four pillars that carry
 * the slab together (`sizing`): one lost leaves the other three at 0.96 of their capacity, two lost overload the rest (owner, 2026-10-24: "4 pilares e a sustentação é a soma dos 4").
 */
export const DEFAULT_SPECIMENS: readonly SpecimenDef[] = [
  { id: 'house_casa_portico', template: 'townhouse', seed: 1, portico: true, sizing: { safety: 0.72, redundancy: 0.97 } },
  { id: 'house_casa_inteira', template: 'single_storey_a', seed: 1 },
  { id: 'house_casa_wood_frame', template: 'wood_frame_house', seed: 1 },
  { id: 'house_casa_tronco', template: 'log_cabin', seed: 1 },
  { id: 'house_barraca', template: 'campsite', seed: 1 },
]

/** Colour of each material in the specimens (the team's table). */
const COLOR: Record<string, number> = {
  brick: 0xa8553a, concrete: 0x9a9a96, plaster: 0xd8d4c8, ceramic: 0xb4623e, glass: 0xaecfd8, tempered_glass: 0xaecfd8, wood_soft: 0xb08a58, wood_hard: 0x7a5434, plywood: 0xb89a6a, mdf: 0xb89a6a,
  steel: 0x8a8e92, aluminium: 0xb8bcc0, plastic: 0x2f6aa8, copper: 0xb87333, stone: 0x8a8a84, fabric: 0xcfc4a8,
}

/** What the area keeps of a built specimen: the structure spec the house draws (what the destruction world is given) and the plan it came from. */
export interface SpecimenSpec {
  readonly spec: any
  readonly plan: any
}

const cache = new WeakMap<object, Map<string, SpecimenSpec>>()

/**
 * The structure spec of a specimen: the engine draws the plan, the house renderer draws the house, and the house describes its structure (`house.structure.spec`) with what the water tank holds and
 * what makes the gas bottle explode. The spec is cached per three.js namespace and specimen; each call hands out a copy.
 */
export function specimenSpec(THREE: any, engine: FloorplanEngineLike, def: SpecimenDef, houseOptions: Partial<HouseRendererOptions> = {}): SpecimenSpec {
  let byId = cache.get(THREE)
  if (!byId) cache.set(THREE, (byId = new Map()))
  const key = `${def.id}|${def.template}|${def.seed ?? 1}|${def.state ?? 'normal'}|${def.portico ? 'p' : ''}|${def.sizing ? JSON.stringify(def.sizing) : ''}`
  let made = byId.get(key)
  if (!made) {
    const plan = engine.generate(def.template, { seed: def.seed ?? 1, ...(def.state ? { state: def.state } : {}) })
    // no world: the house is drawn only to describe its structure and thrown away
    const house = create(THREE, { ...houseOptions, destruction: undefined, destructionRenderer: undefined, interactives: undefined, vegetation: undefined, fleet: null }).build(plan, { quality: 'game', terrain: false, noPerimeter: true })
    const spec = house.structure.spec({ wallDetail: 'coarse', ...(def.portico ? { portico: true } : {}), ...(def.sizing ?? {}) })
    house.dispose()
    made = { spec, plan }
    byId.set(key, made)
  }
  return { spec: JSON.parse(JSON.stringify(made.spec)), plan: made.plan }
}

/**
 * One box (or cylinder, sphere) per part, named by the part id and coloured by its material, in the space of the house (the origin at the corner of the plan): what the team's house area draws, so the
 * room binds each mesh to the part of the same name. The anchored terrain slab is left out (the room has a floor).
 */
export function buildSpecimenMeshes(THREE: any, spec: any): any {
  const root = new THREE.Group()
  for (const part of spec.parts) {
    if (part.id === 'ground') continue
    const shape = part.shape
    const geometry = shape.kind === 'cylinder' ? new THREE.CylinderGeometry(shape.radius, shape.radius, shape.height, 14) : shape.kind === 'sphere' ? new THREE.SphereGeometry(shape.radius, 12, 8) : new THREE.BoxGeometry(shape.size[0], shape.size[1], shape.size[2])
    const glass = /glass/.test(part.material)
    const material = new THREE.MeshStandardMaterial({ color: COLOR[part.material] ?? 0x888888, roughness: 0.8, metalness: part.material === 'steel' || part.material === 'aluminium' ? 0.5 : 0, transparent: glass, opacity: glass ? 0.45 : 1 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = part.id
    mesh.position.set(part.position[0], part.position[1], part.position[2])
    if (part.rotation) mesh.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2])
    mesh.castShadow = true
    mesh.receiveShadow = true
    root.add(mesh)
  }
  return root
}
