import { holds } from '../conditions'
import type { ConditionContext } from '../conditions'
import type { NamePools } from '../sheet/ruleset'
import { setState } from '../story/apply'
import { fillText, shortName } from '../text'
import type { Actions, ChronicleEntry, Flags, Person, ResolvedChange, StateId, States } from '../types'
import type { LifeNumbers, LifeOptions, LifeRule, LifeText, LifeWorld } from './types'

/** What the life simulation reads of the world around it. */
export type LifeHost = {
  readonly states: States
  readonly flags: Flags
  readonly actions: Actions
  /** The people the world started with (named or cast), by id, in order. */
  readonly people: Readonly<Record<string, Person>>
  /** The days on which each person has a story beat (the team's `EV.some(e => e.who.includes(id) && …)`). */
  readonly beatDays: (id: string) => readonly number[]
  readonly random: () => number
  readonly names: NamePools
  readonly numbers: LifeNumbers
  readonly text: LifeText
  readonly options: LifeOptions
  readonly log: (entry: ChronicleEntry) => void
}

type Row = readonly [string, StateId, string, string?]
const toChanges = (rows: readonly Row[]): ResolvedChange[] => rows.map(([id, state, note, base]) => ({ id, state, note, ...(base ? { base } : {}) }))

/** The world of the life simulation at its start (Os Vivos do Vale `world`, lines 619-622). */
export function createLifeWorld(options: LifeOptions, numbers: LifeNumbers): LifeWorld {
  const W: LifeWorld = {
    raid: {}, food: {}, defence: {}, affinity: {}, partner: {}, rival: {}, adopted: {}, timers: {}, made: {}, count: 0, lastNews: {},
    stats: { births: 0, arrivals: 0, deaths: 0, couples: 0, fights: 0, betrayals: 0, caravans: 0, raids: 0, pregnancies: 0 },
    usedNames: new Set(),
  }
  for (const [id, group] of Object.entries(options.groups)) {
    W.food[id] = group.food
    W.defence[id] = group.defence
  }
  W.defence[options.playerBase ?? 'player'] = 1
  for (const [a, b, kind] of options.relations ?? []) if (kind === numbers.rivalKind) W.rival[a < b ? `${a}|${b}` : `${b}|${a}`] = 1
  for (const [a, b] of options.couples ?? []) {
    W.partner[a] = b
    W.partner[b] = a
  }
  return W
}

/**
 * One day of the life simulation (Os Vivos do Vale `life(d, S, F, R, W, log)`, lines 623-739), rule by rule and draw by draw: the clocks (healing,
 * turning, coming back, giving birth), the daily risk, the bonds inside each base (couples, pregnancy, adoption, rivalry, fights, betrayal), food,
 * caravans and raids between bases, and the newcomers every few days.
 */
