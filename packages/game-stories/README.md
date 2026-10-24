# @adatechnology/game-stories

Stories as data for games, pure and seeded: stories of beats with roles, conditions, text pieces and changes; the casting that decides who plays each
role; the chronicle; the character sheet that keeps everything a person lived; and the life simulation that runs between the stories (people get hurt,
fall in love, have children, fight, betray, trade, are raided and arrive). No three.js, no game content: the game gives the people, the stories and the
places, and reads the chronicle and the sheets.

It is a literal port of two team deliveries:

- **Os Vivos do Vale** (`site/pages/sobreviventes/os-vivos-do-vale.html`): `life()`, `simulate()` and the event engine (`EV`, `ACTS`, `fill`), made
  generic. The valley's people and its 47 events are not here: they are the zombiada slice (`specs/001-migracao-entregas-dos-times/game-slice/stories/`).
- **Personagens** (`site/pages/zumbis-personagens/personagens.html`): the sheet (point buy, derived values, skills and milestones, memory and opinion).
  The ruleset itself (attributes, skills, professions, traits, formulas) and the name pools are content in `@adatechnology/game-characters-people`.

The golden `game-stories-life.json` (7 full lives line by line, 40 more by hash, 96 sets of player actions without the life simulation and 48 sheets,
all recorded by running the team code in `node:vm` with `tools/characters-catalog`) is replayed by the tests.

- **The normal world comes first.** `life.numbers.infection` is `false` by default: an outing can hurt or kill, nobody is bitten and nobody turns.
  `infection: true` turns on the team's bitten band and the turn after two days.
- **Everything is a number with its source** (`LIFE_DEFAULTS`, `SHEET_DEFAULTS`) and every text is a table (`LIFE_TEXT`, `pt-BR` word for word and
  `en`); a game patches what it wants through `life.numbers` and `life.text`.
- **Stories cross** by role: a role with the same id in two stories is one person, and a beat reads the states, flags, actions and what each person
  remembers.
- **Casting (P9)**: a role is a pinned person, or someone who fits its needs, or a person made from the name pools. It draws from its own stream, so the
  life simulation keeps the team's sequence.

## Install

```sh
pnpm add @adatechnology/game-stories
```

Browser without a bundler (the global is `GameStories`):

```html
<script src="https://unpkg.com/@adatechnology/game-stories/dist/index.global.js"></script>
```

## Usage

```ts
import { createStoryWorld, createSheet } from '@adatechnology/game-stories'

const world = createStoryWorld({ people, stories, life: { groups, relations, couples }, fill: 80, seed: 7, locale: 'pt-BR' })
world.act('fix_well') // a player action: the stories read it from today on
world.runTo(30)
world.chronicle.entries // every line, by day
world.states // the state of every person: ok, hurt, dead, missing, party, hostile, moved, left...
const sheet = world.sheet(world.cast('keeper')) // the same world, the same sheet
sheet.history // the stories and events the person lived
sheet.derived() // max health, stamina, load, running speed... from the ruleset

const mine = createSheet({ profession: 'nurse', attributes: { agility: 6 }, traits: ['athlete'] })
mine.pool() // points left of the 14
```

A story:

```ts
{
  id: 'well',
  roles: [{ id: 'keeper', needs: { base: 'farm' }, create: true }],
  beats: [
    { id: 'well_dry', day: 10, roles: ['keeper'], variants: [{ text: [{ name: 'keeper' }, ' finds the well dry.'], flags: { well_dry: 1 } }] },
    {
      id: 'well_after', day: 14, roles: ['keeper', 'newcomer'],
      variants: [
        { when: { all: [{ action: 'fix_well' }, { living: 'newcomer' }] }, text: [{ name: 'newcomer' }, ' fixes the pump.'] },
        { text: [{ name: 'keeper' }, ' carries water from the river.'], changes: [{ role: 'keeper', state: 'hurt' }] },
      ],
    },
  ],
}
```

## Test area

`createStoriesTestModule()` (`stories_area`, only the generic contracts) puts the seed, the day, the life simulation, the infection layer, the player
actions and a person's sheet on the bench, with six scenarios (determinism, casting, the normal world, the sheet keeps what was lived, the point buy and
two stories crossing). It runs the kit's example content (two small stories on a farm and a town, marked `example`) until a game loads its own
(`module.load(content)`). `examples/stories-test-area` loads it into the shared test room (`sala-historias.html`, with a button for a JSON file such as the
zombiada slice), and `examples/interactables-test-area` carries it too.

## Em português

Histórias como dados, determinísticas por semente: histórias de momentos com papéis, condições, pedaços de texto e mudanças; a escalação de quem faz
cada papel; a crônica; a ficha que guarda tudo o que a pessoa viveu; e a vida sorteada entre as histórias. Porte literal de Os Vivos do Vale (`life()`,
`simulate()`, eventos) e da ficha de Personagens. O mundo normal vem primeiro (sem mordida por padrão). O conteúdo do vale (as 45 pessoas e os 47
eventos) fica no repositório do jogo; o kit traz só um exemplo marcado `example`.
