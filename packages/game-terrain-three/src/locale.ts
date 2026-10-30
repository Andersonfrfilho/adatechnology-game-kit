import type { TERRAIN_STRIPS } from './test-module'

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
    surfaces: { dirt: 'Dirt', lawn: 'Lawn', sand: 'Sand', road: 'Asphalt', concrete_slab: 'Concrete slab', wood_floor: 'Wood floor', tile_floor: 'Tile', stone_paving: 'Stone paving' },
  },
  'pt-BR': {
    name: 'Terreno',
    group: 'Terreno',
    weight: 'Bloco de concreto (60 kg)',
    surfaces: { dirt: 'Terra', lawn: 'Grama', sand: 'Areia', road: 'Asfalto', concrete_slab: 'Laje de concreto', wood_floor: 'Assoalho', tile_floor: 'Cerâmica', stone_paving: 'Pedra' },
  },
}

export const locale = (id: string): TerrainText => LOCALES[id] ?? LOCALES.en!
