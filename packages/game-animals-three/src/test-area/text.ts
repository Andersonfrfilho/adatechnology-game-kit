export type AnimalsText = {
  group: string
  name: string
  controls: Record<'visual_state' | 'gait' | 'speed' | 'outbreak' | 'time_scale', string>
  hints: Record<'visual_state' | 'gait' | 'outbreak' | 'time_scale', string>
  options: { visual_state: Record<string, string>; gait: Record<string, string> }
  actions: Record<'bite_all' | 'recover' | 'call' | 'skin_40' | 'clear_skins', string>
  layers: Record<'joints' | 'split' | 'sound_range' | 'carcass_lure', string>
  metrics: Record<'animals' | 'draw_calls' | 'triangles' | 'nodes_per_skin' | 'incubating' | 'turned' | 'dead', string>
  scenarios: Record<string, string>
}

export const TEXT: Record<string, AnimalsText> = {
  en: {
    group: 'Animals',
    name: 'Animals area',
    controls: { visual_state: 'Visual state', gait: 'Gait', speed: 'Animation speed', outbreak: 'Outbreak rule', time_scale: 'Bite clock' },
    hints: {
      visual_state: 'The look of every animal: alive, infected (grey coat, glowing eyes, wounds) or dead (lying down, a pool of blood)',
      gait: 'idle, walk or run; the cycle of each species runs at its own rate',
      outbreak: 'Off: a bite does nothing. On: a species that turns incubates and turns, one that dies dies, the rest shrug it off',
      time_scale: 'Game seconds per real second for the bite timers (60: ten minutes pass in ten seconds)',
    },
    options: { visual_state: { alive: 'Alive', infected: 'Infected', dead: 'Dead' }, gait: { idle: 'Idle', walk: 'Walk', run: 'Run' } },
    actions: { bite_all: 'Bite every animal', recover: 'Heal every animal', call: 'Make the animals with a call call (hen, lapwing, cow, dog)', skin_40: 'Add 40 animals as node skins', clear_skins: 'Remove the skins' },
    layers: { joints: 'Joints', split: 'Split view', sound_range: 'Sound range', carcass_lure: 'Carcass lure radius' },
    metrics: { animals: 'Animals', draw_calls: 'Draw calls', triangles: 'Triangles', nodes_per_skin: 'Nodes per skin', incubating: 'Incubating', turned: 'Turned', dead: 'Dead' },
    scenarios: {
      visual_states: 'Alive, infected and dead for every species',
      gait_moves_legs: 'The gait moves the legs',
      outbreak_rule: 'Outbreak rule on and off',
      carcass_lure: 'A carcass lures zombies within its radius',
      bite_to_turn_timer: 'Bite, incubation, turn (accelerated)',
      skins_40: '40 animals as node skins',
    },
  },
  'pt-BR': {
    group: 'Animais',
    name: 'Área de animais',
    controls: { visual_state: 'Estado visual', gait: 'Andar', speed: 'Velocidade da animação', outbreak: 'Regra de surto', time_scale: 'Relógio da mordida' },
    hints: {
      visual_state: 'O aspecto de todos os bichos: vivo, infectado (pelo cinza, olhos brilhando, feridas) ou morto (deitado, poça de sangue)',
      gait: 'idle, walk ou run; o ciclo de cada espécie anda no seu ritmo',
      outbreak: 'Desligada: a mordida não faz nada. Ligada: a espécie que vira incuba e vira, a que morre morre, as outras não sentem',
      time_scale: 'Segundos de jogo por segundo real nos prazos da mordida (60: dez minutos passam em dez segundos)',
    },
    options: { visual_state: { alive: 'Vivo', infected: 'Infectado', dead: 'Morto' }, gait: { idle: 'Parado', walk: 'Andando', run: 'Correndo' } },
    actions: { bite_all: 'Morder todos os bichos', recover: 'Curar todos os bichos', call: 'Fazer os bichos com chamado chamarem (galinha, quero-quero, vaca, cachorro)', skin_40: 'Pôr 40 bichos como pele de nós', clear_skins: 'Tirar as peles' },
    layers: { joints: 'Juntas', split: 'Vista aberta', sound_range: 'Alcance do som', carcass_lure: 'Raio de atração da carcaça' },
    metrics: { animals: 'Bichos', draw_calls: 'Chamadas de desenho', triangles: 'Triângulos', nodes_per_skin: 'Nós por pele', incubating: 'Incubando', turned: 'Viraram', dead: 'Morreram' },
    scenarios: {
      visual_states: 'Vivo, infectado e morto em cada espécie',
      gait_moves_legs: 'O andar mexe as pernas',
      outbreak_rule: 'Regra de surto ligada e desligada',
      carcass_lure: 'A carcaça atrai zumbis dentro do raio',
      bite_to_turn_timer: 'Mordida, incubação, vira (acelerado)',
      skins_40: '40 bichos como pele de nós',
    },
  },
}
