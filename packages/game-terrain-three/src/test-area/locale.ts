import type { TERRAIN_STRIPS } from './test-module'

/** The ground profiles of the catalogue (`TERRAIN_PROFILES` of game-terrain) by name, for a HUD that says what the floor under the aim is. */
const PROFILE_NAMES: Record<string, Record<string, string>> = {
  en: { lawn: 'Lawn', dirt: 'Dirt', sand: 'Sand', road: 'Asphalt road', concrete_slab: 'Concrete slab', suspended_slab: 'Slab over a void', tile_floor: 'Tile floor', wood_floor: 'Wood floor', stone_paving: 'Stone paving' },
  'pt-BR': { lawn: 'Grama', dirt: 'Terra', sand: 'Areia', road: 'Asfalto', concrete_slab: 'Laje de concreto', suspended_slab: 'Laje sobre vão', tile_floor: 'Piso cerâmico', wood_floor: 'Assoalho', stone_paving: 'Calçamento de pedra' },
}

/** The name of a ground profile in the locale (`en` when the locale is unknown); a profile a game added without a name answers its id. */
export function terrainProfileName(profileId: string, localeId: string): string {
  return (PROFILE_NAMES[localeId] ?? PROFILE_NAMES.en!)[profileId] ?? profileId
}

interface TerrainText {
  readonly name: string
  readonly group: string
  readonly weight: string
  readonly surfaces: Record<(typeof TERRAIN_STRIPS)[number], string>
}

const LOCALES: Record<string, TerrainText> = {
  en: {
    name: 'Terrain',
    group: 'Terrain',
    weight: 'Concrete block (60 kg)',
    surfaces: { dirt: 'Dirt', lawn: 'Lawn', sand: 'Sand', road: 'Asphalt', concrete_slab: 'Concrete slab', suspended_slab: 'Slab over a void', wood_floor: 'Wood floor', tile_floor: 'Tile', stone_paving: 'Stone paving', mud: 'Mud', gravel_bed: 'Gravel', dry_clay: 'Dry clay', snow: 'Snow', cobblestone: 'Cobblestones', paver_floor: 'Concrete pavers', shallow_water: 'Shallow water' },
  },
  'pt-BR': {
    name: 'Terreno',
    group: 'Terreno',
    weight: 'Bloco de concreto (60 kg)',
    surfaces: { dirt: 'Terra', lawn: 'Grama', sand: 'Areia', road: 'Asfalto', concrete_slab: 'Laje de concreto', suspended_slab: 'Laje sobre vão', wood_floor: 'Assoalho', tile_floor: 'Cerâmica', stone_paving: 'Pedra', mud: 'Lama', gravel_bed: 'Cascalho', dry_clay: 'Barro seco', snow: 'Neve', cobblestone: 'Paralelepípedo', paver_floor: 'Bloquete', shallow_water: 'Água rasa' },
  },
}

export const locale = (id: string): TerrainText => LOCALES[id] ?? LOCALES.en!
