// What a house takes from its street, as the scenario names it: the pieces the SDK draws (each a catalogue id of the module that owns it) and the pieces the SDK has no drawing for yet.
import type { Locale } from './house-tables-data.js'

export const HOUSE_CONNECTIONS_ID = 'house_connections'
export const HOUSE_CONNECTIONS_LOT_ID = 'house_connections_lot'
/** Type of the log entry that names the ids the area could not lay. */
export const HOUSE_CONNECTIONS_MISSING_LOG = 'house_connections_missing'

type Named = readonly [string, string]

/** A piece of the SDK that goes on a house's utility connection, and what to call it on the floor. */
export interface ConnectionPiece {
  readonly item: string
  readonly name: Named
  /** Turned about y to show its street face to the player (the post's drop bracket is on the -z face). */
  readonly rotationY?: number
  /** The owning module is the urban one: a piece of scenery, a slab to aim at, not a household piece with parts. */
  readonly isScenery?: boolean
}

export const CONNECTION_PIECES: readonly ConnectionPiece[] = [
  { item: 'service_entrance_network', name: ['Padrão em rede (poste 6 m)', 'Network post (6 m)'], rotationY: Math.PI },
  { item: 'power_meter', name: ['Caixa do medidor', 'Meter box'] },
  { item: 'service_mast', name: ['Pontalete na fachada', 'Facade service mast'] },
  { item: 'service_entrance', name: ['Padrão antigo (poste próprio)', 'Old post (own pole)'] },
  { item: 'electrical_panel', name: ['Quadro de distribuição', 'Distribution board'] },
  { item: 'pole_concrete_distribution', name: ['Poste da rua', 'Street pole'], isScenery: true },
]

/** What a house connection has that the SDK does not draw yet: laid on the floor where it goes, with its sign. */
export interface ConnectionGap {
  readonly id: string
  readonly network: 'water' | 'sewer' | 'storm'
  readonly name: Named
}

export const CONNECTION_GAPS: readonly ConnectionGap[] = [
  { id: 'water_meter_box', network: 'water', name: ['Hidrômetro (cavalete)', 'Water meter stand'] },
  { id: 'inspection_box_cover', network: 'sewer', name: ['Tampa de inspeção', 'Inspection cover'] },
  { id: 'downspout_mouth', network: 'storm', name: ['Boca do condutor', 'Downspout mouth'] },
  { id: 'sewer_lateral', network: 'sewer', name: ['Ramal de esgoto', 'Sewer lateral'] },
]

export const GAP_PREFIX: Named = ['SEM PEÇA: ', 'NO PIECE: ']

export const textOf = (locale: Locale, pair: Named): string => (locale === 'en' ? pair[1] : pair[0])
