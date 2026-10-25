import type { BlockBuilding, BuildingOptions, FillBlockOptions } from '../block'
import type { PoleOptions } from '../poles'
import type { UrbanBuilder } from '../scene'
import type { Silhouette } from '../types'

/** What a game asks a house provider to put on the ground. Fields a typology does not use are ignored. */
export type HouseRequest = {
  x: number
  z: number
  /** Turn of the whole house; the default provider turns the group. */
  ry?: number
  width?: number
  depth?: number
  floors?: number
  color?: number
  roofColor?: number
  hasDoor?: boolean
  isBoarded?: boolean
}

/** Draws a house of the given typology into the builder (and may add vehicles, plants or anything else around it). */
export type HouseProvider = (typology: string, request: HouseRequest, b: UrbanBuilder) => void
/** Draws a vehicle where the pattern parks one. A pattern parks none unless a provider is given. */
export type VehicleRequest = { x: number; z: number; ry: number; color: number }
export type VehicleProvider = (request: VehicleRequest, b: UrbanBuilder) => void
/** Draws a tree where the pattern plants one. The default is the cone pine and the ball tree of the street props. */
export type PlantRequest = { kind: 'pine' | 'tree'; x: number; z: number; scale: number }
export type PlantProvider = (request: PlantRequest, b: UrbanBuilder) => void

export type Providers = { house?: HouseProvider; vehicle?: VehicleProvider; plant?: PlantProvider }

/** The cell of the sample sheet and what was put there, as data. */
export type UrbanPlan = {
  id: string
  origin: { x: number; z: number }
  houses: { typology: string; x: number; z: number; ry: number }[]
  buildings: BlockBuilding[]
  poles: { pole: string; x: number; z: number; on: boolean }[]
  vehicles: VehicleRequest[]
  plants: PlantRequest[]
}

export type Locale = 'pt-BR' | 'en'
export type PatternText = { label: string; title: string; caption: string; detail: string }

/**
 * A neighbourhood pattern: numbers a game can change and a key into the registry of composers, which draw the street.
 * `params` are the numbers of that composer (counts, pitch, palettes, positions of the poles).
 */
export type NeighbourhoodPattern<TParams = Record<string, unknown>> = {
  id: string
  /** Width of the main paved strip (a road, a cobbled street, a yard or a boardwalk). */
  streetWidth: number
  /** Width of the sidewalks; 0 when the pattern has none. */
  walkWidth: number
  /** House and building typologies the pattern places (ids of the house provider). */
  typologies: readonly string[]
  /** Id of the kind of pole the pattern uses; empty when it has no public lighting. */
  pole: string
  /** Colour of the light the lamps give. */
  lightColor: number
  /** Metres between poles (0 when it has none). */
  spacing: number
  /** Share of the lamps that are on; the rest are burnt out. 1 means all, without drawing from the random. */
  lit: number
  /** Key into the composers. */
  compose: string
  /** Where a map marker stands over the sample: its height and its shift in z from the origin. */
  marker: { height: number; dz?: number }
  /** Title, caption under the sample and marker text, by locale. */
  text: Record<Locale, PatternText>
  params: TParams
}

/** The parts of the kit a composer draws with: poles, streets, blocks and props. */
export interface UrbanKitCore {
  poles: { get(id: string): { build(b: UrbanBuilder, options: PoleOptions): void } }
  streets: {
    road(b: UrbanBuilder, x: number, z: number, w: number, l: number, along: 'x' | 'z'): void
    walk(b: UrbanBuilder, x: number, z: number, w: number, d: number): void
    ground(b: UrbanBuilder, color?: number, size?: number): void
    grid(b: UrbanBuilder, g: { block: number; count: number; width: number }): void
  }
  block: {
    facades: readonly number[]
    building(b: UrbanBuilder, x: number, z: number, width: number, depth: number, height: number, color: number, o?: BuildingOptions): BlockBuilding
    fill(b: UrbanBuilder, g: { cx: number; cz: number; size: number; minHeight: number; maxHeight: number } & FillBlockOptions): BlockBuilding[]
  }
  props: {
    fence(b: UrbanBuilder, x0: number, z0: number, x1: number, z1: number, height: number, color?: number): void
    tent(b: UrbanBuilder, x: number, z: number, ry: number, w: number, d: number, color?: number): void
    pine(b: UrbanBuilder, x: number, z: number, scale?: number, y?: number): void
    tree(b: UrbanBuilder, x: number, z: number, scale?: number): void
    container(b: UrbanBuilder, x: number, y: number, z: number, ry: number, color: number): void
    watchtower(b: UrbanBuilder, x: number, z: number, searchlight?: boolean): void
    sandbags(b: UrbanBuilder, x: number, z: number, length: number, along: 'x' | 'z', rows?: number): void
    label(b: UrbanBuilder, x: number, z: number, title: string, subtitle: string): void
    wires(b: UrbanBuilder, points: readonly (readonly [number, number])[], y: number, color?: number): void
  }
}

export type ComposeContext<TParams = Record<string, unknown>> = {
  kit: UrbanKitCore
  b: UrbanBuilder
  pattern: NeighbourhoodPattern<TParams>
  params: TParams
  x0: number
  z0: number
  plan: UrbanPlan
  /** True with the probability `share`; draws from the random unless the share is 1. */
  isLit(share: number): boolean
  pole(options: PoleOptions & { id?: string }): void
  house(typology: string, request: HouseRequest): void
  vehicle(request: VehicleRequest): void
  plant(request: PlantRequest): void
  building(x: number, z: number, width: number, depth: number, height: number, color: number, options?: { lit?: number; shop?: number }): void
}

export type Composer<TParams = any> = (context: ComposeContext<TParams>) => void

export type ComposeOptions = { locale?: Locale; providers?: Providers }

export type SilhouetteFactory = (request: HouseRequest, random: () => number) => Silhouette
