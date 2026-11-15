export type AreaText = {
  group: string
  name: string
  controls: Record<'package' | 'template' | 'state' | 'seed' | 'construction_level' | 'quality' | 'lod' | 'houses' | 'budget' | 'floor_view' | 'hit', string>
  hints: Record<'template' | 'construction_level' | 'houses' | 'budget' | 'lod' | 'floor_view' | 'hit', string>
  actions: Record<'build' | 'enter' | 'up' | 'down' | 'door' | 'strike' | 'reset' | 'clear', string>
  options: {
    quality: Record<string, string>
    lod: Record<string, string>
    floor_view: Record<string, string>
    hit: Record<string, string>
    state: Record<string, string>
  }
  layers: Record<'roof' | 'lot' | 'water' | 'night' | 'room_lights', string>
  metrics: Record<'construction_stage' | 'houses' | 'parts' | 'standing' | 'broken' | 'holes' | 'draw_calls' | 'triangles' | 'lod' | 'floor' | 'doors_open' | 'target' | 'planned', string>
  sheet: { kicker: string; title: string; stage: string; template: string; seed: string; state: string; floors: string; size: string; parts: string; look: string; none: string; no_engine: string }
  specimens: Record<string, string>
  furniture: Record<string, string>
  scenarios: Record<string, string>
  steps: Record<'built' | 'stage_changed' | 'no_engine' | 'entered' | 'floor' | 'no_floor' | 'door' | 'no_door' | 'strike' | 'no_aim' | 'cleared' | 'reset'
    | 'one_pillar_broke' | 'slabs_whole' | 'no_slab_fell' | 'two_slab_fell' | 'two_roof_fell' | 'partition_broke' | 'slab_stayed' | 'glass_hole' | 'glass_broke' | 'walls_whole' | 'tank_hole' | 'tank_leaked' | 'gas_exploded' | 'gas_damaged', string>
}

