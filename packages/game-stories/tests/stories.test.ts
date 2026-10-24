import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getNamePools } from '@adatechnology/game-characters-people'
import { describe, expect, it } from 'vitest'

import { castStories } from '../src/casting'
import { createSheet, drawSheet } from '../src/sheet/sheet'
import type { LifeOptions } from '../src/life/types'
import type { Person, Story } from '../src/types'
import { createStoryWorld, lifeNumbersOf, simulateStories } from '../src/world'

const SLICE = join(__dirname, '../../../specs/001-migracao-entregas-dos-times/game-slice/stories')
const slice = <T>(file: string): T => JSON.parse(readFileSync(join(SLICE, file), 'utf8')) as T
const names = getNamePools('pt-BR')
let state = 1
const random = () => ((state = (state * 16807) % 2147483647) / 2147483647)

describe('casting (P9)', () => {
  const people: Person[] = [
    { id: 'ana', name: 'Ana Lima', age: 30, female: true, base: 'a', profession: 'nurse' },
    { id: 'joao', name: 'João Souza', age: 61, base: 'a' },
    { id: 'rita', name: 'Rita Gomes', age: 44, female: true, base: 'b', profession: 'nurse' },
  ]
  it('pins, draws among those who fit and makes new people from the name pools when none fits', () => {
    const stories: Story[] = [
      {
        id: 's',
        roles: [
          { id: 'elder', person: 'joao' },
          { id: 'medic', needs: { profession: ['nurse'] } },
          { id: 'kid', needs: { age: [6, 9] } },
          { id: 'brother', create: true, needs: { sex: 'm', age: [58, 58] }, bond: { role: 'elder', relation: 'irmão', sameSurname: true } },
        ],
        beats: [],
      },
    ]
    const cast = castStories({ stories, people, names, random })
    expect(cast.roles.elder).toBe('joao')
    expect(['ana', 'rita']).toContain(cast.roles.medic)
    const kid = cast.people.find((p) => p.id === cast.roles.kid)!
    expect(kid.generated && kid.age! >= 6 && kid.age! <= 9).toBe(true)
    const brother = cast.people.find((p) => p.id === 'brother')!
    expect(brother.name.endsWith(' Souza') && brother.age === 58 && !brother.female && brother.base === 'a' && brother.relation === 'irmão').toBe(true)
    expect(names.male).toContain(brother.name.split(' ')[0])
  })

  it('casts the starting block roles of the slice: Rosa’s brother and Jéssica’s cousin, names drawn, the same seed the same names', () => {
    const cast = slice<Person[]>('cast.json')
    const roles = slice<Story>('roles.json')
    const world = (seed: number) => createStoryWorld({ people: cast, stories: [roles], seed })
    const a = world(4)
    const cicero = a.person('cicero')!
    const sandra = a.person('sandra')!
    expect([cicero.name.split(' ').at(-1), cicero.age, cicero.profession, cicero.base]).toEqual(['Tavares', 58, 'builder', 'aurora'])
    expect([sandra.name.split(' ').at(-1), sandra.age, sandra.female, sandra.profession]).toEqual(['Monteiro', 34, true, 'nurse'])
    expect(world(4).person('cicero')!.name).toBe(cicero.name)
    const drawn = new Set([1, 2, 3, 4, 5, 6].map((seed) => world(seed).person('sandra')!.name))
    expect(drawn.size).toBeGreaterThan(1)
  })
})

describe('beats as data', () => {
  const people: Person[] = ['a', 'b', 'c'].map((id) => ({ id, name: `${id.toUpperCase()} X`, age: 30, base: 'home' }))
  const story: Story = {
    id: 't',
    roles: [{ id: 'a', person: 'a' }],
    beats: [
      { id: 'one', day: 1, title: 'One', roles: ['a'], variants: [{ when: { action: 'help' }, alt: true, text: [{ name: 'a' }, ' helped.'], changes: [{ role: 'a', state: 'party', note: '' }] }, { text: ['Nobody came.'], flags: { alone: 1 } }] },
      { id: 'two', day: 2, title: 'Two', roles: ['a'], variants: [{ needsChanges: true, join: ' ', text: [{ when: { flag: 'alone' }, text: 'Alone.' }, { count: 'changes' }], changes: [{ each: { cast: true, except: ['a'], where: { state: 'self', is: 'ok' } }, change: { state: 'moved', note: 'left', base: 'away' } }] }] },
      { id: 'three', day: 3, title: 'Three', roles: ['a'], variants: [{ needsChanges: true, text: ['never'], changes: [{ when: { flag: 'nope' }, changes: [{ role: 'a', state: 'dead', note: '' }] }] }] },
    ],
  }
  it('takes the variant an action opens, joins pieces, counts changes and skips a beat that changes nobody', () => {
    const helped = simulateStories(3, { people, stories: [story], actions: { help: 1 } })
    expect(helped.chronicle.entries.map((e) => [e.id, e.text, e.alt ?? false])).toEqual([['one', 'A helped.', true], ['two', '2', false]])
    expect([helped.states.a!.state, helped.states.a!.base]).toEqual(['party', 'player'])
    const alone = simulateStories(3, { people, stories: [story] })
    expect(alone.chronicle.entries.map((e) => e.text)).toEqual(['Nobody came.', 'Alone. 2'])
    expect(alone.states.b).toEqual({ state: 'moved', note: 'left', base: 'away' })
    expect(alone.sheet('a').remembers('one')).toBe(true)
  })
  it('throws on a code beat nobody registered, and runs one that is', () => {
    const coded: Story = { id: 'c', roles: [], beats: [{ id: 'x', day: 1, title: 'X', roles: [], run: 'custom' }] }
    expect(() => simulateStories(1, { people, stories: [coded] })).toThrow(/custom/)
    const ran = simulateStories(1, { people, stories: [coded], codeBeats: { custom: () => ({ text: 'ran', changes: [{ id: 'c', state: 'dead', note: 'x' }] }) } })
    expect([ran.chronicle.entries[0]!.text, ran.states.c!.state]).toEqual(['ran', 'dead'])
  })
})

