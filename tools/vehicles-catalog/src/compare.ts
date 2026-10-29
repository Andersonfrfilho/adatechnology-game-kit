import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'

import { installPortableMath } from '@adatechnology/golden-tool'
import { createVehicleKit } from '@adatechnology/game-vehicles'
import { installFleet, legacyVehicleSeeds, fleetVehicleIds } from '@adatechnology/game-vehicles-fleet'
import * as THREE from 'three'

import { digest } from './digest'
import type { Digest } from './digest'
import { extractRegisters, garageArtifactScripts, garageSiteScripts } from './extract'
import type { PageScript } from './extract'
import { fakeDocument } from './fake-dom'
import { COMPARISON_DIR } from './paths'

const STATES = [
  ['intact', 'intacto'],
  ['damaged', 'danificado'],
  ['modified', 'modificado'],
] as const
/** Crash flags that only the game plugin adds (zombie blood); the SDK has no such flag, so the page's damaged state leaves it out. */
const GAME_ONLY_FLAGS = ['frontBlood']

type PageApi = { build: (key: string, state: string, zones?: unknown) => { root: unknown }; zoneScenario: (vehicle: unknown, id: string) => { flags: Record<string, boolean> }; config: { damagedScenario: string } }

/** Runs the page scripts in a fresh context with the same three.js and the fake canvas document, and returns the SDK global the page builds with. */
const runPage = (scripts: readonly PageScript[]): PageApi => {
  const sandbox: Record<string, unknown> = { THREE, document: fakeDocument, console, Math, setTimeout, clearTimeout }
  sandbox.window = sandbox
  const context = createContext(sandbox)
  for (const script of scripts) runInContext(script.code, context, { filename: script.path })
  return sandbox.VehicleSDK as PageApi
}

const pageDigests = (page: PageApi, key: string): Record<string, Digest> => {
  const probe = page.build(key, 'intacto')
  const damagedZones = page.zoneScenario(probe, page.config.damagedScenario)
  for (const flag of GAME_ONLY_FLAGS) delete damagedZones.flags[flag]
  return {
    intact: digest(page.build(key, 'intacto').root),
    damaged: digest(page.build(key, 'danificado', damagedZones).root),
    modified: digest(page.build(key, 'modificado').root),
  }
}

const sdkDigests = (kit: ReturnType<typeof createVehicleKit>, id: string): Record<string, Digest> =>
  Object.fromEntries(STATES.map(([state]) => [state, digest(kit.build(id, state).root)]))

type Row = { id: string; key: string; state: string; artifact: Digest; site: Digest; sdk: Digest; artifactEqualsSite: boolean; sdkEqualsArtifact: boolean }

export const compareGarage = (): Row[] => {
  const restore = installPortableMath()
  try {
    const artifact = runPage(garageArtifactScripts())
    const site = runPage(garageSiteScripts().map((script) => script))
    const kit = createVehicleKit({ THREE, document: fakeDocument, locale: 'pt-BR' })
    installFleet(kit)
    const registered = new Set(extractRegisters().map((entry) => entry.key))
    const rows: Row[] = []
    for (const id of fleetVehicleIds) {
      const key = legacyVehicleSeeds[id] as string
      if (!registered.has(key)) throw new Error(`vehicles-catalog compare: "${key}" is not registered by the Garagem artifact`)
      const fromArtifact = pageDigests(artifact, key)
      const fromSite = pageDigests(site, key)
      const fromSdk = sdkDigests(kit, id)
      for (const [state] of STATES) {
        const a = fromArtifact[state] as Digest
        const s = fromSite[state] as Digest
        const k = fromSdk[state] as Digest
        rows.push({ id, key, state, artifact: a, site: s, sdk: k, artifactEqualsSite: JSON.stringify(a) === JSON.stringify(s), sdkEqualsArtifact: JSON.stringify(a) === JSON.stringify(k) })
      }
    }
    return rows
  } finally {
    restore()
  }
}

const render = (rows: readonly Row[]): string => {
  const different = rows.filter((row) => !row.artifactEqualsSite || !row.sdkEqualsArtifact)
  const lines = [
    '# Garagem: artefato x site v4 x SDK',
    '',
    'Gerado por `pnpm --filter @adatechnology/vehicles-catalog-tool compare`. Cada veículo é construído nos três estados (intacto, danificado, modificado) pelo',
    'artefato (`artefatos/Xy9QydZTRyAfwxRMjzh1aT/`), pelos `<script>` da página v4 (`sources/veiculos__garagem.js`) e pelo SDK (`game-vehicles` + `game-vehicles-fleet`),',
    'todos em Node com three r160 e o canvas falso do repositório. O resumo de cada cena (objetos e hash de transformações, geometrias e materiais) é o de',
    '`packages/game-vehicles-fleet/tests/helpers/digest.ts`. O estado danificado usa o cenário `frontal` sem a bandeira de sangue, que só existe no jogo.',
    '',
    `Veículos: ${new Set(rows.map((row) => row.id)).size}. Comparações: ${rows.length}. Diferentes: ${different.length}.`,
    '',
    '| veículo | chave da página | estado | objetos | artefato = site | SDK = artefato |',
    '|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row.id} | ${row.key} | ${row.state} | ${row.artifact.objects} | ${row.artifactEqualsSite ? 'sim' : 'NÃO'} | ${row.sdkEqualsArtifact ? 'sim' : 'NÃO'} |`),
    '',
  ]
  return lines.join('\n')
}

export const writeComparison = (rows: readonly Row[]): void => {
  mkdirSync(COMPARISON_DIR, { recursive: true })
  writeFileSync(join(COMPARISON_DIR, 'README.md'), render(rows))
  writeFileSync(join(COMPARISON_DIR, 'resultado.json'), `${JSON.stringify(rows, null, 2)}\n`)
}

if (process.argv[1]?.endsWith('compare.js')) {
  const rows = compareGarage()
  writeComparison(rows)
  const different = rows.filter((row) => !row.artifactEqualsSite || !row.sdkEqualsArtifact)
  process.stdout.write(`vehicles-catalog compare: ${rows.length} comparisons, ${different.length} different\n`)
  if (different.length > 0) process.exitCode = 1
}
