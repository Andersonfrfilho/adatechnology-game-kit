import type { DestructibleSpec } from './destruction'

export interface CheckSpecOptions {
  /** Known material ids. When given, every part's material must be one of them. */
  materials?: Iterable<string>
}

export interface SpecReport {
  /** False when there is at least one problem (warnings do not count). */
  ok: boolean
  problems: string[]
  /** Things that are legal but probably wrong, e.g. structural parts that cannot reach an anchored part. */
  warnings: string[]
}

const STRUCTURE_ROLES = ['foundation', 'column', 'beam', 'slab', 'wall', 'partition', 'roof', 'stair', 'none']
const BEARS = [true, false, 'a_on_b', 'b_on_a']

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const positive = (n: unknown): boolean => finite(n) && n > 0
const vec3 = (v: unknown): boolean => Array.isArray(v) && v.length === 3 && v.every(finite)
const nonNegative = (n: unknown): boolean => n === undefined || (finite(n) && n >= 0)

/**
 * Static checks on a `DestructibleSpec` (no world needed), for items that give a `spec` instead of an `impl`: unique part ids, known materials
 * (when `options.materials` is given), joints that reference existing, different parts, finite positive sizes, non-negative mass / hp / capacity,
 * valid structure roles and `bears` directions. A structural part with no path of joints to an anchored part is a warning, not a problem: it
 * is allowed, it just falls.
 */
export const checkSpec = (spec: DestructibleSpec, options: CheckSpecOptions = {}): SpecReport => {
  const problems: string[] = []
  const warnings: string[] = []
  const materials = options.materials ? new Set(options.materials) : null
  const parts = Array.isArray(spec?.parts) ? spec.parts : []
  if (!Array.isArray(spec?.parts) || parts.length === 0) problems.push('the spec needs at least one part')
  const ids = new Set<string>()
  for (const p of parts) {
    const id = String(p?.id ?? '')
    const label = `part "${id}"`
    if (id === '') problems.push('a part has no id')
    else if (ids.has(id)) problems.push(`duplicate part id "${id}"`)
    ids.add(id)
    if (materials && !materials.has(p?.material)) problems.push(`${label} has unknown material "${String(p?.material)}"`)
    else if (typeof p?.material !== 'string' || p.material === '') problems.push(`${label} needs a material`)
    const s = p?.shape
    if (s?.kind === 'box') {
      if (!Array.isArray(s.size) || s.size.length !== 3 || !s.size.every(positive)) problems.push(`${label} box size must be three finite positive numbers`)
    } else if (s?.kind === 'cylinder') {
      if (!positive(s.radius) || !positive(s.height)) problems.push(`${label} cylinder radius and height must be finite and positive`)
    } else if (s?.kind === 'sphere') {
      if (!positive(s.radius)) problems.push(`${label} sphere radius must be finite and positive`)
    } else problems.push(`${label} has an unknown shape`)
    if (!vec3(p?.position)) problems.push(`${label} needs a finite position [x, y, z]`)
    if (p?.rotation !== undefined && !vec3(p.rotation)) problems.push(`${label} has an invalid rotation`)
    for (const f of ['mass', 'hp', 'thickness'] as const) if (!nonNegative(p?.[f])) problems.push(`${label} ${f} must be a finite number >= 0`)
    if (p?.fill !== undefined && !(finite(p.fill) && p.fill >= 0 && p.fill <= 1)) problems.push(`${label} fill must be between 0 and 1`)
    if (p?.structure) {
      if (!STRUCTURE_ROLES.includes(p.structure.role)) problems.push(`${label} has an invalid structure role "${String(p.structure.role)}"`)
      if (!nonNegative(p.structure.capacity)) problems.push(`${label} structure capacity must be a finite number >= 0`)
    }
    if (p?.contains && !nonNegative(p.contains.liters)) problems.push(`${label} contains.liters must be a finite number >= 0`)
  }

  const jointIds = new Set<string>()
  const edges: Array<[string, string]> = []
  for (const j of spec?.joints ?? []) {
    const id = j.id ?? `${j.a}~${j.b}`
    const label = `joint "${id}"`
    if (jointIds.has(id)) problems.push(`duplicate joint id "${id}"`)
    jointIds.add(id)
    if (!ids.has(j.a)) problems.push(`${label} references unknown part "${String(j.a)}"`)
    if (!ids.has(j.b)) problems.push(`${label} references unknown part "${String(j.b)}"`)
    if (j.a === j.b) problems.push(`${label} joins part "${String(j.a)}" to itself`)
    if (j.bears !== undefined && !BEARS.includes(j.bears)) problems.push(`${label} has an invalid bears "${String(j.bears)}"`)
    if (!nonNegative(j.strength)) problems.push(`${label} strength must be a finite number >= 0`)
    if (!nonNegative(j.seconds)) problems.push(`${label} seconds must be a finite number >= 0`)
    if (j.bears !== false && ids.has(j.a) && ids.has(j.b) && j.a !== j.b) edges.push([j.a, j.b])
  }

  // structural parts must reach an anchored part over the joints (only when the spec lists its joints: otherwise they are inferred later)
  const structural = parts.filter((p) => p?.structure && p.structure.role !== 'none')
  if (structural.length && spec.joints) {
    const anchored = parts.filter((p) => p.anchored || p.structure?.role === 'foundation').map((p) => p.id)
    const adj = new Map<string, string[]>()
    for (const [a, b] of edges) {
      adj.set(a, [...(adj.get(a) ?? []), b])
      adj.set(b, [...(adj.get(b) ?? []), a])
    }
    const seen = new Set(anchored)
    const queue = [...anchored]
    while (queue.length) {
      for (const n of adj.get(queue.pop()!) ?? []) {
        if (seen.has(n)) continue
        seen.add(n)
        queue.push(n)
      }
    }
    const lost = structural.filter((p) => !seen.has(p.id)).map((p) => p.id)
    if (lost.length) warnings.push(`structural part(s) ${lost.map((i) => `"${i}"`).join(', ')} cannot reach an anchored part, so they will fall`)
  }
  return { ok: problems.length === 0, problems, warnings }
}
