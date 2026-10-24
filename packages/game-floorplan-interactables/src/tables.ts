// Defaults of the adapter: the tables of the team's `AdaptadorInterativos` (kit 0.3.0), with the ids of this kit. Every table is a registry: `create` takes an
// override of each (a key with `null` removes the entry), so a game can add, replace or drop entries without touching the adapter.
// The comments say which id of the team's `PlantasSDK` each entry was (the tables of MIGRATION.md in the floorplan packs give the same ids).

/** How a furniture type of the plan becomes an object of the household pack. */
export interface TypeMapEntry {
  /** Household type (`hh.types`), or one the adapter creates itself (`lamp`). */
  type?: string
  /** Household variant (`steel`, `garage`, `hanging`). */
  variant?: string
  /** The furniture becomes more than one object: `sink` (basin + base cabinet + wall cabinet), `basin` (bathroom basin + wall cabinet), `rustic_sink`. */
  compound?: 'sink' | 'basin' | 'rustic_sink'
  /**
   * Which sizes of the furniture go to the drawing: `wdh` (default), `wd` (width and depth: the plan gives the height of the base, not of the whole drawing, like the
   * 10 cm shower tray or the 50 cm bench without a back), `wh`, `w`, `x` (none, but the height off the floor `y` stays) or `none` (none, not even `y`).
   */
  dim?: 'wdh' | 'wd' | 'wh' | 'w' | 'x' | 'none'
  /** Power of a lamp (W). */
  watts?: number
}

