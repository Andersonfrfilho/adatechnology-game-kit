import { createDestruction } from './world'
import type { DestructibleSpec, SizeStructureOptions, StructureRole } from './types'

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
  return out
}
