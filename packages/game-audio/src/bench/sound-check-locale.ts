import type { SfxBlow, SfxMaterial, SfxState } from '../catalog'
import type { CriterionId } from '../measure/criteria'
import type { SampleEnvironment } from '../sample'

type Strength = 'light' | 'medium' | 'heavy'

export type SoundCheckText = {
  readonly group: string
  readonly name: string
  readonly controls: Readonly<
    Record<
      | 'category'
      | 'sound'
      | 'play'
      | 'material'
      | 'blow'
      | 'strike'
      | 'distance'
      | 'bearing'
      | 'environment'
      | 'strength'
      | 'wall'
      | 'burst'
      | 'play_a'
      | 'play_b'
      | 'ab_cycle'
      | 'blind'
      | 'reveal'
      | 'prefer_a'
      | 'prefer_b'
      | 'measure'
      | 'record'
      | 'approve',
      string
    >
  >
  readonly hints: Readonly<Record<'sound' | 'strike' | 'wall' | 'burst' | 'ab_cycle' | 'blind' | 'measure' | 'record' | 'approve', string>>
  readonly categories: Readonly<Record<string, string>>
  readonly blows: Readonly<Record<SfxBlow, string>>
  readonly materials: Readonly<Record<SfxMaterial, string>>
  readonly environments: Readonly<Record<SampleEnvironment, string>>
  readonly strengths: Readonly<Record<Strength, string>>
  readonly states: Readonly<Record<SfxState, string>>
  readonly criteria: Readonly<Record<CriterionId, string>>
  readonly metrics: Readonly<Record<'chosen' | 'matrix' | 'last' | 'ab' | 'blind' | 'verdicts' | 'state' | 'count', string>>
  readonly run: Readonly<Record<'idle' | 'measuring' | 'done' | 'failed' | 'recording' | 'recorded', string>>
  readonly words: Readonly<Record<'none' | 'hidden' | 'prefers' | 'approved', string>>
  readonly probe: string
  readonly wall: string
  readonly scenarios: Readonly<Record<'pipeline' | 'criteria' | 'loop' | 'panel', string>>
}

const PT: SoundCheckText = {
  group: 'Som',
  name: 'Painel de som (arquivos e C1–C10)',
  controls: {
    category: '1 · Categoria',
    sound: '1 · Som',
    play: '1 · ▶ Tocar',
    material: '2 · Material',
    blow: '2 · Golpe',
    strike: '2 · ▶ Tocar golpe',
    distance: '3 · Distância',
    bearing: '3 · Direção',
    environment: '3 · Lugar',
    strength: '3 · Força',
    wall: '3 · Atrás da parede',
    burst: '3 · Rajada 20×',
    play_a: '4 · ▶ A (atual)',
    play_b: '4 · ▶ B (novo)',
    ab_cycle: '4 · Alternar A/B',
    blind: '4 · Às cegas (X)',
    reveal: '4 · Revelar X',
    prefer_a: '4 · Prefiro A',
    prefer_b: '4 · Prefiro B',
    measure: '5 · Medir C1–C10',
    record: '5 · Gravar 3 s',
    approve: '5 · Aprovo (C10)',
  },
  hints: {
    sound: 'A = arquivo, S = sintetizado, F = faltando. O que tem arquivo toca o arquivo; o resto toca o som atual.',
    strike: 'Toca impact_<material>_<golpe>: o arquivo se existir, senão o som atual daquele material.',
    wall: 'Põe a parede de casa entre você e a fonte: o som fica abafado (C4).',
    burst: 'Vinte vezes a cada 60 ms, como uma rajada (C9).',
    ab_cycle: 'A, B, A, B, um por segundo.',
    blind: 'Toca A ou B sem dizer qual; depois revele.',
    measure: 'Mede o som escolhido no motor real (contexto offline): sincronia, som certo, distância, lado, variação, volume, força, cauda e rajada.',
    record: 'Grava 3 s da saída com o som tocando e baixa o arquivo (C10).',
    approve: 'Marca o C10 do som escolhido como aprovado pelo seu ouvido.',
  },
  categories: {
    armas: 'Armas',
    impactos: 'Impactos',
    'explosoes-fogo': 'Explosões e fogo',
    personagem: 'Personagem',
    veiculos: 'Veículos',
    'itens-portas': 'Itens e portas',
    ambiente: 'Ambiente',
    calibracao: 'Calibração (SDK)',
  },
  blows: { bullet: 'tiro', blunt: 'soco/chute', blade: 'faca', break: 'quebra', drag: 'arrasto/queda' },
  materials: {
    steel: 'aço',
    aluminium: 'alumínio',
    wood: 'madeira',
    plywood: 'compensado',
    mdf: 'MDF',
    glass: 'vidro',
    tempered_glass: 'vidro temperado',
    ceramic: 'cerâmica',
    concrete: 'concreto',
    brick: 'tijolo',
    plaster: 'gesso',
    plastic: 'plástico',
    fabric: 'tecido',
    paper: 'papelão',
    foliage: 'folhagem',
    soil: 'terra',
    flesh: 'carne',
  },
  environments: { indoor: 'interior', outdoor: 'exterior' },
  strengths: { light: 'leve', medium: 'médio', heavy: 'forte' },
  states: { file: 'A', synth: 'S', missing: 'F' },
  criteria: { C1: 'C1 Sincronia', C2: 'C2 Certo p/ ação', C3: 'C3 Distância', C4: 'C4 Posição', C5: 'C5 Variação', C6: 'C6 Volume', C7: 'C7 Intensidade', C8: 'C8 Cauda', C9: 'C9 Rajada', C10: 'C10 Escuta' },
  metrics: { chosen: '1 · Escolhido', matrix: '2 · Matriz', last: 'Último tocado', ab: '4 · A × B', blind: '4 · X', verdicts: '4 · Preferências', state: '5 · Medição', count: '1 · Catálogo' },
  run: { idle: 'parada', measuring: 'medindo…', done: 'pronta', failed: 'falhou', recording: 'gravando…', recorded: 'gravação baixada' },
  words: { none: '—', hidden: '? (revele)', prefers: 'prefere', approved: 'aprovado pelo dono' },
  probe: 'Fonte do som',
  wall: 'Parede (oclusão)',
  scenarios: { pipeline: 'Arquivo → decodifica → toca (round-robin, cauda)', criteria: 'Critérios C1–C9 no som de calibração', loop: 'Loop de arquivo: emenda sem buraco (crossfade)', panel: 'Painel: categorias, matriz, A/B e parede' },
}

