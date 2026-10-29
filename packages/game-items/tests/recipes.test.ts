import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { canCraft, craft } from '../src'
import type { CraftContext, ItemDef, RecipeDef } from '../src'
import { item, makeCatalog, sequence } from './fixtures'

const catalog = makeCatalog([
  item('wooden_plank', { category: 'materials' }),
  item('nails', { category: 'materials' }),
  item('hammer', { category: 'tools' }),
  item('rag', { category: 'materials' }),
  item('tshirt', { category: 'clothing' }),
  item('jeans', { category: 'clothing' }),
  item('rice', { cookable: true }),
  item('potatoes', { cookable: true }),
  item('salt'),
  item('sugar'),
])

const barricade: RecipeDef = {
  id: 'window_barricade',
  inputs: [{ item: 'wooden_plank', qty: 2 }, { item: 'nails', qty: 8 }],
  tools: [{ anyOf: ['hammer'] }],
  skill: { id: 'carpentry', level: 2 },
  seconds: 8,
  output: { effect: 'window_barricade', params: {}, text: 'Window with 200 life.' },
}
const rags: RecipeDef = { id: 'rags', inputs: [{ match: { category: 'clothing' }, qty: 1 }], tools: [{ anyOf: [] }], seconds: 4, output: { item: 'rag', qty: [2, 4] } }

const context = (inventory: Record<string, number>, extra: Partial<CraftContext> = {}): CraftContext => ({ catalog, inventory: new Map(Object.entries(inventory)), ...extra })
const supplies = { wooden_plank: 3, nails: 10, hammer: 1 }

describe('canCraft', () => {
  it('passes with the inputs and the tool', () => {
    expect(canCraft(barricade, context(supplies))).toEqual({ isPossible: true, missing: [] })
  })

  it('lists everything missing', () => {
    expect(canCraft(barricade, context({ wooden_plank: 1, nails: 10 })).missing).toEqual(['tool:hammer', 'item:wooden_plank'])
  })

  it('ignores the skill when the host does not pass skills, and checks it when it does', () => {
    expect(canCraft(barricade, context(supplies)).isPossible).toBe(true)
    expect(canCraft(barricade, context(supplies, { skills: { carpentry: 1 } })).missing).toEqual(['skill:carpentry:2'])
    expect(canCraft(barricade, context(supplies, { skills: { carpentry: 2 } })).isPossible).toBe(true)
    expect(canCraft(barricade, context(supplies, { skills: {} })).missing).toEqual(['skill:carpentry:2'])
  })

  it('checks unlockedBy only when the host passes unlocked', () => {
    const secret = { ...barricade, skill: undefined, unlockedBy: 'diy_magazine' } as RecipeDef
    expect(canCraft(secret, context(supplies)).isPossible).toBe(true)
    expect(canCraft(secret, context(supplies, { unlocked: new Set() })).missing).toEqual(['unlock:diy_magazine'])
    expect(canCraft(secret, context(supplies, { unlocked: new Set(['diy_magazine']) })).isPossible).toBe(true)
  })

  it('treats a fire as a station that must be near, and water as litres', () => {
    const soup: RecipeDef = { id: 'soup', inputs: [{ fluid: 'water', liters: 0.5 }, { match: { cookable: true }, qty: 2 }], tools: [{ anyOf: [], world: ['fire'] }], seconds: 60, output: { effect: 'soup', params: {} } }
    const have = { rice: 1, potatoes: 1 }
    expect(canCraft(soup, context(have)).missing).toEqual(['world:fire', 'fluid:water'])
    expect(canCraft(soup, context(have, { world: new Set(['fire']), fluids: { water: 0.4 } })).missing).toEqual(['fluid:water'])
    expect(canCraft(soup, context(have, { world: new Set(['fire']), fluids: { water: 1 } })).isPossible).toBe(true)
    expect(canCraft(soup, context({ rice: 1 }, { world: new Set(['fire']), fluids: { water: 1 } })).missing).toEqual(['match:cookable'])
  })

  it('accepts any of several items, summing them toward the quantity', () => {
    const preserves: RecipeDef = { id: 'preserves', inputs: [{ any: ['salt', 'sugar'], qty: 2 }], tools: [], seconds: 1, output: { effect: 'x', params: {} } }
    expect(canCraft(preserves, context({ salt: 1 })).missing).toEqual(['any:salt|sugar'])
    expect(canCraft(preserves, context({ salt: 1, sugar: 1 })).isPossible).toBe(true)
  })

  it('treats a thing of the world as something that must be near', () => {
    const sandbag: RecipeDef = { id: 'sandbag', inputs: [{ world: ['soil'] }], tools: [], seconds: 1, output: { effect: 'x', params: {} } }
    expect(canCraft(sandbag, context({})).missing).toEqual(['world:soil'])
    expect(canCraft(sandbag, context({}, { world: new Set(['soil']) })).isPossible).toBe(true)
  })
})

describe('craft', () => {
  it('returns what is consumed and the effect for the host to handle', () => {
    expect(craft(barricade, context(supplies), () => 0)).toEqual({
      isCrafted: true,
      seconds: 8,
      consumed: [{ item: 'wooden_plank', count: 2 }, { item: 'nails', count: 8 }],
      output: { effect: 'window_barricade', params: {}, text: 'Window with 200 life.' },
    })
  })

  it('draws the output quantity from its range, in catalog order for a match', () => {
    const result = craft(rags, context({ jeans: 1, tshirt: 3 }), sequence(0.99))
    expect(result).toMatchObject({ isCrafted: true, consumed: [{ item: 'tshirt', count: 1 }], output: { item: 'rag', count: 4 } })
    expect(craft(rags, context({ tshirt: 1 }), sequence(0))).toMatchObject({ output: { item: 'rag', count: 2 } })
  })

  it('refuses with the missing list and consumes nothing', () => {
    expect(craft(barricade, context({}), () => 0)).toEqual({ isCrafted: false, missing: ['tool:hammer', 'item:wooden_plank', 'item:nails'] })
  })
})

describe('with the 33 recipes read from the team page', () => {
  const recipes = JSON.parse(readFileSync(new URL('../../game-items-goods/src/data/recipes.json', import.meta.url), 'utf8')) as RecipeDef[]

  it('can make every recipe with the whole catalog at hand, a fire, the world things and water', () => {
    const goods = JSON.parse(readFileSync(new URL('../../game-items-goods/src/data/items.json', import.meta.url), 'utf8')) as ItemDef[]
    const full = makeCatalog(goods)
    const everything = new Map(goods.map((entry) => [entry.id, 99]))
    const world = new Set(recipes.flatMap((recipe) => [...recipe.inputs.flatMap((input) => input.world ?? []), ...recipe.tools.flatMap((tool) => tool.world ?? [])]))
    expect(recipes).toHaveLength(33)
    for (const recipe of recipes) expect(canCraft(recipe, { catalog: full, inventory: everything, world, fluids: { water: 99 } }), recipe.id).toEqual({ isPossible: true, missing: [] })
  })

  it('crafts the window barricade of the page with plank, nails and hammer, ignoring the skill', () => {
    const recipe = recipes.find((entry) => entry.id === 'window_barricade') as RecipeDef
    expect(craft(recipe, context(supplies), () => 0)).toMatchObject({ isCrafted: true, output: { effect: 'window_barricade' } })
  })
})
