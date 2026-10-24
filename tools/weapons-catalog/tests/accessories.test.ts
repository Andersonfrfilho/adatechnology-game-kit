import { readFileSync } from 'node:fs'

import { beforeAll, describe, expect, it } from 'vitest'

import { loadDecisions } from '../src/decisions'
import type { Decisions } from '../src/decisions'
import { extractArsenal } from '../src/extract-arsenal'
import type { ArsenalAccessoryRow } from '../src/extract-arsenal'
import { OUTPUT_PATHS, SOURCE_PATHS } from '../src/paths'

type Mount = { readonly kind: string; readonly interfaces: readonly string[]; readonly sources: readonly string[] }
type Firearm = {
  readonly id: string
  readonly dimensions: { readonly length: number; readonly lengthCollapsed?: number }
  readonly mounts?: readonly Mount[]
  readonly fitted?: readonly { readonly id: string; readonly mount: string; readonly integral?: boolean }[]
  readonly stock?: { readonly kind: string; readonly foldAxis?: string }
}
type Attachment = { readonly id: string; readonly sources: readonly string[]; readonly mounts: readonly string[]; readonly interfaces: readonly string[]; readonly effects: readonly { readonly from?: string }[] }

const readRows = <TRow>(path: string): TRow[] => JSON.parse(readFileSync(path, 'utf8')) as TRow[]

let decisions: Decisions
let rows: readonly ArsenalAccessoryRow[]
let firearms: Firearm[]
let attachments: Attachment[]

beforeAll(() => {
  decisions = loadDecisions()
  rows = extractArsenal().accessories
  firearms = readRows<Firearm>(OUTPUT_PATHS.firearms)
  attachments = readRows<Attachment>(OUTPUT_PATHS.attachments)
})

describe('Arsenal §11 parser', () => {
  it('reads the 18 lines of the six cards with their group, name and effect', () => {
    expect(rows).toHaveLength(18)
    expect(rows.map((row) => row.group)).toEqual([
      ...Array<string>(3).fill('Boca do cano'),
      ...Array<string>(4).fill('Miras'),
      ...Array<string>(3).fill('Trilho inferior'),
      ...Array<string>(2).fill('Trilho lateral'),
      ...Array<string>(3).fill('Carregador'),
      ...Array<string>(3).fill('Coronha e cano'),
    ])
    const suppressor = rows.find((row) => row.name === 'Supressor')
    expect(suppressor?.effect).toBe('ruído −60% (com subsônica −75%), dano −5%, aquece e gasta durabilidade.')
    expect(rows.find((row) => row.name === 'Cano serrado')?.effect).toContain('dispersão maior')
  })
})

