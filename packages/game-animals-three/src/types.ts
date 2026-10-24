import type * as THREE_NS from 'three'

import type { AnimalSpecies } from '@adatechnology/game-animals'

export type Three = typeof THREE_NS

/** The slice of a canvas the texture painter uses; a stub works in tests. */
export type CanvasLike = { width: number; height: number; getContext(kind: '2d'): unknown }

/** The slice of `document` that creates canvases. */
export type DocumentLike = { createElement(tag: 'canvas'): CanvasLike }

export type AnimalsThreeOptions = {
  /** Where canvases for the coat textures (cat stripes, jaguar rosettes) come from; default `globalThis.document`. */
  readonly document?: DocumentLike
  /** A stream of numbers in [0, 1) for the start phase of each step cycle; default a seeded stream of `seed`. */
  readonly random?: () => number
  /** Seed of the default stream (the page uses 7). */
  readonly seed?: number
}

export type AnimalPivot = { readonly group: THREE_NS.Group; readonly rest: THREE_NS.Vector3; readonly offset: THREE_NS.Vector3 }

export type AnimalLeg = {
  readonly hip: THREE_NS.Group
  readonly knee: THREE_NS.Group
  readonly foot: THREE_NS.Group
  readonly isFront: boolean
  readonly angle1: number
  readonly angle2: number
  readonly side: number
}

export type AnimalWing = { readonly shoulder: THREE_NS.Group; readonly elbow: THREE_NS.Group; readonly side: number }

/** One animal: the tree to put in a scene (`root`) and the parts the animation drives. */
export type AnimalRig = {
  readonly species: AnimalSpecies
  readonly root: THREE_NS.Group
  readonly trunk: THREE_NS.Group
  readonly materials: THREE_NS.MeshStandardMaterial[]
  readonly joints: THREE_NS.Mesh[]
  readonly pivots: AnimalPivot[]
  readonly legs: AnimalLeg[]
  readonly tail: THREE_NS.Group[]
  readonly ears: THREE_NS.Group[]
  /** Parts that show only while infected (wounds, ribs). */
  readonly infectionParts: THREE_NS.Object3D[]
  readonly eyes: THREE_NS.Mesh[]
  readonly wings: AnimalWing[]
  readonly segments: { readonly group: THREE_NS.Group; readonly radius: number }[]
  phase: number
  size: number
  segmentLength: number
  segmentCount: number
  home: THREE_NS.Vector3
  infected: boolean
  dead: boolean
  pool?: THREE_NS.Mesh
  eyeMaterial?: THREE_NS.MeshStandardMaterial
  woundMaterial?: THREE_NS.MeshStandardMaterial
  main?: THREE_NS.MeshStandardMaterial
  dark?: THREE_NS.MeshStandardMaterial
  bodyGroup?: THREE_NS.Group
  /** The mesh of a quadruped's trunk (it moves with the animation of the body, so a node skin keeps it as a node). */
  body?: THREE_NS.Mesh
  neck?: THREE_NS.Group
  head?: THREE_NS.Group
  jaw?: THREE_NS.Group
  tailRoot?: THREE_NS.Group
  neckAngle: number
  headAngle: number
  tongue?: THREE_NS.Mesh
  /** Triangles of the whole tree. */
  triangles: number
}
