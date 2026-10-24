/** Words and sentences of the urban area, by locale. `{0}`, `{1}`... are filled in order. */
export type UrbanText = {
  group: string
  name: string
  items: Record<string, string>
  controls: Record<'pattern' | 'seed' | 'lamps' | 'budget' | 'providers', string>
  hints: Record<'pattern' | 'seed' | 'lamps' | 'budget' | 'providers', string>
  options: { lamps: Record<string, string>; providers: Record<string, string> }
  actions: Record<'compose' | 'clear', string>
  layers: Record<'light_radius' | 'bounds', string>
  metrics: Record<'samples' | 'draw_calls' | 'triangles' | 'real_lights' | 'instances' | 'bench_objects' | 'light_budget_left', string>
  log: Record<'composed' | 'cleared' | 'no_vehicles', string>
  scenarios: Record<string, string>
  checks: Record<string, string>
}

const ptBR: UrbanText = {
  group: 'Cidade',
  name: 'Área urbana',
  items: {
    pole_led_double: 'Poste LED de braço duplo',
    pole_concrete_arm: 'Poste de concreto com braço',
    pole_cast_iron: 'Lampião de ferro fundido',
    pole_wood_crossarm: 'Poste de madeira com cruzeta',
    pole_flood_tower: 'Torre de refletores',
    street_grid: 'Grade de ruas com quarteirão',
    terrain_patch: 'Trecho de terreno',
    downtown: 'Bairro: centro',
    suburb: 'Bairro: subúrbio',
    working_class: 'Bairro: popular',
    historic_street: 'Bairro: rua histórica',
    industrial_port: 'Bairro: industrial e porto',
    railway_village: 'Bairro: vila ferroviária',
    mountain_resort: 'Bairro: serra',
    stilt_village: 'Bairro: palafitas',
    military: 'Bairro: militar',
    rural: 'Bairro: rural',
  },
  controls: { pattern: 'Bairro da bancada', seed: 'Semente', lamps: 'Lampiões', budget: 'Luzes reais da cena', providers: 'Veículos e plantas' },
  hints: {
    pattern: 'Padrão que as ações desenham na frente do jogador',
    seed: 'A mesma semente desenha a mesma rua',
    lamps: 'Quantos lampiões ficam acesos; o resto queima',
    budget: 'Cada lampião aceso gasta uma; passando disso fica só a lente brilhando',
    providers: 'Pede ao game-vehicles-fleet e ao game-vegetation-species os carros e as árvores',
  },
  options: {
    lamps: { pattern: 'Os do padrão', all: 'Todos acesos', half: 'Metade', none: 'Nenhum' },
    providers: { none: 'Nenhum (padrão)', plants: 'Plantas das espécies', vehicles: 'Veículos da frota', both: 'Os dois' },
  },
  actions: { compose: 'Desenhar o bairro', clear: 'Tirar o bairro' },
  layers: { light_radius: 'Alcance das luzes', bounds: 'Caixas das amostras' },
  metrics: { samples: 'Amostras na sala', draw_calls: 'Chamadas de desenho', triangles: 'Triângulos', real_lights: 'Luzes reais', instances: 'Instâncias', bench_objects: 'Objetos da bancada', light_budget_left: 'Orçamento de luzes que sobra' },
  log: { composed: 'Bairro {0} desenhado com a semente {1}: {2} objetos, {3} luzes reais', cleared: 'Bairro tirado', no_vehicles: 'A sala não recebeu um construtor de veículos: os carros ficam de fora' },
  scenarios: {
    urban_pole_heights: 'Os cinco postes têm a altura da tabela',
    urban_light_budget: 'O orçamento de luzes: as primeiras acesas ganham luz real e o contador passa de zero',
    urban_road_dashes: 'A rua tem uma faixa a cada 5 m',
    urban_block_heights: 'Os prédios altos são mais raros',
    urban_neighbourhood_seed: 'A mesma semente desenha o mesmo bairro',
    urban_lamps_burnt: 'Um bairro com a fração zero de lampiões acesos não tem nenhum aceso',
    urban_terrain: 'O terreno tem a altura do vértice, o leito do rio e o nível do lago',
    urban_providers: 'Os provedores pedem veículos da frota e espécies da região onde o bairro estaciona e planta',
  },
  checks: {
    pole_top: 'o poste {0} chega a {1} m',
    budget_real: '{0} lâmpadas acesas, {1} luzes reais (o orçamento é {2})',
    budget_left: 'o contador chegou a {0}',
    dashes: 'uma rua de 60 m tem {0} faixas, a primeira em x = {1}',
    heights_in_range: 'os prédios ficam entre {0} e {1} m',
    heights_median: 'a mediana dos prédios é {0} m, abaixo do meio {1} m',
    same_seed: 'a mesma semente repete as partes: {0}',
    other_seed: 'outra semente muda o bairro: {0}',
    lamps_none: 'com a fração 0 nenhum dos {0} postes está aceso',
    lamps_all: 'o centro mantém os {0} postes acesos',
    vertex_height: 'a altura do vértice central é {0} m e a da malha {1} m',
    river_bed: 'o leito do rio está {0} m abaixo do chão ao lado',
    lake_level: 'o centro do lago está a {0} m',
    vehicles_placed: '{0} veículos pedidos, {1} vagas de veículo na cena',
    vehicle_ids: 'os veículos são da frota: {0}',
    plants_placed: '{0} plantas pedidas, {1} vagas de planta na cena',
  },
}