/** Furniture type of the plan to the object of the kit (`TypeMapEntry`). */
export const TYPE_MAP: Readonly<Record<string, TypeMapEntry>> = Object.freeze({
  fridge: { type: 'fridge' }, // was `geladeira`
  fridge_large: { type: 'fridge' }, // was `geladeira2`
  display_fridge_medium: { type: 'fridge', variant: 'steel' }, // was `geladeira_med`
  display_fridge: { type: 'fridge', variant: 'steel' }, // was `refrig_exp`
  freezer: { type: 'fridge_compact' }, // was `freezer`
  kitchen_cabinet: { compound: 'sink' }, // was `armario_cozinha`
  kitchen_cabinet_small: { compound: 'sink' }, // was `armario_cozinha_p`
  kitchen_cabinet_large: { compound: 'sink' }, // was `armario_cozinha_g`
  washbasin: { compound: 'basin' }, // was `pia_b`
  pedestal_basin: { compound: 'basin' }, // was `pia_coluna`
  wardrobe: { type: 'wardrobe' }, // was `guarda`
  wardrobe_small: { type: 'wardrobe' }, // was `guarda_peq`
  wardrobe_large: { type: 'wardrobe' }, // was `guarda_g`
  closet_wardrobe: { type: 'wardrobe' }, // was `guarda_closet`
  dresser: { type: 'dresser' }, // was `comoda`
  nightstand: { type: 'nightstand' }, // was `criado`
  pantry: { type: 'pantry' }, // was `despensa`
  laundry_cabinet: { type: 'pantry' }, // was `armario_lav`
  china_cabinet: { type: 'pantry' }, // was `cristaleira`
  filing_cabinet: { type: 'dresser' }, // was `arquivo`
  console_table: { type: 'dresser' }, // was `aparador_c`
  tv_unit: { type: 'kitchen_cabinet_base' }, // was `rack`
  tv_unit_small: { type: 'kitchen_cabinet_base' }, // was `rack_peq`
  tv_unit_large: { type: 'kitchen_cabinet_base' }, // was `rack_grande`
  stove: { type: 'stove' }, // was `fogao`
  stove_4burner: { type: 'stove' }, // was `fogao4`
  cooking_gas_cylinder: { type: 'gas_bottle', dim: 'none' }, // was `botijao_gas`
  gas_cylinder: { type: 'gas_bottle', dim: 'none' }, // was `botijao`
  tv: { type: 'tv' }, // was `tv`
  tv_large: { type: 'tv' }, // was `tv_grande`
  microwave: { type: 'microwave' }, // was `microondas`
  washing_machine: { type: 'washing_machine' }, // was `maquina`
  shower: { type: 'shower', dim: 'wd' }, // was `box`
  shower_large: { type: 'shower', dim: 'wd' }, // was `box_g`
  toilet: { type: 'toilet', dim: 'wd' }, // was `vaso`
  laundry_tub: { type: 'utility_sink', dim: 'wd' }, // was `tanque`
  sofa_2seat: { type: 'sofa' }, // was `sofa2`
  sofa_3seat: { type: 'sofa' }, // was `sofa3`
  sofa_l: { type: 'sofa' }, // was `sofa_l`
  sofa_xl: { type: 'sofa' }, // was `sofa_xl`
  armchair: { type: 'armchair' }, // was `poltrona`
  armchair_high: { type: 'armchair' }, // was `poltrona_alta`
  stool: { type: 'dining_chair' }, // was `banqueta`
  camp_chair: { type: 'camp_chair', dim: 'wd' }, // was `cadeira_camping`
  rocking_chair: { type: 'armchair' }, // was `cadeira_balanco`
  rustic_sink: { compound: 'rustic_sink' }, // was `pia_rustica`: the sink of the cabin or shack: the basin the whole width, no cabinet under it; a wall cabinet only if there is `overhead` content
  improvised_bed: { type: 'bed_single', dim: 'wd' }, // was `cama_improvisada`
  log_bench: { type: 'bench', dim: 'wd' }, // was `banco_tronco`
  plank_shelf: { type: 'pantry', variant: 'garage' }, // was `prateleira_tabua`
  sideboard: { type: 'dresser' }, // was `aparador`
  buffet: { type: 'dresser' }, // was `bufe`
  single_bed: { type: 'bed_single', dim: 'wd' }, // was `cama_solteiro`
  double_bed: { type: 'bed_double', dim: 'wd' }, // was `cama_casal`
  queen_bed: { type: 'bed_double', dim: 'wd' }, // was `cama_queen`
  king_bed: { type: 'bed_double', dim: 'wd' }, // was `cama_king`
  bench: { type: 'bench', dim: 'wd' }, // was `banco`
  garden_bench: { type: 'bench', dim: 'wd' }, // was `banco_jardim`
  waiting_bench: { type: 'bench', dim: 'wd' }, // was `espera`
  blinds: { type: 'blinds' }, // was `persiana`
  curtain: { type: 'curtain' }, // was `cortina`
  trash_bin: { type: 'trash_bin' }, // was `lixeira`
  outdoor_bin: { type: 'wheelie_bin' }, // was `lixeira_ext`
  mailbox: { type: 'mailbox', dim: 'none' }, // was `caixa_correio`: the household draws the box on its post: position and rotation only
  doghouse: { type: 'dog_house' }, // was `casinha_cachorro`
  bbq_grill: { type: 'bbq', dim: 'wd' }, // was `churrasqueira`
  bbq_simple: { type: 'bbq', dim: 'wd' }, // was `churrasqueira_simples`
  clothesline: { type: 'clothesline', dim: 'wh' }, // was `varal`
  tool_shelf: { type: 'pantry', variant: 'garage' }, // was `estante_ferr`
  workbench: { type: 'pantry', variant: 'garage' }, // was `bancada_ferr`
  // rural houses and campsite (types of the household pack: rural and camp)
  bunk_bed: { type: 'bunk_bed', dim: 'wd' }, // was `beliche`
  wood_stove: { type: 'wood_stove', dim: 'wd' }, // was `fogao_lenha`: the flue rises to the chimney height (cabin); the fireplace is handled in `planSimple` (it moves and changes height)
  fireplace: { type: 'fireplace', dim: 'w' }, // was `lareira`
  outhouse: { type: 'outhouse', dim: 'wdh' }, // was `privada`
  well: { type: 'well', dim: 'none' }, // was `poco`
  cooler: { type: 'cooler', dim: 'wd' }, // was `cooler`
  campfire: { type: 'campfire', dim: 'wd' }, // was `fogueira`
  camp_stove: { type: 'camp_stove', dim: 'wd' }, // was `fogareiro`
  camp_gas_canister: { type: 'gas_canister', dim: 'none' }, // was `botijao_camping`
  camp_table: { type: 'camp_table', dim: 'wdh' }, // was `mesa_camping`
  // kerosene/gas lanterns: a `lamp` device without electricity (the grid does not matter); the ceiling one is the `hanging` variant
  oil_lamp: { type: 'lantern_lamp', dim: 'x' }, // was `lampiao`
  camp_lantern: { type: 'lantern_lamp', dim: 'x' }, // was `lampiao_camping`
  ceiling_oil_lamp: { type: 'lantern_lamp', variant: 'hanging', dim: 'x' }, // was `lampiao_teto`
  // lamps: objects of the adapter (the kit has no lamp mesh; the house renderer draws the fixture)
  ceiling_light: { type: 'lamp', watts: 15 }, // was `plafon`
  pendant: { type: 'lamp', watts: 20 }, // was `pendente`
  track_spot: { type: 'lamp', watts: 10 }, // was `spot_trilho`
  chandelier: { type: 'lamp', watts: 60 }, // was `lustre`
  floor_lamp: { type: 'lamp', watts: 12 }, // was `luminaria`
  table_lamp: { type: 'lamp', watts: 9 }, // was `abajur`
})

