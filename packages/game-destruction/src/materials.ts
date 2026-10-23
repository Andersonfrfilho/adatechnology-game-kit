import materialsJson from './data/materials.json'
import hintsJson from './data/material-hints.json'
import { aabbOf, quatFromEuler, shapeDims } from './math'
import type { JointKind, JointSpec, MaterialDef, MaterialId, PartShape, PartSpec, ToolKind } from './types'

/** Built-in materials (data in `src/data/materials.json`). Override or extend with the `materials` option of `createDestruction`. */
export const MATERIALS: MaterialDef[] = materialsJson as unknown as MaterialDef[]

/** Default joint strength (joint hit points), tools that undo it and seconds of tool work. */
export const JOINT_DEFAULTS: Record<JointKind, { strength: number; tools: ToolKind[]; seconds: number }> = {
  screw: { strength: 80, tools: ['screwdriver'], seconds: 2.5 },
  bolt: { strength: 200, tools: ['wrench'], seconds: 4 },
  nail: { strength: 60, tools: ['pry_bar', 'hammer'], seconds: 2 },
  weld: { strength: 600, tools: ['cutting_torch', 'saw'], seconds: 8 },
  glue: { strength: 50, tools: ['pry_bar', 'knife'], seconds: 3 },
  hinge: { strength: 120, tools: ['screwdriver'], seconds: 3 },
  clip: { strength: 20, tools: ['hand'], seconds: 0.6 },
  tie: { strength: 15, tools: ['knife', 'hand'], seconds: 1 },
  mortar: { strength: 400, tools: ['hammer'], seconds: 6 },
  fused: { strength: 1000, tools: [], seconds: 0 },
  stem: { strength: 40, tools: ['knife', 'saw', 'hand'], seconds: 1.5 },
  rebar: { strength: 1500, tools: ['cutting_torch', 'saw'], seconds: 20 },
  resting: { strength: 30, tools: ['hand'], seconds: 1 },
}

const has = (m: MaterialDef, tag: string) => !!m.tags && m.tags.includes(tag)

/**
 * The joint kind that fits two materials: glass is glued (clipped to plastic), soft things are tied, plants share a stem, masonry gets mortar,
 * metal is welded, wood is screwed, plastic clips. `inferJoints` refines weld to bolt for thick metal and screw to nail for thin wood.
 */
export const JOINT_BY_MATERIALS = (a: MaterialDef, b: MaterialDef): JointKind => {
  const any = (tag: string) => has(a, tag) || has(b, tag)
  const both = (tag: string) => has(a, tag) && has(b, tag)
  if (any('glass')) return any('plastic') ? 'clip' : 'glue'
  if (any('fabric')) return 'tie'
  if (both('plant')) return 'stem'
  if (any('plant')) return 'tie'
  if (both('masonry')) return 'mortar'
  if (any('masonry') && any('metal')) return 'bolt'
  if (both('metal')) return 'weld'
  if (any('plastic')) return 'clip'
  if (any('rubber') || any('wax')) return 'glue'
  return 'screw'
}

const MATERIAL_MAP: ReadonlyMap<MaterialId, MaterialDef> = new Map(MATERIALS.map((m) => [m.id, m]))

const HINTS = Object.entries(hintsJson as Record<string, string>).sort((x, y) => y[0].length - x[0].length)

/** Guess a material id from a mesh or node name (case-insensitive substring; the longest keyword wins). */
export const guessMaterial = (name: string): MaterialId | undefined => {
  const n = name.toLowerCase()
  for (const [key, id] of HINTS) if (n.includes(key)) return id
  return undefined
}

/** Volume of a shape in m³. */
export const partVolume = (shape: PartShape): number => {
  if (shape.kind === 'box') return shape.size[0] * shape.size[1] * shape.size[2]
  if (shape.kind === 'cylinder') return Math.PI * shape.radius * shape.radius * shape.height
  return (4 / 3) * Math.PI * shape.radius ** 3
}

/** Mass of a part in kg: its `mass`, or density × volume × fill. */
export const partMass = (part: PartSpec, material: MaterialDef): number => part.mass ?? material.density * partVolume(part.shape) * (part.fill ?? 1)

/** Wall thickness of a part in metres (see `PartSpec.thickness`). */
export const partThickness = (part: PartSpec): number => {
  const dims = shapeDims(part.shape)
  const min = Math.min(dims[0], dims[1], dims[2])
  return Math.max(1e-4, Math.min(part.thickness ?? min * (part.fill ?? 1), min))
}

/**
 * Joints for touching parts. Two parts touch when their axis-aligned bounds (after rotation), grown by `tolerance` metres, overlap. The kind comes
 * from `JOINT_BY_MATERIALS`; thick metal pairs (smallest dimension of both >= 2 cm) get a `bolt` instead of a `weld`, and thin wood pairs (either
 * under 2 cm) a `nail` instead of a `screw`.
 */
export const inferJoints = (parts: PartSpec[], tolerance = 0.01, materials: ReadonlyMap<string, MaterialDef> = MATERIAL_MAP): JointSpec[] => {
  const boxes = parts.map((p) => aabbOf(p.shape, p.position, quatFromEuler(...(p.rotation ?? [0, 0, 0]))))
  const out: JointSpec[] = []
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = boxes[i], b = boxes[j]
      let touch = true
      for (let k = 0; k < 3 && touch; k++) if (a.min[k] - tolerance > b.max[k] || b.min[k] - tolerance > a.max[k]) touch = false
      if (!touch) continue
      const ma = materials.get(parts[i].material)
      const mb = materials.get(parts[j].material)
      let kind: JointKind = ma && mb ? JOINT_BY_MATERIALS(ma, mb) : 'screw'
      const thin = Math.min(partThickness(parts[i]), partThickness(parts[j]))
      if (kind === 'weld' && thin >= 0.02) kind = 'bolt'
      if (kind === 'screw' && ma && mb && has(ma, 'wood') && has(mb, 'wood') && thin < 0.02) kind = 'nail'
      out.push({ id: `${parts[i].id}~${parts[j].id}`, a: parts[i].id, b: parts[j].id, kind })
    }
  }
  return out
}

/**
 * Load in kg a structural part carries before it fails: `structure.capacity`, else `material.compressive` (default 20 000 kg/m²) times the
 * section. The section is the product of the two smallest dimensions (thickness times longest dimension for slabs; thickness times horizontal length for walls); foundations get x10.
 */
export const partCapacity = (part: PartSpec, material: MaterialDef): number => {
  if (part.structure?.capacity !== undefined) return part.structure.capacity
  const d = shapeDims(part.shape).sort((a, b) => a - b)
  const role = part.structure?.role
  const sh = shapeDims(part.shape)
  const section = role === 'wall' || role === 'partition' ? Math.min(sh[0], sh[2]) * Math.max(sh[0], sh[2]) : role === 'slab' ? d[0] * d[2] : d[0] * d[1]
  return Math.max(1, section * (material.compressive ?? 20000) * (role === 'foundation' ? 10 : 1))
}
