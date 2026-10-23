/** Vehicle ids of the fleet by group, in the order they are installed. */

/** Bicycle, scooters, motorcycles and a quad bike. */
export const motorcycles = [
  'bicycle',
  'scooter',
  'commuter_motorcycle',
  'trail_bike',
  'adventure_bike',
  'highway_police_bike',
  'quad_bike',
  'step_through_scooter',
  'naked_bike',
  'sport_bike',
  'cruiser',
  'delivery_bike',
] as const

/** Hatchbacks, sedans, police cars, a taxi and two classics. */
export const cars = [
  'compact_hatch',
  'taxi',
  'entry_hatch',
  'electric_hatch',
  'midsize_sedan',
  'police_sedan',
  'highway_police_sedan',
  'beetle',
  'boxy_hatch',
  'family_hatch',
  'rideshare_hatch',
  'turbo_hatch',
  'fastback_sedan',
  'classic_six_sedan',
  'v8_coupe',
] as const

/** Compact, hybrid, mid-size and large SUVs. */
export const suvs = ['compact_suv', 'hybrid_suv', 'midsize_suv', 'large_suv'] as const

/** Pickups and a monster truck. */
export const pickups = ['compact_pickup', 'crossover_pickup', 'midsize_pickup', 'monster_truck'] as const

/** A cargo van and an ambulance. */
export const vans = ['cargo_van', 'ambulance'] as const

/** Trucks, buses and an armoured truck. */
export const heavy = ['box_truck', 'tanker_truck', 'school_bus', 'city_bus', 'armored_truck'] as const

/** A farm tractor. */
export const agricultural = ['tractor'] as const

/** Military vehicles, one of them a tank and two helicopters. */
export const military = [
  'light_4x4',
  'troop_truck',
  'apc_6x6',
  'armored_car_6x6',
  'battle_tank',
  'transport_helicopter',
  'light_attack_turboprop',
  'attack_helicopter',
] as const

/** Boats, a jet ski and a sailboat. */
export const water = ['river_skiff', 'speedboat', 'fishing_boat', 'jet_ski', 'sailboat', 'rescue_dinghy', 'patrol_boat'] as const

/** Planes and helicopters. */
export const air = [
  'single_engine_plane',
  'crop_duster',
  'piston_helicopter',
  'rescue_helicopter',
  'tandem_trainer',
  'regional_turboprop',
  'amphibian_turboprop',
  'light_jet',
  'trainer_helicopter',
  'turbine_helicopter',
  'police_helicopter',
] as const

/** Fleet group ids, in the order the groups are registered. */
export const fleetGroupIds = [
  'motorcycles',
  'cars',
  'suvs',
  'pickups',
  'vans',
  'heavy',
  'agricultural',
  'military',
  'water',
  'air',
] as const

export type FleetGroupId = (typeof fleetGroupIds)[number]

/** The vehicle ids of every group. */
export const fleetGroups = {
  motorcycles,
  cars,
  suvs,
  pickups,
  vans,
  heavy,
  agricultural,
  military,
  water,
  air,
} as const

/** Every vehicle id, in install order. */
export const fleetVehicleIds = [
  'compact_hatch',
  'taxi',
  'entry_hatch',
  'electric_hatch',
  'midsize_sedan',
  'police_sedan',
  'highway_police_sedan',
  'bicycle',
  'scooter',
  'commuter_motorcycle',
  'trail_bike',
  'adventure_bike',
  'highway_police_bike',
  'quad_bike',
  'beetle',
  'compact_suv',
  'hybrid_suv',
  'midsize_suv',
  'large_suv',
  'compact_pickup',
  'crossover_pickup',
  'midsize_pickup',
  'monster_truck',
  'cargo_van',
  'ambulance',
  'box_truck',
  'tanker_truck',
  'school_bus',
  'city_bus',
  'armored_truck',
  'tractor',
  'light_4x4',
  'troop_truck',
  'apc_6x6',
  'armored_car_6x6',
  'battle_tank',
  'transport_helicopter',
  'river_skiff',
  'speedboat',
  'fishing_boat',
  'single_engine_plane',
  'crop_duster',
  'piston_helicopter',
  'rescue_helicopter',
  'step_through_scooter',
  'naked_bike',
  'sport_bike',
  'cruiser',
  'delivery_bike',
  'boxy_hatch',
  'family_hatch',
  'rideshare_hatch',
  'turbo_hatch',
  'fastback_sedan',
  'classic_six_sedan',
  'v8_coupe',
  'jet_ski',
  'sailboat',
  'rescue_dinghy',
  'patrol_boat',
  'tandem_trainer',
  'regional_turboprop',
  'amphibian_turboprop',
  'light_jet',
  'light_attack_turboprop',
  'trainer_helicopter',
  'turbine_helicopter',
  'police_helicopter',
  'attack_helicopter',
] as const

export type FleetVehicleId = (typeof fleetVehicleIds)[number]
