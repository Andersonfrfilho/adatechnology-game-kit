import type * as THREE_NS from 'three'
import type { ContainerSpec } from '@adatechnology/game-contracts'
import { LIQUIDS } from '@adatechnology/game-fluids'

import data from './data/destruction.json'

/** The destruction material (`game-destruction` id) of each material tag of the kit, for a mesh whose model says nothing else. */
export const DESTRUCTION_MATERIAL_BY_TAG: Readonly<Record<string, string>> = {
  metal: 'steel',
  wood: 'wood_soft',
  glass: 'glass',
  paper: 'paper',
  plastic: 'plastic',
  cloth: 'fabric',
  food: 'flesh_fruit',
}

/** How a model behaves under `game-destruction-three`'s `specFromObject3D`, as `data/destruction.json` keeps it. */
export interface ItemDestruction {
  /** The meshes are thin shells, not solid blocks. */
  readonly hollow?: boolean
  /** The parts of the model are welded to its largest mesh, so a hit dents and holes them instead of tearing them off. */
  readonly welded?: boolean
  /** Meshes made of these material tags are skins (labels, coats): drawn on a part, never a part of their own. */
  readonly skinTags?: readonly string[]
  /** Material tag to destruction material id, over `DESTRUCTION_MATERIAL_BY_TAG`. */
  readonly materials?: Readonly<Record<string, string>>
  /** Segments every cylinder mesh of the model is rebuilt with, so a bullet dent (a few millimetres wide) finds vertices to push in. */
  readonly tessellate?: { readonly heightSegments: number; readonly radialSegments: number }
}

/** A family of models that behave alike: one rule for all of them, so adding a model is one id and changing the rule changes them all. */
export interface ItemFamily {
  readonly models: readonly string[]
  readonly rule: ItemDestruction
}

/** What a model holds inside its shell: a liquid (`game-fluids` id) filling `fill` of the inner volume. */
export interface ItemContents {
  readonly liquid: string
  readonly fill: number
  /** The shell is a box (a flat tin) and not a cylinder. */
  readonly box?: boolean
}

const FAMILIES = data.families as Readonly<Record<string, ItemFamily>>
const CONTENTS = data.contents as Readonly<Record<string, ItemContents>>

const FAMILY_OF_MODEL = new Map<string, string>(Object.entries(FAMILIES).flatMap(([family, entry]) => entry.models.map((model) => [model, family] as const)))

/** Id of the family a model belongs to (`drink_can`), if any. */
export const itemFamily = (modelId: string): string | undefined => FAMILY_OF_MODEL.get(modelId)

// One lookup on purpose: the item-category system (contracts per category) can feed it later instead of this file.
export const itemDestruction = (modelId: string): ItemDestruction | undefined => {
  const family = FAMILY_OF_MODEL.get(modelId)
  return family === undefined ? undefined : FAMILIES[family]?.rule
}

/** The family ids and their models, as the data gives them. */
export const ITEM_FAMILIES: Readonly<Record<string, ItemFamily>> = FAMILIES

/** The subject of `itemContents`: what `buildItem` draws. */
export interface ContentsSubject {
  readonly model?: string
  /** Metres. */
  readonly size: readonly [number, number, number]
  /** Kg, shell included. */
  readonly weight?: number
}

/** Id of the welded part that is the whole shell of a container. */
export const SHELL_PART_ID = 'shell'

/** Share of the inner volume the walls and the seams take away. */
const WALL_SHARE = 0.9
/** Radius of the pull tab opening of a closed can, in metres. */
const OPENING_RADIUS = 0.012

/**
 * The container the model holds (`TestableItem.fluid` of the test room and `PartSpec.contains` of the shell), sized from the item: the inner volume of its
 * box times the fill of the model, never more than the item weighs in that liquid. Undefined for a model that holds nothing.
 */
export function itemContents(subject: ContentsSubject): { readonly container: ContainerSpec; readonly liquid: string; readonly liters: number } | undefined {
  const contents = subject.model === undefined ? undefined : CONTENTS[subject.model]
  if (!contents) return undefined
  const [width, height, depth] = subject.size
  const radius = Math.min(width, depth) / 2
  const innerLiters = (contents.box ? width * depth : Math.PI * radius * radius) * height * WALL_SHARE * 1000
  const density = LIQUIDS.find((liquid) => liquid.id === contents.liquid)?.density ?? 1000
  const heaviest = subject.weight === undefined ? Infinity : (subject.weight * 1000) / density
  const liters = Math.min(innerLiters * contents.fill, heaviest)
  const container: ContainerSpec = {
    capacity: innerLiters,
    liquid: contents.liquid,
    liters,
    shape: contents.box ? { kind: 'box', size: [width * WALL_SHARE, height * WALL_SHARE, depth * WALL_SHARE] } : { kind: 'cylinder', radius: radius * WALL_SHARE, height: height * WALL_SHARE },
    opening: OPENING_RADIUS,
    closed: true,
  }
  return { container, liquid: contents.liquid, liters }
}

