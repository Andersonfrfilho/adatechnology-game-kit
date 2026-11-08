/**
 * Item types the plans place that have no builder in the house renderer, so the house draws a labelled box for them: no model, no material, nothing to
 * break. A debt counted on 2026-11-08 (docs/plantas-validacao.md); it only shrinks. A type that gets its model leaves the list (the test fails until it does),
 * and a new type without a model fails the test.
 */
export const UNMODELLED_ITEM_TYPES: ReadonlySet<string> = new Set<string>([
  'altar', 'altar_cross', 'bakery_counter', 'barn', 'basketball_hoop', 'blackboard', 'bucket', 'bunk_bed', 'butcher_counter', 'camo_rack',
  'camp_chair', 'campfire', 'camp_gas_canister', 'camp_lantern', 'camp_stove', 'camp_table', 'canopy_column', 'canteen_table', 'ceiling_oil_lamp',
  'cell_bunk', 'checkout_lane', 'chicken_coop', 'church_bell', 'cold_chamber', 'compounding_bench', 'convenience_aisle', 'convenience_counter',
  'conveyor_line', 'cooler', 'corral', 'cot', 'crash_cart', 'dispensing_counter', 'donation_cabinet', 'evidence_rack', 'farm_table', 'farm_well',
  'fireplace', 'firewood', 'forklift', 'fuel_pump_island', 'furnace', 'gondola_run', 'gun_counter', 'hammock', 'hay_bale', 'hospital_bed',
  'improvised_bed', 'industrial_counter', 'investigation_board', 'library_stack', 'lift_post', 'locker_bank_6', 'locker_bank_9', 'log_bench',
  'log_table', 'long_gun_rack', 'machine_shed', 'medical_crate', 'medicine_cabinet', 'metal_press', 'oil_drum', 'oil_lamp', 'outhouse',
  'oxygen_cylinder', 'pallet_rack', 'patient_monitor', 'pew', 'plank_shelf', 'reading_table', 'reception_counter', 'reload_bench', 'rifle_trestle',
  'rocking_chair', 'rustic_sink', 'sacristy_table', 'safe', 'scarecrow', 'school_desk', 'shooting_bench', 'silo', 'sleeping_bag', 'sleeping_pad',
  'stretcher', 'target_frame', 'tractor', 'trophy_head', 'vaccine_fridge', 'vault_shelf', 'veranda_post', 'weapon_locker', 'well', 'wood_stove',
])
