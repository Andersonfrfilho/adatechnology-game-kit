import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'

import { createAudioRecorder } from './audio-recorder'
import type { AudioTrace } from './audio-recorder'
import { cutBetween, cutDeclaration, cutFunction } from './cut-source'
import { portablePow } from './portable-math'
import { createSeededRandom } from './seeded-random'

/** Which team page the audio comes from: the game (`jogo.js`) or the art scene (`arte__cena-de-arte.js`). */
export type TeamAudioProfile = 'game' | 'art_scene'

/** One call of the team's own code. `setup` runs first (the audio chain, a loop already created), `call` is the sound under test. */
export type TeamAudioCase = {
  readonly id: string
  readonly setup: string
  readonly call: string
}

export type TeamAudioCaseRecord = TeamAudioCase & { readonly seed: number; readonly trace: AudioTrace }

export type TeamAudioFixture = {
  readonly profile: TeamAudioProfile
  readonly seed: number
  /** SHA-256 of each cut of the team source: when the page changes, these change and the fixture must be recorded again. */
  readonly cuts: Readonly<Record<string, string>>
  readonly cases: readonly TeamAudioCaseRecord[]
}

const EVALUATION_TIMEOUT_MS = 20000
const DEFAULT_SEED = 1
const GAME_NOISE_START = 'audioInit();'
const ART_SCENE_CHAIN = 'initAudio(); __clearTrace();'

const GAME_CLASSES = ['pistola', 'escopeta', 'fuzil', 'rifle', 'impacto', 'carne', 'passo', 'vidro', 'madeira', 'recarga', 'vazio', 'explosao'] as const
const GAME_DISTANCES = [0, 10, 60, 120, 160] as const
const GAME_LOOPS = ['motor', 'chuva', 'horda', 'rotor'] as const
const GAME_LOOP_LEVELS = [0.001, 0.035, 0.3] as const
const GAME_SCREAM_DISTANCES = [0, 10, 30, 60, 100] as const
const GAME_ANIMAL_CALLS = ['latido', 'queroquero', 'cacarejo', 'mugido'] as const
const GAME_ANIMAL_DISTANCES = [0, 30, 60, 69] as const
const ART_POSITIONS = [
  [3, 2],
  [12, -9],
  [40, 25],
] as const
const ART_SHOT_WEAPONS = ['ak', '870', 'g17', 'r700', 'other'] as const
const ART_VOICES = [
  { name: 'walker', zombie: "{ x: X, z: Z, T: { n: 'Lento', c: 1 } }" },
  { name: 'runner', zombie: "{ x: X, z: Z, T: { n: 'Corredor', c: 3.5 } }" },
  { name: 'brute', zombie: "{ x: X, z: Z, T: { n: 'Brutamonte', c: 2 } }" },
] as const

const at = (template: string, [x, z]: readonly [number, number]): string => template.replaceAll('X', String(x)).replaceAll('Z', String(z))

function gameCases(): TeamAudioCase[] {
  const cases: TeamAudioCase[] = [{ id: 'init', setup: '', call: 'audioInit()' }]
  const run = (id: string, call: string): void => void cases.push({ id, setup: GAME_NOISE_START, call })
  for (const soundClass of GAME_CLASSES) for (const distance of GAME_DISTANCES) run(`sfx.${soundClass}@${distance}`, `sfx('${soundClass}', 1, ${distance})`)
  run('sfx.unknown@0', "sfx('desconhecido', 1, 0)")
  run('sfx.pistola.half_volume@10', "sfx('pistola', 0.5, 10)")
  for (const name of GAME_LOOPS) {
    for (const level of GAME_LOOP_LEVELS) {
      const frequency = name === 'motor' ? 120 : 0
      run(`loop.${name}@${level}`, `loopSet('${name}', ${level}, ${frequency}); loopSet('${name}', ${level * 1.5}, ${frequency * 1.2})`)
    }
  }
  for (const distance of GAME_SCREAM_DISTANCES) run(`grito@${distance}`, `grito(${distance})`)
  for (const distance of [0, 15, 40, 80]) run(`voz.gemido@${distance}`, `voz('gemido', ${distance})`)
  for (const distance of [0, 15, 40]) run(`voz.corredor@${distance}`, `voz('corredor', ${distance})`)
  for (const distance of [0, 30]) run(`voz.grito@${distance}`, `voz('grito', ${distance})`)
  for (const call of GAME_ANIMAL_CALLS) for (const distance of GAME_ANIMAL_DISTANCES) run(`bichoSom.${call}@${distance}`, `bichoSom('${call}', ${distance})`)
  for (const distance of [0, 20, 60, 200]) run(`boom@${distance}`, `boom(${distance})`)
  run('chiado', 'chiado()')
  run('buzina', 'buzina()')
  return cases
}

