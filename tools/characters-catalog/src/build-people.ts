import type { Decisions } from './decisions'
import type { ElencoData, Profession } from './extract-elenco'
import type { AccessoryRow, Extra, PeopleBody, PortraitBody } from './extract-people'

export type PeopleInputs = {
  readonly elenco: ElencoData
  readonly bodies: readonly PeopleBody[]
  readonly accessories: readonly AccessoryRow[]
  readonly decisions: Decisions
}

const hex = (color: number): string => color.toString(16).toUpperCase().padStart(6, '0')

const missing = (what: string, key: string): never => {
  throw new Error(`characters-catalog: no ${what} for "${key}" in decisions.json`)
}

/** `Profissão · −2 pontos`: the points the page prints for the profession in character creation. */
const POINTS = /([+−-]?\d+) pontos?/

const pointsOf = (profession: Profession): number => {
  const match = POINTS.exec(profession.sub)
  if (!match) return missing('points in the subtitle', profession.n)
  return Number((match[1] ?? '0').replace('−', '-'))
}

const accessoryOf = ([id, color]: Extra): { id: string; color?: string } => ({ id, ...(color === undefined ? {} : { color: hex(color) }) })

export const buildProfessions = ({ elenco, decisions }: PeopleInputs): unknown[] =>
  elenco.professions.map((profession, index) => {
    const id = decisions.professionIds.value[index] ?? missing('profession id', String(index))
    const raw = profession as unknown as PortraitBody
    return {
      id,
      name: { en: decisions.professionNames.value[id] ?? missing('profession name', id), 'pt-BR': profession.n },
      ...(profession.fem ? { female: true } : {}),
      points: pointsOf(profession),
      protection: decisions.professionProtection.value[id] ?? [],
      look: {
        skin: hex(profession.skin),
        hair: { style: profession.hair.s, color: hex(profession.hair.c) },
        ...(profession.hat ? { hat: { kind: profession.hat.k, color: hex(profession.hat.c) } } : {}),
        ...(raw.face ? { face: raw.face } : {}),
        top: { color: hex(raw.top.c), sleeve: raw.top.sl, ...(raw.top.plaid === undefined ? {} : { plaid: hex(raw.top.plaid) }) },
        pants: { color: hex(raw.pants.c) },
        shoes: hex(raw.shoes),
      },
      accessories: (raw.ex ?? []).map(accessoryOf),
      ...(profession.hand ? { hand: profession.hand } : {}),
      ...(raw.lhand ? { leftHand: raw.lhand } : {}),
      carries: { en: decisions.professionCarries.value[id] ?? missing('profession carries', id), 'pt-BR': profession.kit.replace(/^Leva: |^Carrega: /, '') },
    }
  })

const range = (values: readonly number[]): [number, number] => [Math.min(...values), Math.max(...values)]

/** Height, build and hunch ranges of each age group, read from the named people of the portraits page (the neutral 1 / 1 / 0 where a body has none). */
export const buildAgePresets = ({ bodies, decisions }: PeopleInputs): unknown[] =>
  decisions.ageGroups.value.map((group, index) => {
    const lower = index === 0 ? -1 : (decisions.ageGroups.value[index - 1]?.maxYears ?? -1)
    const inGroup = bodies.filter((entry) => (group.id === 'child' ? entry.isChild : !entry.isChild && entry.years !== undefined && entry.years > lower && entry.years <= group.maxYears))
    const of = (pick: (body: PortraitBody) => number | undefined, neutral: number): number[] => inGroup.map((entry) => pick(entry.body) ?? neutral)
    return {
      id: group.id,
      count: inGroup.length,
      height: range(of((body) => body.h, 1)),
      build: range(of((body) => body.bulk, 1)),
      hunch: range(of((body) => body.hunch, 0)),
    }
  })

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort()

/** The pools a game draws a generic person from: every value the professions and the 44 named people use. */
export const buildAppearance = ({ elenco, bodies }: PeopleInputs): unknown => {
  const all: readonly PortraitBody[] = [...(elenco.professions as unknown as readonly PortraitBody[]), ...bodies.map((entry) => entry.body)]
  return {
    skinTones: sorted(all.map((body) => hex(body.skin))),
    hairStyles: sorted(all.map((body) => body.hair.s)),
    hairColors: sorted(all.map((body) => hex(body.hair.c))),
    hatKinds: sorted(all.flatMap((body) => (body.hat ? [body.hat.k] : []))),
    hatColors: sorted(all.flatMap((body) => (body.hat ? [hex(body.hat.c)] : []))),
    faceFeatures: sorted(all.flatMap((body) => body.face ?? [])),
    sleeves: sorted(all.map((body) => body.top.sl)),
    topColors: sorted(all.map((body) => hex(body.top.c))),
    pantsColors: sorted(all.map((body) => hex(body.pants.c))),
    shoeColors: sorted(all.map((body) => hex(body.shoes))),
  }
}

export const buildAccessories = ({ accessories, decisions }: PeopleInputs): unknown =>
  accessories.map((row) => ({ id: row.id, slot: row.slot, slotName: decisions.accessorySlots.value[row.slot] ?? missing('accessory slot', row.slot) }))
