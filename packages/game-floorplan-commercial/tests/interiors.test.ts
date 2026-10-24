import { beforeAll, describe, expect, it } from 'vitest'
import { engine } from '@adatechnology/game-floorplan'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import { register, interiorFindsHints } from '../src'

beforeAll(() => {
  registerResidential(engine, { region: 'br' })
  register(engine, { region: 'br' })
})

type Dimensions = readonly [number, number]
/** A `loot` pin of the team's gallery scene: where it is (room, furniture category) and the label the team gave it. */
type Pin = readonly [label: string, room: string, container: string]
type Program = {
  /** Declared use for zoning. */
  use: string
  size: Dimensions
  ceiling: number
  /** Room dimensions (width, depth) at the default size, from the gallery scene's walls and the zones its fixtures mark. */
  rooms: Record<string, Dimensions>
  /** Count of each fixture type over the whole plan; `ground` fixtures outside the building are not counted. */
  fixtures: Record<string, number>
  pins: readonly Pin[]
}

/** The program of each building, from `buildMercado`... `buildFazenda` of the gallery (mapa__galeria-vale-cinzento.js L771-L1096) and its pins. */
const PROGRAMS: Record<string, Program> = {
  supermarket: {
    use: 'commercial',
    size: [18, 13], ceiling: 3.4,
    rooms: { checkouts: [13, 2.9], service_corridor: [2, 1.9], office: [3, 1.9], stockroom: [5, 3.6], bakery: [5, 3], butcher: [5, 4.5], shop: [13, 10.1] },
    fixtures: { gondola_run: 4, checkout_lane: 3, cash_register: 3, wall_shelving: 6, freezer: 2, bakery_counter: 1, butcher_counter: 1, cold_chamber: 1, metal_shelf: 1, office_desk: 1, safe: 1 },
    pins: [['Gôndola quase vazia', 'shop', 'gondola_shelf'], ['Padaria', 'bakery', 'bakery_counter'], ['Escritório do gerente', 'office', 'safe'], ['Açougue', 'butcher', 'butcher_counter'], ['Estoque', 'stockroom', 'metal_shelf']],
  },
  drugstore: {
    use: 'commercial',
    size: [11, 9], ceiling: 3.2,
    rooms: { shop: [8, 5.6], compounding_room: [3, 2.5], dispensing: [8, 3.4], controlled_storage: [3, 2.2] },
    fixtures: { wall_shelving: 7, dispensing_counter: 3, compounding_bench: 1, scale: 1, metal_shelf: 1, vaccine_fridge: 1, safe: 1 },
    pins: [['Controlados atrás da grade', 'controlled_storage', 'metal_shelf'], ['Geladeira de vacinas', 'controlled_storage', 'vaccine_fridge'], ['Cofre', 'controlled_storage', 'safe'], ['Sala de manipulação', 'compounding_room', 'compounding_bench'], ['Prateleira', 'shop', 'wall_shelving']],
  },
  gun_shop: {
    use: 'commercial',
    size: [20, 9], ceiling: 3.2,
    rooms: { sales_floor: [12, 7], vault: [2.4, 2], shooting_range: [8, 9] },
    fixtures: { long_gun_rack: 1, gun_counter: 1, reload_bench: 1, trophy_head: 3, camo_rack: 1, vault_shelf: 1, shooting_bench: 4, target_frame: 4 },
    pins: [['Armas longas', 'sales_floor', 'gun_rack'], ['Vitrine de pistolas', 'sales_floor', 'gun_counter'], ['Roupa camuflada', 'sales_floor', 'camo_rack'], ['Bancada de recarga', 'sales_floor', 'reload_bench'], ['Estande de tiro', 'shooting_range', 'shooting_bench'], ['Depósito blindado (classe D)', 'vault', 'vault_shelf']],
  },
  police_station: {
    use: 'institutional',
    size: [16, 11], ceiling: 3,
    rooms: { evidence_depot: [1.8, 3.5], reception: [9.6, 3.5], chief_office: [4.6, 3.5], arsenal: [2.4, 3], locker_room: [2.4, 4.5], bullpen: [8.6, 7.5], cell_1: [2.5, 6.5], cell_2: [2.5, 6.5] },
    fixtures: { reception_counter: 1, evidence_rack: 1, office_desk: 4, filing_cabinet: 1, weapon_locker: 1, locker_bank_6: 1, investigation_board: 1, cell_bunk: 2, car: 1 },
    pins: [['Arsenal (classe D)', 'arsenal', 'weapon_locker'], ['Sala do delegado', 'chief_office', 'office_desk'], ['Depósito de evidências', 'evidence_depot', 'evidence_rack'], ['Pátio de viaturas', 'garden', 'car'], ['Vestiário', 'locker_room', 'locker'], ['Mesas', 'bullpen', 'office_desk']],
  },
  emergency_room: {
    use: 'institutional',
    size: [18, 11], ceiling: 3,
    rooms: { emergency_room: [18, 6.5], ward_a: [8, 4.5], icu: [2, 4.5], ward_b: [8, 4.5] },
    fixtures: { stretcher: 3, crash_cart: 1, oxygen_cylinder: 6, hospital_bed: 5, patient_monitor: 5, medicine_cabinet: 2 },
    pins: [['Carrinho de emergência', 'emergency_room', 'crash_cart'], ['Ala de internação (A)', 'ward_a', 'medicine_cabinet'], ['Ala de internação (B)', 'ward_b', 'medicine_cabinet']],
  },
  school: {
    use: 'institutional',
    size: [18, 15], ceiling: 3,
    rooms: { library: [5.5, 5.9], cafeteria: [4.5, 3.6], kitchen: [4.5, 2.3], corridor: [10, 2.6], classroom: [10, 6.5], sports_court: [8, 15] },
    fixtures: { bookcase: 4, library_stack: 2, reading_table: 1, canteen_table: 2, industrial_counter: 1, locker_bank_9: 1, blackboard: 1, office_desk: 1, school_desk: 16, basketball_hoop: 2 },
    pins: [['Mesa do professor', 'classroom', 'office_desk'], ['Biblioteca', 'library', 'bookcase'], ['Cozinha da merenda', 'kitchen', 'industrial_counter'], ['Armários de alunos', 'corridor', 'locker']],
  },
  gas_station: {
    use: 'commercial',
    size: [22, 7], ceiling: 3,
    rooms: { convenience_store: [14, 7], restroom: [2, 2], utility: [2, 5], oil_bay: [6, 7] },
    fixtures: { convenience_aisle: 3, convenience_counter: 1, cash_register: 1, display_fridge: 4, tool_shelf: 1, lift_post: 2, metal_shelf: 1, oil_drum: 4, fuel_pump_island: 3, canopy_column: 4, toilet: 1, washbasin: 1 },
    pins: [['Conveniência', 'convenience_store', 'gondola_shelf'], ['Troca de óleo', 'oil_bay', 'metal_shelf']],
  },
  church: {
    use: 'institutional',
    size: [12, 20], ceiling: 7,
    rooms: { parish_hall: [12, 4], nave: [12, 12.8], sanctuary: [9.4, 3.2], sacristy: [2.6, 3.2] },
    fixtures: { pew: 14, donation_cabinet: 1, altar: 1, altar_cross: 1, wardrobe_small: 1, sacristy_table: 1, church_bell: 1 },
    pins: [['Altar', 'sanctuary', 'altar'], ['Sacristia', 'sacristy', 'wardrobe'], ['Armário de doações', 'nave', 'donation_cabinet']],
  },
  metalworks: {
    use: 'industrial',
    size: [30, 20], ceiling: 8,
    rooms: { canteen: [10, 4.5], reception: [10, 4.5], shipping_bay: [10, 10], storage: [20, 5.5], production_floor: [27, 7], office_mezzanine: [8.5, 3], locker_room: [3, 10] },
    fixtures: { canteen_table: 2, fridge: 1, forklift: 1, oil_drum: 6, pallet_rack: 3, metal_press: 4, conveyor_line: 1, furnace: 1, office_desk: 1, locker_bank_6: 1 },
    pins: [['Vestiário', 'locker_room', 'locker'], ['Porta-pallets', 'storage', 'pallet_rack'], ['Escritório no mezanino', 'office_mezzanine', 'office_desk'], ['Refeitório', 'canteen', 'canteen_table']],
  },
}

