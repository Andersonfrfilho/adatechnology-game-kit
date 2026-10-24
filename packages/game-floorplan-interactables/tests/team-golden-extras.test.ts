import { createGoodsFindsProvider, createGoodsItems } from '@adatechnology/game-items-goods'
import { describe, expect, it } from 'vitest'

import { create } from '../src'
import { engine, GameInteractables, GameInteractablesHousehold, planOf } from './support/plans'
import { loadTeamAdapter, normalizeWorld, planToKit, teamSeedKey, teamShape, withoutSource } from './support/team-shape'

// More of the same comparison with the team's IIFE: a chimney (the kit's plan has none from any template yet, so the test gives the plan one), and the contents the goods
// catalog answers (ids of `game-items-goods`, without group or pickable).
const Team = loadTeamAdapter()
const kit = { GameInteractables, GameInteractablesHousehold }
const teamAdapter = Team.criar({ ...kit })
const adapter = create({ ...kit, seedKey: teamSeedKey })
const clean = (v: any) => withoutSource(JSON.parse(JSON.stringify(v)))

function same(r: any, popts: Record<string, unknown> = {}) {
  const res = teamShape(r)
  const mine = adapter.plan(r, { seed: r.seed, ...popts })
  const team = planToKit(teamAdapter.planejar(res, { semente: res.semente, ...(popts.night ? { noite: true } : {}) }))
  expect(clean(mine)).toEqual(clean(team))
  const worldMine = adapter.createWorld(r, { seed: r.seed })
  const worldTeam = teamAdapter.criarMundo(res, { semente: res.semente })
  adapter.add(worldMine, mine, { isBlocked: adapter.blockedOf(r) })
  teamAdapter.adicionar(worldTeam, teamAdapter.planejar(res, { semente: res.semente, ...(popts.night ? { noite: true } : {}) }), { bloqueado: teamAdapter.bloqueadoDe(res) })
  expect(normalizeWorld(JSON.parse(JSON.stringify(worldMine.serialize())))).toEqual(normalizeWorld(JSON.parse(JSON.stringify(worldTeam.serialize()))))
  return mine
}

describe('chimney: the smoke of the fireplace and the flue of the wood stove reach the top of the chimney', () => {
  it('fireplace', () => {
    let seen = 0
    for (const [template, seed, extra] of [['wood_frame_house', 1, { fireplace: true }], ['wood_frame_house', 2, { fireplace: true }], ['a_frame_chalet', 3, { fireplace: true }]] as const) {
      const r = planOf(template, seed, 'normal', extra)
      const fire = r.items.find((m: any) => m.type === 'fireplace')
      if (!fire) continue
      seen++
      r.structureExtras = { ...(r.structureExtras || {}), chimney: { kind: 'fireplace', material: 'stone', aabb: [fire.x + 0.6, fire.z - 0.4, fire.x + 1.4, fire.z + 0.4], height: 7.4 } }
      const mine = same(r)
      const entry = mine.items.find((e: any) => e.type === 'fireplace')
      expect(entry.connections.chimneyTop).toBeDefined()
      expect(entry.connections.chimneyTop[1]).toBe(7.4)
      expect(entry.item.variant).toBe('stone')
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('wood stove', () => {
    let seen = 0
    for (const seed of [1, 2, 3, 4]) {
      const r = planOf('log_cabin', seed)
      const stove = r.items.find((m: any) => m.type === 'wood_stove')
      if (!stove) continue
      seen++
      r.structureExtras = { ...(r.structureExtras || {}), chimney: { kind: 'flue', material: 'steel', aabb: [stove.x, stove.z, stove.x + 0.2, stove.z + 0.2], flue: true, height: 4.1 } }
      const mine = same(r)
      const entry = mine.items.find((e: any) => e.type === 'wood_stove')
      expect(entry.item.flueHeight).toBe(Math.round((4.1 - (stove.y || 0)) * 1000) / 1000)
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('a chimney that names its item (fireplace / stove) is matched by id', () => {
    const r = planOf('wood_frame_house', 1, 'normal', { fireplace: true })
    const fire = r.items.find((m: any) => m.type === 'fireplace')
    if (!fire) return
    r.structureExtras = { chimney: { kind: 'fireplace', material: 'brick', aabb: [0, 0, 1, 1], height: 6, fireplace: 'nobody' } }
    const mine = adapter.plan(r, { seed: r.seed })
    expect(mine.items.find((e: any) => e.type === 'fireplace').connections.chimneyTop).toBeUndefined()
    r.structureExtras.chimney.fireplace = fire.id
    expect(adapter.plan(r, { seed: r.seed }).items.find((e: any) => e.type === 'fireplace').connections.chimneyTop).toBeDefined()
  })
})

describe('the contents the goods catalog answers', () => {
  it('are stored like the team\'s stacks', () => {
    engine.registerFindsProvider(createGoodsFindsProvider(createGoodsItems()))
    let stacks = 0
    for (const [template, seed, state] of [['single_storey_a', 1, 'normal'], ['townhouse', 2, 'fortified'], ['mansion', 3, 'abandoned'], ['market', 1, 'normal'], ['log_cabin', 2, 'normal']] as const) {
      const r = planOf(template, seed, state)
      const mine = same(r)
      for (const e of mine.items) for (const list of Object.values<any>(e.item.contents || {})) stacks += list.filter(Boolean).length
    }
    expect(stacks).toBeGreaterThan(20)
  })
})
