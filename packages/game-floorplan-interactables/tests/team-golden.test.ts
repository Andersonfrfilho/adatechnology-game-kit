import { describe, expect, it } from 'vitest'

import { create } from '../src'
import { GameInteractables, GameInteractablesHousehold, planOf, TEMPLATES } from './support/plans'
import { loadTeamAdapter, normalizeWorld, planToKit, teamSeedKey, teamShape, toKit, withoutSource } from './support/team-shape'

// The team's own `AdaptadorInterativos` (tests/fixtures/team-golden/adaptador-interativos.js, the IIFE of the page, byte for byte) runs in a vm on the team's `res` rebuilt from
// the plan of the kit; the port runs on the plan itself. Both answers must be the same after the renaming of MIGRATION.md.
const Team = loadTeamAdapter()
const kit = { GameInteractables, GameInteractablesHousehold }
const teamAdapter = Team.criar({ ...kit, locale: 'pt-BR', regiao: 'br' })
const adapter = create({ ...kit, locale: 'pt-BR', region: 'br', seedKey: teamSeedKey })

const CASES: [string, number, string][] = []
for (const t of TEMPLATES) for (const seed of [1, 2, 3]) CASES.push([t, seed, 'normal'])
for (const t of ['single_storey_a', 'townhouse', 'mansion', 'market']) for (const state of ['fortified', 'abandoned']) CASES.push([t, 5, state])

const planned = (template: string, seed: number, state: string, popts: Record<string, unknown> = {}) => {
  const r = planOf(template, seed, state)
  const res = teamShape(r)
  const mine = adapter.plan(r, { seed: r.seed, ...popts })
  const team = planToKit(teamAdapter.planejar(res, { semente: res.semente, ...(popts.night ? { noite: true } : {}), ...(popts.floor !== undefined ? { andar: popts.floor } : {}) }))
  return { r, res, mine, team }
}

describe('the tables are the team\'s', () => {
  it('has the same number of furniture types, content ids by legacy and group fallbacks as the IIFE', () => {
    expect(Object.keys(Team.MAPA_TIPOS).length).toBe(Object.keys(adapter.registries.typeMap).length)
    expect(Object.values(Team.MAPA_TIPOS).map((m: any) => JSON.stringify({ t: m.t ?? null, c: m.composto ?? null, v: m.variant ?? null, w: m.watts ?? null })).sort()).toEqual(
      Object.values<any>(adapter.registries.typeMap).map((m) => JSON.stringify({ t: m.type ?? null, c: ({ sink: 'pia', basin: 'pia_b', rustic_sink: 'pia_rustica' } as any)[m.compound] ?? null, v: m.variant ?? null, w: m.watts ?? null })).sort(),
    )
    expect(Object.keys(Team.CONTEUDO_POR_CATEGORIA).length).toBe(Object.keys(adapter.registries.contentByGroup).length)
    // every household item the team's table points to is reached by the kit's table, or is a household item itself (the id stays)
    const targets = new Set<string>(Object.values(adapter.registries.contentMap) as string[])
    for (const household of Object.values<string>(Team.MAPA_CONTEUDO)) expect(targets.has(household) || !!adapter.household.items[household], household).toBe(true)
  })
})

describe('plan: the same objects as the team\'s adapter, house by house', () => {
  for (const [template, seed, state] of CASES) {
    it(`${template} seed ${seed} ${state}`, () => {
      const { mine, team } = planned(template, seed, state)
      expect(mine.items.length).toBeGreaterThan(0)
      expect(withoutSource(JSON.parse(JSON.stringify(mine)))).toEqual(withoutSource(JSON.parse(JSON.stringify(team))))
    })
  }

  it('at night, on one floor, with the lamps decided by a function', () => {
    for (const [template, seed] of [['townhouse', 2], ['log_cabin', 1], ['campsite', 2], ['mansion', 3]] as const) {
      for (const popts of [{ night: true }, { floor: 0 }, { floor: 1, night: true }]) {
        const { mine, team } = planned(template, seed, 'normal', popts)
        expect(withoutSource(JSON.parse(JSON.stringify(mine))), `${template} ${JSON.stringify(popts)}`).toEqual(withoutSource(JSON.parse(JSON.stringify(team))))
      }
    }
  })

  it('the stacks keep the item they came from in data.source', () => {
    const r = planOf('single_storey_a', 3)
    const mine = adapter.plan(r, { seed: r.seed })
    const fridge = mine.items.find((e: any) => e.type === 'fridge')
    const ids = new Set(r.contents['kitchen.fridge'].map((s: any) => s.itemId))
    const placed = Object.values<any>(fridge.item.contents).flat().filter(Boolean)
    expect(placed.length).toBeGreaterThan(0)
    for (const stack of placed) expect(ids.has(stack.data.source)).toBe(true)
  })
})

describe('world and add: the same world, door by door', () => {
  for (const [template, seed, state] of [['single_storey_a', 3, 'normal'], ['townhouse', 2, 'normal'], ['mansion', 1, 'normal'], ['log_cabin', 2, 'normal'], ['campsite', 1, 'normal'], ['shack', 1, 'abandoned'], ['market', 2, 'normal']] as const) {
    it(`${template} seed ${seed} ${state}`, () => {
      const { r, res, mine, team } = planned(template, seed, state, { night: true })
      const worldMine = adapter.createWorld(r, { seed: r.seed })
      const worldTeam = teamAdapter.criarMundo(res, { semente: res.semente })
      const outMine = adapter.add(worldMine, mine, { isBlocked: adapter.blockedOf(r) })
      const teamPlan = teamAdapter.planejar(res, { semente: res.semente, noite: true })
      const outTeam = toKit(teamAdapter.adicionar(worldTeam, teamPlan, { bloqueado: teamAdapter.bloqueadoDe(res) }))
      expect(JSON.parse(JSON.stringify(outMine))).toEqual(JSON.parse(JSON.stringify(outTeam)))
      expect(mine.items.length).toBe(team.items.length)
      const mineWorld = normalizeWorld(JSON.parse(JSON.stringify(worldMine.serialize())))
      const teamWorld = normalizeWorld(JSON.parse(JSON.stringify(worldTeam.serialize())))
      expect(Object.keys(mineWorld.objects).length).toBe(mine.items.length)
      expect(mineWorld).toEqual(teamWorld)
    })
  }

  it('the walls: blockedOf answers like bloqueadoDe on a grid of points', () => {
    const r = planOf('townhouse', 2)
    const res = teamShape(r)
    const a = adapter.blockedOf(r, { originX: 3, originZ: -2 })
    const b = teamAdapter.bloqueadoDe(res, { origemX: 3, origemZ: -2 })
    let inside = 0
    for (let x = -2; x < 20; x += 0.13) for (let z = -8; z < 20; z += 0.13) for (const floor of [0, 1, -1]) {
      const va = a(x, z, floor)
      if (va) inside++
      expect(va).toBe(b(x, z, floor))
    }
    expect(inside).toBeGreaterThan(100)
  })
})
