/** Words of the vegetation area's bench. */
export type VegetationText = {
  group: string
  name: string
  controls: Record<'seed' | 'quality' | 'lod' | 'condition' | 'season' | 'wind' | 'gust', string>
  hints: Record<'seed' | 'quality' | 'lod' | 'condition' | 'season' | 'wind' | 'gust', string>
  options: { quality: Record<string, string>; lod: Record<string, string>; condition: Record<string, string>; season: Record<string, string> }
  actions: Record<'plant_lot' | 'clear_lot' | 'toggle_walker', string>
  layers: Record<'colliders' | 'piece_boxes' | 'wood_axes', string>
  metrics: Record<'plants' | 'pieces' | 'triangles' | 'draw_calls' | 'lot_triangles' | 'lot_plants' | 'lot_colliders' | 'lot_lod0' | 'lot_lod1' | 'lot_lod2' | 'lot_ms', string>
  lot: Record<'planted' | 'cleared' | 'walker_on' | 'walker_off', string>
}

export const TEXT: Record<string, VegetationText> = {
  en: {
    group: 'Trees, plants and flowers',
    name: 'Vegetation',
    controls: { seed: 'Lot seed', quality: 'Lot quality', lod: 'Lot detail (LOD)', condition: 'Condition', season: 'Season', wind: 'Wind', gust: 'Gusts' },
    hints: {
      seed: 'The seed of the nursery lot: the same seed plants the same yard',
      quality: 'High: every plant at the detail below. Game: one level for all plants and small ones cheaper, with a triangle budget',
      lod: 'Level of detail of the plants of the lot (0 the most detailed)',
      condition: 'How the lot plants look: healthy, dry, dead or overgrown (decides green or dry wood for the destruction)',
      season: 'Season of the lot (flowers and leaf colours)',
      wind: 'Strength of the wind that sways the leaves, flowers and grass',
      gust: 'Slowly varying extra push on top of the wind',
    },
    options: {
      quality: { high: 'High', game: 'Game' },
      lod: { '0': 'LOD 0', '1': 'LOD 1', '2': 'LOD 2' },
      condition: { healthy: 'Healthy', dry: 'Dry', dead: 'Dead', overgrown: 'Overgrown' },
      season: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
    },
    actions: { plant_lot: 'Plant the nursery lot', clear_lot: 'Remove the nursery lot', toggle_walker: 'Start or stop the walker' },
    layers: { colliders: 'Colliders (trunks and cactus bodies)', piece_boxes: 'Boxes of the pieces', wood_axes: 'Wood axes (radius, length, axis)' },
    metrics: { plants: 'Plants placed', pieces: 'Pieces', triangles: 'Triangles', draw_calls: 'Draw calls', lot_triangles: 'Lot triangles', lot_plants: 'Lot plants', lot_colliders: 'Lot colliders', lot_lod0: 'Lot plants at LOD 0', lot_lod1: 'Lot plants at LOD 1', lot_lod2: 'Lot plants at LOD 2', lot_ms: 'Lot build time' },
    lot: { planted: 'Nursery lot planted: {0} plants, {1} triangles, {2} colliders', cleared: 'Nursery lot removed', walker_on: 'The walker crosses the lot and bends the plants', walker_off: 'The walker stopped' },
  },
  'pt-BR': {
    group: 'Árvores, plantas e flores',
    name: 'Vegetação',
    controls: { seed: 'Semente do canteiro', quality: 'Qualidade do canteiro', lod: 'Detalhe do canteiro (LOD)', condition: 'Condição', season: 'Estação', wind: 'Vento', gust: 'Rajadas' },
    hints: {
      seed: 'A semente do canteiro: a mesma semente planta o mesmo quintal',
      quality: 'Alta: todas as plantas no detalhe abaixo. Jogo: um nível para todas e as pequenas mais baratas, com orçamento de triângulos',
      lod: 'Nível de detalhe das plantas do canteiro (0 o mais detalhado)',
      condition: 'Como ficam as plantas do canteiro: saudável, seca, morta ou malcuidada (decide madeira verde ou seca na destruição)',
      season: 'Estação do canteiro (flores e cor das folhas)',
      wind: 'Força do vento que balança folhas, flores e grama',
      gust: 'Empurrão extra que varia devagar, somado ao vento',
    },
    options: {
      quality: { high: 'Alta', game: 'Jogo' },
      lod: { '0': 'LOD 0', '1': 'LOD 1', '2': 'LOD 2' },
      condition: { healthy: 'Saudável', dry: 'Seca', dead: 'Morta', overgrown: 'Malcuidada' },
      season: { spring: 'Primavera', summer: 'Verão', autumn: 'Outono', winter: 'Inverno' },
    },
    actions: { plant_lot: 'Plantar o canteiro', clear_lot: 'Tirar o canteiro', toggle_walker: 'Ligar ou desligar o caminhante' },
    layers: { colliders: 'Colisores (troncos e corpos de cacto)', piece_boxes: 'Caixas das peças', wood_axes: 'Eixos da madeira (raio, comprimento, eixo)' },
    metrics: { plants: 'Plantas postas', pieces: 'Peças', triangles: 'Triângulos', draw_calls: 'Chamadas de desenho', lot_triangles: 'Triângulos do canteiro', lot_plants: 'Plantas do canteiro', lot_colliders: 'Colisores do canteiro', lot_lod0: 'Plantas do canteiro em LOD 0', lot_lod1: 'Plantas do canteiro em LOD 1', lot_lod2: 'Plantas do canteiro em LOD 2', lot_ms: 'Tempo de montagem do canteiro' },
    lot: { planted: 'Canteiro plantado: {0} plantas, {1} triângulos, {2} colisores', cleared: 'Canteiro retirado', walker_on: 'O caminhante cruza o canteiro e dobra as plantas', walker_off: 'O caminhante parou' },
  },
}

export const fill = (template: string, ...values: readonly unknown[]): string => template.replace(/\{(\d+)\}/g, (_m, i: string) => String(values[Number(i)]))