function artSceneCases(): TeamAudioCase[] {
  const cases: TeamAudioCase[] = [{ id: 'chain', setup: '', call: 'initAudio()' }]
  const run = (id: string, call: string): void => void cases.push({ id, setup: ART_SCENE_CHAIN, call })
  for (const weapon of ART_SHOT_WEAPONS) run(`shot.${weapon}`, `sfx.shot({ id: '${weapon}' })`)
  run('click', 'sfx.click(0, 2000, 0.3)')
  run('click.delayed', 'sfx.click(0.42, 1500, 0.5)')
  for (const name of ['empty', 'magOut', 'magIn', 'bolt', 'shell', 'grab', 'bite', 'hurt', 'siren']) run(name, `sfx.${name}()`)
  for (const position of ART_POSITIONS) {
    const label = position.join(',')
    run(`casing@${label}`, at('sfx.casing(X, Z)', position))
    for (const voice of ART_VOICES) run(`groan.${voice.name}@${label}`, `sfx.groan(${at(voice.zombie, position)})`)
    for (const name of ['scream', 'inhale', 'leap']) run(`${name}@${label}`, `sfx.${name}(${at('{ x: X, z: Z }', position)})`)
    for (const name of ['crack', 'sever', 'gore', 'burst', 'glass', 'wood', 'thunk', 'ping', 'clang', 'chip', 'crumble']) run(`${name}@${label}`, at(`sfx.${name}(X, Z)`, position))
    run(`flesh@${label}`, at('sfx.flesh(X, Z, false)', position))
    run(`thud@${label}`, at('sfx.thud(X, Z, 1.5)', position))
    run(`hiss@${label}`, at('sfx.hiss(X, Z, 0.8)', position))
    run(`boom@${label}`, at('sfx.boom(X, Z, false)', position))
  }
  run('flesh.head@3,2', 'sfx.flesh(3, 2, true)')
  run('boom.big@3,2', 'sfx.boom(3, 2, true)')
  return cases
}

export const GAME_AUDIO_CASES: readonly TeamAudioCase[] = gameCases()
export const ART_SCENE_AUDIO_CASES: readonly TeamAudioCase[] = artSceneCases()

const GAME_FUNCTIONS = ['audioInit', 'noise', 'sfx', 'loopSet', 'grito', 'voz', 'bichoSom', 'boom', 'chiado', 'buzina'] as const
// `AC` and `noiseBuf` are also names elsewhere in the page, so these three one-line declarations are cut by their exact text.
const GAME_DECLARATIONS = { AC: 'let AC = null, master = null;', noiseBuf: 'let noiseBuf = null;', LOOPS: 'const LOOPS = {};' } as const

// The page has other functions with these names (`boom` is also a map effect): the audio one is the one that touches `AC`, the page's AudioContext.
function cutAudioFunction(source: string, name: string): string {
  const marker = `\nfunction ${name}(`
  for (let index = source.indexOf(marker); index >= 0; index = source.indexOf(marker, index + 1)) {
    const text = cutFunction(source.slice(index + 1), name)
    if (/\bAC\b/.test(text)) return text
  }
  throw new Error(`team-audio: audio function "${name}" not found in the source`)
}

/** The cuts of the team source that the cases run, by name, in the order they must appear. */
export function cutTeamAudio(profile: TeamAudioProfile, source: string): Readonly<Record<string, string>> {
  if (profile === 'art_scene') {
    return { clamp: cutDeclaration(source, 'clamp'), audio: cutBetween(source, '// ---------- Audio (all synthesized)', 'function unlockAudio') }
  }
  const declarations = Object.fromEntries(Object.entries(GAME_DECLARATIONS).map(([name, text]) => [name, cutBetween(source, text, '\n')]))
  const functions = Object.fromEntries(GAME_FUNCTIONS.map((name) => [name, cutAudioFunction(source, name)]))
  return { ...declarations, ...functions }
}

// The page's own `rand` is `Math.random` taken at load and its listener is the player at the origin, looking along camTheta.
const ART_SCENE_PRELUDE = 'const rand = Math.random; const pl = { x: 0, z: 0 }; let camTheta = 0.6; let rain = true;'

function programOf(profile: TeamAudioProfile, cuts: Readonly<Record<string, string>>): string {
  const body = Object.values(cuts).join('\n')
  return `Math.random = __random; Math.pow = __pow;\n${profile === 'art_scene' ? ART_SCENE_PRELUDE : ''}\n${body}\n`
}

/** Runs one case on the team's own code under a seeded `Math.random` and returns what it did to the fake `AudioContext`. */
export function recordTeamAudioCase(profile: TeamAudioProfile, cuts: Readonly<Record<string, string>>, testCase: TeamAudioCase, seed = DEFAULT_SEED): AudioTrace {
  const recorder = createAudioRecorder()
  const scope = {
    window: { AudioContext: recorder.AudioContext },
    __random: createSeededRandom(seed),
    __pow: portablePow,
    __clearTrace: () => recorder.clearEntries(),
  }
  runInNewContext(`${programOf(profile, cuts)}${testCase.setup}\n${testCase.call}`, scope, { timeout: EVALUATION_TIMEOUT_MS })
  return recorder.trace()
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

/** Every case of a profile, recorded from the team source text. */
export function recordTeamAudioFixture(profile: TeamAudioProfile, source: string, seed = DEFAULT_SEED): TeamAudioFixture {
  const cuts = cutTeamAudio(profile, source)
  const cases = profile === 'game' ? GAME_AUDIO_CASES : ART_SCENE_AUDIO_CASES
  return {
    profile,
    seed,
    cuts: Object.fromEntries(Object.entries(cuts).map(([name, text]) => [name, sha256(text)])),
    cases: cases.map((testCase) => ({ ...testCase, seed, trace: recordTeamAudioCase(profile, cuts, testCase, seed) })),
  }
}

/** The fixture as text: one case per line, so a changed case shows up as one changed line. */
export function serializeTeamAudioFixture(fixture: TeamAudioFixture): string {
  const { cases, ...header } = fixture
  const lines = cases.map((testCase) => `    ${JSON.stringify(testCase)}`)
  return `${JSON.stringify(header).slice(0, -1)},"cases":[\n${lines.join(',\n')}\n  ]}\n`
}
