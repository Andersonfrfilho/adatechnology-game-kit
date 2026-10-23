import type { DestructionEvent, DestructionWorld, ToolKind } from '@adatechnology/game-destruction'
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
}

const SKIP_DAMAGE: ReadonlySet<string> = new Set(['fire', 'heat'])

/**
 * Turns destruction and fluid events into plain log lines in the room locale. Events of one frame arrive as a batch: a `damage` event is merged
 * into the dent, hole or crack it caused, a `leak` event into the hole that opened it, and the noisy ones (melt, drip, disassembly) become one
 * line that is updated while it goes on.
 */
export function createNarrator(c: NarrateContext) {
  const { t, num } = c

  const where = (objectId: string, partId: string): string => {
    const p = c.world.part(objectId, partId)
    return `${c.nameOf(objectId)} › ${partId}${p ? ` (${c.materialName(p.material)})` : ''}`
  }

  const stateOf = (objectId: string, partId: string): LogEntry['state'] => {
    const p = c.world.part(objectId, partId)
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
    material: part ? c.world.part(ev.object, part)?.material : undefined,
    state: part ? stateOf(ev.object, part) : undefined,
  })

  const hpText = (obj: string, part: string): string => {
    const p = c.world.part(obj, part)
    return p ? `hp ${num(p.hp, 0)}/${num(p.maxHp, 0)}` : ''
  }

  const events = (batch: DestructionEvent[]): void => {
    const damage = new Map<string, { amount: number; type: string }>()
    const holes = new Map<string, LogEntry>()
    const dents = new Map<string, LogEntry>()
    for (const ev of batch) {
      if (ev.type !== 'damage') continue
      const k = `${ev.object}|${ev.part}`
      const prev = damage.get(k)
      damage.set(k, { amount: (prev?.amount ?? 0) + ev.amount, type: ev.damageType })
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
          c.log.add({
            ...base(ev, ev.part),
            type: 'crack',
            text: t('ev.crack', { where: where(ev.object, ev.part), rays: ev.crack.rays, cm: num(ev.crack.length * 100, 0), hp: hpText(ev.object, ev.part) }),
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
            text: t(`ev.fracture.${ev.style}`, { where: where(ev.object, ev.part), n: ev.fragments.length }),
            data: { style: ev.style, fragments: ev.fragments.length, damage: d?.amount, point: ev.point, source: ev.source },
          })
          break
        }
        case 'detach': {
          const [a, b] = ev.parts
          c.log.add({
            channel: 'event',
            type: 'detach',
            objectId: ev.object,
            itemId: c.itemIdOf(ev.object),
            text: t('ev.detach', { obj: c.nameOf(ev.object), a, b, by: t(`by.${ev.by}`), n: ev.groups.length }),
            data: { joint: ev.joint, parts: ev.parts, by: ev.by, groups: ev.groups.length },
          })
          break
        }
        case 'disassemble_progress': {
          const pct = Math.round(ev.progress * 100)
          const kind = c.world.state(ev.object)?.joints.find((j) => j.id === ev.joint)?.kind ?? ''
          c.log.coalesce(
            `dis:${ev.object}:${ev.joint}`,
            {
              channel: 'event',
              type: 'disassemble_progress',
              objectId: ev.object,
              itemId: c.itemIdOf(ev.object),
              text: t('ev.disassemble', { obj: c.nameOf(ev.object), joint: ev.joint, kind: kind ? c.jointKind(kind) : '', tool: c.toolName(ev.tool as ToolKind), pct }),
              data: { joint: ev.joint, tool: ev.tool, progress: ev.progress },
            },
            1.5,
          )
          break
        }
        case 'ignite':
          c.log.add({ ...base(ev, ev.part), type: 'ignite', text: t('ev.ignite', { where: where(ev.object, ev.part), temp: num(c.world.part(ev.object, ev.part)?.temperature ?? 0, 0) }) })
          break
        case 'extinguish':
          c.log.add({ ...base(ev, ev.part), type: 'extinguish', text: t('ev.extinguish', { where: where(ev.object, ev.part) }) })
          break
        case 'burnout':
          c.log.add({ ...base(ev, ev.part), type: 'burnout', text: t('ev.burnout', { where: where(ev.object, ev.part) }) })
          break
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
            const parts = Array.isArray(x.parts) ? (x.parts as unknown[]) : []
            c.log.add({
              channel: 'event',
              type: 'collapse',
              
              objectId: x.object,
              itemId: c.itemIdOf(x.object),
              text: t('ev.collapse', { obj: c.nameOf(x.object), n: parts.length, mass: num(Number(x.mass ?? 0), 0) }),
              data: { parts: parts.length, massKg: x.mass, cause: x.cause },
            })
          }
        }
      }
    }
    // damage that no dent, hole, crack or fracture explained (blunt thuds, blast, absorbed bullets)
    for (const [k, d] of damage) {
      if (SKIP_DAMAGE.has(d.type) || d.amount < 0.5) continue
      const [obj, part] = k.split('|')
      c.log.add({
        channel: 'event',
        type: 'damage',
        objectId: obj,
        itemId: c.itemIdOf(obj),
        part,
        material: c.world.part(obj, part)?.material,
        state: stateOf(obj, part),
        text: t('ev.damage', { where: where(obj, part), type: t(`dmg.${d.type}`), amount: num(d.amount, 0), hp: hpText(obj, part) }),
        data: { amount: d.amount, damageType: d.type },
      })
    }
  }

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
      case 'leak':
        c.log.coalesce(`fleak:${ev.container}`, { channel: 'event', type: f + 'leak', ...meta(ev.container), text: t('fl.leak', { who: who(ev.container), liquid: c.liquidName(ev.liquid), rate: num(ev.rate, 2) }), data: { rate: ev.rate, point: ev.point } }, 2)
        break
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
      case 'stain':
        c.log.add({ channel: 'event', type: f + 'stain', text: t('fl.stain', { liquid: c.liquidName(ev.liquid), surface: t(`surface.${ev.surface}`), x: num(ev.point[0], 1), z: num(ev.point[2], 1) }), data: { stain: ev.stain, surface: ev.surface, liquid: ev.liquid, point: ev.point } })
        break
      case 'dried':
        c.log.add({ channel: 'event', type: f + 'dried', text: t(ev.mark ? 'fl.dried.mark' : 'fl.dried'), data: { stain: ev.stain, mark: ev.mark } })
        break
      case 'mix':
        c.log.add({ channel: 'event', type: f + 'mix', ...meta(ev.container), text: t('fl.mix', { who: who(ev.container), from: c.liquidName(ev.from), into: c.liquidName(ev.into) }) })
        break
      default:
        break
    }
  }

  return { events, fluid }
}
