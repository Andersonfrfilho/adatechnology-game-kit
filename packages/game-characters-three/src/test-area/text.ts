export type AreaText = {
  group: string
  name: string
  bodies: Record<string, string>
  child: string
  elder: string
  controls: Record<'decay' | 'age' | 'penetration' | 'death_rule' | 'detail' | 'moment' | 'pose' | 'cascade' | 'hit_preset' | 'protection' | 'path', string>
  hints: Record<'decay' | 'penetration' | 'death_rule' | 'detail' | 'moment' | 'hit_preset' | 'protection', string>
  actions: Record<'heal' | 'kill' | 'infect' | 'spawn_100' | 'spawn_1000' | 'fire_preset', string>
  options: {
    penetration: Record<string, string>
    death_rule: Record<string, string>
    detail: Record<string, string>
    moment: Record<string, string>
    pose: Record<string, string>
    protection: Record<string, string>
    path: Record<string, string>
    age: Record<string, string>
    hit_preset: Record<string, string>
  }
  layers: Record<'capsules' | 'joints' | 'bleed' | 'eyes_only' | 'speed', string>
  metrics: Record<'bodies' | 'instances' | 'triangles' | 'draw_calls' | 'bake_ms' | 'speed' | 'vitality' | 'bleed' | 'segments_hp' | 'last_crossed' | 'last_energy', string>
  scenarios: Record<string, string>
  log: Record<string, string>
}

const PRESETS_EN = { '9x19': '9x19 mm', '12ga_3': '12 ga 00 at 3 m', '7_62x39': '7.62x39', '308': '.308', '5_56x45': '5.56x45', machete: 'Machete', axe: 'Axe', m67_1: 'M67 at 1 m', m67_3: 'M67 at 3 m', m67_6: 'M67 at 6 m' }
const PRESETS_PT = { '9x19': '9x19 mm', '12ga_3': '12 ga 00 a 3 m', '7_62x39': '7,62x39', '308': '.308', '5_56x45': '5,56x45', machete: 'Facão', axe: 'Machado', m67_1: 'M67 a 1 m', m67_3: 'M67 a 3 m', m67_6: 'M67 a 6 m' }

