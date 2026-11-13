import type { DestructibleSpec, JointSpec, PartSpec } from '@adatechnology/game-contracts'

import { MIN_BEAM_WIDTH, MIN_PILLAR_AREA, MIN_PILLAR_SIDE, STRUCTURAL_VIOLATION } from './codes'
import type { StructuralViolation } from './codes'

const EPSILON = 0.005

const carries = (part: PartSpec | undefined): boolean => part?.structure !== undefined && part.structure.role !== 'none'

/** The directions load flows over a joint: `[from, to]` pairs (a part rests on the second). */
function flows(joint: JointSpec, byId: ReadonlyMap<string, PartSpec>): [string, string][] {
  const bears = joint.bears ?? (carries(byId.get(joint.a)) && carries(byId.get(joint.b)))
  if (bears === false) return []
  if (bears === 'a_on_b') return [[joint.a, joint.b]]
  if (bears === 'b_on_a') return [[joint.b, joint.a]]
  return [[joint.a, joint.b], [joint.b, joint.a]]
}

function groundedOf(spec: DestructibleSpec, byId: ReadonlyMap<string, PartSpec>): Set<string> {
  const grounded = new Set(spec.parts.filter((p) => p.anchored || p.structure?.role === 'foundation').map((p) => p.id))
  const edges = (spec.joints ?? []).flatMap((joint) => flows(joint, byId))
  let grew = true
  while (grew) {
    grew = false
    for (const [part, on] of edges) {
      if (grounded.has(part) || !grounded.has(on)) continue
      grounded.add(part)
      grew = true
    }
  }
  return grounded
}

function sectionViolation(part: PartSpec): StructuralViolation | null {
  if (part.material !== 'concrete' || part.shape.kind !== 'box') return null
  const role = part.structure?.role
  const [x, y, z] = part.shape.size
  if (role === 'column' && (Math.min(x, z) < MIN_PILLAR_SIDE - EPSILON || x * z < MIN_PILLAR_AREA - EPSILON))
    return { code: STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION, part: part.id, message: `${part.id} is ${x.toFixed(2)} x ${z.toFixed(2)} m: NBR 6118 asks at least ${MIN_PILLAR_SIDE} m a side and ${MIN_PILLAR_AREA} m²` }
  if (role === 'beam' && Math.min(x, z) < MIN_BEAM_WIDTH - EPSILON && y >= Math.min(x, z))
    return { code: STRUCTURAL_VIOLATION.CONCRETE_BELOW_MIN_SECTION, part: part.id, message: `${part.id} is ${Math.min(x, z).toFixed(2)} m wide: NBR 6118 asks at least ${MIN_BEAM_WIDTH} m` }
  return null
}

/** Every structural part of the spec reaches an anchored part over the joints that bear; every concrete pillar and beam has the NBR 6118 minimum section. */
export function specViolations(spec: DestructibleSpec): StructuralViolation[] {
  const byId = new Map(spec.parts.map((part) => [part.id, part]))
  const grounded = groundedOf(spec, byId)
  const out: StructuralViolation[] = []
  for (const part of spec.parts) {
    if (!carries(part)) continue
    if (!grounded.has(part.id)) {
      const pillar = part.structure!.role === 'column'
      out.push({ code: pillar ? STRUCTURAL_VIOLATION.PILLAR_NOT_GROUNDED : STRUCTURAL_VIOLATION.FLOATING_PART, part: part.id, message: `${part.id} has no load path to an anchored part` })
    }
    const section = sectionViolation(part)
    if (section) out.push(section)
  }
  return out
}
