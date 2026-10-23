import { MATERIALS } from './materials'
import type { DamageType, DestructibleSpec, DestructionEvent, Hit, JointSpec, ObjectState, ToolKind } from './types'

/**
 * What a game module implements for an object whose behaviour it owns (a vehicle with its own panel deformation, a creature, a machine). The
 * world (`DestructionWorld.register`) hosts it next to its own objects: raycast, shoot, explode, hit, disassemble, extinguish, update, state,
 * reset and `on` all route to it.
 *
 * Space: the impl receives hits in WORLD space and returns events in WORLD space (it owns its transform; the transform given to `register` or
 * `setTransform` is only used by the world for raycasts and blast range). Every event must carry `object === id` and name parts listed by
 * `describe()`.
 */
export interface DestructibleImpl {
  readonly id: string
  readonly name?: string
  /** Parts, joints and structure in the impl's local space, for raycast, inspector and log. Called often: keep it cheap. */
  describe(): DestructibleSpec
  /** Apply one hit (see `IMPACT_CONTRACT` for the fields per type) and return the events it caused. */
  hit(hit: Hit): DestructionEvent[]
  /** Advance fire, melting, collapse and other timed behaviour. */
  update?(dt: number): DestructionEvent[]
  state(): ObjectState
  reset?(): void
  /** Same contract as `DestructionWorld.disassemble`: progress 0..1, or -1 when the tool cannot undo the joint. */
  disassemble?(jointId: string, tool: ToolKind, dt: number): number
  extinguish?(partId?: string): void
  /** Plain JSON of the impl's own state, stored in `DestructionSnapshot.impls`. */
  serialize?(): unknown
  load?(data: unknown): void
}

/** The fields a weapon or hazard must put in a `Hit`, per damage type. THE impact contract. */
export interface ImpactContract {
  required: string[]
  optional: string[]
  note: string
}

export const IMPACT_CONTRACT: Record<DamageType, ImpactContract> = {
  ballistic: { required: ['type', 'point', 'direction', 'energy', 'caliber'], optional: ['space', 'source'], note: 'bullets and pellets: joules and diameter in millimetres' },
  blunt: { required: ['type', 'point', 'energy'], optional: ['direction', 'radius', 'space', 'source'], note: 'contact radius in metres (default 3 cm)' },
  slash: { required: ['type', 'point', 'energy'], optional: ['direction', 'radius', 'space', 'source'], note: 'axes, knives, machetes' },
  explosive: { required: ['type', 'point', 'energy', 'radius'], optional: ['space', 'source'], note: 'point is the centre of the blast, radius the range in metres' },
  fire: { required: ['type', 'point', 'temperature', 'radius'], optional: ['duration', 'space', 'source'], note: 'flame temperature in °C; duration in seconds (call every frame with `dt`)' },
  heat: { required: ['type', 'point', 'temperature', 'radius'], optional: ['duration', 'space', 'source'], note: 'heat without flame (cutting torch, hot plate)' },
}

/** Problems with a hit according to the impact contract (empty when it is valid). */
export const checkHit = (hit: Hit): string[] => {
  const c = IMPACT_CONTRACT[hit.type]
  if (!c) return [`unknown damage type "${String(hit.type)}"`]
  const out: string[] = []
  for (const f of c.required) {
    const v = (hit as unknown as Record<string, unknown>)[f]
    if (v === undefined || (Array.isArray(v) ? v.some((n) => !Number.isFinite(n)) : typeof v === 'number' && !Number.isFinite(v))) out.push(`${hit.type} hit needs "${f}"`)
  }
  return out
}

export interface CheckOptions {
  /** Ids of custom materials the impl uses besides the built-in `MATERIALS`. */
  materials?: string[]
}

const finiteJson = (v: unknown, path: string, out: string[]) => {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) out.push(`${path} is not a finite number`)
  } else if (Array.isArray(v)) v.forEach((x, i) => finiteJson(x, `${path}[${i}]`, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) finiteJson(x, `${path}.${k}`, out)
  else if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') out.push(`${path} is not JSON`)
}