export const TEXT: Record<string, AreaText> = {
  en: {
    group: 'Characters',
    name: 'Characters area',
    bodies: {},
    child: 'Child',
    elder: 'Elder',
    controls: { decay: 'Decay', age: 'Age group', penetration: 'Penetration model', death_rule: 'Death rule', detail: 'Damage detail', moment: 'Moment', pose: 'Pose', cascade: 'Cascade', hit_preset: 'Hit', protection: 'Protection', path: 'Drawing path' },
    hints: {
      decay: '0 fresh .. 3 decrepit: skin, blood and cloth of bodies built from now on',
      penetration: 'physical: P = sqrt(E m / A). team-game: the points of the game. Applies to bodies created from now on',
      death_rule: 'vitality-or-head (the game) or head-only (the golden rule of the pages)',
      detail: 'segments: the 17 parts of the near path. regions: the 6 regions of the crowd',
      moment: 'The speed of the selected zombie at that moment, in the readout',
      hit_preset: 'What the Fire hit button does to the body you look at',
      protection: 'Worn by the bodies created from now on',
    },
    actions: { heal: 'Heal the aimed body', kill: 'Kill the aimed body', infect: 'Bite the aimed person (accelerated)', spawn_100: 'Spawn 100 in the crowd', spawn_1000: 'Spawn 1000 in the crowd', fire_preset: 'Fire the hit' },
    options: {
      penetration: { physical: 'Physical', 'team-game': 'Team game' },
      death_rule: { 'vitality-or-head': 'Vitality or head', 'head-only': 'Head only' },
      detail: { segments: 'Segments', regions: 'Regions' },
      moment: { wander: 'Wander', alert: 'Alert', chase: 'Chase', sprint: 'Sprint', frenzy: 'Frenzy', limp: 'Limping', crawl: 'Crawling' },
      pose: { walk: 'Walk', stand: 'Stand' },
      protection: { none: 'None', vest_police: 'Police vest', vest_military: 'Military vest', helmet_combat: 'Helmet', turnout_gear: 'Firefighter gear', vest_helmet: 'Vest and helmet' },
      path: { rich: 'Rich', lod0: 'Instanced LOD 0', lod1: 'Instanced LOD 1', lod2: 'Instanced LOD 2' },
      age: { child: 'Child', young: 'Young', adult: 'Adult', elder: 'Elder' },
      hit_preset: PRESETS_EN,
    },
    layers: { capsules: 'Hit capsules', joints: 'Joints', bleed: 'Bleed emitters', eyes_only: 'Eyes only', speed: 'Speed vectors' },
    metrics: { bodies: 'Bodies', instances: 'Instances', triangles: 'Triangles', draw_calls: 'Draw calls', bake_ms: 'Bake time', speed: 'Speed of the selected', vitality: 'Vitality', bleed: 'Bleed rate', segments_hp: 'Segments hit points', last_crossed: 'Bodies crossed by the last shot', last_energy: 'Energy kept' },
    scenarios: {
      region_x_caliber: 'Region x calibre',
      cut_at_every_joint: 'A cut at every joint',
      broken_bone_dangles: 'A broken bone dangles',
      leg_limp_crawl: 'Leg: limp, then crawl',
      head_kill: 'Head kills',
      grenade_by_radius: 'Grenade by radius',
      penetration_line: 'Penetration through a line of 5',
      age_0_3: 'Decay 0 to 3',
      vest_and_helmet: 'Vest and helmet',
      bite_to_turn: 'Bite, fever, delirium, turn (child too)',
      benchmark_1000: '1000 bodies against the triangle budget',
    },
    log: { crossed: 'Hit: {bodies} bodies crossed, {energy} of the energy kept', turned: '{from} turned into {to}' },
  },
  'pt-BR': {
    group: 'Personagens',
    name: 'Área de personagens',
    bodies: {},
    child: 'Criança',
    elder: 'Idoso',
    controls: { decay: 'Decomposição', age: 'Faixa de idade', penetration: 'Modelo de penetração', death_rule: 'Regra de morte', detail: 'Detalhe do dano', moment: 'Momento', pose: 'Pose', cascade: 'Cascata', hit_preset: 'Golpe', protection: 'Proteção', path: 'Caminho de desenho' },
    hints: {
      decay: '0 fresco .. 3 decrépito: pele, sangue e roupa dos corpos feitos daqui em diante',
      penetration: 'physical: P = raiz(E m / A). team-game: os pontos do jogo. Vale para os corpos criados daqui em diante',
      death_rule: 'vitality-or-head (o jogo) ou head-only (a regra de ouro das páginas)',
      detail: 'segments: as 17 partes do caminho de perto. regions: as 6 regiões da multidão',
      moment: 'A velocidade do zumbi selecionado nesse momento, no mostrador',
      hit_preset: 'O que o botão Disparar faz no corpo para o qual você olha',
      protection: 'Vestida pelos corpos criados daqui em diante',
    },
    actions: { heal: 'Curar o corpo mirado', kill: 'Matar o corpo mirado', infect: 'Morder a pessoa mirada (acelerado)', spawn_100: 'Pôr 100 na multidão', spawn_1000: 'Pôr 1000 na multidão', fire_preset: 'Disparar o golpe' },
    options: {
      penetration: { physical: 'Física', 'team-game': 'Do jogo' },
      death_rule: { 'vitality-or-head': 'Vitalidade ou cabeça', 'head-only': 'Só a cabeça' },
      detail: { segments: 'Segmentos', regions: 'Regiões' },
      moment: { wander: 'Vagando', alert: 'Alerta', chase: 'Perseguição', sprint: 'Disparada', frenzy: 'Frenesi', limp: 'Mancando', crawl: 'Rastejando' },
      pose: { walk: 'Andar', stand: 'Parado' },
      protection: { none: 'Nenhuma', vest_police: 'Colete policial', vest_military: 'Colete militar', helmet_combat: 'Capacete', turnout_gear: 'Roupa de bombeiro', vest_helmet: 'Colete e capacete' },
      path: { rich: 'Rico', lod0: 'Instanciado LOD 0', lod1: 'Instanciado LOD 1', lod2: 'Instanciado LOD 2' },
      age: { child: 'Criança', young: 'Jovem', adult: 'Adulto', elder: 'Idoso' },
      hit_preset: PRESETS_PT,
    },
    layers: { capsules: 'Cápsulas de acerto', joints: 'Juntas', bleed: 'Pontos de sangramento', eyes_only: 'Só os olhos', speed: 'Vetores de velocidade' },
    metrics: { bodies: 'Corpos', instances: 'Instâncias', triangles: 'Triângulos', draw_calls: 'Chamadas de desenho', bake_ms: 'Tempo de assar', speed: 'Velocidade do selecionado', vitality: 'Vitalidade', bleed: 'Taxa de sangramento', segments_hp: 'Vida dos segmentos', last_crossed: 'Corpos atravessados pelo último tiro', last_energy: 'Energia que ficou' },
    scenarios: {
      region_x_caliber: 'Região x calibre',
      cut_at_every_joint: 'Um corte em cada junta',
      broken_bone_dangles: 'Osso quebrado balança',
      leg_limp_crawl: 'Perna: manca, depois rasteja',
      head_kill: 'A cabeça mata',
      grenade_by_radius: 'Granada por raio',
      penetration_line: 'Penetração em fila de 5',
      age_0_3: 'Decomposição de 0 a 3',
      vest_and_helmet: 'Colete e capacete',
      bite_to_turn: 'Mordida, febre, delírio, vira (criança também)',
      benchmark_1000: '1000 corpos contra o orçamento de triângulos',
    },
    log: { crossed: 'Golpe: {bodies} corpos atravessados, {energy} da energia ficou', turned: '{from} virou {to}' },
  },
}
