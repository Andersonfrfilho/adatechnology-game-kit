import type { StoriesContent } from './module'

/**
 * The kit's example content for the bench (design question 2: no team delivery has stories that are not ZombiAdA's). Two tiny stories on generic
 * roles, a farm and a town: everything here is marked `example` and is only there so the bench runs without a game. A game loads its own content
 * (`module.load(content)`), for example the zombiada slice (`specs/…/game-slice/stories/`).
 */
const content = (t: {
  farm: string
  town: string
  nomads: string
  stranger: string
  stay: string
  stays: string
  goes: string
  well: string
  wellDry: string
  fixed: string
  carried: string
  welcome: string
  fixWell: string
  cousin: string
  arrives: [string, string, string]
  staysText: [string, string]
  goesText: [string, string]
  dryText: [string, string]
  fixedText: [string, string, string]
  carriedText: [string, string]
}): StoriesContent => ({
  example: true,
  days: 30,
  actions: [
    { id: 'welcome', name: t.welcome },
    { id: 'fix_well', name: t.fixWell },
  ],
  stories: [
    {
      id: 'stranger',
      example: true,
      roles: [
        { id: 'host', needs: { age: [30, 70], base: 'town' }, create: true },
        { id: 'newcomer', create: true, bond: { role: 'host', relation: t.cousin, sameSurname: false, sameBase: true } },
      ],
      beats: [
        { id: 'stranger_arrives', day: 3, title: t.stranger, roles: ['newcomer', 'host'], variants: [{ text: [{ name: 'newcomer' }, t.arrives[0], { name: 'host' }, t.arrives[1]] }] },
        {
          id: 'stranger_stays',
          day: 7,
          title: t.stay,
          roles: ['newcomer', 'host'],
          variants: [
            { when: { action: 'welcome' }, alt: true, text: [{ name: 'newcomer' }, t.staysText[0]], changes: [{ role: 'newcomer', state: 'ok', note: t.stays }] },
            { text: [{ name: 'newcomer' }, t.goesText[0]], changes: [{ role: 'newcomer', state: 'moved', note: t.goes, base: 'nomad' }] },
          ],
        },
      ],
    },
    {
      id: 'well',
      example: true,
      crosses: ['stranger'],
      roles: [{ id: 'keeper', needs: { base: 'farm' }, create: true }],
      beats: [
        { id: 'well_dry', day: 10, title: t.well, roles: ['keeper'], variants: [{ text: [{ name: 'keeper' }, t.dryText[0]], flags: { well_dry: 1 } }] },
        {
          id: 'well_after',
          day: 14,
          title: t.wellDry,
          roles: ['keeper', 'newcomer'],
          variants: [
            { when: { all: [{ action: 'fix_well' }, { living: 'newcomer' }, { state: 'newcomer', is: 'ok' }] }, alt: true, text: [{ name: 'newcomer' }, t.fixedText[0], { name: 'keeper' }, t.fixedText[1]], changes: [] },
            { text: [{ name: 'keeper' }, t.carriedText[0]], changes: [{ role: 'keeper', state: 'hurt', note: t.carried }] },
          ],
        },
      ],
    },
  ],
  life: {
    groups: { farm: { name: t.farm, defence: 0.5, food: 20 }, town: { name: t.town, defence: 0.4, food: 10 }, nomad: { name: t.nomads, defence: 0, food: 0 } },
    nomadBase: 'nomad',
  },
  fill: 14,
})

export const STORIES_EXAMPLE: Readonly<Record<'pt-BR' | 'en', StoriesContent>> = {
  'pt-BR': content({
    farm: 'Sítio (exemplo)',
    town: 'Vila (exemplo)',
    nomads: 'Estrada',
    stranger: 'Um estranho no portão',
    stay: 'Fica ou vai',
    stays: 'ficou',
    goes: 'seguiu pela estrada',
    well: 'O poço secou',
    wellDry: 'Depois do poço',
    fixed: 'consertou o poço',
    carried: 'carregou água de longe',
    welcome: 'Acolher o estranho',
    fixWell: 'Consertar o poço',
    cousin: 'primo',
    arrives: [' bate no portão de ', ' pedindo abrigo por uma noite.', ''],
    staysText: [' fica e passa a ajudar na horta.', ''],
    goesText: [' junta as coisas e segue pela estrada.', ''],
    dryText: [' acorda e o balde volta vazio do poço.', ''],
    fixedText: [' desce no poço com uma corda e destrava a bomba. ', ' agradece com um prato de comida.', ''],
    carriedText: [' passa a semana carregando água do rio e machuca as costas.', ''],
  }),
  en: content({
    farm: 'Farm (example)',
    town: 'Town (example)',
    nomads: 'Road',
    stranger: 'A stranger at the gate',
    stay: 'Stay or go',
    stays: 'stayed',
    goes: 'went down the road',
    well: 'The well ran dry',
    wellDry: 'After the well',
    fixed: 'fixed the well',
    carried: 'carried water from afar',
    welcome: 'Welcome the stranger',
    fixWell: 'Fix the well',
    cousin: 'cousin',
    arrives: [' knocks at the gate of ', ' asking for a night of shelter.', ''],
    staysText: [' stays and starts helping in the garden.', ''],
    goesText: [' packs up and goes down the road.', ''],
    dryText: [' wakes up and the bucket comes back empty from the well.', ''],
    fixedText: [' goes down the well on a rope and frees the pump. ', ' says thanks with a plate of food.', ''],
    carriedText: [' spends the week carrying water from the river and hurts their back.', ''],
  }),
}
