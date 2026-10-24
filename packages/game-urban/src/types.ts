import type { RandomSource, Silhouette, SilhouettePart, SilhouetteWindow } from '@adatechnology/game-floorplan'

import type { TerrainGrid } from './terrain/types'

export type { RandomSource, Silhouette, SilhouettePart, SilhouetteWindow }

/** How a drawer treats a part when the default (standard material, rough 0.9, shadows on) is not what the team's page does. */
export type PartStyle = {
  /** Metal and paint of the standard material. */
  roughness?: number
  metalness?: number
  /** Shadows: boxes, cylinders, cones and prisms cast and receive by default, planes only receive, crowns only cast, signs and lines neither. */
  castShadow?: boolean
  receiveShadow?: boolean
}

type Styled<TPart> = TPart & { style?: PartStyle }

/** A cone (pointed cap of an iron pole, pine foliage); `y` is the centre. Flat shaded. */
export type ConePart = { shape: 'cone'; parent: number; x: number; y: number; z: number; radius: number; height: number; color: number; segments: number; style?: PartStyle }
/** A rough ball of leaves (a dodecahedron of the given radius). Casts shadows only. */
export type CrownPart = { shape: 'crown'; parent: number; x: number; y: number; z: number; radius: number; color: number; style?: PartStyle }
/** Half (or any arc) of a cylinder lying down, for a barrel-vault roof. Casts shadows only. `rotation` and `scale` are the mesh's own. */
export type VaultPart = {
  shape: 'vault'
  parent: number
  x: number
  y: number
  z: number
  radius: number
  length: number
  arc: number
  segments: number
  color: number
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
  style?: PartStyle
}
/** The ground: a square mesh of the grid's vertices with a colour each, flat shaded, that casts and receives shadows. */
export type TerrainPart = { shape: 'terrain'; parent: number; grid: TerrainGrid; style?: PartStyle }
/** A flat rectangle lying on the ground (`y` is its height). */
export type PlanePart = { shape: 'plane'; parent: number; x: number; y: number; z: number; width: number; depth: number; color: number; style?: PartStyle }
/** Text over one or more lines on a canvas texture (street names, strip labels). */
export type LabelPart = {
  shape: 'label'
  parent: number
  x: number
  y: number
  z: number
  width: number
  height: number
  ry: number
  lines: string[]
  background: string
  foreground: string
  font: string
  canvas: { width: number; height: number }
}
/** A real light. A lamp that did not get one from the budget keeps its glowing lens and has no part like this. */
export type LightPart =
  | { shape: 'light'; kind: 'point'; parent: number; x: number; y: number; z: number; color: number; intensity: number; distance: number; decay: number; flicker: boolean }
  | {
      shape: 'light'
      kind: 'spot'
      parent: number
      x: number
      y: number
      z: number
      color: number
      intensity: number
      distance: number
      decay: number
      angle: number
      penumbra: number
      /** Where the beam points at rest. */
      target: { x: number; y: number; z: number }
      /** When set the target circles the light: `target = (x + sin(t·speed + x)·radius, 0, z + cos(t·speed + x)·radius)`. */
      sweep?: { speed: number; radius: number }
    }

/** The parts of an urban scene: the silhouette vocabulary of game-floorplan plus what streets and poles need. */
export type UrbanPart = Styled<SilhouettePart> | ConePart | CrownPart | PlanePart | VaultPart | TerrainPart | LabelPart | LightPart

/** One small box drawn as an instance of a single mesh (dashes of a road, sandbags). `y` is the base. */
export type ItemBox = { x: number; y: number; z: number; width: number; height: number; depth: number; color: number; rx: number; ry: number; rz: number }

/** Everything a pole, a street, a block or a prop adds to a scene, in the order the team's page adds it. */
export type UrbanScene = {
  parts: UrbanPart[]
  items: ItemBox[]
  windows: { lit: SilhouetteWindow[]; dark: SilhouetteWindow[] }
}

/** The lights a scene may spend. Every lamp that is on takes one, and the first ones win; the rest keep only their glowing lens. */
export type LightBudget = {
  /** Lights left. It goes below zero when more lamps ask than the budget had, as the team's counter does. */
  left: number
  /** True while the budget lasts (spends one either way). */
  take(): boolean
}
