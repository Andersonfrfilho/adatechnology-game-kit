export type AudioBenchText = {
  readonly group: string
  readonly name: string
  readonly probe: string
  readonly controls: Readonly<Record<'sound' | 'distance' | 'bearing' | 'volume' | 'mix' | 'seed' | 'play' | 'voice_storm' | 'loop' | 'loop_level' | 'loop_pitch' | 'source', string>>
  readonly hints: Readonly<Record<'distance' | 'bearing' | 'mix' | 'seed' | 'voice_storm' | 'loop_pitch' | 'source', string>>
  readonly options: Readonly<Record<'none' | 'bench' | 'probe', string>>
  readonly layers: Readonly<Record<'reverb' | 'compressor' | 'panning' | 'muffling', string>>
  readonly metrics: Readonly<Record<'voices' | 'peak' | 'dropped' | 'loops' | 'context' | 'plan_length' | 'plan_level' | 'plan_pan' | 'level_weapons' | 'level_voices' | 'level_world' | 'level_ambience' | 'level_weather' | 'level_ui', string>>
  readonly scenarios: Readonly<Record<'panning' | 'distance' | 'determinism' | 'limiter', string>>
  readonly mixes: Readonly<Record<string, string>>
  /** Text of a sound or loop id when the game has one; the bench falls back to the id. */
  readonly sheet: Readonly<Record<'title' | 'level' | 'distance' | 'pan' | 'length' | 'silent' | 'layer' | 'none', string>>
}

const EN: AudioBenchText = {
  group: 'Sound',
  name: 'Sound area',
  probe: 'Sound probe',
  controls: {
    sound: 'Sound',
    distance: 'Distance',
    bearing: 'Bearing',
    volume: 'Volume',
    mix: 'Mixing chain',
    seed: 'Seed',
    play: 'Play',
    voice_storm: 'Voice storm',
    loop: 'Loop',
    loop_level: 'Loop level',
    loop_pitch: 'Loop pitch',
    source: 'Source',
  },
  hints: {
    distance: 'Metres from the listener: the level falls and the sound is muffled with it.',
    bearing: 'Degrees from straight ahead, positive to the right: shows the panning.',
    mix: 'The game chain (master only) or the art scene chain (compressor and reverb).',
    seed: 'The same seed gives the same sound.',
    voice_storm: 'Twenty of the chosen sound at once: the voice limiter drops what its group and the global cap refuse.',
    loop_pitch: 'Frequency of an oscillator loop, in hertz (0 leaves it where it is).',
    source: 'Where the sound comes from: the distance and bearing set here, or the probe standing in the area.',
  },
  options: { none: 'None', bench: 'Bench settings', probe: 'The probe' },
  layers: { reverb: 'Reverb', compressor: 'Compressor', panning: 'Panning', muffling: 'Muffling by distance' },
  metrics: {
    voices: 'Voices playing',
    peak: 'Most voices at once',
    dropped: 'Voices dropped',
    loops: 'Loops running',
    context: 'Audio context',
    plan_length: 'Chosen sound: length',
    plan_level: 'Chosen sound: level',
    plan_pan: 'Chosen sound: pan',
    level_weapons: 'Level: weapons',
    level_voices: 'Level: voices',
    level_world: 'Level: world',
    level_ambience: 'Level: ambience',
    level_weather: 'Level: weather',
    level_ui: 'Level: interface',
  },
  scenarios: {
    panning: 'A sound to the right is heard on the right, one to the left on the left, one ahead in the middle',
    distance: 'The farther a sound, the quieter, until it is not played',
    determinism: 'The same seed gives the same sound plan, another seed another one',
    limiter: 'The voice limiter holds a storm of voices to its group rule and its global cap',
  },
  mixes: { game: 'Game', art_scene: 'Art scene' },
  sheet: { title: 'Sound plan', level: 'level', distance: 'distance', pan: 'pan', length: 'seconds', silent: 'too far to be heard', layer: 'layer', none: 'no sound chosen' },
}

const PT_BR: AudioBenchText = {
  group: 'Som',
  name: 'Área de som',
  probe: 'Sonda de som',
  controls: {
    sound: 'Som',
    distance: 'Distância',
    bearing: 'Direção',
    volume: 'Volume',
    mix: 'Cadeia de mixagem',
    seed: 'Semente',
    play: 'Tocar',
    voice_storm: 'Tempestade de vozes',
    loop: 'Laço',
    loop_level: 'Nível do laço',
    loop_pitch: 'Altura do laço',
    source: 'Origem',
  },
  hints: {
    distance: 'Metros até o ouvinte: o nível cai e o som abafa junto.',
    bearing: 'Graus a partir da frente, positivo para a direita: mostra o pan.',
    mix: 'A cadeia do jogo (só o master) ou a da Cena de Arte (compressor e reverb).',
    seed: 'A mesma semente dá o mesmo som.',
    voice_storm: 'Vinte do som escolhido de uma vez: o limite de vozes derruba o que a regra do grupo e o teto global recusam.',
    loop_pitch: 'Frequência de um laço de oscilador, em hertz (0 deixa onde está).',
    source: 'De onde vem o som: a distância e a direção daqui, ou a sonda que está na área.',
  },
  options: { none: 'Nenhum', bench: 'Ajustes da bancada', probe: 'A sonda' },
  layers: { reverb: 'Reverb', compressor: 'Compressor', panning: 'Pan', muffling: 'Abafamento pela distância' },
  metrics: {
    voices: 'Vozes tocando',
    peak: 'Mais vozes de uma vez',
    dropped: 'Vozes derrubadas',
    loops: 'Laços ligados',
    context: 'Contexto de áudio',
    plan_length: 'Som escolhido: duração',
    plan_level: 'Som escolhido: nível',
    plan_pan: 'Som escolhido: pan',
    level_weapons: 'Nível: armas',
    level_voices: 'Nível: vozes',
    level_world: 'Nível: mundo',
    level_ambience: 'Nível: ambiente',
    level_weather: 'Nível: clima',
    level_ui: 'Nível: interface',
  },
  scenarios: {
    panning: 'Um som à direita sai à direita, à esquerda sai à esquerda, à frente sai no meio',
    distance: 'Quanto mais longe, mais baixo, até não tocar',
    determinism: 'A mesma semente dá o mesmo plano de som, outra semente dá outro',
    limiter: 'O limite de vozes segura uma tempestade de vozes na regra do grupo e no teto global',
  },
  mixes: { game: 'Jogo', art_scene: 'Cena de Arte' },
  sheet: { title: 'Plano do som', level: 'nível', distance: 'distância', pan: 'pan', length: 'segundos', silent: 'longe demais para ouvir', layer: 'camada', none: 'nenhum som escolhido' },
}

export const audioBenchTextOf = (locale: string): AudioBenchText => (locale === 'en' ? EN : PT_BR)
