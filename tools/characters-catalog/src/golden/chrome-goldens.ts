import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { cutBetween, cutDeclaration, cutFunction } from '@adatechnology/golden-tool/cut-source'
import type { PagePatch, RecordPageOptions } from '@adatechnology/golden-tool/record-page'

import { loadDecisions } from '../decisions'
import { extractGame } from '../extract-game'
import { ANIMALS_DECISIONS_PATH, CAPTURES_DIR, PAGE_PATHS, SOURCE_PATHS, fixturePath } from '../paths'
import { fromMarker, readSource } from '../read-source'

export const GAME_THREE = join(dirname(SOURCE_PATHS.game), 'three.module.js')
const CLOSURE_END = '\n})();\n</script>'
const SCRIPT_END = '\n</script>'
const BODY_MARKER = '// ===== Corpo arredondado (Guia de estilo)'
const ARSENAL_ADDONS = ['OrbitControls.js', 'RoundedBoxGeometry.js', 'RoomEnvironment.js'] as const

export type Slices = Readonly<Record<string, unknown>>

export type ChromeGolden = {
  readonly id: string
  /** A team page (patched to expose its closure) or the harness page with the game's three.js. */
  readonly page: string
  readonly patches: readonly PagePatch[]
  readonly capture: string
  readonly out: string
  readonly addons?: RecordPageOptions['addons']
  readonly ready?: string
  /** Code or data cut out of the sources and handed to the capture as `globalThis.__SLICES`. */
  readonly slices?: () => Slices
  readonly gameThree?: boolean
}

const types = (): { id: string; name: string; index: number }[] => {
  const { typeIds } = loadDecisions()
  return extractGame().categories.map((category, index) => ({ id: typeIds.value[category.id] ?? category.id, name: category.nome, index }))
}

const species = (): { id: string; sourceId: string }[] =>
  Object.entries((JSON.parse(readFileSync(ANIMALS_DECISIONS_PATH, 'utf8')) as { speciesIds: { value: Record<string, string> } }).speciesIds.value).map(([sourceId, id]) => ({ id, sourceId }))

const bodySlices = (): Slices => {
  const game = readSource(SOURCE_PATHS.game)
  const bake = fromMarker(game, '// ===== Assar o corpo do Bestiário numa malha instanciável')
  const rule = /const nv = (c === CAT\.lento \? 4 : [^;]+);/.exec(fromMarker(game, 'const ZVAR = [], ZVAR_OF'))?.[1]
  if (!rule) throw new Error('characters-catalog: the variant count rule was not found in the game')
  const countOf = new Function('c', 'CAT', `return ${rule}`) as (c: number, cat: Record<string, number>) => number
  const cat = Object.fromEntries(extractGame().categories.map((category, index) => [category.id, index]))
  const all = types()
  return {
    types: all,
    variantCounts: Object.fromEntries(all.map((type) => [type.id, countOf(type.index, cat)])),
    best: [cutDeclaration(game, 'CATS'), cutDeclaration(fromMarker(game, '// ===== Corpo dos zumbis do Bestiário v17'), 'BEST'), cutDeclaration(bake, 'BAKE_NEUTRO'), cutDeclaration(bake, '_bv'), cutFunction(bake, 'bakeBody')].join('\n'),
  }
}

const instancedSlices = (): Slices => {
  const body = fromMarker(readSource(SOURCE_PATHS.game), BODY_MARKER)
  return { instanced: [cutDeclaration(body, 'J'), ...['tagGeo', 'mergeBody', 'limb', 'ball', 'buildBody'].map((name) => cutFunction(body, name))].join('\n') }
}

const animalSkinSlices = (): Slices => ({
  species: species(),
  animals: cutBetween(readSource(SOURCE_PATHS.game), '// ===== Bichos do Vale (animais/animais.html)', 'function bichoOssos(E)'),
})

export const CHROME_GOLDENS: readonly ChromeGolden[] = [
  {
    id: 'damage-segments',
    page: PAGE_PATHS.arsenal,
    patches: [{ after: 'const T = THREE, PI = Math.PI;', before: CLOSURE_END, insert: '\nglobalThis.__team = { T, ZW, show, buildZombie, damage, grenadeAt, get Z() { return Z } };' }],
    capture: 'damage-segments.js',
    out: fixturePath('game-characters', 'arsenal-damage-segments.json'),
    addons: ARSENAL_ADDONS,
  },
  {
    id: 'cut-hierarchy',
    page: PAGE_PATHS.elenco,
    patches: [
      {
        after: 'const V=THREE.Vector3;',
        before: CLOSURE_END,
        insert: "\nglobalThis.__team = { THREE, build, hit, WEAPONS, NPCS, setWeapon(id) { weapon = WEAPONS.find((entry) => entry.id === id) }, get lastMessage() { return lastMsg } };",
      },
    ],
    capture: 'cut-hierarchy.js',
    out: fixturePath('game-characters', 'elenco-cut-hierarchy.json'),
  },
  {
    id: 'gait',
    page: PAGE_PATHS.bestiary,
    patches: [{ after: 'function animate0(obj,t){', before: CLOSURE_END, insert: '\nglobalThis.__team = { build, animate0 };' }],
    capture: 'gait.js',
    out: fixturePath('game-characters-three', 'bestiary-gait.json'),
    slices: () => ({ types: types() }),
  },
  {
    id: 'people',
    page: PAGE_PATHS.portraits,
    patches: [{ after: 'function buildPerson(p,zed){', before: CLOSURE_END, insert: '\nglobalThis.__team = { buildPerson, PEOPLE };' }],
    capture: 'people.js',
    out: fixturePath('game-characters-three', 'portraits-people.json'),
  },
  {
    id: 'animals',
    page: PAGE_PATHS.animals,
    patches: [{ after: 'function animQuad(A,t,dt){', before: SCRIPT_END, insert: '\n;globalThis.__team = { ANIMALS, setInfected, st, animQuad, animBird, animSnake };' }],
    capture: 'animals.js',
    out: fixturePath('game-animals-three', 'animals-page.json'),
    slices: () => ({ species: species() }),
  },
  { id: 'body', page: join(CAPTURES_DIR, 'g-harness.html'), patches: [], capture: 'body.js', out: fixturePath('game-characters-three', 'game-best-body.json'), ready: 'globalThis.__harnessReady', slices: bodySlices, gameThree: true },
  { id: 'instanced', page: join(CAPTURES_DIR, 'g-harness.html'), patches: [], capture: 'instanced.js', out: fixturePath('game-characters-three', 'game-instanced-body.json'), ready: 'globalThis.__harnessReady', slices: instancedSlices, gameThree: true },
  { id: 'animal-skin', page: join(CAPTURES_DIR, 'g-harness.html'), patches: [], capture: 'animal-skin.js', out: fixturePath('game-props3d', 'game-animal-skin.json'), ready: 'globalThis.__harnessReady', slices: animalSkinSlices, gameThree: true },
]

