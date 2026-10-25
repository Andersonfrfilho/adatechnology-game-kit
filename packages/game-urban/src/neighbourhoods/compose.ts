import type { UrbanBuilder } from '../scene'
import { createSilhouetteHouses } from './houses'
import type { ComposeContext, ComposeOptions, Composer, Locale, NeighbourhoodPattern, Providers, UrbanKitCore, UrbanPlan } from './types'

const LABEL_OFFSET_Z = 28
const DEFAULT_LOCALE: Locale = 'pt-BR'
const SAMPLE_GROUND = { color: 0x1e2124, size: 500 }

export type Origin = { x: number; z: number }

/** Draws one pattern at `origin`: its composer, then the board with the title and the caption. */
export function composePattern(kit: UrbanKitCore, pattern: NeighbourhoodPattern<any>, composer: Composer, b: UrbanBuilder, origin: Origin, options: ComposeOptions = {}): UrbanPlan {
  const locale = options.locale ?? DEFAULT_LOCALE
  const providers: Providers = options.providers ?? {}
  const house = providers.house ?? createSilhouetteHouses()
  const plan: UrbanPlan = { id: pattern.id, origin: { ...origin }, houses: [], buildings: [], poles: [], vehicles: [], plants: [] }
  const context: ComposeContext = {
    kit,
    b,
    pattern,
    params: pattern.params,
    x0: origin.x,
    z0: origin.z,
    plan,
    isLit: (share) => share >= 1 || b.random() < share,
    pole: ({ id, ...rest }) => {
      kit.poles.get(id ?? pattern.pole).build(b, rest)
      plan.poles.push({ pole: id ?? pattern.pole, x: rest.x, z: rest.z, on: rest.on ?? true })
    },
    house: (typology, request) => {
      house(typology, request, b)
      plan.houses.push({ typology, x: request.x, z: request.z, ry: request.ry ?? 0 })
    },
    vehicle: (request) => {
      providers.vehicle?.(request, b)
      plan.vehicles.push(request)
    },
    plant: (request) => {
      if (providers.plant) providers.plant(request, b)
      else if (request.kind === 'pine') kit.props.pine(b, request.x, request.z, request.scale)
      else kit.props.tree(b, request.x, request.z, request.scale)
      plan.plants.push(request)
    },
    building: (x, z, width, depth, height, color, o) => {
      plan.buildings.push(kit.block.building(b, x, z, width, depth, height, color, o))
    },
  }
  composer(context)
  const text = pattern.text[locale] ?? pattern.text[DEFAULT_LOCALE]
  kit.props.label(b, origin.x, origin.z + LABEL_OFFSET_Z, text.title, text.caption)
  return plan
}

/** The marker (map pin) of a pattern at an origin: where it stands, how high, and what it says. */
export function patternMarker(pattern: NeighbourhoodPattern<any>, origin: Origin, locale: Locale = DEFAULT_LOCALE): { x: number; y: number; z: number; label: string; detail: string } {
  const text = pattern.text[locale] ?? pattern.text[DEFAULT_LOCALE]
  return { x: origin.x, y: pattern.marker.height, z: origin.z + (pattern.marker.dz ?? 0), label: text.label, detail: text.detail }
}

export type SampleSheetOptions = ComposeOptions & {
  /** Ids to draw, in this order. Default all of the kit's patterns in the page's order. */
  ids?: readonly string[]
  /** Where each pattern stands. Default the Galeria's grid. */
  cells?: Readonly<Record<string, Origin>>
  /** Colour and size of the ground under the sheet; false for none. */
  ground?: { color: number; size: number } | false
}

export { SAMPLE_GROUND }