const en: UrbanText = {
  group: 'City',
  name: 'Urban area',
  items: {
    pole_led_double: 'Double-arm LED pole',
    pole_concrete_arm: 'Concrete pole with an arm',
    pole_cast_iron: 'Cast-iron lantern',
    pole_wood_crossarm: 'Wooden pole with a crossarm',
    pole_flood_tower: 'Floodlight tower',
    street_grid: 'Street grid with a block',
    terrain_patch: 'Terrain patch',
    downtown: 'Neighbourhood: downtown',
    suburb: 'Neighbourhood: suburb',
    working_class: 'Neighbourhood: working class',
    historic_street: 'Neighbourhood: historic street',
    industrial_port: 'Neighbourhood: industrial and port',
    railway_village: 'Neighbourhood: railway village',
    mountain_resort: 'Neighbourhood: mountain resort',
    stilt_village: 'Neighbourhood: stilt village',
    military: 'Neighbourhood: military',
    rural: 'Neighbourhood: rural',
  },
  controls: { pattern: 'Bench neighbourhood', seed: 'Seed', lamps: 'Street lamps', budget: 'Real lights of the scene', providers: 'Vehicles and plants' },
  hints: {
    pattern: 'The pattern the actions draw in front of the player',
    seed: 'The same seed draws the same street',
    lamps: 'How many lamps are on; the rest are burnt out',
    budget: 'Every lamp that is on spends one; past that it keeps only its glowing lens',
    providers: 'Asks game-vehicles-fleet and game-vegetation-species for the cars and trees',
  },
  options: {
    lamps: { pattern: "The pattern's own", all: 'All on', half: 'Half', none: 'None' },
    providers: { none: 'None (default)', plants: 'Plants of the species pack', vehicles: 'Vehicles of the fleet', both: 'Both' },
  },
  actions: { compose: 'Draw the neighbourhood', clear: 'Take the neighbourhood away' },
  layers: { light_radius: 'Light reach', bounds: 'Sample boxes' },
  metrics: { samples: 'Samples in the room', draw_calls: 'Draw calls', triangles: 'Triangles', real_lights: 'Real lights', instances: 'Instances', bench_objects: 'Bench objects', light_budget_left: 'Light budget left' },
  log: { composed: 'Neighbourhood {0} drawn with seed {1}: {2} objects, {3} real lights', cleared: 'Neighbourhood taken away', no_vehicles: 'The room got no vehicle builder: the cars are left out' },
  scenarios: {
    urban_pole_heights: 'The five poles stand at the height of the table',
    urban_light_budget: 'The light budget: the first lamps get real lights and the counter goes below zero',
    urban_road_dashes: 'A road has a dash every 5 m',
    urban_block_heights: 'Tall buildings are rarer',
    urban_neighbourhood_seed: 'The same seed draws the same neighbourhood',
    urban_lamps_burnt: 'A neighbourhood with no lamps lit has none on',
    urban_terrain: 'The terrain has the vertex height, the river bed and the lake level',
    urban_providers: 'The providers ask for fleet vehicles and species of the region where the neighbourhood parks and plants',
  },
  checks: {
    pole_top: 'pole {0} reaches {1} m',
    budget_real: '{0} lamps on, {1} real lights (the budget is {2})',
    budget_left: 'the counter reached {0}',
    dashes: 'a 60 m road has {0} dashes, the first at x = {1}',
    heights_in_range: 'the buildings stand between {0} and {1} m',
    heights_median: 'the median building is {0} m, under the middle {1} m',
    same_seed: 'the same seed repeats the parts: {0}',
    other_seed: 'another seed changes the neighbourhood: {0}',
    lamps_none: 'with the share 0 none of the {0} poles is on',
    lamps_all: 'downtown keeps its {0} poles on',
    vertex_height: 'the height of the central vertex is {0} m and the mesh has {1} m',
    river_bed: 'the river bed is {0} m below the land beside it',
    lake_level: 'the centre of the lake is at {0} m',
    vehicles_placed: '{0} vehicles asked, {1} vehicle spots in the scene',
    vehicle_ids: 'the vehicles are of the fleet: {0}',
    plants_placed: '{0} plants asked, {1} plant spots in the scene',
  },
}

export const TEXT: Record<string, UrbanText> = { 'pt-BR': ptBR, en }

/** Fills `{0}`, `{1}`... in order. */
export const fill = (template: string, ...values: unknown[]): string => template.replace(/\{(\d+)\}/g, (_match, index: string) => String(values[Number(index)] ?? ''))