/**
 * Tables that get chairs of the kit (the plan puts none around them). `dining`: chairs on both long sides (and at the ends if the table is 1.6 m or more); `office`:
 * one armchair on the front side of the desk. The adapter only puts a chair where it fits (walls and other furniture).
 */
export const CHAIR_TABLES: Readonly<Record<string, 'dining' | 'office'>> = Object.freeze({
  dining_table: 'dining', // was `mesa`
  dining_table_small: 'dining', // was `mesa_peq`
  dining_table_round: 'dining', // was `mesa_red`
  dining_table_large: 'dining', // was `mesa_grande`
  gourmet_table: 'dining', // was `mesa_gourmet`
  gourmet_table_small: 'dining', // was `mesa_gourmet_peq`
  outdoor_table: 'dining', // was `mesa_ext`
  office_desk: 'office', // was `mesa_escr`
  office_desk_large: 'office', // was `mesa_escr_g`
  desk: 'office', // was `escrivaninha`
})

/** Side of the dining chair of the pack (m). */
export const DINING_CHAIR_SIDE = 0.45

/**
 * What a content stack of the plan (`FindStack.itemId`) becomes in the household catalog (`hh.items`). The ids on the left are the ones the structure pack
 * puts in `result.contents` by default and the ones of the goods catalog (`game-items-goods`, through its provenance); the right side is the team's choice.
 * An id that is not here but is a household item stays as it is.
 */