export function lifeDay(d: number, W: LifeWorld, host: LifeHost): void {
  const { states: S, flags: F, random: R, numbers: N, text: T, options: O } = host
  const nomad = O.nomadBase ?? 'nomad'
  const playerBase = O.playerBase ?? 'player'
  const closed = new Set([nomad, ...(O.closedBases ?? [])])
  const groups = O.groups
  const P = (id: string): Person => host.people[id] ?? W.made[id]!
  const age = (id: string): number => P(id).age ?? N.unknownAge
  const fem = (id: string): boolean => Boolean(P(id).female)
  const nm = (id: string): string => P(id).nick ?? shortName(P(id).name, T.honorifics)
  const o = (id: string): string => (fem(id) ? T.gender.female : T.gender.male)
  const pers = (id: string): readonly number[] => {
    const p = P(id).personality
    return p && p.some((v) => v) ? p : [50, 50, 50, 50, 50]
  }
  const groupName = (b: string | undefined, fallback: string): string => (b !== undefined && groups[b] ? groups[b]!.name : fallback)
  const conditionContext = (): ConditionContext => ({ states: S, flags: F, actions: host.actions, cast: (id) => id, living: N.livingStates })
  const anchorDays = (id: string, from: number, to: number): boolean => host.beatDays(id).some((day) => day > from && day <= to)
  const anchor = (id: string): boolean =>
    anchorDays(id, d, d + 7) || Boolean(W.timers[id]?.due) || (O.anchors ?? []).some((a) => a.id === id && d < a.beforeDay) || Boolean(W.made[id]?.baby)
  const alive = (id: string): boolean => N.activeStates.includes(S[id]!.state)
  const ids = Object.keys(S).filter((id) => alive(id) && age(id) > 0)
  const set = (id: string, state: StateId, note: string, base?: string): void => setState(S, id, state, note, base)
  const say = (rule: LifeRule, text: string, rows: readonly Row[], base: string | null | undefined, people: readonly string[]): void => {
    host.log({ day: d, kind: 'life', id: rule, title: T.titles[rule], text, changes: toChanges(rows), people, ...(base ? { base } : {}) })
    if (base) W.lastNews[base] = d
  }
  const kill = (id: string, note: string): string => {
    set(id, 'dead', note)
    W.stats.deaths++
    const p = W.partner[id]
    if (p && alive(p)) return fillText(T.lines.loses, { partner: nm(p), name: nm(id) })
    return ''
  }
  const cnt = (b: string): number => Object.keys(S).filter((id) => alive(id) && S[id]!.base === b).length
  const pop = (): number => Object.keys(S).filter((id) => alive(id) || S[id]!.state === 'party').length
  const key = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const aff = (a: string, b: string): number => {
    const k = key(a, b)
    if (W.affinity[k] === undefined) {
      const r = (O.relations ?? []).find((rel) => (rel[0] === a && rel[1] === b) || (rel[0] === b && rel[1] === a))
      W.affinity[k] = r ? (N.affinity as Record<string, number>)[r[2]]! : N.unknownAffinity.base + ((pers(a)[1]! + pers(b)[1]!) / 2 - 50) / N.unknownAffinity.divisor
    }
    return W.affinity[k]!
  }
  const addAff = (a: string, b: string, v: number): void => {
    const k = key(a, b)
    W.affinity[k] = Math.max(-100, Math.min(100, aff(a, b) + v))
  }
  const pick = <T>(a: readonly T[]): T => a[Math.floor(R() * a.length)]!
  const hostileNow = (): Record<string, boolean> => {
    const out: Record<string, boolean> = {}
    for (const [b, rule] of Object.entries(O.hostileBases ?? {})) out[b] = rule === true ? true : holds(rule, conditionContext())
    return out
  }
  const bestBase = (): string => {
    const H = hostileNow()
    const c = Object.keys(groups).filter((b) => !closed.has(b) && !H[b] && cnt(b) > 0 && cnt(b) < N.arrivals.room)
    c.sort((a, b) => W.food[b]! * (0.5 + W.defence[b]!) - W.food[a]! * (0.5 + W.defence[a]!))
    return c.length ? c[Math.floor(R() * Math.min(3, c.length))]! : nomad
  }
  const newPerson = (person: Omit<Person, 'id'>): string => {
    const id = `g${++W.count}`
    W.made[id] = { id, generated: true, ...person }
    S[id] = { state: 'ok', note: '', base: person.base }
    return id
  }
  const heal = (spread: number): number => d + N.clocks.healBase + Math.floor(R() * spread)

  for (const { flag, a, b } of O.flagCouples ?? []) {
    if (F[flag] && !W.partner[a] && !W.partner[b]) {
      W.partner[a] = b
      W.partner[b] = a
    }
  }

  // 1. clocks: healing, turning, coming back, giving birth
  for (const [id, t] of Object.entries(W.timers)) {
    if (t.heal === d && S[id]!.state === 'hurt') S[id]!.note = T.notes.healed
    if (t.heal === d && S[id]!.state === 'hurt') S[id]!.state = 'ok'
    if (t.turn === d && S[id]!.state === 'bitten') {
      const b = S[id]!.base
      set(id, 'undead', b === nomad ? T.notes.undead_street : fillText(T.notes.undead_near, { place: groupName(b, T.places.where_died) }))
      say('turn', fillText(T.lines.turn, { name: nm(id) }), [[id, 'undead', S[id]!.note]], S[id]!.base, [id])
    }
    if (t.back === d && S[id]!.state === 'missing') {
      if (R() < N.clocks.backChance) {
        set(id, 'ok', T.notes.came_back)
        say('back', fillText(T.lines.back, { name: nm(id) }), [[id, 'ok', T.notes.came_back_short]], null, [id])
      } else {
        const x = kill(id, T.notes.never_back)
        say('lost', fillText(T.lines.lost, { name: nm(id), loss: x }), [[id, 'dead', T.notes.never_back]], null, [id])
      }
    }
    if (t.due === d) {
      t.due = 0
      if (!alive(id)) continue
      const b = S[id]!.base
      const med = (O.midwives ?? []).some((m) => S[m] && alive(m) && S[m]!.base === b)
      const pm = med ? N.birth.motherWithMidwife : N.birth.motherAlone
      const pb = med ? N.birth.babyWithMidwife : N.birth.babyAlone
      const dad = t.father
      const sx = R() < N.birth.girl ? 'f' : 'm'
      const bn = sx === 'f' ? pick(host.names.babyFemale) : pick(host.names.babyMale)
      const momDies = R() < pm && !anchor(id)
      const babyDies = R() < pb
      let txt = fillText(T.lines.birth, { name: nm(id), place: groupName(b, T.places.open_field), help: med ? T.lines.birth_help : T.lines.birth_alone })
      const ch: Row[] = []
      const people = [id]
      if (babyDies) txt += T.lines.baby_dies
      else {
        const surname = P(id).name.split(' ').filter((x) => !/[“”]/.test(x)).slice(-1)[0]
        const bid = newPerson({ name: `${bn} ${surname}`, age: 0, base: b, female: sx === 'f', baby: true, mother: id, ...(dad ? { father: dad } : {}) })
        W.stats.births++
        txt += fillText(T.lines.baby_born, { baby: bn })
        ch.push([bid, 'ok', T.notes.newborn, b])
        people.push(bid)
      }
      if (momDies) {
        txt += fillText(T.lines.mother_dies, { loss: kill(id, T.notes.childbirth), name: nm(id) })
        ch.push([id, 'dead', T.notes.childbirth])
      }
      say('birth', txt, ch, b, people)
    }
  }
  for (const id of ids) {
    if (S[id]!.state === 'hurt' && !(W.timers[id] && W.timers[id]!.heal! > d)) {
      W.timers[id] = W.timers[id] || {}
      W.timers[id]!.heal = heal(N.clocks.healSpread)
    }
  }

  // 2. the daily risk
  for (const id of ids) {
    if (!alive(id) || anchor(id) || (W.made[id] && W.made[id]!.baby)) continue
    const b = S[id]!.base
    if (b === playerBase) continue
    const ex = W.made[id] ? (age(id) < N.risk.childAge ? N.risk.newcomerChild : N.risk.newcomerAdult) : (O.exposure?.[id] ?? N.risk.defaultExposure)
    let r = (O.placeRisk?.[b] ?? N.risk.defaultPlace) * ex * (1 - (W.defence[b] ?? 0)) * (W.food[b]! < N.risk.hungryBelow ? N.risk.hungry : 1) * (S[id]!.state === 'hurt' ? N.risk.hurt : 1)
    for (const [flag, factor] of Object.entries(O.riskFlags ?? {})) r *= F[flag] ? factor : 1
    if (R() >= r) continue
    const x = R()
    const where = groupName(b, T.places.road)
    const hurtBand = N.infection ? N.risk.bands.hurt : N.risk.bands.bitten
    if (x < hurtBand) {
      set(id, 'hurt', T.notes.hurt_out)
      W.timers[id] = { ...W.timers[id], heal: heal(N.clocks.healSpread) }
      say('risk', fillText(T.lines.risk_hurt, { name: nm(id), o: o(id), place: where }), [[id, 'hurt', T.notes.hurt_out]], null, [id])
    } else if (x < N.risk.bands.bitten) {
      set(id, 'bitten', T.notes.bitten_out)
      W.timers[id] = { ...W.timers[id], turn: d + N.clocks.turnDays }
      say('risk', fillText(T.lines.risk_bitten, { name: nm(id) }), [[id, 'bitten', T.notes.hides_bite]], b, [id])
    } else if (x < N.risk.bands.dead) {
      const t = kill(id, T.notes.dead_out)
      say('risk', fillText(T.lines.risk_dead, { name: nm(id), place: where, loss: t }), [[id, 'dead', T.notes.did_not_return]], b, [id])
    } else {
      set(id, 'missing', T.notes.missing_out)
      W.timers[id] = { ...W.timers[id], back: d + N.clocks.backBase + Math.floor(R() * N.clocks.backSpread) }
      say('risk', fillText(T.lines.risk_missing, { name: nm(id), place: where }), [[id, 'missing', T.notes.missing_short]], null, [id])
    }
  }

  // 3. bonds inside each base
  const B = N.bonds
  const by: Record<string, string[]> = {}
  for (const id of Object.keys(S)) {
    if (!alive(id) || age(id) < B.minAge) continue
    const b = S[id]!.base
    if (!b || b === playerBase || b === nomad) continue
    ;(by[b] = by[b] || []).push(id)
  }
  for (const [b, m] of Object.entries(by)) {
    const quiet = W.lastNews[b]! >= d - B.quietDays
    for (let i = 0; i < m.length; i++) {
      for (let j = i + 1; j < m.length; j++) {
        const a = m[i]!
        const c = m[j]!
        const pa = pers(a)
        const pc = pers(c)
        addAff(a, c, ((pa[1]! + pc[1]!) / 2 - 50) / B.driftEmpathy + (W.food[b]! < B.lowFood ? -(pa[3]! + pc[3]!) / B.driftGreed : B.driftFed) + (R() - 0.5) * B.driftNoise)
        const v = aff(a, c)
        const k = key(a, c)
        if (quiet || W.lastNews[b]! >= d) continue
        if (!W.partner[a] && !W.partner[c] && age(a) >= B.coupleAge && age(c) >= B.coupleAge && Math.abs(age(a) - age(c)) <= B.coupleGap && v >= B.coupleAffinity && R() < B.coupleChance) {
          W.partner[a] = c
          W.partner[c] = a
          W.affinity[k] = B.coupledAffinity
          W.stats.couples++
          say('bond', fillText(T.lines.couple, { a: nm(a), b: nm(c), line: pick(T.pools.couple) }), [], b, [a, c])
          continue
        }
        if (W.partner[a] === c && W.food[b]! >= B.pregnancyFood) {
          const f = fem(a) && !fem(c) ? a : fem(c) && !fem(a) ? c : null
          if (f && age(f) <= B.pregnancyAge && !W.timers[f]?.due && !(anchorDays(a, d, d + B.pregnancyStoryWindow) || anchorDays(c, d, d + B.pregnancyStoryWindow)) && R() < B.pregnancyChance) {
            W.timers[f] = { ...W.timers[f], due: d + B.pregnancyDays, father: f === a ? c : a }
            W.stats.pregnancies++
            say('pregnancy', fillText(T.lines.pregnancy, { a: nm(a), b: nm(c), days: B.pregnancyDays }), [], b, [a, c])
            continue
          }
          if (!f && !W.adopted[k] && R() < B.adoptionChance) {
            const orphan = Object.keys(S).find((x) => alive(x) && S[x]!.base === b && (O.orphans?.[x] !== undefined || (W.made[x]?.baby && !alive(W.made[x]!.mother!))))
            if (orphan) {
              W.adopted[k] = 1
              say('adoption', fillText(T.lines.adoption, { a: nm(a), b: nm(c), child: O.orphans?.[orphan] ?? nm(orphan) }), [], b, [a, c, orphan])
              continue
            }
          }
        }
        if (!W.rival[k] && v <= B.rivalryAt) {
          W.rival[k] = 1
          say('rivalry', fillText(T.lines.rivalry, { a: nm(a), b: nm(c), line: pick(T.pools.rivalry) }), [], b, [a, c])
          continue
        }
        if (W.rival[k] && v <= B.fightAt && Math.max(pa[0]!, pc[0]!) >= B.fightCourage && R() < B.fightChance) {
          W.stats.fights++
          W.affinity[k] = B.afterFight
          const x = R()
          const lo = pa[0]! < pc[0]! ? a : c
          const hi = lo === a ? c : a
          if (x < B.fightHurt && !anchor(lo)) {
            set(lo, 'hurt', fillText(T.notes.fight_with, { other: nm(hi) }))
            W.timers[lo] = { ...W.timers[lo], heal: heal(B.fightHealSpread) }
            say('fight', fillText(T.lines.fight_hurt, { winner: nm(hi), loser: nm(lo) }), [[lo, 'hurt', T.notes.fight]], b, [hi, lo])
          } else if (x < B.fightDead && !anchor(lo)) {
            const t = kill(lo, fillText(T.notes.dead_fight, { other: nm(hi) }))
            say('fight', fillText(T.lines.fight_dead, { loser: nm(lo), winner: nm(hi), loss: t }), [[lo, 'dead', T.notes.fight]], b, [hi, lo])
          } else {
            const out = pa[2]! < pc[2]! ? a : c
            const dest = bestBase()
            if (dest !== b && !anchor(out)) {
              set(out, 'moved', T.notes.left_after_fight, dest)
              say('fight', fillText(T.lines.fight_leaves, { name: nm(out), to: groupName(dest, dest), other: nm(out === a ? c : a) }), [[out, 'moved', groupName(dest, dest), dest]], b, [out, out === a ? c : a])
            }
          }
        }
      }
    }
    // betrayal
    const V = N.betrayal
    for (const id of m) {
      const p = pers(id)
      if (quiet || W.lastNews[b]! >= d || !alive(id) || anchor(id)) continue
      if (p[2]! < V.loyaltyBelow && p[3]! > V.greedAbove && W.food[b]! < V.foodBelow && R() < V.chance) {
        const dest = (O.traitorDestinations ?? []).find((t) => t.base !== b && (!t.when || holds(t.when, conditionContext())))?.base ?? nomad
        W.food[b] = Math.max(0, W.food[b]! - V.takes)
        W.stats.betrayals++
        set(id, host.people[id] ? 'hostile' : 'moved', fillText(T.notes.betrayed, { from: groupName(b, b), to: groupName(dest, dest) }), dest)
        for (const other of m) if (other !== id) addAff(id, other, V.affinity)
        say('betrayal', fillText(T.lines.betrayal, { name: nm(id), from: groupName(b, b), to: groupName(dest, dest) }), [[id, S[id]!.state, T.notes.betrayed_short, dest]], b, [id])
      }
    }
  }

  // 4. food, caravans and raids between bases
  for (const b of Object.keys(W.food)) {
    const rule = O.foodDrift?.[b]
    const drift = rule === undefined ? N.food.drift : typeof rule === 'number' ? rule : F[rule.flag] ? rule.value : N.food.drift
    W.food[b] = Math.max(0, Math.min(N.food.max, W.food[b]! + drift))
  }
  const H = hostileNow()
  const C = N.caravan
  for (const [b, m] of Object.entries(by)) {
    if (W.food[b]! >= C.below || W.lastNews[b]! >= d - B.quietDays) continue
    caravan: for (const x of m) {
      for (const [c, mc] of Object.entries(by)) {
        if (c === b || H[c] || W.food[c]! <= C.hostAbove) continue
        const y = mc.find((member) => aff(x, member) >= C.affinity)
        if (!y || R() >= C.chance) continue
        W.food[b]! += C.carries
        W.food[c]! -= C.carries
        addAff(x, y, C.bond)
        W.stats.caravans++
        let t = fillText(T.lines.caravan, { carrier: nm(y), from: groupName(c, c), to: groupName(b, b), host: nm(x) })
        const ch: Row[] = []
        if (R() < C.hurtChance && !anchor(y)) {
          set(y, 'hurt', T.notes.hurt_caravan)
          W.timers[y] = { ...W.timers[y], heal: d + C.healDays }
          t += fillText(T.lines.caravan_hurt, { carrier: nm(y), o: o(y) })
          ch.push([y, 'hurt', T.notes.caravan])
        }
        say('caravan', t, ch, b, [y, x])
        break caravan
      }
    }
  }
  const A = N.raid
  const raids = (O.raids ?? []).map((raid) => ({ ...raid, on: holds(raid.when, conditionContext()) }))
  for (const { from: src, on, who } of raids) {
    if (!on || R() >= A.chance || (W.raid[src] || 0) > d - A.cooldown) continue
    const alvo = Object.keys(by)
      .filter((b) => b !== src && !H[b] && !(O.raidImmune ?? []).includes(b) && W.food[b]! >= A.targetFood)
      .sort((a, b) => W.defence[a]! - W.defence[b]! + (R() - 0.5) * A.noise)[0]
    if (!alvo || W.lastNews[alvo]! >= d - B.quietDays) continue
    W.raid[src] = d
    const v = pick(by[alvo]!)
    W.stats.raids++
    const loot = Math.min(A.loot, W.food[alvo]!)
    W.food[alvo]! -= loot
    W.food[src] = (W.food[src] || 0) + loot
    const hero = Object.entries(by)
      .filter(([b]) => b !== alvo && !H[b])
      .flatMap(([, mm]) => mm)
      .find((h) => pers(h)[0]! >= A.heroCourage && by[alvo]!.some((other) => aff(h, other) >= A.heroAffinity))
    let t = fillText(T.lines.raid, { who, target: groupName(alvo, alvo), loot: Math.round(loot) })
    const ch: Row[] = []
    const people = [v]
    if (hero && R() < A.heroChance) {
      t += fillText(T.lines.raid_hero, { hero: nm(hero), heroBase: groupName(S[hero]!.base, S[hero]!.base), victim: nm(v), o: o(v) })
      set(v, 'hurt', T.notes.hurt_raid)
      W.timers[v] = { ...W.timers[v], heal: d + A.healDays }
      addAff(hero, v, A.heroBond)
      ch.push([v, 'hurt', T.notes.raid])
      people.push(hero)
    } else if (R() < A.deadChance && !anchor(v)) {
      t += fillText(T.lines.raid_dead, { loss: kill(v, fillText(T.notes.dead_raid, { from: groupName(src, src) })), victim: nm(v) })
      ch.push([v, 'dead', T.notes.raid])
    } else if (!anchor(v)) {
      set(v, 'hurt', T.notes.hurt_raid)
      W.timers[v] = { ...W.timers[v], heal: d + A.healDays }
      t += fillText(T.lines.raid_grazed, { victim: nm(v) })
      ch.push([v, 'hurt', T.notes.raid])
    }
    say('raid', t, ch, alvo, people)
  }

  // 5. newcomers
  const V = N.arrivals
  // a newcomer always comes for someone: a world with nobody of the bond age gets no newcomers
  const pool = Object.values(host.people).filter((x) => !x.extra && typeof x.age === 'number' && x.age >= V.bondAge)
  if (O.arrivals !== false && d % V.every === 0 && pool.length > 0) {
    const origins = O.arrivals?.origins?.length ? O.arrivals.origins : ['']
    let n = R() < (d > V.lateAfter ? V.lateChance : V.chance) ? 1 + (R() < V.secondChance ? 1 : 0) : 0
    while (n-- > 0 && pop() < V.cap) {
      const f = R() < 0.5
      let nome: string
      do nome = `${pick(f ? host.names.female : host.names.male)} ${pick(host.names.surnames)}`
      while (W.usedNames.has(nome.split(' ')[0]!) && W.usedNames.size < V.uniqueNames)
      const first = nome.split(' ')[0]!
      W.usedNames.add(first)
      const origem = pick(origins)
      const bond = pick(pool).id
      const rel = pick(host.names.kinship[f ? 'female' : 'male'])
      const st = S[bond]!.state
      const live = alive(bond) || st === 'party'
      const bondBase = S[bond]!.base
      const b = live && bondBase !== playerBase && bondBase !== nomad && !H[bondBase] && cnt(bondBase) < V.room ? bondBase : bestBase()
      const Q = N.personality
      const id = newPerson({
        name: nome,
        age: V.ageBase + Math.floor(R() * V.ageSpread),
        base: b,
        female: f,
        personality: [Q.base + R() * Q.spread, Q.base + R() * Q.spread, Q.base + R() * Q.spread, Q.greedBase + R() * Q.spread, Q.base + R() * Q.spread].map(Math.round),
        bond,
        relation: rel,
      })
      W.stats.arrivals++
      const way = origem ? ` ${origem}` : ''
      const note = (O.arrivals ? O.arrivals.notes ?? [] : []).filter((x) => x.origin === origem && holds(x.when, conditionContext())).map((x) => x.text).join('')
      let t = fillText(T.lines.arrival, { first, relation: rel, bond: nm(bond), origin: way, note })
      if (!live) {
        const fate = (T.fates as Record<string, string>)[st] ?? T.fates.other
        t += fillText(T.lines.arrival_gone, { bond: nm(bond), fate, base: groupName(b, b) })
      } else {
        t +=
          st === 'party'
            ? fillText(T.lines.arrival_party, { bond: nm(bond), base: groupName(b, b) })
            : b === S[bond]!.base
              ? fillText(T.lines.arrival_found, { bond: nm(bond), base: groupName(b, b) })
              : fillText(T.lines.arrival_elsewhere, { bond: nm(bond), where: groupName(S[bond]!.base, T.places.nowhere), base: groupName(b, b) })
        W.affinity[key(id, bond)] = V.bondAffinity
      }
      for (const a of O.arrivals ? O.arrivals.announcements ?? [] : []) if (holds(a.when, conditionContext())) t += a.text
      const arrived = fillText(T.notes.arrived, { origin: way })
      const ch: Row[] = [[id, 'ok', arrived, b]]
      const people = [id, bond]
      if (R() < V.pairChance && pop() < V.cap) {
        const pf = !f
        let n2: string
        do n2 = pick(pf ? host.names.female : host.names.male)
        while (W.usedNames.has(n2) && W.usedNames.size < V.uniqueNames)
        W.usedNames.add(n2)
        const surname = nome.split(' ').slice(-1)[0]
        const id2 = newPerson({
          name: `${n2} ${surname}`,
          age: Math.max(V.ageBase, W.made[id]!.age! + Math.floor(R() * V.pairAgeSpread) - V.pairAgeShift),
          base: b,
          female: pf,
          personality: [1, 2, 3, 4, 5].map(() => Math.round(Q.base + R() * Q.spread)),
          bond,
          relation: fillText(T.notes.pair_of, { first }),
        })
        W.stats.arrivals++
        W.partner[id] = id2
        W.partner[id2] = id
        ch.push([id2, 'ok', arrived, b])
        people.push(id2)
        const mae = pf ? id2 : id
        if (R() < V.pregnantChance && W.made[mae]!.age! <= B.pregnancyAge) {
          W.timers[mae] = { due: d + V.pregnantDueBase + Math.floor(R() * V.pregnantDueSpread), father: mae === id ? id2 : id }
          W.stats.pregnancies++
          t += fillText(T.lines.arrival_pair_pregnant, { pair: n2, mother: nm(mae) })
        } else t += fillText(T.lines.arrival_pair, { pair: n2 })
      }
      say('arrival', t, ch, null, people)
    }
  }
}

