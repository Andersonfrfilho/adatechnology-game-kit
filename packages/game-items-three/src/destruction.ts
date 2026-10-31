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
  /** Segments the cylinder and box meshes of the model are rebuilt with, so a bullet dent (a few millimetres wide) finds vertices to push in. */
  readonly tessellate?: {
    /**
     * With `capRings` (and `three` given to `tagForDestruction`) a cylinder becomes one lathe with that many rings on each end, so the lid and the bottom dent
     * too; its rows then are about as tall as its columns are wide, never more than `heightSegments`.
     */
    readonly cylinder?: { readonly heightSegments: number; readonly radialSegments: number; readonly capRings?: number }
    readonly box?: { readonly widthSegments: number; readonly heightSegments: number; readonly depthSegments: number }
  }
  /** Real wall thickness in metres of the shell (`body`, the largest mesh) and of its other parts (`ends`: lid, bottom, neck), for the destruction world. */
  readonly wall?: { readonly body: number; readonly ends: number }
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
  /** three.js, for the shapes three only makes from scratch (a cylinder with rings on its ends: `tessellate.cylinder.capRings`). */
  readonly three?: typeof THREE_NS
}

type CylinderParameters = { radiusTop: number; radiusBottom: number; height: number; openEnded: boolean; thetaStart: number; thetaLength: number }
type BoxParameters = { width: number; height: number; depth: number }
type Tessellation = NonNullable<ItemDestruction['tessellate']>
type GeometryConstructor = new (...args: readonly (number | boolean)[]) => THREE_NS.BufferGeometry

/**
 * A cylinder drawn as one lathe: rings on the bottom from the axis out, the side, rings on the top back to the axis. The corners are two points (one of the end,
 * one of the side), so the rim stays sharp and the vertices of each face move with that face only.
 */
function ringedCylinder(T: typeof THREE_NS, p: CylinderParameters, radial: number, maxRows: number, rings: number): THREE_NS.BufferGeometry {
  const half = p.height / 2
  // rows about as tall as a column is wide on the wider end
  const column = (2 * Math.PI * Math.max(p.radiusTop, p.radiusBottom, 1e-6)) / radial
  const rows = Math.max(1, Math.min(maxRows, Math.round(p.height / column)))
  const points: THREE_NS.Vector2[] = []
  if (!p.openEnded) for (let i = 0; i <= rings; i++) points.push(new T.Vector2((p.radiusBottom * i) / rings, -half))
  for (let j = 0; j <= rows; j++) points.push(new T.Vector2(p.radiusBottom + ((p.radiusTop - p.radiusBottom) * j) / rows, -half + (p.height * j) / rows))
  if (!p.openEnded) for (let i = rings; i >= 0; i--) points.push(new T.Vector2((p.radiusTop * i) / rings, half))
  return lathed(T, points, radial, p.thetaStart, p.thetaLength)
}

/**
 * The lathe of `points` with its normals from its faces: the lathe's own normals blend an end into the side at a doubled corner point. A point on the axis that
 * only degenerate triangles touch gets the normal of the end it closes (up on the top, down on the bottom).
 */
function lathed(T: typeof THREE_NS, points: readonly THREE_NS.Vector2[], radial: number, phiStart?: number, phiLength?: number): THREE_NS.BufferGeometry {
  const geometry = new T.LatheGeometry([...points], radial, phiStart, phiLength)
  geometry.computeVertexNormals()
  const position = geometry.getAttribute('position')
  const normal = geometry.getAttribute('normal')
  const middle = (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2
  for (let i = 0; i < normal.count; i++) {
    if (Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) > 0.5) continue
    normal.setXYZ(i, 0, position.getY(i) >= middle ? 1 : -1, 0)
  }
  return geometry
}

/** The profile of a lathe with every stretch split into pieces no longer than `step`, so its rows are about as fine as its columns. */
function finerProfile(T: typeof THREE_NS, points: readonly THREE_NS.Vector2[], step: number): THREE_NS.Vector2[] {
  const out: THREE_NS.Vector2[] = []
  points.forEach((point, index) => {
    const next = points[index + 1]
    out.push(point.clone())
    if (!next) return
    const pieces = Math.max(1, Math.round(point.distanceTo(next) / step))
    for (let k = 1; k < pieces; k++) out.push(point.clone().lerp(next, k / pieces))
  })
  return out
}

