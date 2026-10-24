type Keys<K extends string> = Readonly<Record<K, string>>

export type CrowdBenchText = {
  readonly group: string
  readonly name: string
  readonly mix: string
  readonly controls: Keys<'count' | 'type' | 'night' | 'seed' | 'spawn' | 'noise' | 'hit' | 'kill_all' | 'join' | 'flee' | 'herd' | 'materialize' | 'push' | 'reset'>
  readonly hints: Keys<'count' | 'type' | 'night' | 'noise' | 'hit' | 'join' | 'flee' | 'herd' | 'materialize' | 'push'>
  readonly layers: Keys<'corpses' | 'civilians' | 'animals'>
  readonly metrics: Keys<'agents' | 'drawn' | 'lod_near' | 'lod_middle' | 'lod_far' | 'draw_calls' | 'bake_ms' | 'active' | 'kills' | 'corpses' | 'civilians' | 'health' | 'grabbed' | 'message'>
  readonly scenarios: Keys<'relevance' | 'lod' | 'attack_pose' | 'corpse_darkens' | 'civilians_flee' | 'herd_calls' | 'vultures' | 'infection' | 'determinism'>
  readonly messages: Keys<'called' | 'burst_hit' | 'swing_knock' | 'pounce_knock' | 'migration' | 'door_broken' | 'alarm' | 'bark' | 'growl' | 'bitten' | 'turned' | 'died'>
  readonly yes: string
  readonly no: string
}

const EN: CrowdBenchText = {
  group: 'Crowd',
  name: 'Crowd area',
  mix: 'Mixed (by weight)',
  controls: {
    count: 'Agents',
    type: 'Type of the new ones',
    night: 'Night',
    seed: 'Seed',
    spawn: 'Add 100',
    noise: 'Noise here (80 m)',
    hit: 'Shoot the nearest in the head',
    kill_all: 'Kill all',
    join: 'Civilians join you',
    flee: 'Civilians run away',
    herd: 'Bring the animals',
    materialize: 'Bring 50 from the region',
    push: 'Push (break a grab)',
    reset: 'Start again',
  },
  hints: {
    count: 'The crowd grows or shrinks to this many, born 10 to 90 m from the area centre. Only the near ones think every frame (relevance bands).',
    type: 'The type of the agents added from now on; mixed draws them by the weights of the pack.',
    night: 'At night sight drops by 40%.',
    noise: 'A noise heard 80 m around you: the ones that hear it come.',
    hit: 'A headshot to the nearest agent: a body on the ground, blood through the room effects.',
    join: 'The civilians follow you; bitten, they turn after the bite time.',
    flee: 'The civilians run off along a path out of the area and are gone.',
    herd: 'A companion dog, hens, a lapwing, cows, a horse, a pig, a capybara, a carcass and the vultures over it.',
    materialize: 'The region model turns 50 of its numbers into agents near you; the far ones go back.',
    push: 'What holds you lets go after six pushes.',
  },
  layers: { corpses: 'Bodies on the ground', civilians: 'Civilians', animals: 'Animals' },
  metrics: {
    agents: 'Agents',
    drawn: 'Drawn',
    lod_near: 'Near level',
    lod_middle: 'Middle level',
    lod_far: 'Far level',
    draw_calls: 'Draw calls',
    bake_ms: 'Bake',
    active: 'Thinking every frame',
    kills: 'Kills',
    corpses: 'Bodies',
    civilians: 'Civilians alive',
    health: 'Your health',
    grabbed: 'Grabbed',
    message: 'Last message',
  },
  scenarios: {
    relevance: 'Relevance: 500 agents, only the near ones every frame',
    lod: 'Level of detail with 1.5 m of hysteresis',
    attack_pose: 'Attack pose in at 1.6 m, out at 2.2 m',
    corpse_darkens: 'A body darkens and shrinks at the end of its life',
    civilians_flee: 'Civilians follow, then run away and are gone',
    herd_calls: 'The hen flees and clucks, the lapwing raises the alarm',
    vultures: 'The vultures circle the bodies',
    infection: 'Region numbers become agents and go back',
    determinism: 'The same seed, the same crowd',
  },
  messages: {
    called: 'A screamer called the crowd',
    burst_hit: 'Hit by a bloater burst',
    swing_knock: 'A brute knocked you down',
    pounce_knock: 'A leaper knocked you down',
    migration: 'A crowd is on the move',
    door_broken: 'A door gave way',
    alarm: 'A bird raises the alarm',
    bark: 'The dog is barking',
    growl: 'The dog is growling',
    bitten: 'A civilian was bitten',
    turned: 'A civilian turned',
    died: 'A civilian died',
  },
  yes: 'yes',
  no: 'no',
}

