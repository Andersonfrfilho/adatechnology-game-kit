type Keys<K extends string> = Readonly<Record<K, string>>

export type StoriesBenchText = {
  readonly group: string
  readonly name: string
  readonly controls: Keys<'seed' | 'day' | 'life' | 'infection' | 'person' | 'next_day' | 'reset'>
  readonly hints: Keys<'seed' | 'day' | 'life' | 'infection' | 'person' | 'action'>
  readonly metrics: Keys<'day' | 'people' | 'living' | 'dead' | 'births' | 'arrivals' | 'lines' | 'last'>
  readonly scenarios: Keys<'determinism' | 'casting' | 'normal_world' | 'sheet_keeps' | 'point_buy' | 'crossing'>
  readonly sheet: Keys<'kicker' | 'state' | 'base' | 'age' | 'profession' | 'pool' | 'lived' | 'none' | 'day'>
  readonly states: Keys<'ok' | 'hurt' | 'bitten' | 'undead' | 'dead' | 'missing' | 'party' | 'hostile' | 'moved' | 'left' | 'unborn'>
  readonly derived: Keys<'health' | 'stamina' | 'carry' | 'run_speed' | 'detection' | 'noise' | 'learning' | 'composure' | 'melee'>
}

const EN: StoriesBenchText = {
  group: 'Stories',
  name: 'Stories area',
  controls: { seed: 'Seed', day: 'Day', life: 'Life simulation', infection: 'Bites and the turned', person: 'Sheet of', next_day: 'Next day', reset: 'Start again' },
  hints: {
    seed: 'The world drawn again: who plays each role, their names and every chance of the life simulation.',
    day: 'The world runs to this day; the sheet and the chronicle show it.',
    life: 'Off, only the stories happen; on, people also get hurt, fall in love, have children, fight, betray, trade and arrive.',
    infection: 'The apocalypse layer of the life simulation: a run can end in a bite, and a bite turns in two days. Off by default: a normal world.',
    person: 'Whose sheet the panel shows.',
    action: 'A player action: the stories read it from its day on.',
  },
  metrics: { day: 'Day', people: 'People', living: 'Living', dead: 'Dead', births: 'Births', arrivals: 'Arrivals', lines: 'Chronicle lines', last: 'Last line' },
  scenarios: {
    determinism: 'The same seed, the same chronicle',
    casting: 'Another seed casts other names',
    normal_world: 'A normal world: nobody is bitten',
    sheet_keeps: 'The sheet keeps the stories the person lived',
    point_buy: 'Point buy: 14 points, the profession and traits',
    crossing: 'An action in one story changes another',
  },
  sheet: { kicker: 'Character sheet', state: 'State', base: 'Lives at', age: 'Age', profession: 'Profession', pool: 'Points left', lived: 'Lived', none: 'Nothing yet', day: 'Day' },
  states: { ok: 'well', hurt: 'hurt', bitten: 'bitten', undead: 'turned', dead: 'dead', missing: 'missing', party: 'with the player', hostile: 'hostile', moved: 'moved', left: 'left', unborn: 'not born yet' },
  derived: { health: 'Max health', stamina: 'Stamina', carry: 'Max load (kg)', run_speed: 'Running speed (m/s)', detection: 'Detection radius (m)', noise: 'Footstep noise (%)', learning: 'Learning speed (%)', composure: 'Composure', melee: 'Melee damage (%)' },
}

const PT_BR: StoriesBenchText = {
  group: 'Histórias',
  name: 'Área das histórias',
  controls: { seed: 'Semente', day: 'Dia', life: 'Vida sorteada', infection: 'Mordidas e reanimados', person: 'Ficha de', next_day: 'Próximo dia', reset: 'Recomeçar' },
  hints: {
    seed: 'O mundo sorteado de novo: quem faz cada papel, os nomes e cada chance da vida sorteada.',
    day: 'O mundo corre até esse dia; a ficha e a crônica mostram.',
    life: 'Desligada, só as histórias acontecem; ligada, as pessoas também se ferem, se apaixonam, têm filhos, brigam, traem, trocam e chegam.',
    infection: 'A camada do apocalipse na vida sorteada: uma saída pode acabar em mordida, e a mordida reanima em dois dias. Desligada por padrão: mundo normal.',
    person: 'De quem é a ficha no painel.',
    action: 'Uma ação do jogador: as histórias leem a partir do dia dela.',
  },
  metrics: { day: 'Dia', people: 'Pessoas', living: 'Vivos', dead: 'Mortos', births: 'Nascimentos', arrivals: 'Chegadas', lines: 'Linhas da crônica', last: 'Última linha' },
  scenarios: {
    determinism: 'A mesma semente, a mesma crônica',
    casting: 'Outra semente escala outros nomes',
    normal_world: 'Mundo normal: ninguém é mordido',
    sheet_keeps: 'A ficha guarda as histórias que a pessoa viveu',
    point_buy: 'Compra de pontos: 14 pontos, a profissão e os traços',
    crossing: 'Uma ação numa história muda outra',
  },
  sheet: { kicker: 'Ficha do personagem', state: 'Estado', base: 'Mora em', age: 'Idade', profession: 'Profissão', pool: 'Pontos livres', lived: 'Viveu', none: 'Nada ainda', day: 'Dia' },
  states: { ok: 'vivo', hurt: 'ferido', bitten: 'mordido', undead: 'zumbi nomeado', dead: 'morto', missing: 'sumido', party: 'com o jogador', hostile: 'hostil', moved: 'mudou de base', left: 'saiu do vale', unborn: 'ainda não nasceu' },
  derived: { health: 'Vida máxima', stamina: 'Fôlego', carry: 'Carga máxima (kg)', run_speed: 'Velocidade de corrida (m/s)', detection: 'Raio de detecção (m)', noise: 'Ruído dos passos (%)', learning: 'Velocidade de aprendizado (%)', composure: 'Compostura', melee: 'Dano corpo a corpo (%)' },
}

const TEXT: Readonly<Record<string, StoriesBenchText>> = { en: EN, 'pt-BR': PT_BR }

export const storiesBenchTextOf = (locale: string): StoriesBenchText => TEXT[locale] ?? PT_BR