/** The fill of the team's page (`simulate(…, { fill })`, lines 746-749): ordinary people, round the open bases, until that many are living. */
export function fillWorld(W: LifeWorld, host: Pick<LifeHost, 'states' | 'random' | 'names' | 'numbers' | 'options'>, target: number): void {
  const { states: S, random: R, numbers: N, options: O } = host
  const closed = new Set([O.nomadBase ?? 'nomad', ...(O.closedBases ?? [])])
  const bases = Object.keys(O.groups).filter((b) => !closed.has(b))
  const living = (): string[] => Object.keys(S).filter((id) => N.livingStates.includes(S[id]!.state))
  let i = 0
  let idle = 0
  while (living().length < target && bases.length > 0) {
    const b = bases[i++ % bases.length]!
    if (living().filter((id) => S[id]!.base === b).length >= N.fill.perBase) {
      if (++idle >= bases.length) break
      continue
    }
    idle = 0
    const id = `g${++W.count}`
    const f = R() < 0.5
    const first = f ? host.names.female : host.names.male
    W.made[id] = {
      id,
      generated: true,
      name: `${first[W.count % first.length]} ${host.names.surnames[W.count % host.names.surnames.length]}`,
      age: N.fill.ageBase + Math.floor(R() * N.fill.ageSpread),
      base: b,
      female: f,
      personality: [1, 2, 3, 4, 5].map(() => Math.round(N.personality.base + R() * N.personality.spread)),
    }
    S[id] = { state: 'ok', note: '', base: b }
  }
}