describe('the life simulation', () => {
  const groups = { farm: { name: 'Farm', defence: 0.2, food: 9 }, town: { name: 'Town', defence: 0.2, food: 9 }, nomad: { name: 'Road', defence: 0, food: 0 } }
  it('is a normal world by default: risks hurt, kill or lose people, never bite', () => {
    const changes = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) => simulateStories(90, { seed, life: { groups, nomadBase: 'nomad', placeRisk: { farm: 0.2, town: 0.2 } }, fill: 16 }).chronicle.entries.flatMap((e) => e.changes))
    expect(changes.some((c) => c.state === 'hurt')).toBe(true)
    expect(changes.some((c) => c.state === 'bitten' || c.state === 'undead')).toBe(false)
    const bitten = [1, 2, 3, 4].flatMap((seed) => simulateStories(90, { seed, life: { groups, nomadBase: 'nomad', placeRisk: { farm: 0.2, town: 0.2 }, numbers: { infection: true } }, fill: 16 }).chronicle.entries.flatMap((e) => e.changes))
    expect(bitten.some((c) => c.state === 'bitten')).toBe(true)
    expect(bitten.some((c) => c.state === 'undead')).toBe(true)
  })

  it('lets a couple of the same sex adopt an orphan (the rule the golden lives do not reach)', () => {
    const people: Person[] = [
      { id: 'm1', name: 'Paulo Lima', age: 40, base: 'farm', personality: [50, 50, 50, 50, 50] },
      { id: 'm2', name: 'Bruno Rocha', age: 42, base: 'farm', personality: [50, 50, 50, 50, 50] },
      { id: 'kids', name: 'as crianças', base: 'farm', extra: true },
    ]
    const life: LifeOptions = { groups: { ...groups, farm: { name: 'Farm', defence: 1, food: 60 } }, nomadBase: 'nomad', couples: [['m1', 'm2']], orphans: { kids: 'one of the kids' }, arrivals: false }
    const seeds = Array.from({ length: 60 }, (_, i) => i + 1)
    const adopted = seeds.map((seed) => simulateStories(90, { seed, people, life, locale: 'en' })).find((w) => w.chronicle.entries.some((e) => e.id === 'adoption'))
    expect(adopted?.chronicle.entries.find((e) => e.id === 'adoption')?.text).toBe('Paulo and Bruno adopt one of the kids.')
  })

  it('takes its numbers by patch and its texts by locale', () => {
    expect(lifeNumbersOf({ arrivals: { cap: 10 } }).arrivals).toMatchObject({ cap: 10, room: 8, every: 5 })
    const en = simulateStories(30, { seed: 2, people: [{ id: 'host', name: 'Rita Gomes', age: 40, female: true, base: 'farm' }], life: { groups, nomadBase: 'nomad' }, fill: 12, locale: 'en' })
    expect(en.chronicle.entries.some((e) => e.title === 'Arrival')).toBe(true)
  })
})

describe('the character sheet (P13)', () => {
  it('keeps 30 memories at most, the lightest goes; every entry stays in the history', () => {
    const sheet = createSheet()
    for (let day = 1; day <= 40; day++) sheet.record({ kind: 'event', id: `e${day}`, day, weight: day === 5 ? 100 : day })
    expect(sheet.memories).toHaveLength(30)
    expect(sheet.memories.some((m) => m.id === 'e5')).toBe(true)
    expect(sheet.memories.some((m) => m.id === 'e1')).toBe(false)
    expect(sheet.history).toHaveLength(40)
  })
  it('holds opinions in −100..100, joins at +60, hostile below −60, decaying to neutral', () => {
    const sheet = createSheet()
    expect(sheet.opine('p', 150)).toBe(100)
    expect(sheet.stance('p')).toBe('joins')
    sheet.opine('q', -60)
    expect(sheet.stance('q')).toBe('neutral')
    sheet.opine('q', -1)
    expect(sheet.stance('q')).toBe('hostile')
    sheet.decay(50)
    expect([sheet.opinions.p, sheet.opinions.q]).toEqual([50, -11])
  })
  it('draws a sheet that spends the whole pool inside the limits, the same way for the same stream', () => {
    let seed = 9
    const stream = () => ((seed = (seed * 48271) % 2147483647) / 2147483647)
    const sheet = drawSheet(stream, { profession: 'teacher' })
    expect([sheet.pool(), sheet.valid(), sheet.profession]).toEqual([0, true, 'teacher'])
    expect(sheet.skills).toMatchObject({ leadership: 1, chemistry: 1 })
    expect(createSheet({ profession: 'mechanic', skills: { mechanics: 3 } }).milestones('mechanics')).toEqual([0, 1])
  })
})