const EN: SoundCheckText = {
  ...PT,
  group: 'Sound',
  name: 'Sound panel (files and C1–C10)',
  controls: {
    category: '1 · Category',
    sound: '1 · Sound',
    play: '1 · ▶ Play',
    material: '2 · Material',
    blow: '2 · Blow',
    strike: '2 · ▶ Play blow',
    distance: '3 · Distance',
    bearing: '3 · Bearing',
    environment: '3 · Place',
    strength: '3 · Strength',
    wall: '3 · Behind the wall',
    burst: '3 · Burst 20×',
    play_a: '4 · ▶ A (current)',
    play_b: '4 · ▶ B (new)',
    ab_cycle: '4 · Alternate A/B',
    blind: '4 · Blind (X)',
    reveal: '4 · Reveal X',
    prefer_a: '4 · Prefer A',
    prefer_b: '4 · Prefer B',
    measure: '5 · Measure C1–C10',
    record: '5 · Record 3 s',
    approve: '5 · Approve (C10)',
  },
  hints: {
    sound: 'A = file, S = synthesized, F = missing. A file plays the file; the rest plays the current sound.',
    strike: 'Plays impact_<material>_<blow>: the file if there is one, else the current sound of that material.',
    wall: 'Puts the house wall between you and the source: the sound is muffled (C4).',
    burst: 'Twenty times every 60 ms, like a burst (C9).',
    ab_cycle: 'A, B, A, B, one a second.',
    blind: 'Plays A or B without saying which; reveal it after.',
    measure: 'Measures the chosen sound through the real engine (offline context): sync, right sound, distance, side, variation, level, strength, tail and burst.',
    record: 'Records 3 s of the output with the sound playing and downloads it (C10).',
    approve: 'Marks C10 of the chosen sound as approved by your ear.',
  },
  categories: { armas: 'Weapons', impactos: 'Impacts', 'explosoes-fogo': 'Explosions and fire', personagem: 'Character', veiculos: 'Vehicles', 'itens-portas': 'Items and doors', ambiente: 'Ambience', calibracao: 'Calibration (SDK)' },
  blows: { bullet: 'bullet', blunt: 'punch/kick', blade: 'knife', break: 'break', drag: 'drag/fall' },
  materials: {
    steel: 'steel',
    aluminium: 'aluminium',
    wood: 'wood',
    plywood: 'plywood',
    mdf: 'MDF',
    glass: 'glass',
    tempered_glass: 'tempered glass',
    ceramic: 'ceramic',
    concrete: 'concrete',
    brick: 'brick',
    plaster: 'plaster',
    plastic: 'plastic',
    fabric: 'fabric',
    paper: 'cardboard',
    foliage: 'foliage',
    soil: 'soil',
    flesh: 'flesh',
  },
  environments: { indoor: 'indoor', outdoor: 'outdoor' },
  strengths: { light: 'light', medium: 'medium', heavy: 'heavy' },
  criteria: { C1: 'C1 Sync', C2: 'C2 Right sound', C3: 'C3 Distance', C4: 'C4 Position', C5: 'C5 Variation', C6: 'C6 Level', C7: 'C7 Strength', C8: 'C8 Tail', C9: 'C9 Burst', C10: 'C10 Listening' },
  metrics: { chosen: '1 · Chosen', matrix: '2 · Matrix', last: 'Last played', ab: '4 · A × B', blind: '4 · X', verdicts: '4 · Preferences', state: '5 · Measurement', count: '1 · Catalogue' },
  run: { idle: 'idle', measuring: 'measuring…', done: 'done', failed: 'failed', recording: 'recording…', recorded: 'recording downloaded' },
  words: { none: '—', hidden: '? (reveal)', prefers: 'prefers', approved: 'approved by the owner' },
  probe: 'Sound source',
  wall: 'Wall (occlusion)',
  scenarios: { pipeline: 'File → decode → play (round-robin, tail)', criteria: 'Criteria C1–C9 on the calibration sound', loop: 'File loop: seamless joins (crossfade)', panel: 'Panel: categories, matrix, A/B and wall' },
}

export const soundCheckTextOf = (locale: string): SoundCheckText => (locale.startsWith('en') ? EN : PT)
