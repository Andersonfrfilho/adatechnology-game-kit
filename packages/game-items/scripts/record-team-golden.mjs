// Records the golden fixtures of the item finds from the team's own code: the game's `rollItems` (G-b) and the 3D house viewer's `sorteiaConteudo` (G-c).
// The functions and the tables they read are cut out of the delivered sources and evaluated in a `vm` context whose random stream is replaced by a seeded one,
// so the fixture holds what the original answers, not what the port assumes. Needs `pnpm build` of golden-tool. Run once: `pnpm --filter @adatechnology/game-items record:team-golden`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'

import { createSeededRandom, cutLiteral, installPortableMath } from '@adatechnology/golden-tool'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const SPEC = join(ROOT, 'specs', '001-migracao-entregas-dos-times')
const GAME = readFileSync(join(SPEC, 'artefatos', '2UG1Mhe9LqJkQKKVsJkTWR', 'jogo.js'), 'utf8')
const VIEWER = readFileSync(join(SPEC, 'sources', 'jogo__visor-casas-3d.js'), 'utf8')
const DECISIONS = JSON.parse(readFileSync(join(ROOT, 'tools', 'items-catalog', 'decisions.json'), 'utf8'))
const OUT = join(ROOT, 'packages', 'game-items', 'tests', 'fixtures', 'team-golden')
const TIMEOUT = { timeout: 5000 }

installPortableMath()

/** Text from `start` (a line start) up to, not including, the first match of `end` after it. */
const between = (source, start, end) => {
  const from = source.search(start)
  const to = source.slice(from + 1).search(end) + from + 1
  if (from < 0 || to <= from) throw new Error(`block not found: ${start} .. ${end}`)
  return source.slice(from, to)
}

const countingRandom = (random) => {
  const draws = []
  const next = () => {
    const value = random()
    draws.push(value)
    return value
  }
  return { next, draws }
}

const recordRollItems = () => {
  const code = [
    ...['ITENS', 'EXTRA', 'RAR_W', 'CONT_TAB', 'FIXOS'].map((name) => `const ${name} = ${cutLiteral(GAME, name)};`),
    between(GAME, /^function rollItems\(/m, /^\}\n/m) + '}',
  ].join('\n')
  const containers = Object.keys(JSON.parse(JSON.stringify(runInNewContext(`(${cutLiteral(GAME, 'CONT_TAB')})`, {}, TIMEOUT))))
  const places = Object.keys(DECISIONS.placeMap)
  const cases = []
  for (const container of containers) {
    for (const place of places) {
      for (let seed = 1; seed <= 10; seed++) {
        const random = countingRandom(createSeededRandom(seed))
        const context = { R: random.next }
        const ids = runInNewContext(`${code}\nrollItems(${JSON.stringify(container)}, ${JSON.stringify(place)}, '', null)`, context, TIMEOUT)
        cases.push({ container, place, seed, ids, draws: random.draws.length })
      }
    }
  }
  const tables = {
    placeIds: Object.fromEntries(Object.entries(DECISIONS.placeMap).map(([code, decision]) => [code, decision.value.id])),
  }
  return { source: 'jogo.js rollItems (L68796-68812), CONT_TAB, RAR_W, ITENS, EXTRA; R replaced by the seeded mulberry32 of golden-tool, nome = "" and extra = null', ...tables, cases }
}

const STATES = ['normal', 'protegida', 'abandonada']
const FOOTPRINTS = [0.2, 0.5, 0.9, 1.4, 2.4]

const recordHouseContents = () => {
  const code = [
    between(VIEWER, /^function mulberry32\(/m, /^\/\/ ---------- catálogo de itens/m),
    between(VIEWER, /^const LT = /m, /^function aplicaConteudo\(/m),
  ].join('\n')
  const keys = Object.keys(runInNewContext(`${code}\nCONTEUDO`, {}, TIMEOUT))
  const cases = []
  keys.forEach((key, index) => {
    const footprint = FOOTPRINTS[index % FOOTPRINTS.length]
    for (const state of STATES) {
      for (let seed = 1; seed <= 25; seed++) {
        const capture = { draws: [] }
        const context = { capture }
        const call = `(() => { const make = criaRng; criaRng = (sem, chave) => { const random = make(sem, chave); return () => { const value = random(); capture.draws.push(value); return value; }; }; return sorteiaConteudo({ id: 'm_${key}', categoria: '${key}', w: ${footprint}, d: 1 }, '${state}', ${seed}); })()`
        const result = runInNewContext(`${code.replace('const criaRng', 'var criaRng')}\n${call}`, context, TIMEOUT)
        cases.push({ key, state, seed, footprint, picks: result.map((pick) => ({ type: pick.tipo, count: pick.qtd })), draws: capture.draws })
      }
    }
  })
  return { source: 'visor-casas-3d.js sorteiaConteudo (L10848-10865), CONTEUDO, COMIDA_SUP, criaRng, ordemPonderada; the recorded draws are the ones the original consumed', cases }
}

mkdirSync(OUT, { recursive: true })
const write = (name, data) => writeFileSync(join(OUT, name), `${JSON.stringify(data)}\n`)
const rollItems = recordRollItems()
const houseContents = recordHouseContents()
write('roll-items.json', rollItems)
write('house-contents.json', houseContents)
process.stdout.write(`roll-items: ${rollItems.cases.length} cases; house-contents: ${houseContents.cases.length} cases\n`)
