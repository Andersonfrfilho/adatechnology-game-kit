import type { DestructionEvent, DestructionWorld, PartState, ToolKind } from '@adatechnology/game-destruction'
import type { FluidEvent, FluidWorld } from '@adatechnology/game-fluids'
import type { WritableLog } from './log'
import type { LogEntry } from './types'

type Vars = Record<string, string | number>

/** What the narrator needs to know about the room. */
export interface NarrateContext {
  world: DestructionWorld
  fluids: FluidWorld
  log: WritableLog
  /** Current room time in seconds. */
  now: () => number
  t: (key: string, vars?: Vars) => string
  /** Locale number: `1.5` -> `1,5` in pt-BR. */
  num: (n: number, digits?: number) => string
  /** Item display name of an object id (also loose pieces). */
  nameOf: (objectId: string) => string
  itemIdOf: (objectId: string) => string | undefined
  materialName: (id: string) => string
  liquidName: (id: string) => string
  jointKind: (kind: string) => string
  toolName: (tool: string) => string
  /** Display name of the item that carries a fluid container. */
  containerName: (containerId: string) => { name: string; objectId?: string; itemId?: string } | undefined
  /** Where a part lives now: its object, or the loose piece it broke off into. */
  locatePart?: (objectId: string, partId: string) => { objectId: string; part: PartState } | null
}

const SKIP_DAMAGE: ReadonlySet<string> = new Set(['fire', 'heat'])

/**
 * Turns destruction and fluid events into plain log lines in the room locale. Events of one frame arrive as a batch: a `damage` event is merged
 * into the dent, hole or crack it caused, a `leak` event into the hole that opened it, and the noisy ones (melt, drip, disassembly) become one
 * line that is updated while it goes on.
 */
