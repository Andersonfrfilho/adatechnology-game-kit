export type PlayerBenchText = {
  readonly group: string
  readonly name: string
  readonly controls: Readonly<Record<'infection' | 'agility' | 'vigor' | 'seed' | 'hurt' | 'bite' | 'grab' | 'push' | 'knife' | 'bandage' | 'knock' | 'crouch' | 'reset', string>>
  readonly hints: Readonly<Record<'infection' | 'agility' | 'vigor' | 'seed' | 'grab' | 'push', string>>
  readonly metrics: Readonly<Record<'health' | 'stamina' | 'bleeding' | 'wounds' | 'stage' | 'time_left' | 'panic' | 'spread' | 'grab' | 'noise' | 'steps' | 'message', string>>
  readonly stages: Readonly<Record<'none' | 'malaise' | 'fever' | 'delirium' | 'dead', string>>
  readonly scenarios: Readonly<Record<'stamina' | 'bleed_bandage' | 'normal_world' | 'infection_kills' | 'grab_break_free' | 'determinism', string>>
  readonly yes: string
  readonly no: string
}

const EN: PlayerBenchText = {
  group: 'Player',
  name: 'Player area',
  controls: {
    infection: 'Individual infection',
    agility: 'Agility',
    vigor: 'Vigor',
    seed: 'Seed',
    hurt: 'Take a hit (10)',
    bite: 'Bite',
    grab: 'Get grabbed',
    push: 'Push (E)',
    knife: 'Knife (F)',
    bandage: 'Bandage (B)',
    knock: 'Knocked down 1.5 s',
    crouch: 'Crouch (C)',
    reset: 'Start again',
  },
  hints: {
    infection: 'Off: a normal world, wounds never infect. On: the game rule (scratch 6%, laceration 22%, bite 100%; fever at 30 s, death at 120 s).',
    agility: 'The sheet: stamina, run speed and footstep noise come from it.',
    vigor: 'The sheet: health, stamina and composure come from it.',
    seed: 'The same seed gives the same wounds and the same knife rolls.',
    grab: 'Something grabs you from behind: 3 s to push it off (6 pushes) or to land the knife (70%).',
    push: 'Shoves what is in front, or pushes off what holds you.',
  },
  metrics: {
    health: 'Health',
    stamina: 'Stamina',
    bleeding: 'Bleeding',
    wounds: 'Wounds',
    stage: 'Infection',
    time_left: 'Time left',
    panic: 'Panic',
    spread: 'Aim spread x',
    grab: 'Grab timer',
    noise: 'Last noise',
    steps: 'Footsteps',
    message: 'Message',
  },
  stages: { none: 'None', malaise: 'Malaise', fever: 'Fever', delirium: 'Delirium', dead: 'Dead' },
  scenarios: {
    stamina: 'Running drains stamina and resting gives it back',
    bleed_bandage: 'A laceration bleeds until it is dressed',
    normal_world: 'In a normal world a bite hurts and bleeds but never infects',
    infection_kills: 'With the infection on, a bite brings fever and kills at its time',
    grab_break_free: 'Six pushes break a grab before the bite',
    determinism: 'The same seed gives the same wounds',
  },
  yes: 'yes',
  no: 'no',
}

const PT_BR: PlayerBenchText = {
  group: 'Jogador',
  name: 'Área do jogador',
  controls: {
    infection: 'Infecção individual',
    agility: 'Agilidade',
    vigor: 'Vigor',
    seed: 'Semente',
    hurt: 'Levar um golpe (10)',
    bite: 'Mordida',
    grab: 'Ser agarrado',
    push: 'Empurrar (E)',
    knife: 'Faca (F)',
    bandage: 'Curativo (B)',
    knock: 'Derrubado 1,5 s',
    crouch: 'Agachar (C)',
    reset: 'Recomeçar',
  },
  hints: {
    infection: 'Desligada: mundo normal, ferida nunca infecta. Ligada: a regra do jogo (arranhão 6%, laceração 22%, mordida 100%; febre aos 30 s, morte aos 120 s).',
    agility: 'A ficha: fôlego, velocidade de corrida e ruído dos passos saem dela.',
    vigor: 'A ficha: vida, fôlego e compostura saem dela.',
    seed: 'A mesma semente dá as mesmas feridas e os mesmos golpes de faca.',
    grab: 'Algo te agarra por trás: 3 s para empurrar (6 empurrões) ou acertar a faca (70%).',
    push: 'Empurra o que está na frente, ou se solta do que te segura.',
  },
  metrics: {
    health: 'Vida',
    stamina: 'Fôlego',
    bleeding: 'Sangrando',
    wounds: 'Feridas',
    stage: 'Infecção',
    time_left: 'Tempo restante',
    panic: 'Pânico',
    spread: 'Dispersão x',
    grab: 'Agarrão',
    noise: 'Último ruído',
    steps: 'Passos',
    message: 'Mensagem',
  },
  stages: { none: 'Nenhuma', malaise: 'Mal-estar', fever: 'Febre', delirium: 'Delírio', dead: 'Morto' },
  scenarios: {
    stamina: 'Correr gasta fôlego e descansar devolve',
    bleed_bandage: 'Uma laceração sangra até o curativo',
    normal_world: 'No mundo normal a mordida machuca e sangra, mas não infecta',
    infection_kills: 'Com a infecção ligada, a mordida dá febre e mata no tempo dela',
    grab_break_free: 'Seis empurrões soltam o agarrão antes da mordida',
    determinism: 'A mesma semente dá as mesmas feridas',
  },
  yes: 'sim',
  no: 'não',
}

export const playerBenchTextOf = (locale: string): PlayerBenchText => (locale.toLowerCase().startsWith('en') ? EN : PT_BR)