describe('accessories', () => {
  it('has every §11 line implemented by an accessory or a listed feature', () => {
    const claimed = new Set([...Object.values(decisions.attachments).map((decision) => decision.value.arsenal), ...Object.keys(decisions.arsenalFeatures.value)])
    expect(rows.filter((row) => !claimed.has(row.name))).toEqual([])
  })

  it('gives every accessory sources, and every decision a reason (with a URL when it is a reference)', () => {
    for (const [id, decision] of Object.entries(decisions.attachments)) {
      expect(decision.value.sources.length, id).toBeGreaterThan(0)
      expect(decision.reason.length, id).toBeGreaterThan(20)
      if (decision.source === 'reference' || decision.value.sources.includes('reference')) expect(decision.reason, id).toMatch(/https?:\/\//)
      expect(decision.value.sources.includes('arsenal'), id).toBe(decision.value.arsenal !== undefined)
    }
    expect(attachments.map((attachment) => attachment.id)).toEqual(Object.keys(decisions.attachments))
    for (const attachment of attachments) expect(attachment.sources.length, attachment.id).toBeGreaterThan(0)
  })

  it('takes every cited number from the text of its §11 line and leaves the citation out of the data', () => {
    for (const [id, decision] of Object.entries(decisions.attachments)) {
      const row = rows.find((candidate) => candidate.name === decision.value.arsenal)
      for (const effect of decision.value.effects) if (effect.from !== undefined) expect(row?.effect, `${id}: ${effect.from}`).toContain(effect.from)
    }
    for (const attachment of attachments) for (const effect of attachment.effects) expect(effect.from).toBeUndefined()
  })

  it('has the numbers of §11 in the suppressor, the brake, the grip, the bipod and the magazines', () => {
    const effectOf = (id: string, stat: string, when?: string): { mul?: number; set?: number } | undefined =>
      (attachments.find((attachment) => attachment.id === id)?.effects as readonly { stat: string; when?: string; mul?: number; set?: number }[] | undefined)?.find((effect) => effect.stat === stat && effect.when === when)
    expect(effectOf('suppressor', 'noise')?.mul).toBe(0.4)
    expect((effectOf('suppressor', 'noise')?.mul ?? 0) * (effectOf('suppressor', 'noise', 'subsonic')?.mul ?? 0)).toBeCloseTo(0.25, 10)
    expect(effectOf('suppressor', 'muzzleSpeed')?.mul).toBeCloseTo(Math.sqrt(0.95), 4)
    expect(effectOf('oil_filter_suppressor', 'noise')?.mul).toBe(0.6)
    expect(effectOf('muzzle_brake', 'recoilVertical')?.mul).toBe(0.75)
    expect(effectOf('muzzle_brake', 'noise')?.mul).toBe(1.1)
    expect(effectOf('vertical_grip', 'recoilVertical')?.mul).toBe(0.85)
    expect(effectOf('bipod', 'recoilVertical', 'supported')?.mul).toBe(0.4)
    expect(effectOf('extended_magazine', 'capacity')?.mul).toBe(1.5)
    expect(effectOf('extended_magazine', 'reload')?.mul).toBe(1.15)
    expect(effectOf('long_barrel', 'range')?.mul).toBe(1.2)
  })
})

describe('mounts and fitted accessories of the firearms', () => {
  it('only fits ids that exist, on a place the weapon has, and the factory parts that cannot come off are integral', () => {
    const ids = new Set(attachments.map((attachment) => attachment.id))
    for (const firearm of firearms) {
      const kinds = new Set((firearm.mounts ?? []).map((mount) => mount.kind))
      for (const part of firearm.fitted ?? []) {
        expect(ids.has(part.id), `${firearm.id}: ${part.id}`).toBe(true)
        expect(kinds.has(part.mount), `${firearm.id}: ${part.id} on ${part.mount}`).toBe(true)
      }
      for (const mount of firearm.mounts ?? []) {
        expect(mount.interfaces.length, `${firearm.id} ${mount.kind}`).toBeGreaterThan(0)
        expect(mount.sources.length, `${firearm.id} ${mount.kind}`).toBeGreaterThan(0)
      }
    }
    const integralIds = firearms.flatMap((firearm) => (firearm.fitted ?? []).filter((part) => part.integral).map((part) => `${firearm.id}:${part.id}`))
    expect(integralIds.sort()).toEqual(['browning_m2:tripod', 'hk_g36:integral_optic_3x', 'hk_g36k:integral_optic_3x', 'hk_mp5sd3:integral_suppressor', 'm24_sws:fixed_scope_10x', 'steyr_aug_a1:integral_optic_1_5x', 'svd_dragunov:pso_1'])
  })

  it('maps the Gallery options: rails, scopes, bipods, brakes and the AK slots of §17', () => {
    const byId = new Map(firearms.map((firearm) => [firearm.id, firearm]))
    const mountOf = (id: string, kind: string): Mount | undefined => byId.get(id)?.mounts?.find((mount) => mount.kind === kind)
    expect(mountOf('colt_m4a1', 'rail_top')?.interfaces).toContain('picatinny')
    expect(byId.get('colt_m4a1')?.fitted).toEqual([{ id: 'acog_4x', mount: 'rail_top' }])
    expect(byId.get('fn_minimi')?.fitted).toEqual([{ id: 'bipod', mount: 'rail_bottom' }])
    expect(byId.get('mac_10')?.fitted).toEqual([{ id: 'muzzle_brake_heavy', mount: 'muzzle' }])
    expect(mountOf('ak_47', 'muzzle')?.interfaces).toEqual(['thread_14x1lh'])
    expect(mountOf('akm', 'rail_left')?.interfaces).toEqual(['ak_side'])
    expect(mountOf('remington_700', 'rail_top')?.interfaces).toEqual(['dovetail'])
    expect(mountOf('glock_17', 'rail_top')).toBeUndefined()
    const html = readFileSync(SOURCE_PATHS.arsenal, 'utf8')
    for (const slot of ['boca_rosca_14x1', 'trilho_lateral_ak']) expect(html).toContain(slot)
  })

  it('gives a weapon that holds a launcher mount only where the real mount exists (the GP-25 only on the AKs: the SKS and the RPK have none)', () => {
    const withLauncher = firearms.filter((firearm) => firearm.mounts?.some((mount) => mount.kind === 'underbarrel' && mount.interfaces.some((name) => ['m203', 'gp25', 'ag36'].includes(name))))
    expect(withLauncher.map((firearm) => firearm.id).sort()).toEqual(['ak_12', 'ak_47', 'ak_74', 'akm', 'colt_m16a2', 'colt_m4a1', 'hk416'])
  })
})

describe('stocks', () => {
  it('gives every folding or sliding stock a length with it in, shorter than the weapon, and a fold axis when it folds', () => {
    const stocked = firearms.filter((firearm) => firearm.stock)
    expect(stocked.length).toBeGreaterThanOrEqual(18)
    for (const firearm of stocked) {
      expect(firearm.dimensions.lengthCollapsed, firearm.id).toBeDefined()
      expect(firearm.dimensions.lengthCollapsed ?? Infinity, firearm.id).toBeLessThan(firearm.dimensions.length)
      if (firearm.stock?.kind === 'fold' || firearm.stock?.kind === 'fold_retract') expect(firearm.stock.foldAxis, firearm.id).toBeDefined()
    }
  })

  it('has a referenced length (with a URL) for the seven weapons the sheet does not cover', () => {
    for (const id of ['imbel_ia2', 'taurus_t4', 'benelli_m4', 'franchi_spas_12', 'barrett_mrad', 'cheytac_m200', 'm14_ebr']) {
      const decision = decisions.stocks[id]
      expect(decision?.value.lengthCollapsed, id).toBeGreaterThan(0)
      expect(decision?.source === 'reference' || decision?.source === 'derived', id).toBe(true)
      expect(decision?.reason, id).toMatch(/https?:\/\//)
    }
  })

  it('knows the fold axis of the folding stocks the real weapons have', () => {
    const axisOf = (id: string): string | undefined => firearms.find((firearm) => firearm.id === id)?.stock?.foldAxis
    expect(axisOf('uzi')).toBe('under')
    expect(axisOf('franchi_spas_12')).toBe('over')
    for (const id of ['cz_scorpion_evo_3', 'fn_scar_h', 'imbel_ia2', 'barrett_mrad', 'hk_ump_45']) expect(axisOf(id), id).toBe('right')
    expect(firearms.find((firearm) => firearm.id === 'mac_10')?.stock?.kind).toBe('retract')
  })
})

describe('launchers under a barrel', () => {
  it('has the measures of the manuals for the M203, a URL for every reference and the explosive of each', () => {
    const launchers = JSON.parse(readFileSync(OUTPUT_PATHS.launchers, 'utf8')) as { id: string; mass: number; tags?: string[]; dimensions: { length: number; barrel: number; emptyMass: number }; action: { projectile: string; speed: number; family: string } }[]
    const explosives = JSON.parse(readFileSync(OUTPUT_PATHS.explosives, 'utf8')) as { id: string; sources: string[] }[]
    const m203 = launchers.find((launcher) => launcher.id === 'm203')
    expect(m203?.dimensions).toEqual({ length: 0.38, barrel: 0.305, emptyMass: 1.36 })
    expect(m203?.action).toMatchObject({ projectile: 'm79_40mm', speed: 76, family: 'underbarrel' })
    for (const [id, decision] of Object.entries(decisions.underbarrelLaunchers)) {
      expect(decision.reason, id).toMatch(/https?:\/\//)
      expect(launchers.find((launcher) => launcher.id === id)?.tags, id).toEqual(['underbarrel'])
      expect(explosives.some((explosive) => explosive.id === decision.value.projectile), id).toBe(true)
    }
    expect(decisions.explosives.vog_25?.copyOf?.value).toBe('m79_40mm')
    expect(decisions.explosives.vog_25?.copyOf?.reason).toMatch(/https?:\/\//)
    const attached = attachments as unknown as { id: string; launcher?: string }[]
    for (const part of attached.filter((candidate) => candidate.launcher !== undefined)) expect(launchers.some((launcher) => launcher.id === part.launcher), part.id).toBe(true)
  })
})