export const TEXT: Record<string, AreaText> = {
  en: {
    group: 'Houses',
    name: 'Houses and buildings area',
    controls: { package: 'Package', template: 'Typology', state: 'State', seed: 'Seed', construction_level: 'Construction level (0..8)', quality: 'Quality', lod: 'Level of detail', houses: 'Houses in the row', budget: 'Draw-call budget', floor_view: 'Floors shown', hit: 'Hit' },
    hints: {
      template: 'Builds the house with game-floorplan-three from the plan the engine draws for this typology and seed',
      construction_level: '0 Blueprint -> 1 Foundation -> 2 Frame -> 3 Bare masonry -> 4 Utilities -> 5 Plaster & floors -> 6 Doors & windows -> 7 Roof -> 8 Complete house',
      houses: 'More than one: a row with neighbours of the next seeds; the planner shares the budget by distance (planLod)',
      budget: 'Draw calls the row may spend: the nearest houses stay complete, the far ones lose their interior or hide',
      lod: 'Auto follows the distance to the eye; 0 complete, 1 without the small pieces, 2 hidden',
      floor_view: 'Cuts the house to show its floors; all shows everything with the roof',
      hit: 'What the Hit button throws at the wall you are aiming at',
    },
    actions: { build: 'Build the house', enter: 'Go in', up: 'Floor up', down: 'Floor down', door: 'Open / close the door (E)', strike: 'Hit the aimed wall', reset: 'Rebuild the walls', clear: 'Take the houses away' },
    options: {
      quality: { high: 'High', game: 'Game' },
      lod: { auto: 'Auto', '0': '0 complete', '1': '1 no small pieces', '2': '2 hidden' },
      floor_view: { all: 'All', '0': 'Ground floor', '1': 'First floor', '2': 'Second floor' },
      hit: { burst_9mm: '9 mm burst', burst_762: '7.62 burst', sledge: 'Sledgehammer', c4: 'C4', rpg: 'RPG warhead' },
      state: { normal: 'Normal', fortified: 'Fortified', abandoned: 'Abandoned' },
    },
    layers: { roof: 'Roof', lot: 'Lot (ground, wall, gate)', water: 'Plumbing & conduits in walls', night: 'Night (lit windows and lamps)', room_lights: 'Room lights (one lamp per lit room, stopped by the walls)' },
    metrics: { construction_stage: 'Construction stage', houses: 'Houses', parts: 'Parts', standing: 'Standing', broken: 'Broken', holes: 'Holes', draw_calls: 'Draw calls', triangles: 'Triangles', lod: 'Level of detail (nearest)', floor: 'Your floor', doors_open: 'Doors open', target: 'You aim at', planned: 'Planned draw calls' },
    sheet: { kicker: 'House', title: 'House of the bench', stage: 'Stage', template: 'Typology', seed: 'Seed', state: 'State', floors: 'Floors', size: 'Size', parts: 'Structure parts', look: 'You aim at', none: 'nothing to use', no_engine: 'The page gave no floorplan engine' },
    furniture: {
      dining_table: 'Dining table',
      coffee_table: 'Coffee table',
      desk: 'Desk',
      sofa_3seat: 'Sofa (3 seats)',
      fridge: 'Refrigerator',
      stove_4burner: 'Stove (4 burners)',
      tv: 'TV',
      floor_lamp: 'Floor lamp',
      double_bed: 'Double bed',
      toilet: 'Toilet',
      washbasin: 'Washbasin',
      shower: 'Shower',
      mirror: 'Mirror',
      washing_machine: 'Washing machine',
    },
    specimens: {
      house_casa_portico: 'Single-storey house: frame, the walls only close',
      house_casa_inteira: 'Whole single-storey house (real structure, windows, water tank, gas bottle)',
      house_casa_wood_frame: 'Wood-frame house',
      house_casa_tronco: 'Log cabin',
      house_barraca: 'Camping tent',
    },
    scenarios: {
      house_one_pillar: 'destroy one corner pillar: the slab stays',
      house_two_pillars: 'destroy two pillars: the slab and what is above fall',
      house_partition: 'a partition falls alone, the slab stays',
      house_window_glass: 'a shot at the glass breaks the window',
      house_tank_leak: 'a punctured water tank leaks',
      house_gas_explodes: 'the gas bottle explodes and damages the wall',
    },
    steps: {
      built: 'House {template} (seed {seed}, {state}) built: {parts} parts, {floors} floors',
      stage_changed: 'Construction level {level}: {title} — {description}',
      no_engine: 'No floorplan engine was given to the module',
      entered: 'Inside the house, floor {floor}',
      floor: 'Floor {floor}',
      no_floor: 'No floor {floor} here',
      door: 'Door used: {text}',
      no_door: 'No door or fixture within reach',
      strike: '{hit} on {part}',
      no_aim: 'Nothing to hit where you aim',
      cleared: 'Houses taken away',
      reset: 'Walls rebuilt',
      one_pillar_broke: 'pillar {id} broke',
      slabs_whole: 'the slabs are still whole',
      no_slab_fell: 'no slab collapsed',
      two_slab_fell: 'the slab collapsed ({n} parts fell)',
      two_roof_fell: 'the roof above fell with it',
      partition_broke: 'partition {id} broke',
      slab_stayed: 'the slab stayed up',
      glass_hole: 'the first shot holed the glass',
      glass_broke: 'window {id} broke after {n} shots',
      walls_whole: 'the walls are intact',
      tank_hole: 'the tank has a hole',
      tank_leaked: 'leaked: {before} -> {after} L',
      gas_exploded: 'the bottle exploded',
      gas_damaged: 'the blast damaged {n} nearby parts',
    },
  },
  'pt-BR': {
    group: 'Casas',
    name: 'Área de casas e prédios',
    controls: { package: 'Pacote', template: 'Tipologia', state: 'Estado', seed: 'Semente', construction_level: 'Nível da construção (0..8)', quality: 'Qualidade', lod: 'Nível de detalhe', houses: 'Casas na fileira', budget: 'Orçamento de draw calls', floor_view: 'Andares à mostra', hit: 'Golpe' },
    hints: {
      template: 'Constrói a casa com o game-floorplan-three a partir da planta que o motor desenha para esta tipologia e semente',
      construction_level: '0 Planta e gabarito -> 1 Fundação e baldrame -> 2 Estrutura -> 3 Alvenaria no osso -> 4 Instalações -> 5 Reboco e pisos -> 6 Esquadrias -> 7 Telhado -> 8 Casa completa',
      houses: 'Mais de uma: fileira com vizinhas das próximas sementes; o planejador reparte o orçamento pela distância (planLod)',
      budget: 'Draw calls que a fileira pode gastar: as casas mais perto ficam completas, as de longe perdem o interior ou somem',
      lod: 'Auto segue a distância até o olho; 0 completo, 1 sem as peças pequenas, 2 escondida',
      floor_view: 'Corta a casa para mostrar os andares; todos mostra tudo com o telhado',
      hit: 'O que o botão Golpe joga na parede para onde você mira',
    },
    actions: { build: 'Construir a casa', enter: 'Entrar', up: 'Subir um andar', down: 'Descer um andar', door: 'Abrir / fechar a porta (E)', strike: 'Golpear a parede mirada', reset: 'Refazer as paredes', clear: 'Tirar as casas' },
    options: {
      quality: { high: 'Alta', game: 'Jogo' },
      lod: { auto: 'Auto', '0': '0 completo', '1': '1 sem peças pequenas', '2': '2 escondida' },
      floor_view: { all: 'Todos', '0': 'Térreo', '1': 'Primeiro andar', '2': 'Segundo andar' },
      hit: { burst_9mm: 'Rajada de 9 mm', burst_762: 'Rajada de 7,62', sledge: 'Marreta', c4: 'C4', rpg: 'Ogiva de RPG' },
      state: { normal: 'Normal', fortified: 'Fortificada', abandoned: 'Abandonada' },
    },
    layers: { roof: 'Telhado', lot: 'Lote (chão, muro, portão)', water: 'Encanamento e eletrodutos nas paredes', night: 'Noite (janelas e lâmpadas acesas)', room_lights: 'Luz por cômodo (uma lâmpada por cômodo aceso, barrada pelas paredes)' },
    metrics: { construction_stage: 'Etapa da obra', houses: 'Casas', parts: 'Peças', standing: 'De pé', broken: 'Quebradas', holes: 'Furos', draw_calls: 'Draw calls', triangles: 'Triângulos', lod: 'Nível de detalhe (a mais perto)', floor: 'Seu andar', doors_open: 'Portas abertas', target: 'Você mira em', planned: 'Draw calls planejados' },
    sheet: { kicker: 'Casa', title: 'Casa da bancada', stage: 'Etapa da obra', template: 'Tipologia', seed: 'Semente', state: 'Estado', floors: 'Andares', size: 'Tamanho', parts: 'Peças da estrutura', look: 'Você mira em', none: 'nada para usar', no_engine: 'A página não deu o motor de plantas' },
    furniture: {
      dining_table: 'Mesa de jantar',
      coffee_table: 'Mesa de centro',
      desk: 'Escrivaninha',
      sofa_3seat: 'Sofá (3 lugares)',
      fridge: 'Geladeira',
      stove_4burner: 'Fogão (4 bocas)',
      tv: 'Televisão',
      floor_lamp: 'Luminária de chão / Abajur',
      double_bed: 'Cama de casal',
      toilet: 'Vaso sanitário',
      washbasin: 'Lavatório / Pia de banheiro',
      shower: 'Chuveiro',
      mirror: 'Espelho',
      washing_machine: 'Máquina de lavar',
    },
    specimens: {
      house_casa_portico: 'Casa térrea em pórtico (as paredes só vedam)',
      house_casa_inteira: 'Casa térrea inteira (estrutura real, janelas, caixa d\'água, botijão)',
      house_casa_wood_frame: 'Casa de madeira wood_frame',
      house_casa_tronco: 'Cabana de troncos',
      house_barraca: 'Barraca de camping',
    },
    scenarios: {
      house_one_pillar: 'destruir um pilar de canto: a laje fica',
      house_two_pillars: 'destruir dois pilares: a laje e o que está em cima caem',
      house_partition: 'parede de vedação cai sozinha, laje fica',
      house_window_glass: 'tiro no vidro quebra a janela',
      house_tank_leak: 'caixa d\'água furada vaza',
      house_gas_explodes: 'botijão explode e danifica a parede',
    },
    steps: {
      built: 'Casa {template} (semente {seed}, {state}) construída: {parts} peças, {floors} andares',
      stage_changed: 'Nível da construção {level}: {title} — {description}',
      no_engine: 'O módulo não recebeu o motor de plantas',
      entered: 'Dentro da casa, andar {floor}',
      floor: 'Andar {floor}',
      no_floor: 'Não há o andar {floor} aqui',
      door: 'Porta usada: {text}',
      no_door: 'Nenhuma porta ou peça ao alcance',
      strike: '{hit} em {part}',
      no_aim: 'Nada para golpear onde você mira',
      cleared: 'Casas retiradas',
      reset: 'Paredes refeitas',
      one_pillar_broke: 'o pilar {id} quebrou',
      slabs_whole: 'as lajes continuam inteiras',
      no_slab_fell: 'nenhuma laje desabou',
      two_slab_fell: 'a laje desabou ({n} peças caíram)',
      two_roof_fell: 'o telhado que estava em cima caiu junto',
      partition_broke: 'a parede {id} quebrou',
      slab_stayed: 'a laje ficou de pé',
      glass_hole: 'o primeiro tiro furou o vidro',
      glass_broke: 'a janela {id} quebrou em {n} tiros',
      walls_whole: 'as paredes continuam inteiras',
      tank_hole: 'a caixa tem furo',
      tank_leaked: 'vazou: {before} -> {after} L',
      gas_exploded: 'o botijão explodiu',
      gas_damaged: 'a explosão danificou {n} peças ao redor',
    },
  },
}

/** Fills the `{name}` holes of a message. */
export function fill(message: string, vars: Record<string, string | number> = {}): string {
  return message.replace(/\{(\w+)\}/g, (hole, key) => (key in vars ? String(vars[key]) : hole))
}