export const CONTENT_MAP: Readonly<Record<string, string>> = Object.freeze({
  // food
  sugar: 'sugar', // was `acucar`
  rice: 'rice', // was `arroz`
  biscuits: 'biscuits', // was `biscoito`
  coffee: 'coffee', // was `cafe`
  raw_beef: 'frozen_meat', // was `carne`
  packed_meat: 'frozen_meat', // was `carne`
  flour: 'flour', // was `farinha`
  beans: 'beans', // was `feijao`
  apple: 'apple', // was `fruta`
  fruit: 'apple', // was `fruta`
  yogurt: 'yogurt', // was `iogurte`
  canned_food: 'canned_food', // was `lata_atum`
  canned_tuna: 'canned_food', // was `lata_atum`
  canned_corn_and_peas: 'canned_food', // was `lata_milho`
  canned_corn: 'canned_food', // was `lata_milho`
  milk_carton: 'milk_carton', // was `leite`
  pasta: 'pasta', // was `macarrao`
  cooking_oil: 'cooking_oil', // was `oleo`
  eggs: 'eggs', // was `ovos`
  cheese: 'cheese', // was `queijo`
  leftover_meal: 'bowl', // was `sobras`
  leftovers: 'bowl', // was `sobras`
  ice_cream: 'ice_cream', // was `sorvete`
  seasoning: 'salt', // was `tempero`
  spices: 'salt', // was `tempero`
  // water and drink
  water_jug_5l: 'water_bottle', // was `agua_galao`
  water_jug: 'water_bottle', // was `agua_galao`
  water_bottle: 'water_bottle', // was `agua_garrafa`
  soda_can: 'soda_can', // was `refrigerante`
  soda: 'soda_can', // was `refrigerante`
  // medicine
  alcohol_70: 'alcohol_70', // was `alcool`
  rubbing_alcohol: 'alcohol_70', // was `alcool`
  adhesive_bandages: 'bandage', // was `curativo`
  bandages: 'bandage', // was `curativo`
  insulin: 'first_aid_kit', // was `insulina`
  painkillers: 'painkillers', // was `paracetamol`
  painkiller: 'painkillers', // was `paracetamol`
  maintenance_medication: 'painkillers', // was `remedio`
  medicine: 'painkillers', // was `remedio`
  // cleaning and hygiene
  bleach: 'bleach', // was `agua_sanitaria`
  disinfectant: 'bleach', // was `desinfetante`
  detergent: 'detergent', // was `detergente`
  dish_soap: 'detergent', // was `detergente`
  toothbrush: 'toothbrush', // was `escova_dente`
  sponge: 'sponge', // was `esponja`
  rubber_gloves: 'sponge', // was `luvas`
  toilet_paper: 'toilet_paper', // was `papel_higienico`
  laundry_powder: 'detergent', // was `sabao_po`
  washing_powder: 'detergent', // was `sabao_po`
  soap: 'soap', // was `sabonete`
  shampoo: 'shampoo', // was `shampoo`
  // clothes
  jeans: 'jeans', // was `calca`
  trousers: 'jeans', // was `calca`
  tshirt: 'tshirt', // was `camisa`
  shirt: 'tshirt', // was `camisa`
  t_shirt: 'tshirt', // was `camiseta`
  jacket: 'jacket', // was `casaco`
  coat: 'jacket', // was `casaco`
  blanket: 'blanket', // was `cobertor`
  socks: 'socks', // was `meias`
  underwear: 'underwear', // was `roupa_intima`
  sneakers: 'sneakers', // was `sapato`
  shoes: 'sneakers', // was `sapato`
  // utensils
  cup: 'cup', // was `caneca`
  mug: 'cup', // was `caneca`
  plate: 'plate', // was `prato`
  china_plates: 'plate', // was `prato`
  plates: 'plate', // was `prato`
  wine_glass: 'cup', // was `taca`
  wine_glasses: 'cup', // was `taca`
  pot: 'pot', // was `panela`
  // tools and electronics
  pliers: 'screwdriver', // was `alicate`
  bucket: 'paint_can', // was `balde`
  cable_bundle: 'phone_charger', // was `cabos`
  cables: 'phone_charger', // was `cabos`
  pen: 'pen', // was `caneta`
  phone_charger: 'phone_charger', // was `carregador`
  charger: 'phone_charger', // was `carregador`
  screwdriver: 'screwdriver', // was `chave_fenda`
  house_key: 'wallet', // was `chaves`
  keys: 'wallet', // was `chaves`
  remote_control: 'batteries', // was `controle_remoto`
  rope: 'rope', // was `corda`
  electrical_tape: 'duct_tape', // was `fita_isolante`
  insulating_tape: 'duct_tape', // was `fita_isolante`
  flashlight: 'flashlight', // was `lanterna`
  backpack: 'backpack', // was `mochila`
  eyeglasses: 'wallet', // was `oculos`
  glasses: 'wallet', // was `oculos`
  screws: 'duct_tape', // was `parafusos`
  batteries: 'batteries', // was `pilhas`
  nails: 'duct_tape', // was `pregos`
  // improvised weapons
  knife: 'knife', // was `faca`
  kitchen_knife: 'knife', // was `faca`
  stapler: 'scissors', // was `grampeador`
  hammer: 'hammer', // was `martelo`
  handsaw: 'hammer', // was `serrote`
  hand_saw: 'hammer', // was `serrote`
  scissors: 'scissors', // was `tesoura`
  broom: 'rope', // was `vassoura`
  // papers
  letter: 'letter', // was `carta`
  bill: 'bill', // was `conta`
  documents: 'documents', // was `documento`
  dvd: 'notebook', // was `dvd`
  dvds: 'notebook', // was `dvd`
  book: 'notebook', // was `livro`
  // trash
  food_packaging: 'plastic_bag', // was `embalagem`
  packaging: 'plastic_bag', // was `embalagem`
  paint_can: 'paint_can', // was `lata_tinta`
  empty_can: 'empty_can', // was `lata_vazia`
  flyer: 'flyer', // was `panfleto`
  crumpled_paper: 'crumpled_paper', // was `papel_amassado`
  trash_bag: 'plastic_bag', // was `saco_lixo`
  full_trash_bag: 'plastic_bag', // was `saco_lixo_cheio`
})

