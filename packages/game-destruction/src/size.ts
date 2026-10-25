import { createDestruction } from './world'
import { bendGeometry, isFlexural, isReinforced, resolveFlexure, sectionMoments, sectionWidth, steelMoment, tensionSteel } from './flexure'
import { MATERIALS } from './materials'
import type { DestructibleSpec, MaterialDef, SizeStructureOptions, StructureRole } from './types'

/** Highest tension steel ratio a designer puts in a beam or slab (NBR 6118 17.3.5.2.4: 4% of the section). */
const MAX_REBAR_RATIO = 0.04

/** The spec without one part (and its joints; inferred joints are inferred again without it). */
const without = (spec: DestructibleSpec, id: string): DestructibleSpec => {
  const reduced: DestructibleSpec = { ...spec, parts: spec.parts.filter((p) => p.id !== id), joints: (spec.joints ?? []).filter((j) => j.a !== id && j.b !== id) }
  if (!spec.joints) delete reduced.joints
  return reduced
}

/**
 * Sizes the tension steel of the reinforced beams, slabs, roofs and stairs of a structure (a `reinforcement` cage or a `structure.rebar`), the way
 * `sizeStructure` sizes the capacities: each one gets the `structure.rebar.ratio` that keeps its bending at rest (`PartState.flexure`) at `safety`
 * (`safetyByRole`) and, with `redundancy`, at most `redundancy` after the loss of any part of `redundancyRoles`. Steel is only added (up to 4% of the
 * section) and plain concrete stays plain: a beam the spec makes without steel is a beam without steel. Returns a copy.
 */
export const sizeRebar = (spec: DestructibleSpec, options: SizeStructureOptions = {}): DestructibleSpec => {
  const flexure = resolveFlexure(options.flexure)
  const materials = new Map<string, MaterialDef>(MATERIALS.map((m) => [m.id, m]))
  for (const m of options.materials ?? []) materials.set(m.id, m)
  const out = structuredClone(spec)
  const targets = out.parts.filter((p) => {
    const m = materials.get(p.material)
    return p.shape.kind === 'box' && !!m && isReinforced(p) && isFlexural(p, m, flexure)
  })
  if (targets.length === 0) return out
  const safety = options.safety ?? 0.65
  const safetyOf = (role: StructureRole): number => options.safetyByRole?.[role] ?? safety
  const bending = (s: DestructibleSpec): Map<string, number> => {
    const w = createDestruction({ ...(options.materials ? { materials: options.materials } : {}), structure: { flexure: options.flexure } })
    const id = w.add(s)
    return new Map(w.state(id)!.parts.map((p) => [p.id, p.flexure ?? 0]))
  }
  const base = bending(out)
  const factor = new Map(targets.map((p) => [p.id, (base.get(p.id) ?? 0) / safetyOf(p.structure!.role)]))
  if (options.redundancy !== undefined) {
    const roles: readonly StructureRole[] = options.redundancyRoles ?? ['column']
    for (const lost of out.parts) {
      if (!lost.structure || !roles.includes(lost.structure.role)) continue
      const l = bending(without(out, lost.id))
      for (const p of targets) if (p.id !== lost.id) factor.set(p.id, Math.max(factor.get(p.id)!, (l.get(p.id) ?? 0) / options.redundancy))
    }
  }
  for (const p of targets) {
    const f = factor.get(p.id)!
    const g = bendGeometry(p)
    if (f <= 1 || g.gravity < 0) continue
    const section = { b: sectionWidth(g, g.gravity), h: g.dims[g.gravity] }
    const steel = tensionSteel(p, g.dims, section, flexure)
    const m = materials.get(p.material)!
    const need = f * sectionMoments(m, section, steel, flexure).ultimate
    const momentOf = (area: number) => steelMoment(area, steel.yieldMPa, steel.d, section.b, m.strength!.compressiveMPa, flexure)
    // the smallest steel area whose moment reaches the need (the moment grows with the area), found by bisection, at most the 4% cap
    const cap = MAX_REBAR_RATIO * section.b * steel.d
    if (steel.area >= cap) continue
    let lo = steel.area, hi = cap
    if (momentOf(hi) > need) {
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2
        if (momentOf(mid) < need) lo = mid
        else hi = mid
      }
    }
    const ratio = hi / (section.b * steel.d)
    p.structure = { ...p.structure!, rebar: { ...p.structure!.rebar, ratio } }
  }
  return out
}

/**
 * Sizes the load capacity of a structure the way an engineer would, from the loads the world itself computes. The intact spec goes through the
 * same load solver `createDestruction` uses, and each structural part (`structure.role` other than `none`) gets `structure.capacity = load / safety`,
 * so its at-rest stress is exactly `safety` (`safetyByRole` overrides it per role). With `redundancy` set, every part whose role is in
 * `redundancyRoles` (default `column`) is also removed in turn and the capacity of the parts that would carry more is raised so they stay at or below
 * `redundancy`. Parts without `structure`, with role `none`, or with no support path to an
 * anchored part are left as they are. The spec is not modified; a copy is returned.
 */
export const sizeStructure = (spec: DestructibleSpec, options: SizeStructureOptions = {}): DestructibleSpec => {
  const safety = options.safety ?? 0.65
  const redundancy = options.redundancy
  const redundancyRoles: readonly StructureRole[] = options.redundancyRoles ?? ['column']
  const safetyOf = (role: StructureRole): number => options.safetyByRole?.[role] ?? safety
  const loads = (s: DestructibleSpec): Map<string, { load: number; stress: number }> => {
    const w = createDestruction(options.materials ? { materials: options.materials } : {})
    const id = w.add(s)
    return new Map(w.state(id)!.parts.map((p) => [p.id, { load: p.load ?? 0, stress: p.stress ?? 0 }]))
  }
  const out = structuredClone(spec)
  const base = loads(out)
  const need = new Map<string, number>()
  for (const p of out.parts) {
    if (!p.structure || p.structure.role === 'none') continue
    const b = base.get(p.id)
    if (!b || b.stress <= 0) continue
    need.set(p.id, b.load / safetyOf(p.structure.role))
  }
  if (redundancy !== undefined) {
    for (const col of out.parts) {
      if (!col.structure || !redundancyRoles.includes(col.structure.role)) continue
      const reduced: DestructibleSpec = {
        ...out,
        parts: out.parts.filter((p) => p.id !== col.id),
        joints: (out.joints ?? []).filter((j) => j.a !== col.id && j.b !== col.id),
      }
      // joints are inferred when the spec has none; removing a part then removes its joints with it
      if (!out.joints) delete reduced.joints
      const l = loads(reduced)
      for (const [id, n] of need) {
        const r = l.get(id)
        if (r && r.stress > 0) need.set(id, Math.max(n, r.load / redundancy))
      }
    }
  }
  for (const p of out.parts) {
    const n = need.get(p.id)
    if (n !== undefined) p.structure = { ...p.structure!, capacity: n }
  }
  return sizeRebar(out, options)
}
