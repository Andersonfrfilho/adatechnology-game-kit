import type { PlantSpec } from '../src'

/** One or more representative specs per archetype (no species pack needed). */
export const SAMPLES: Record<string, PlantSpec> = {
  broadleaf_round: { archetype: 'broadleaf_tree', height: 7, crownShape: 'round' },
  broadleaf_spreading_fruit: { archetype: 'broadleaf_tree', height: 9, crownShape: 'spreading', crownRadius: 4, fruit: { colors: [0xe8a02a, 0xd4602d], count: 10, radius: 0.12 } },
  broadleaf_weeping: { archetype: 'broadleaf_tree', height: 8, crownShape: 'weeping', deciduous: true },
  broadleaf_bloom: { archetype: 'broadleaf_tree', height: 9, bloom: { colors: [0xf4c81e], replacesLeaves: true, seasons: ['summer'] } },
  broadleaf_trunk_fruit: { archetype: 'broadleaf_tree', height: 4, trunkFraction: 0.2, fruit: { colors: [0x2a1030], count: 60, radius: 0.03, onTrunk: true } },
  dead_tree: { archetype: 'dead_tree', height: 6 },
  palm_coconut: { archetype: 'palm', variant: 'coconut', fruit: { color: 0x7a9a3a, count: 5 } },
  palm_royal: { archetype: 'palm', variant: 'royal' },
  palm_fan: { archetype: 'palm', variant: 'fan' },
  palm_areca: { archetype: 'palm', variant: 'areca', stems: 6 },
  banana: { archetype: 'banana', bunch: true, bud: true },
  conifer_cone: { archetype: 'conifer', shape: 'cone' },
  conifer_candelabra: { archetype: 'conifer', shape: 'candelabra' },
  shrub_round: { archetype: 'shrub', shape: 'round', flowers: { colors: [0xe870a8], style: 'dots', count: 40 } },
  shrub_hedge: { archetype: 'shrub', shape: 'hedge', length: 2.4 },
  shrub_loose: { archetype: 'shrub', shape: 'loose', flowers: { colors: [0xc8208a], style: 'clusters', count: 40 } },
  flower_daisy: { archetype: 'flower_plant', flowerType: 'daisy' },
  flower_rose: { archetype: 'flower_plant', flowerType: 'rose' },
  flower_sunflower: { archetype: 'flower_plant', flowerType: 'sunflower' },
  flower_tulip: { archetype: 'flower_plant', flowerType: 'tulip' },
  flower_hibiscus: { archetype: 'flower_plant', flowerType: 'hibiscus' },
  flower_cluster: { archetype: 'flower_plant', flowerType: 'cluster' },
  flower_lily: { archetype: 'flower_plant', flowerType: 'lily' },
  flower_bird: { archetype: 'flower_plant', flowerType: 'bird_of_paradise' },
  grass: { archetype: 'grass_tuft' },
  grass_seeds: { archetype: 'grass_tuft', height: 0.9, seedHeads: true },
  fern: { archetype: 'fern' },
  rosette_agave: { archetype: 'rosette', form: 'agave' },
  rosette_sword: { archetype: 'rosette', form: 'sword' },
  rosette_aloe: { archetype: 'rosette', form: 'aloe', bloom: { color: 0xe8702a } },
  rosette_echeveria: { archetype: 'rosette', form: 'echeveria' },
  cactus_columnar: { archetype: 'columnar_cactus', flowers: { color: 0xffffff } },
  cactus_saguaro: { archetype: 'columnar_cactus', armStyle: 'saguaro', arms: 2, ribs: 12 },
  cactus_paddle: { archetype: 'paddle_cactus', fruit: { color: 0xc83a4a, count: 5 }, flowers: { color: 0xf2c230, count: 3 } },
  cactus_globe: { archetype: 'globe_cactus', cephalium: { color: 0xc8305a } },
  vine_wall: { archetype: 'vine', host: { wall: { width: 2.5, height: 2.2 } }, flowers: { colors: [0xc8208a], count: 12 } },
  vine_path: { archetype: 'vine', host: { path: [[0, 0, 0], [0, 1, 0.1], [0.4, 2, 0.1], [1, 2.4, 0]] } },
  potted: { archetype: 'potted', pot: { shape: 'terracotta', radius: 0.2 }, plant: { archetype: 'fern' } },
}

/** Budgets for LOD0 triangle counts by sample key prefix. */
export function budgetFor(key: string): number {
  if (key.startsWith('broadleaf') || key.startsWith('palm') || key.startsWith('banana') || key.startsWith('conifer') || key.startsWith('dead')) return 6000
  if (key.startsWith('shrub')) return 2500
  if (key.startsWith('flower') || key.startsWith('fern') || key.startsWith('rosette') || key.startsWith('vine') || key.startsWith('potted')) return 1500
  if (key.startsWith('grass')) return 300
  if (key.startsWith('cactus')) return 2500
  return 6000
}