export function createNarrator(c: NarrateContext) {
  const { t, num } = c

  /** Materials seen per `object|part`, so a line about a part that already broke off its object still names the material. */
  const materialMemo = new Map<string, string>()
  const findPart = (objectId: string, partId: string): PartState | null => {
    const p = c.world.part(objectId, partId) ?? c.locatePart?.(objectId, partId)?.part ?? null
    if (p) materialMemo.set(`${objectId}|${partId}`, p.material)
    return p
  }
  const plural = (key: string, n: number): string => t(`${key}.${n === 1 ? 'one' : 'other'}`, { n })
  const pieces = (n: number): string => plural('count.piece', n)
  const joints = (n: number): string => plural('count.joint', n)
  const xz = (x: number, z: number): string => t('coords', { x: num(x, 1), z: num(z, 1) })

  const where = (objectId: string, partId: string): string => {
    const p = findPart(objectId, partId)
    const m = p?.material ?? materialMemo.get(`${objectId}|${partId}`)
    return `${c.nameOf(objectId)} › ${partId}${m ? ` (${c.materialName(m)})` : ''}`
  }

  const stateOf = (objectId: string, partId: string): LogEntry['state'] => {
    const p = findPart(objectId, partId)
    if (!p) return undefined
    const s: Record<string, number | string | boolean> = {
      status: p.status,
      hp: Math.round(p.hp * 10) / 10,
      maxHp: Math.round(p.maxHp * 10) / 10,
      temperature: Math.round(p.temperature),
      char: Math.round(p.char * 100) / 100,
      melt: Math.round(p.melt * 100) / 100,
    }
    if (p.liters !== undefined) s.liters = Math.round(p.liters * 1000) / 1000
    return s
  }

  const base = (ev: DestructionEvent, part?: string): Pick<LogEntry, 'channel' | 'objectId' | 'itemId' | 'part' | 'material' | 'state'> => ({
    channel: 'event',
    objectId: ev.object,
    itemId: c.itemIdOf(ev.object),
    part,
    material: part ? (findPart(ev.object, part)?.material ?? materialMemo.get(`${ev.object}|${part}`)) : undefined,
    state: part ? stateOf(ev.object, part) : undefined,
  })

  const hpText = (obj: string, part: string): string => {
    const p = findPart(obj, part)
    return p ? `hp ${num(p.hp, 0)}/${num(p.maxHp, 0)}` : ''
  }

  const isLost = (obj: string, part: string): boolean => {
    const st = findPart(obj, part)?.status
    return st === 'broken' || st === 'melted' || st === 'ashes'
  }

  /** Per-part running totals for lines that repeat while something goes on (cracks under load, overload damage). */
  const crackAcc = new Map<string, { n: number; cm: number; last: number }>()
  const damageAcc = new Map<string, { total: number; last: number }>()
  const stressAt = new Map<string, number>()
  const leakAt = new Map<string, number>()
  const list = (names: string[]): string => (names.length > 6 ? `${names.slice(0, 6).join(', ')}…` : names.join(', '))

  const events = (batch: DestructionEvent[]): void => {
    const now = c.now()
    const damage = new Map<string, { amount: number; type: string }>()
    const holes = new Map<string, LogEntry>()
    const dents = new Map<string, LogEntry>()
    for (const ev of batch) {
      if (ev.type !== 'damage') continue
      const k = `${ev.object}|${ev.part}`
      const prev = damage.get(k)
      damage.set(k, { amount: (prev?.amount ?? 0) + ev.amount, type: ev.damageType })
    }

    // A part that breaks, melts or burns away opens every joint it had: those `detach` events become part of ONE line about the part
    // (appended to its fracture or burnout line, or standing alone), instead of one line per joint.
    const lostJoints = new Map<string, { obj: string; part: string; joints: number; groups: number; merged: boolean }>()
    // Joints that open for another reason (a blow, a tool) are counted per object.
    const openJoints = new Map<string, { obj: string; by: string; list: Array<{ joint: string; a: string; b: string }>; groups: number; done: boolean }>()
    // Several parts of one object catching fire or being put out at once are one line.
    const fireParts = new Map<string, { obj: string; parts: string[]; temp: number; done: boolean }>()
    const outParts = new Map<string, { obj: string; parts: string[]; done: boolean }>()
    for (const ev of batch) {
      if (ev.type === 'detach') {
        if (ev.by === 'part_lost') {
          const [a, b] = ev.parts
          const lost = isLost(ev.object, a) && !isLost(ev.object, b) ? a : isLost(ev.object, b) && !isLost(ev.object, a) ? b : isLost(ev.object, a) ? a : b
          const key = `${ev.object}|${lost}`
          const g = lostJoints.get(key) ?? { obj: ev.object, part: lost, joints: 0, groups: 0, merged: false }
          g.joints++
          g.groups = ev.groups.length
          lostJoints.set(key, g)
        } else {
          const key = `${ev.object}|${ev.by}`
          const g = openJoints.get(key) ?? { obj: ev.object, by: ev.by, list: [], groups: 0, done: false }
          const [a, b] = ev.parts
          g.list.push({ joint: ev.joint, a, b })
          g.groups = ev.groups.length
          openJoints.set(key, g)
        }
      } else if (ev.type === 'ignite') {
        const g = fireParts.get(ev.object) ?? { obj: ev.object, parts: [], temp: 0, done: false }
        g.parts.push(ev.part)
        g.temp = Math.max(g.temp, findPart(ev.object, ev.part)?.temperature ?? 0)
        fireParts.set(ev.object, g)
      } else if (ev.type === 'extinguish') {
        const g = outParts.get(ev.object) ?? { obj: ev.object, parts: [], done: false }
        g.parts.push(ev.part)
        outParts.set(ev.object, g)
      }
    }
    const lostTail = (key: string): string => {
      const g = lostJoints.get(key)
      if (!g) return ''
      g.merged = true
      return t('ev.lost.tail', { joints: joints(g.joints), pieces: pieces(g.groups) })
    }
    const lostData = (key: string): Record<string, unknown> => {
      const g = lostJoints.get(key)
      return g ? { jointsOpened: g.joints, pieces: g.groups } : {}
    }

    for (const ev of batch) {
      switch (ev.type) {
        case 'damage':
          break
        case 'dent': {
          const k = `${ev.object}|${ev.part}`
          const d = damage.get(k)
          damage.delete(k)
          const mm = ev.dent.depth * 1000
          const prev = dents.get(k)
          if (prev) {
            const n = Number(prev.data?.count ?? 1) + 1
            const deepest = Math.max(Number(prev.data?.depthMm ?? 0), mm)
            prev.text = t('ev.dents', { where: where(ev.object, ev.part), n, mm: num(deepest, 0), hp: hpText(ev.object, ev.part) })
            prev.data = { ...prev.data, count: n, depthMm: Math.round(deepest * 10) / 10 }
            break
          }
          dents.set(
            k,
            c.log.add({
              ...base(ev, ev.part),
              type: 'dent',
              text: t('ev.dent', { where: where(ev.object, ev.part), mm: num(mm, 0), hp: hpText(ev.object, ev.part) }),
              data: { count: 1, depthMm: Math.round(mm * 10) / 10, radius: ev.dent.radius, damage: d?.amount, point: ev.worldPoint, source: ev.source },
            }),
          )
          break
        }
        case 'hole': {
          const k = `${ev.object}|${ev.part}`
          const d = damage.get(k)
          damage.delete(k)
          const mm = ev.hole.diameter * 1000
          const prev = holes.get(k)
          if (prev) {
            const n = Number(prev.data?.count ?? 1) + 1
            const through = Number(prev.data?.throughCount ?? 0) + (ev.hole.through ? 1 : 0)
            prev.text = t('ev.holes', { where: where(ev.object, ev.part), n, mm: num(mm, 0), thr: through, hp: hpText(ev.object, ev.part) })
            prev.data = { ...prev.data, count: n, throughCount: through, through: through > 0 }
            break
          }
          holes.set(
            k,
            c.log.add({
              ...base(ev, ev.part),
              type: 'hole',
              text: t(ev.hole.through ? 'ev.hole.through' : 'ev.hole.stuck', { where: where(ev.object, ev.part), mm: num(mm, 0), hp: hpText(ev.object, ev.part) }),
              data: { count: 1, throughCount: ev.hole.through ? 1 : 0, diameterMm: Math.round(mm * 10) / 10, through: ev.hole.through, damage: d?.amount, point: ev.worldPoint, source: ev.source },
            }),
          )
          break
        }
        case 'crack': {
          const k = `${ev.object}|${ev.part}`
          const d = damage.get(k)
          damage.delete(k)
          // a part under load cracks again and again: that is one line that counts them (a cracking shot or blow stays its own line)
          const loaded = (findPart(ev.object, ev.part)?.stress ?? 0) > 0.8 && ev.source === undefined
          const cm = ev.crack.length * 100
          if (loaded) {
            const acc = crackAcc.get(k)
            const n = acc && now - acc.last <= 1 ? acc.n + 1 : 1
            const longest = acc && n > 1 ? Math.max(acc.cm, cm) : cm
            crackAcc.set(k, { n, cm: longest, last: now })
            c.log.coalesce(
              `crack:${k}`,
              {
                ...base(ev, ev.part),
                type: 'crack',
                text: t('ev.cracks', { where: where(ev.object, ev.part), n, cm: num(longest, 0), hp: hpText(ev.object, ev.part) }),
                data: { rays: ev.crack.rays, lengthM: ev.crack.length, count: n, underLoad: true },
              },
              1,
            )
            break
          }
          c.log.add({
            ...base(ev, ev.part),
            type: 'crack',
            text: t('ev.crack', { where: where(ev.object, ev.part), rays: ev.crack.rays, cm: num(cm, 0), hp: hpText(ev.object, ev.part) }),
            data: { rays: ev.crack.rays, lengthM: ev.crack.length, damage: d?.amount, source: ev.source },
          })
          break
        }
        case 'ricochet':
          c.log.add({
            ...base(ev, ev.part),
            type: 'ricochet',
            text: t('ev.ricochet', { where: where(ev.object, ev.part), energy: num(ev.energy, 0) }),
            data: { energy: ev.energy, direction: ev.direction },
          })
          break
        case 'leak': {
          const k = `${ev.object}|${ev.part}`
          const liquid = c.liquidName(ev.fluid)
          const hole = holes.get(k)
          const rate = num(ev.rate, 2)
          leakAt.set(ev.object, now)
          if (hole) {
            hole.text += t('ev.leak.tail', { liquid, rate })
            hole.data = { ...hole.data, leak: { fluid: ev.fluid, ratePerS: ev.rate, pressurized: ev.pressurized } }
          } else {
            c.log.add({ ...base(ev, ev.part), type: 'leak', text: t('ev.leak.alone', { where: where(ev.object, ev.part), liquid, rate }), data: { fluid: ev.fluid, ratePerS: ev.rate } })
          }
          break
        }
        case 'fracture': {
          const k = `${ev.object}|${ev.part}`
          const d = damage.get(k)
          damage.delete(k)
          c.log.add({
            ...base(ev, ev.part),
            type: 'fracture',
            text: t(`ev.fracture.${ev.style}`, { where: where(ev.object, ev.part), n: ev.fragments.length }) + lostTail(k),
            data: { style: ev.style, fragments: ev.fragments.length, damage: d?.amount, point: ev.point, source: ev.source, ...lostData(k) },
          })
          break
        }
        case 'detach': {
          if (ev.by === 'part_lost') {
            // the part's own line (fracture, burnout) already says it; with none in this batch, say it here, once
            const [a, b] = ev.parts
            const lost = isLost(ev.object, a) && !isLost(ev.object, b) ? a : isLost(ev.object, b) && !isLost(ev.object, a) ? b : isLost(ev.object, a) ? a : b
            const key = `${ev.object}|${lost}`
            const g = lostJoints.get(key)
            if (!g || g.merged) break
            const hasOwnLine = batch.some((e) => (e.type === 'fracture' || e.type === 'burnout') && e.object === ev.object && e.part === lost)
            if (hasOwnLine) break
            g.merged = true
            const status = findPart(ev.object, lost)?.status
            const verb = t(`lost.${status === 'ashes' ? 'ashes' : status === 'melted' ? 'melted' : 'broken'}`)
            c.log.add({
              ...base(ev, lost),
              type: 'detach',
              text: t('ev.lost.alone', { where: where(ev.object, lost), verb, joints: joints(g.joints), pieces: pieces(g.groups) }),
              data: { parts: [a, b], by: ev.by, ...lostData(key) },
            })
            break
          }
          const key = `${ev.object}|${ev.by}`
          const g = openJoints.get(key)
          if (!g || g.done) break
          g.done = true
          const [a, b] = ev.parts
          const many = g.list.length > 1
          c.log.add({
            channel: 'event',
            type: 'detach',
            objectId: ev.object,
            itemId: c.itemIdOf(ev.object),
            text: many
              ? t(`ev.detach.many.${ev.by === 'tool' ? 'tool' : 'break'}`, { obj: c.nameOf(ev.object), joints: joints(g.list.length), pieces: pieces(g.groups) })
              : t('ev.detach', { obj: c.nameOf(ev.object), a, b, by: t(`by.${ev.by}`), pieces: pieces(g.groups) }),
            data: { joint: ev.joint, joints: g.list.map((j) => j.joint), parts: ev.parts, by: ev.by, groups: g.groups },
          })
          break
        }
        case 'disassemble_progress': {
          const pct = Math.round(ev.progress * 100)
          const kind = kindOf(ev.object, ev.joint)
          const [a, b] = ev.joint.split('~')
          c.log.coalesce(
            `dis:${ev.object}:${ev.joint}`,
            {
              channel: 'event',
              type: 'disassemble_progress',
              objectId: ev.object,
              itemId: c.itemIdOf(ev.object),
              text: t('ev.disassemble', { obj: c.nameOf(ev.object), a: a ?? ev.joint, b: b ?? '', kind: kind ? c.jointKind(kind) : t('joint.generic'), tool: c.toolName(ev.tool as ToolKind), pct }),
              data: { joint: ev.joint, tool: ev.tool, progress: ev.progress },
            },
            1.5,
          )
          break
        }
        case 'ignite': {
          const g = fireParts.get(ev.object)
          if (g && g.parts.length >= 3) {
            if (g.done) break
            g.done = true
            c.log.add({
              channel: 'event',
              type: 'ignite',
              objectId: ev.object,
              itemId: c.itemIdOf(ev.object),
              text: t('ev.ignite.many', { obj: c.nameOf(ev.object), n: g.parts.length, temp: num(g.temp, 0), parts: list(g.parts) }),
              data: { parts: g.parts, temperature: Math.round(g.temp) },
            })
            break
          }
          c.log.add({ ...base(ev, ev.part), type: 'ignite', text: t('ev.ignite', { where: where(ev.object, ev.part), temp: num(findPart(ev.object, ev.part)?.temperature ?? 0, 0) }) })
          break
        }
        case 'extinguish': {
          const g = outParts.get(ev.object)
          if (g && g.parts.length >= 3) {
            if (g.done) break
            g.done = true
            c.log.add({
              channel: 'event',
              type: 'extinguish',
              objectId: ev.object,
              itemId: c.itemIdOf(ev.object),
              text: t('ev.extinguish.many', { obj: c.nameOf(ev.object), n: g.parts.length, parts: list(g.parts) }),
              data: { parts: g.parts },
            })
            break
          }
          c.log.add({ ...base(ev, ev.part), type: 'extinguish', text: t('ev.extinguish', { where: where(ev.object, ev.part) }) })
          break
        }
        case 'burnout': {
          const k = `${ev.object}|${ev.part}`
          c.log.add({ ...base(ev, ev.part), type: 'burnout', text: t('ev.burnout', { where: where(ev.object, ev.part) }) + lostTail(k), data: lostData(k) })
          break
        }
        case 'melt':
          c.log.coalesce(
            `melt:${ev.object}:${ev.part}`,
            { ...base(ev, ev.part), type: 'melt', text: t('ev.melt', { where: where(ev.object, ev.part), pct: Math.round(ev.melt * 100) }), data: { melt: ev.melt } },
            2,
          )
          break
        case 'drip':
          c.log.coalesce(`drip:${ev.object}:${ev.part}`, { ...base(ev, ev.part), type: 'drip', text: t('ev.drip', { where: where(ev.object, ev.part) }), data: { point: ev.point } }, 2)
          break
        case 'explode':
          c.log.add({
            ...base(ev, ev.part),
            type: 'explode',
            text: t('ev.explode', { where: where(ev.object, ev.part), energy: num(ev.energy, 0), radius: num(ev.radius, 1) }),
            data: { energy: ev.energy, radius: ev.radius, point: ev.point },
          })
          break
        case 'destroyed':
          c.log.add({ channel: 'event', type: 'destroyed', objectId: ev.object, itemId: c.itemIdOf(ev.object), text: t('ev.destroyed', { obj: c.nameOf(ev.object) }) })
          break
        default: {
          // structural events (`stress`, `collapse`) come from newer versions of the core
          const x = ev as unknown as Record<string, unknown> & { type: string; object: string; time: number }
          if (x.type === 'stress') {
            const part = String(x.part ?? '')
            stressAt.set(`${x.object}|${part}`, now)
            c.log.coalesce(
              `stress:${x.object}:${part}`,
              {
                ...base(ev, part),
                type: 'stress',
                text: t('ev.stress', { where: where(x.object, part), stress: num(Number(x.stress ?? 0) * 100, 0), load: num(Number(x.load ?? 0), 0) }),
                data: { stress: x.stress, load: x.load },
              },
              1,
            )
          } else if (x.type === 'collapse') {
            const parts = Array.isArray(x.parts) ? (x.parts as unknown[]).map(String) : []
            c.log.add({
              channel: 'event',
              type: 'collapse',
              objectId: x.object,
              itemId: c.itemIdOf(x.object),
              text: t('ev.collapse', { obj: c.nameOf(x.object), pieces: pieces(parts.length), mass: num(Number(x.mass ?? 0), 0), parts: list(parts) }),
              data: { parts: parts.length, partIds: parts, massKg: x.mass, cause: x.cause },
            })
          }
        }
      }
    }
    // damage that no dent, hole, crack or fracture explained (blunt thuds, blast, absorbed bullets, a structure carrying too much)
    for (const [k, d] of damage) {
      if (SKIP_DAMAGE.has(d.type) || d.amount < 0.5) continue
      const [obj, part] = k.split('|')
      const overload = d.type === 'blunt' && now - (stressAt.get(k) ?? -99) <= 3
      const entry = {
        channel: 'event' as const,
        type: 'damage',
        objectId: obj,
        itemId: c.itemIdOf(obj),
        part,
        material: findPart(obj, part)?.material ?? materialMemo.get(k),
        state: stateOf(obj, part),
      }
      if (!overload) {
        c.log.add({ ...entry, text: t('ev.damage', { where: where(obj, part), type: t(`dmg.${d.type}`), amount: num(d.amount, 0), hp: hpText(obj, part) }), data: { amount: d.amount, damageType: d.type } })
        continue
      }
      // a structure carrying too much loses hit points every tick: one line with the running total
      const acc = damageAcc.get(k)
      const total = acc && now - acc.last <= 1 ? acc.total + d.amount : d.amount
      damageAcc.set(k, { total, last: now })
      c.log.coalesce(
        `damage:${k}`,
        { ...entry, text: t('ev.damage.overload', { where: where(obj, part), amount: num(total, 0), hp: hpText(obj, part) }), data: { amount: total, damageType: d.type, overload: true } },
        1,
      )
    }
  }

  const kindMemo = new Map<string, string>()
  const kindOf = (objectId: string, jointId: string): string => {
    const key = `${objectId}|${jointId}`
    const own = c.world.state(objectId)?.joints.find((j) => j.id === jointId)?.kind
    if (own) {
      kindMemo.set(key, own)
      return own
    }
    const known = kindMemo.get(key)
    if (known) return known
    for (const id of c.world.ids()) {
      const k = c.world.state(id)?.joints.find((j) => j.id === jointId)?.kind
      if (k) return k
    }
    return ''
  }

  const stainInfo = new Map<string, { liquid: string; surface: string; x: number; z: number }>()
  const stainAcc = new Map<string, { n: number; last: number }>()
  const driedAcc = new Map<string, { n: number; last: number }>()
  const drinkAcc = new Map<string, { liters: number; thirst: number; burn: boolean; effects: Set<string>; last: number; start: number }>()
  const fluid = (ev: FluidEvent): void => {
    const who = (id: string): string => c.containerName(id)?.name ?? id
    const meta = (id: string): { objectId?: string; itemId?: string } => {
      const m = c.containerName(id)
      return { objectId: m?.objectId, itemId: m?.itemId }
    }
    const f = 'fluid.'
    switch (ev.type) {
      case 'fill':
        c.log.coalesce(`fill:${ev.container}`, { channel: 'event', type: f + 'fill', ...meta(ev.container), text: t('fl.fill', { who: who(ev.container), liquid: c.liquidName(ev.liquid), liters: num(ev.liters, 2) }), data: { liters: ev.liters } }, 1.5)
        break
      case 'pour':
        c.log.coalesce(`pour:${ev.container}`, { channel: 'event', type: f + 'pour', ...meta(ev.container), text: t('fl.pour', { who: who(ev.container), liquid: c.liquidName(ev.liquid), rate: num(ev.rate, 2) }), data: { rate: ev.rate } }, 2)
        break
      case 'spill':
        c.log.coalesce(`spill:${ev.container}`, { channel: 'event', type: f + 'spill', ...meta(ev.container), text: t('fl.spill', { who: who(ev.container), liquid: c.liquidName(ev.liquid), rate: num(ev.rate, 2) }), data: { rate: ev.rate } }, 2)
        break
      case 'leak': {
        // the hole line of the destruction event already says the object is leaking
        const owner = meta(ev.container).objectId
        if (owner && c.now() - (leakAt.get(owner) ?? -99) <= 2) break
        c.log.coalesce(`fleak:${ev.container}`, { channel: 'event', type: f + 'leak', ...meta(ev.container), text: t('fl.leak', { who: who(ev.container), liquid: c.liquidName(ev.liquid), rate: num(ev.rate, ev.rate < 0.01 ? 3 : 2) }), data: { rate: ev.rate, point: ev.point } }, 2)
        break
      }
      case 'drink': {
        // a sip arrives as many small drink events: one line per sip, updated while it goes on
        const now = c.now()
        let acc = drinkAcc.get(ev.container)
        if (!acc || now - acc.last > 0.5) acc = { liters: 0, thirst: 0, burn: false, effects: new Set<string>(), last: now, start: now }
        acc.liters += ev.liters
        acc.thirst += ev.thirst
        acc.burn = acc.burn || ev.burn
        for (const e of ev.effects) acc.effects.add(e)
        acc.last = now
        drinkAcc.set(ev.container, acc)
        const effects = [...acc.effects].map((e) => t(`effect.${e}`)).join(', ')
        c.log.coalesce(
          `drink:${ev.container}:${acc.start}`,
          {
            channel: 'event',
            type: f + 'drink',
            ...meta(ev.container),
            text:
              t('fl.drink', { who: who(ev.container), liters: num(acc.liters, 2), thirst: num(acc.thirst, 0) }) +
              (effects ? `, ${effects}` : '') +
              (acc.burn ? `, ${t('fl.burn')}` : ''),
            data: { liters: acc.liters, temperature: ev.temperature, thirst: acc.thirst, effects: [...acc.effects], burn: acc.burn },
          },
          0.5,
        )
        break
      }
      case 'empty':
        c.log.add({ channel: 'event', type: f + 'empty', ...meta(ev.container), text: t('fl.empty', { who: who(ev.container) }) })
        break
      case 'splash':
        c.log.coalesce(`splash:${ev.liquid}`, { channel: 'event', type: f + 'splash', text: t('fl.splash', { liquid: c.liquidName(ev.liquid) }), data: { point: ev.point, intensity: ev.intensity } }, 1)
        break
      case 'stain': {
        const surface = t(`surface.${ev.surface}`)
        const liquid = c.liquidName(ev.liquid)
        stainInfo.set(ev.stain, { liquid: ev.liquid, surface, x: ev.point[0], z: ev.point[2] })
        // a leak or a spill makes several stains in a row: one line that counts them
        const key = `stain:${ev.liquid}:${ev.surface}`
        const acc = stainAcc.get(key)
        const n = acc && c.now() - acc.last <= 1 ? acc.n + 1 : 1
        stainAcc.set(key, { n, last: c.now() })
        c.log.coalesce(
          key,
          {
            channel: 'event',
            type: f + 'stain',
            text: n > 1 ? t('fl.stains', { n, liquid, surface, where: xz(ev.point[0], ev.point[2]) }) : t('fl.stain', { liquid, surface, where: xz(ev.point[0], ev.point[2]) }),
            data: { stain: ev.stain, surface: ev.surface, liquid: ev.liquid, point: ev.point, count: n },
          },
          1,
        )
        break
      }
      case 'dried': {
        const info = stainInfo.get(ev.stain)
        const key = `dried:${info?.liquid ?? '?'}:${ev.mark}`
        const acc = driedAcc.get(key)
        const n = acc && c.now() - acc.last <= 1.5 ? acc.n + 1 : 1
        driedAcc.set(key, { n, last: c.now() })
        const vars = { liquid: info ? c.liquidName(info.liquid) : '', surface: info?.surface ?? '', where: info ? xz(info.x, info.z) : '', n }
        const text = !info
          ? t(ev.mark ? 'fl.dried.mark' : 'fl.dried')
          : n > 1
            ? t(ev.mark ? 'fl.dried.many.mark' : 'fl.dried.many', vars)
            : t(ev.mark ? 'fl.dried.known.mark' : 'fl.dried.known', vars)
        c.log.coalesce(key, { channel: 'event', type: f + 'dried', text, data: { stain: ev.stain, mark: ev.mark, count: n } }, 1.5)
        break
      }
      case 'mix':
        c.log.add({ channel: 'event', type: f + 'mix', ...meta(ev.container), text: t('fl.mix', { who: who(ev.container), from: c.liquidName(ev.from), into: c.liquidName(ev.into) }) })
        break
      default:
        break
    }
  }

  return { events, fluid }
}
