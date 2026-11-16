// What a house of the kit holds, room by room, for the house-and-yard-on-tables area: which goods pools lie on each room's tables, which pieces stand on its
// floor and what hangs on a wall. Every id is a catalogue id of the module that owns the piece (household, the houses' furniture, the goods, the plants).
export type Locale = 'pt-BR' | 'en'

/** One room of the house (or the yard): the pools of goods its furniture holds go on its tables, its furniture on the floor. */
export interface HouseSection {
  readonly id: string
  readonly name: readonly [string, string]
  /** Keys of `GOODS_HOUSE_POOLS` whose items lie on this room's tables. */
  readonly pools: readonly string[]
  /** Small pieces of the household catalogue that stand on a table (a camp stove, a lantern). */
  readonly onTable: readonly string[]
  /** Catalogue ids standing on the floor. */
  readonly floor: readonly string[]
  /** Pieces drawn at the height of the counter they stand on (a microwave at 0.9 m), laid over that piece of `floor`: piece id to the id it stands on. */
  readonly onTopOf?: Readonly<Record<string, string>>
  readonly surface: string
}

export const SECTIONS: readonly HouseSection[] = [
  {
    id: 'kitchen',
    name: ['Cozinha', 'Kitchen'],
    pools: ['geladeira', 'refrig_exp', 'freezer', 'pia', 'aereo', 'despensa', 'cristaleira'],
    onTable: [],
    floor: ['fridge', 'fridge_compact', 'furniture_fridge', 'kitchen_cabinet_base', 'pantry', 'stove', 'furniture_stove_4burner', 'gas_bottle', 'sink_kitchen', 'furniture_dining_table', 'dining_chair'],
    onTopOf: { microwave: 'kitchen_cabinet_base' },
    surface: 'tile_floor',
  },
  {
    id: 'living',
    name: ['Sala e escritório', 'Living room and study'],
    pools: ['rack', 'gaveteiro'],
    onTable: [],
    floor: ['sofa', 'furniture_sofa_3seat', 'armchair', 'tv', 'furniture_tv', 'furniture_coffee_table', 'furniture_desk', 'furniture_floor_lamp', 'bench', 'fireplace', 'wood_stove'],
    surface: 'tile_floor',
  },
  {
    id: 'bedroom',
    name: ['Quarto', 'Bedroom'],
    pools: ['guarda', 'comoda', 'criado', 'sapateira'],
    onTable: [],
    floor: ['bed_double', 'furniture_double_bed', 'bed_single', 'bunk_bed', 'wardrobe', 'dresser', 'nightstand', 'furniture_mirror'],
    surface: 'tile_floor',
  },
  {
    id: 'bathroom',
    name: ['Banheiro', 'Bathroom'],
    pools: ['pia_b'],
    onTable: [],
    floor: ['toilet', 'furniture_toilet', 'sink_bathroom', 'furniture_washbasin', 'shower', 'furniture_shower'],
    surface: 'tile_floor',
  },
  {
    id: 'laundry',
    name: ['Lavanderia', 'Laundry'],
    pools: ['armario_lav', 'estante_lav'],
    onTable: [],
    floor: ['washing_machine', 'furniture_washing_machine', 'utility_sink'],
    surface: 'tile_floor',
  },
  {
    id: 'yard',
    name: ['Quintal, garagem e jardim', 'Yard, garage and garden'],
    pools: ['bancada', 'estante_ferr', 'correio', 'lixeira'],
    onTable: ['camp_stove', 'gas_canister', 'lantern_lamp'],
    floor: [
      'bbq', 'clothesline', 'dog_house', 'trash_bin', 'wheelie_bin', 'mailbox', 'well', 'outhouse', 'service_entrance', 'cooler', 'campfire', 'camp_chair', 'camp_table',
      'hibiscus_shrub', 'boxwood_hedge', 'rose_bush_red', 'sunflower', 'potted_fern', 'potted_cactus', 'banana_with_bunch', 'mango_young_15',
    ],
    surface: 'lawn',
  },
]

/**
 * What hangs on a wall in a house: it hangs on the room's target wall (the houses' `wallPiece`). The household catalogue draws each one at the height a house
 * hangs it (a wall cabinet's base 1.4 m up), so it is laid with its origin on the floor, held where it is put (`fixed`): the wall cabinet, which stands free
 * elsewhere, would otherwise fall off the wall.
 */
export const ON_THE_WALL: readonly string[] = ['kitchen_cabinet_wall', 'bathroom_cabinet', 'electrical_panel', 'power_meter', 'wall_socket', 'wall_switch', 'blinds', 'curtain', 'conduit_run']

/** The rooms of the compact area (`house_tables_kitchen`): the kitchen alone, small enough for the plain room's floor and away from its scenery. */
export const KITCHEN_ONLY: readonly string[] = ['kitchen']