const SEEDS = Array.from({ length: 25 }, (_, index) => index + 1)

describe.each(Object.entries(PROGRAMS))('interior %s', (id, program) => {
  it('has the default size, ceiling and place of the scene', () => {
    const template = engine.listTemplates().find((t) => t.id === id)!
    expect(template.use).toBe(program.use)
    expect(template.defaults).toEqual({ w: program.size[0], d: program.size[1] })
    const plan = engine.generate(id, { seed: 1 })
    expect([plan.w, plan.d]).toEqual(program.size)
    expect(plan.floors[0].ceiling).toBe(program.ceiling)
    expect(engine.templates[id]!.place).toBeTruthy()
  })

  it('has the rooms and dimensions of the scene', () => {
    const plan = engine.generate(id, { seed: 1 })
    const dimensions = Object.fromEntries(plan.rooms.map((room: any) => [room.id, [Math.round((room.parts[0][2] - room.parts[0][0]) * 100) / 100, Math.round((room.parts[0][3] - room.parts[0][1]) * 100) / 100]]))
    expect(dimensions).toEqual(program.rooms)
  })

  it('has every fixture of the scene, the same count for every seed', () => {
    for (const seed of SEEDS) {
      const counts: Record<string, number> = {}
      const plan = engine.generate(id, { seed })
      for (const item of plan.items) if (!item.decor) counts[item.type] = (counts[item.type] ?? 0) + 1
      const wanted = Object.entries(program.fixtures)
      expect(Object.fromEntries(wanted.map(([type]) => [type, counts[type] ?? 0])), `seed ${seed}`).toEqual(program.fixtures)
    }
  })

  it('is valid for every seed: no overlap, nothing blocking a door, nothing required missing', () => {
    for (const seed of SEEDS) {
      const plan = engine.generate(id, { seed })
      expect(engine.validate(plan), `seed ${seed}`).toEqual([])
    }
  })

  it('turns every loot pin of the scene into a finds hint backed by a fixture in that room', () => {
    const hints = interiorFindsHints[id] ?? []
    const plan = engine.generate(id, { seed: 1 })
    for (const [label, room, container] of program.pins) {
      expect(hints.some((hint) => hint.room === room && hint.container === container), label).toBe(true)
      expect(plan.items.some((item: any) => item.room === room && item.category === container), label).toBe(true)
    }
    expect(hints.length).toBe(program.pins.length)
  })

  it('names the template and every room in en and pt-BR', () => {
    const plan = engine.generate(id, { seed: 1, locale: 'pt-BR' })
    const english = engine.generate(id, { seed: 1 })
    expect(plan.name).not.toBe(id)
    expect(english.name).not.toBe(id)
    expect(plan.name).not.toBe(english.name)
    for (const room of english.rooms) expect(room.name, room.id).not.toBe(room.id)
    for (const room of plan.rooms) expect(room.name, room.id).not.toBe(room.id)
  })
})
