import lifeNumbers from './data/life.json'
import type { NamePools } from './sheet/ruleset'
import type { Person, Role, Story } from './types'

/** Who plays each role, and everyone in the world after the casting (the people given, then the people it made). */
export type Casting = {
  readonly roles: Readonly<Record<string, string>>
  readonly people: readonly Person[]
  /** The role of a person the casting made, or the first role a given person plays. */
  readonly roleOf: (id: string) => string | undefined
}

export type CastOptions = {
  readonly stories: readonly Story[]
  readonly people?: readonly Person[]
  readonly names: NamePools
  readonly random: () => number
  /** The base of a made person whose role names none and has no bond (default the first base of a given person, else 'nomad'). */
  readonly defaultBase?: string
}

const fits = (person: Person, role: Role): boolean => {
  const needs = role.needs
  if (!needs) return true
  if (needs.sex && Boolean(person.female) !== (needs.sex === 'f')) return false
  if (needs.age && (person.age === undefined || person.age < needs.age[0] || person.age > needs.age[1])) return false
  if (needs.profession && (!person.profession || !needs.profession.includes(person.profession))) return false
  if (needs.base && person.base !== needs.base) return false
  if (needs.tags && !needs.tags.every((tag) => person.tags?.includes(tag))) return false
  return true
}

/**
 * Casts every story's roles at the world's creation (decision P9: who plays each role is drawn, so every game is different). A role the game pins
 * (`person`) is that person; another is drawn among the people not cast yet who fit its needs; with none (or `create`), a new person is made from the
 * name pools: the sex and age the role needs (else drawn as a newcomer's: half and half, 18 + 0..41 years), the bond's surname and base when the role
 * asks, the newcomer's personality draw. Roles with the same id in two stories are the same person: that is how stories cross.
 */
export function castStories(options: CastOptions): Casting {
  const R = options.random
  const pick = <T>(list: readonly T[]): T => list[Math.floor(R() * list.length)]!
  const people = [...(options.people ?? [])]
  const byId = new Map(people.map((person) => [person.id, person]))
  const roles: Record<string, string> = {}
  const made = new Map<string, string>()
  const taken = new Set<string>()
  const Q = lifeNumbers.personality
  const A = lifeNumbers.arrivals
  for (const story of options.stories) {
    for (const role of story.roles) {
      if (roles[role.id]) continue
      if (role.person) {
        if (!byId.has(role.person)) throw new Error(`game-stories: role "${role.id}" of "${story.id}" names "${role.person}", who is not among the people`)
        roles[role.id] = role.person
        taken.add(role.person)
        continue
      }
      const candidates = role.create ? [] : people.filter((person) => !taken.has(person.id) && !person.extra && fits(person, role))
      if (candidates.length > 0) {
        const chosen = pick(candidates)
        roles[role.id] = chosen.id
        taken.add(chosen.id)
        continue
      }
      const bond = role.bond ? byId.get(roles[role.bond.role] ?? '') : undefined
      const female = role.needs?.sex ? role.needs.sex === 'f' : R() < 0.5
      const first = pick(female ? options.names.female : options.names.male)
      const surname = role.bond?.sameSurname && bond ? bond.name.split(' ').filter((x) => !/[“”]/.test(x)).slice(-1)[0]! : pick(options.names.surnames)
      const range = role.needs?.age
      const age = range ? range[0] + Math.floor(R() * (range[1] - range[0] + 1)) : A.ageBase + Math.floor(R() * A.ageSpread)
      const base = role.needs?.base ?? (role.bond?.sameBase !== false && bond ? bond.base : (options.defaultBase ?? people[0]?.base ?? 'nomad'))
      const personality = [Q.base + R() * Q.spread, Q.base + R() * Q.spread, Q.base + R() * Q.spread, Q.greedBase + R() * Q.spread, Q.base + R() * Q.spread].map(Math.round)
      const person: Person = {
        id: role.id,
        name: `${first} ${surname}`,
        age,
        female,
        base,
        personality,
        role: role.id,
        generated: true,
        ...(role.needs?.profession?.length ? { profession: pick(role.needs.profession) } : {}),
        ...(role.tags ? { tags: role.tags } : {}),
        ...(bond ? { bond: bond.id } : {}),
        ...(role.bond?.relation ? { relation: role.bond.relation } : {}),
      }
      if (byId.has(person.id)) throw new Error(`game-stories: role "${role.id}" would make a person with the id of someone given`)
      people.push(person)
      byId.set(person.id, person)
      roles[role.id] = person.id
      taken.add(person.id)
      made.set(person.id, role.id)
    }
  }
  const firstRole = new Map<string, string>()
  for (const [role, id] of Object.entries(roles)) if (!firstRole.has(id)) firstRole.set(id, role)
  return { roles, people, roleOf: (id) => made.get(id) ?? firstRole.get(id) }
}