const PT_BR: CrowdBenchText = {
  group: 'Multidão',
  name: 'Área da multidão',
  mix: 'Misturado (pelo peso)',
  controls: {
    count: 'Agentes',
    type: 'Tipo dos novos',
    night: 'Noite',
    seed: 'Semente',
    spawn: 'Mais 100',
    noise: 'Barulho aqui (80 m)',
    hit: 'Tiro na cabeça do mais perto',
    kill_all: 'Matar todos',
    join: 'Civis vêm com você',
    flee: 'Civis fogem',
    herd: 'Trazer os bichos',
    materialize: 'Trazer 50 da região',
    push: 'Empurrar (soltar-se)',
    reset: 'Recomeçar',
  },
  hints: {
    count: 'A multidão cresce ou diminui até esse número, nascendo de 10 a 90 m do centro da área. Só os de perto pensam todo quadro (faixas de relevância).',
    type: 'O tipo dos agentes acrescentados daqui em diante; misturado sorteia pelos pesos do pacote.',
    night: 'À noite a visão cai 40%.',
    noise: 'Um barulho ouvido a 80 m de você: quem ouve vem.',
    hit: 'Um tiro na cabeça do agente mais perto: um corpo no chão, sangue pelos efeitos da sala.',
    join: 'Os civis seguem você; mordidos, viram depois do tempo da mordida.',
    flee: 'Os civis fogem por um caminho para fora da área e somem.',
    herd: 'Um cão companheiro, galinhas, um quero-quero, vacas, um cavalo, um porco, uma capivara, uma carcaça e os urubus sobre ela.',
    materialize: 'O modelo da região transforma 50 dos seus números em agentes perto de você; os de longe voltam.',
    push: 'Quem segura você solta depois de seis empurrões.',
  },
  layers: { corpses: 'Corpos no chão', civilians: 'Civis', animals: 'Bichos' },
  metrics: {
    agents: 'Agentes',
    drawn: 'Desenhados',
    lod_near: 'Nível perto',
    lod_middle: 'Nível meio',
    lod_far: 'Nível longe',
    draw_calls: 'Chamadas de desenho',
    bake_ms: 'Cozimento',
    active: 'Pensando todo quadro',
    kills: 'Mortes',
    corpses: 'Corpos',
    civilians: 'Civis vivos',
    health: 'Sua vida',
    grabbed: 'Agarrado',
    message: 'Última mensagem',
  },
  scenarios: {
    relevance: 'Relevância: 500 agentes, só os de perto todo quadro',
    lod: 'Nível de detalhe com 1,5 m de histerese',
    attack_pose: 'Pose de ataque entra a 1,6 m e sai a 2,2 m',
    corpse_darkens: 'O corpo escurece e encolhe no fim da vida',
    civilians_flee: 'Civis seguem, depois fogem e somem',
    herd_calls: 'A galinha foge e cacareja, o quero-quero dá o alarme',
    vultures: 'Os urubus circulam os corpos',
    infection: 'Números da região viram agentes e voltam',
    determinism: 'A mesma semente, a mesma multidão',
  },
  messages: {
    called: 'Um gritador chamou a multidão',
    burst_hit: 'Atingido pelo estouro de um inchado',
    swing_knock: 'Um brutamonte derrubou você',
    pounce_knock: 'Um saltador derrubou você',
    migration: 'Uma multidão está migrando',
    door_broken: 'Uma porta cedeu',
    alarm: 'Um pássaro dá o alarme',
    bark: 'O cão está latindo',
    growl: 'O cão está rosnando',
    bitten: 'Um civil foi mordido',
    turned: 'Um civil virou',
    died: 'Um civil morreu',
  },
  yes: 'sim',
  no: 'não',
}

const TEXT: Readonly<Record<string, CrowdBenchText>> = { en: EN, 'pt-BR': PT_BR }

export const crowdBenchTextOf = (locale: string): CrowdBenchText => TEXT[locale] ?? PT_BR