/** When the item is in no table: the closest household item by the group of the stack (`FindStack.group`). */
export const CONTENT_BY_GROUP: Readonly<Record<string, string>> = Object.freeze({
  food: 'canned_food', // was `comida`
  water: 'water_bottle', // was `agua`
  medicine: 'painkillers', // was `remedio`
  tool: 'duct_tape', // was `ferramenta`
  improvised_weapon: 'hammer', // was `arma_improvisada`
  clothes: 'tshirt', // was `roupa`
  document: 'documents', // was `documento`
  cleaning: 'detergent', // was `limpeza`
  trash: 'crumpled_paper', // was `lixo`
  utensil: 'plate', // was `utensilio`
})

/** The item for a stack with no table entry, no household id and no known group. */
export const CONTENT_FALLBACK = 'crumpled_paper'

/** Items that go in the freezer first (the team asked for it by the name of the stack: ice cream and "frozen meat"). */
export const FROZEN_ITEMS: readonly string[] = Object.freeze(['ice_cream', 'frozen_meat'])

/** Items that go in the drawers of a wardrobe first (underwear and socks). */
export const DRAWER_ITEMS: readonly string[] = Object.freeze(['underwear', 'socks'])

/** Groups that go in the drawer of a kitchen base cabinet first. */
export const DRAWER_GROUPS: readonly string[] = Object.freeze(['improvised_weapon', 'tool'])

/** The last resort when nothing of the category fits the slots of the object (a mailbox holds only thin paper). */
export const OBJECT_SUBSTITUTES: Readonly<Record<string, readonly string[]>> = Object.freeze({ mailbox: ['flyer', 'postcard', 'letter'] })

/** Point of the plumbing (`plumbing.points[].kind`) to the fixtures of the household object that use it. */
export const FIXTURES_OF_POINT: Readonly<Record<string, readonly string[]>> = Object.freeze({
  tap: ['tap'], // was `torneira`
  shower: ['shower'], // was `chuveiro`
  flush: ['flush'], // was `descarga`
  tub: ['tap', 'basin'], // was `tanque`
  machine: ['inlet'], // was `maquina`
})

/** Objects the kit does not have and the adapter creates itself (without going through `build`). */
export const OWN_TYPES: Readonly<Record<string, true>> = Object.freeze({ lamp: true, gas_piped: true })