/**
 * Contract checker for the test room: `describe()` is valid, a 500 J ballistic hit at a part centre returns well-formed events of this impl, `state()`
 * matches `describe()`, hit points never go negative, `update(0.016)` returns an array and every event is JSON-serializable. It hits the impl
 * (and calls `reset()` afterwards when there is one).
 */
export const checkDestructible = (impl: DestructibleImpl, options: CheckOptions = {}): { ok: boolean; problems: string[] } => {
  const problems: string[] = []
  const known = new Set([...MATERIALS.map((m) => m.id), ...(options.materials ?? [])])
  let spec: DestructibleSpec | undefined
  try {
    spec = impl.describe()
  } catch (e) {
    return { ok: false, problems: [`describe() threw: ${String(e)}`] }
  }
  if (!spec || !Array.isArray(spec.parts) || spec.parts.length === 0) return { ok: false, problems: ['describe() must return at least one part'] }
  const ids = new Set<string>()
  for (const p of spec.parts) {
    if (ids.has(p.id)) problems.push(`duplicate part id "${p.id}"`)
    ids.add(p.id)
    if (!known.has(p.material)) problems.push(`part "${p.id}" has unknown material "${p.material}"`)
    if (!p.shape || !['box', 'cylinder', 'sphere'].includes(p.shape.kind)) problems.push(`part "${p.id}" has no valid shape`)
    if (!Array.isArray(p.position) || p.position.length !== 3) problems.push(`part "${p.id}" has no position`)
  }
  const jointIds = new Set<string>()
  for (const j of (spec.joints ?? []) as JointSpec[]) {
    if (!ids.has(j.a) || !ids.has(j.b)) problems.push(`joint "${j.id ?? `${j.a}~${j.b}`}" references an unknown part`)
    const jid = j.id ?? `${j.a}~${j.b}`
    if (jointIds.has(jid)) problems.push(`duplicate joint id "${jid}"`)
    jointIds.add(jid)
  }
  const checkState = (label: string) => {
    let st: ObjectState
    try {
      st = impl.state()
    } catch (e) {
      problems.push(`state() threw ${label}: ${String(e)}`)
      return
    }
    const sids = st.parts.map((p) => p.id).sort().join(',')
    if (sids !== [...ids].sort().join(',')) problems.push(`state() part ids do not match describe() ${label}`)
    for (const p of st.parts) if (!(p.hp >= 0)) problems.push(`part "${p.id}" has negative or invalid hp ${label}`)
  }
  const checkEvents = (events: unknown, label: string) => {
    if (!Array.isArray(events)) {
      problems.push(`${label} must return an array`)
      return
    }
    const evs = events as DestructionEvent[]
    evs.forEach((e, i) => {
      if (e.object !== impl.id) problems.push(`${label} event ${i} (${e.type}) has object "${String(e.object)}", expected "${impl.id}"`)
      const part = (e as { part?: string }).part
      if (part !== undefined && !ids.has(part)) problems.push(`${label} event ${i} (${e.type}) names unknown part "${part}"`)
    })
    const bad: string[] = []
    finiteJson(evs, 'events', bad)
    problems.push(...bad.map((b) => `${label}: ${b}`))
    try {
      const s = JSON.stringify(evs)
      if (JSON.stringify(JSON.parse(s)) !== s) problems.push(`${label} events do not survive a JSON round trip`)
    } catch (e) {
      problems.push(`${label} events are not JSON-serializable: ${String(e)}`)
    }
  }
  checkState('before the hit')
  const target = spec.parts[0]
  try {
    const hit: Hit = { type: 'ballistic', point: [target.position[0], target.position[1], target.position[2]], direction: [0, 0, -1], energy: 500, caliber: 9 }
    checkEvents(impl.hit(hit), 'hit()')
  } catch (e) {
    problems.push(`hit() threw: ${String(e)}`)
  }
  checkState('after the hit')
  if (impl.update) {
    try {
      checkEvents(impl.update(0.016), 'update()')
    } catch (e) {
      problems.push(`update() threw: ${String(e)}`)
    }
    checkState('after update')
  }
  try {
    impl.reset?.()
  } catch (e) {
    problems.push(`reset() threw: ${String(e)}`)
  }
  return { ok: problems.length === 0, problems }
}
