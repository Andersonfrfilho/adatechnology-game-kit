/**
 * Records the golden of the light mode: the team's own Frota Leve (frota-leve.js, run as the page runs it, on three r160 with the fake canvas)
 * builds a set of vehicles at both qualities and the numbers that identify each build are written to a fixture that `game-vehicles-three`
 * tests against. Run it again only when the source changes.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createContext, runInContext } from 'node:vm'

import { installPortableMath } from '@adatechnology/golden-tool'
import * as THREE from 'three'

import { fakeDocument } from './fake-dom'
import { LITE_GOLDEN_PATH, SOURCE_PATHS } from './paths'

/** The vehicles of the golden: the eight the design names and one more per group of the fleet. */
export const LITE_GOLDEN_KEYS = ['hatch', 'seda', 'picape', 'onibus', 'leopardo', 'moto', 'blackhawk', 'trator', 'suv', 'van', 'lancha', 'heli'] as const
export const LITE_GOLDEN_SEED = 7

const round = (x: number): number => Math.round(x * 1e4) / 1e4

const fnv = (values: ArrayLike<number>): string => {
  let h = 2166136261
  for (let i = 0; i < values.length; i++) {
    const v = Math.round((values[i] as number) * 1e4)
    h ^= v & 0xffff
    h = Math.imul(h, 16777619)
    h ^= (v >> 16) & 0xffff
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

const frotaLeveSource = (): string => {
  const text = readFileSync(SOURCE_PATHS.lightFleet, 'utf8')
  const start = text.indexOf('var FrotaLeve = (function () {')
  const end = text.indexOf('\n// ===== script 2')
  if (start < 0 || end < 0) throw new Error('record-lite: the FrotaLeve script was not found in the source')
  return text.slice(start, end)
}

type Built = { grupo: any; tris: number; drawCalls: number; L: number; W: number; H: number; podadas?: number; danificaveis: any[] }

export const recordLite = (): Record<string, unknown> => {
  const restore = installPortableMath()
  try {
    const sandbox: Record<string, unknown> = { document: fakeDocument, console, Math, WeakMap, Set, Map }
    sandbox.window = sandbox
    const context = createContext(sandbox)
    runInContext(`${frotaLeveSource()}\nthis.FrotaLeve = FrotaLeve`, context, { filename: 'frota-leve.js' })
    const api = (sandbox.FrotaLeve as any).criar({ THREE })
    const describe = (v: Built) => {
      const classes: Record<string, unknown> = {}
      v.grupo.traverse((m: any) => {
        if (!m.isMesh || !m.geometry.attributes.position) return
        const g = m.geometry
        classes[m.name || 'mesh'] = { vertices: g.attributes.position.count, indices: g.index ? g.index.count : 0, hash: fnv(g.attributes.position.array) }
      })
      return {
        tris: v.tris,
        drawCalls: v.drawCalls,
        L: v.L,
        W: v.W,
        H: v.H,
        pruned: v.podadas ?? 0,
        classes: v.grupo.children.length > 0 && Object.keys(classes).length > 1 ? classes : undefined,
        damageables: v.danificaveis.map((d) => ({
          material: d.tipo,
          zone: d.zona,
          part: d.parte,
          side: d.lado,
          min: [d.caixa.min.x, d.caixa.min.y, d.caixa.min.z].map(round),
          max: [d.caixa.max.x, d.caixa.max.y, d.caixa.max.z].map(round),
        })),
      }
    }
    const out: Record<string, unknown> = {}
    for (const key of LITE_GOLDEN_KEYS) {
      const lite = api.construir(key, { qualidade: 'jogo', semente: LITE_GOLDEN_SEED }) as Built & { cor: string }
      out[`${key}:lite`] = { color: (lite as any).cor, ...describe(lite) }
    }
    const high = api.construir('hatch', { qualidade: 'alta', semente: LITE_GOLDEN_SEED }) as Built & { cor: string }
    out['hatch:high'] = { color: (high as any).cor, ...describe(high) }
    return { seed: LITE_GOLDEN_SEED, vehicles: out }
  } finally {
    restore()
  }
}

if (process.argv[1]?.endsWith('record-lite.js')) {
  mkdirSync(dirname(LITE_GOLDEN_PATH), { recursive: true })
  writeFileSync(LITE_GOLDEN_PATH, `${JSON.stringify(recordLite(), null, 2)}\n`)
  process.stdout.write(`record-lite: wrote ${LITE_GOLDEN_PATH}\n`)
}