/** The same shape as `geometry` with the segments of the rule, or undefined when the rule says nothing about its kind. */
function tessellated(geometry: THREE_NS.BufferGeometry, rule: Tessellation, T?: typeof THREE_NS): THREE_NS.BufferGeometry | undefined {
  const Shape = geometry.constructor as GeometryConstructor
  if (geometry.type === 'CylinderGeometry' && rule.cylinder) {
    const parameters = (geometry as unknown as { parameters: CylinderParameters }).parameters
    const { radiusTop, radiusBottom, height, openEnded, thetaStart, thetaLength } = parameters
    if (T && rule.cylinder.capRings !== undefined) return ringedCylinder(T, parameters, rule.cylinder.radialSegments, rule.cylinder.heightSegments, rule.cylinder.capRings)
    return new Shape(radiusTop, radiusBottom, height, rule.cylinder.radialSegments, rule.cylinder.heightSegments, openEnded, thetaStart, thetaLength)
  }
  // a model drawn as a lathe already (an empty can) gets the same columns, and rows to match
  if (geometry.type === 'LatheGeometry' && rule.cylinder && T && rule.cylinder.capRings !== undefined) {
    const { points, segments, phiStart, phiLength } = (geometry as unknown as { parameters: { points: THREE_NS.Vector2[]; segments: number; phiStart: number; phiLength: number } }).parameters
    if (segments >= rule.cylinder.radialSegments) return undefined
    const widest = Math.max(...points.map((point) => point.x), 1e-6)
    return lathed(T, finerProfile(T, points, (2 * Math.PI * widest) / rule.cylinder.radialSegments), rule.cylinder.radialSegments, phiStart, phiLength)
  }
  if (geometry.type === 'BoxGeometry' && rule.box) {
    const { width, height, depth } = (geometry as unknown as { parameters: BoxParameters }).parameters
    return new Shape(width, height, depth, rule.box.widthSegments, rule.box.heightSegments, rule.box.depthSegments)
  }
  return undefined
}

const triangleCount = (geometry: THREE_NS.BufferGeometry): number => (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3

/** Rebuilds the cylinder and box geometries of every mesh under `root` with the segments of the rule; a geometry shared by several meshes is rebuilt once. */
function tessellateShapes(root: THREE_NS.Object3D, rule: Tessellation, T?: typeof THREE_NS): void {
  const rebuilt = new Map<THREE_NS.BufferGeometry, THREE_NS.BufferGeometry>()
  root.traverse((object) => {
    const mesh = object as THREE_NS.Mesh
    if (!mesh.isMesh) return
    let fresh = rebuilt.get(mesh.geometry)
    if (!fresh) {
      fresh = tessellated(mesh.geometry, rule, T)
      if (!fresh) return
      rebuilt.set(mesh.geometry, fresh)
    }
    mesh.geometry = fresh
  })
  let added = 0
  rebuilt.forEach((fresh, old) => {
    added += triangleCount(fresh) - triangleCount(old)
    old.dispose()
  })
  root.userData.tessellationTriangles = added
}

/**
 * Writes the `userData` that `specFromObject3D` reads onto the meshes of a drawn item: the destruction material of each mesh from its kit material tag,
 * the item's real weight in kg (`destructionMass`, so the world weighs what the thing weighs) and what the model's family in `data/destruction.json` asks for (hollow shells, welded parts, skins),
 * with the liquid the model holds on its shell (`destructionContains`) and the real thickness of each wall (`destructionThickness`).
 */
export function tagForDestruction(root: THREE_NS.Object3D, options: DestructionTagOptions = {}): void {
  const { modelId, weight, size, three } = options
  if (weight !== undefined && weight > 0) root.userData.destructionMass = weight
  const rule = modelId === undefined ? undefined : itemDestruction(modelId)
  if (rule?.tessellate) tessellateShapes(root, rule.tessellate, three)
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
    if (rule.wall) mesh.userData.destructionThickness = mesh === anchor ? rule.wall.body : rule.wall.ends
  })
  const contents = size === undefined ? undefined : itemContents({ ...(modelId === undefined ? {} : { model: modelId }), size, ...(weight === undefined ? {} : { weight }) })
  if (contents) anchor.userData.destructionContains = { fluid: contents.liquid, liters: contents.liters }
}