function tagOf(mesh: THREE_NS.Mesh): string | undefined {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const tag = (material?.userData as { tag?: unknown } | undefined)?.tag
  return typeof tag === 'string' ? tag : undefined
}

function volumeOf(mesh: THREE_NS.Mesh): number {
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
  const box = mesh.geometry.boundingBox
  if (!box) return 0
  return (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z)
}

/** What `tagForDestruction` needs to know about the item beside its meshes. */
export interface DestructionTagOptions {
  readonly modelId?: string
  /** Real weight in kg. */
  readonly weight?: number
  /** Size in metres, for the contents of the shell. */
  readonly size?: readonly [number, number, number]
}

type CylinderParameters = { radiusTop: number; radiusBottom: number; height: number; radialSegments: number; heightSegments: number; openEnded: boolean; thetaStart: number; thetaLength: number }

/** Rebuilds the cylinder geometry of every mesh under `root` with the segment counts of the rule; a geometry shared by several meshes is rebuilt once. */
function tessellateCylinders(root: THREE_NS.Object3D, segments: NonNullable<ItemDestruction['tessellate']>): void {
  const rebuilt = new Map<THREE_NS.BufferGeometry, THREE_NS.BufferGeometry>()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh || mesh.geometry.type !== 'CylinderGeometry') return
    let fresh = rebuilt.get(mesh.geometry)
    if (!fresh) {
      const { radiusTop, radiusBottom, height, openEnded, thetaStart, thetaLength } = (mesh.geometry as unknown as { parameters: CylinderParameters }).parameters
      const Cylinder = mesh.geometry.constructor as new (...args: readonly (number | boolean)[]) => THREE_NS.BufferGeometry
      fresh = new Cylinder(radiusTop, radiusBottom, height, segments.radialSegments, segments.heightSegments, openEnded, thetaStart, thetaLength)
      rebuilt.set(mesh.geometry, fresh)
    }
    mesh.geometry = fresh
  })
  const triangles = (geometry: THREE_NS.BufferGeometry): number => (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3
  let added = 0
  rebuilt.forEach((fresh, old) => {
    added += triangles(fresh) - triangles(old)
  })
  root.userData.tessellationTriangles = added
  rebuilt.forEach((_fresh, old) => old.dispose())
}

/**
 * Writes the `userData` that `specFromObject3D` reads onto the meshes of a drawn item: the destruction material of each mesh from its kit material tag,
 * the item's real weight in kg (`destructionMass`, so the world weighs what the thing weighs) and what the model's family in `data/destruction.json` asks for (hollow shells, welded parts, skins),
 * with the liquid the model holds on its shell (`destructionContains`).
 */
export function tagForDestruction(root: THREE_NS.Object3D, options: DestructionTagOptions = {}): void {
  const { modelId, weight, size } = options
  if (weight !== undefined && weight > 0) root.userData.destructionMass = weight
  const rule = modelId === undefined ? undefined : itemDestruction(modelId)
  if (rule?.tessellate) tessellateCylinders(root, rule.tessellate)
  const solid: THREE_NS.Mesh[] = []
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    const tag = tagOf(mesh)
    if (tag === undefined) return
    const material = rule?.materials?.[tag] ?? DESTRUCTION_MATERIAL_BY_TAG[tag]
    if (material !== undefined) mesh.userData.destructionMaterial = material
    if (rule?.skinTags?.includes(tag)) {
      mesh.userData.destructionSkin = true
      return
    }
    if (rule?.hollow) mesh.userData.hollow = true
    solid.push(mesh)
  })
  if (!rule?.welded || solid.length < 2) return
  const anchor = solid.reduce((largest, mesh) => (volumeOf(mesh) > volumeOf(largest) ? mesh : largest))
  solid.forEach((mesh, index) => {
    mesh.userData.destructionPart = mesh === anchor ? { id: SHELL_PART_ID } : { id: `shell_${index}`, parent: SHELL_PART_ID, kind: 'weld' }
  })
  const contents = size === undefined ? undefined : itemContents({ ...(modelId === undefined ? {} : { model: modelId }), size, ...(weight === undefined ? {} : { weight }) })
  if (contents) anchor.userData.destructionContains = { fluid: contents.liquid, liters: contents.liters }
}
