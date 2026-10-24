import type { Decisions, ExplosiveDecision } from './decisions'
import type { ArsenalExplosiveRow } from './extract-arsenal'
import type { GameExplosive } from './extract-game'
import type { LabProfile } from './extract-lab'

export type ExplosiveRecord = Readonly<Record<string, unknown>> & { readonly id: string }

export type ExplosiveInputs = {
  readonly arsenal: readonly ArsenalExplosiveRow[]
  readonly lab: Readonly<Record<string, LabProfile>>
  readonly game: Readonly<Record<string, GameExplosive>>
  readonly decisions: Decisions
}

const ROUNDING = 100
const TEMPERATURE_FALLBACK = 700
const roundJoules = (joules: number): number => Math.round(joules * ROUNDING) / ROUNDING

const hopkinsonEnergy = (lethalRadius: number, scale: Decisions['energyScale']['value']): number =>
  roundJoules(scale.anchorEnergy * Math.pow(lethalRadius / scale.anchorLethalRadius, scale.exponent))

const findLab = (inputs: ExplosiveInputs, id: string, key: string | undefined): LabProfile => {
  const profile = key === undefined ? undefined : inputs.lab[key]
  if (!profile) throw new Error(`weapons-catalog: explosive ${id} has no Laboratory profile "${String(key)}"`)
  return profile
}

const fireOf = (decision: ExplosiveDecision, inputs: ExplosiveInputs): Record<string, number> | undefined => {
  const extras = decision.extras?.value
  const names = decision.sources.value
  if (!extras?.fireFrom) return undefined
  const temperature = extras.fireTemperature ?? TEMPERATURE_FALLBACK
  if (extras.fireFrom === 'game') {
    const fire = inputs.game[names.game ?? '']?.fogoRes
    if (!fire) throw new Error('weapons-catalog: the game has no fogoRes for an explosive that asks for it')
    return { temperature, radius: fire[0], seconds: fire[1] }
  }
  const residual = findLab(inputs, 'fire', names.lab).residual?.[0]
  if (!residual) throw new Error('weapons-catalog: the Laboratory has no residual fire for an explosive that asks for it')
  return { temperature, radius: residual.r, seconds: residual.life }
}

const buildOne = (id: string, decision: ExplosiveDecision, inputs: ExplosiveInputs): ExplosiveRecord => {
  const names = decision.sources.value
  const lab = findLab(inputs, id, names.lab)
  const arsenal = inputs.arsenal.find((row) => row.name === names.arsenal)
  if (names.arsenal && !arsenal) throw new Error(`weapons-catalog: Arsenal §13 has no row "${names.arsenal}"`)
  const world = decision.world?.value
  const extras = decision.extras?.value
  const lethalRadius = lab.lethal
  const record: Record<string, unknown> = {
    id,
    name: decision.name.value,
    kind: decision.kind.value,
    lethalRadius,
    injuryRadius: lab.injury,
  }
  if (extras?.cone && lab.cone) record.cone = { halfAngleDeg: Math.round((lab.cone.half * 180) / Math.PI), length: lab.cone.len }
  record.energy = decision.energy?.value ?? hopkinsonEnergy(lethalRadius, inputs.decisions.energyScale.value)
  record.destructionLevel = arsenal?.destructionLevel ?? world?.destructionLevel
  record.noise = arsenal?.noise ?? world?.noise
  if (extras?.fuse !== undefined) record.fuse = extras.fuse
  if (extras?.fuseRange) record.fuseRange = extras.fuseRange
  if (extras?.fuseLength !== undefined) record.fuseLength = extras.fuseLength
  if (extras?.burnRate !== undefined) record.burnRate = extras.burnRate
  if (extras?.burnTolerance !== undefined) record.burnTolerance = extras.burnTolerance
  if (extras?.stunSeconds !== undefined) record.stunSeconds = extras.stunSeconds
  const fire = fireOf(decision, inputs)
  if (fire) record.fire = fire
  record.triggers = decision.triggers.value
  if (extras?.chain) record.chain = extras.chain
  if (extras?.mass !== undefined) record.mass = extras.mass
  const isReferenced = extras?.fuseRange !== undefined || extras?.burnRate !== undefined
  const origins = [arsenal ? 'arsenal' : undefined, 'lab', names.game ? 'game' : undefined, names.gallery ? 'gallery' : undefined, isReferenced ? 'reference' : undefined, world || decision.copyOf ? 'derived' : undefined]
  record.sources = origins.filter((origin) => origin !== undefined)
  return record as ExplosiveRecord
}

/** Applies `copyOf`: the copy keeps its own id, name and sources, and takes every number from the explosive it copies. */
const applyCopies = (records: ExplosiveRecord[], inputs: ExplosiveInputs): ExplosiveRecord[] =>
  records.map((record) => {
    const source = inputs.decisions.explosives[record.id]?.copyOf?.value
    if (!source) return record
    const original = records.find((candidate) => candidate.id === source)
    if (!original) throw new Error(`weapons-catalog: ${record.id} copies unknown explosive ${source}`)
    return { ...original, id: record.id, name: record.name, sources: record.sources } as ExplosiveRecord
  })

export const buildExplosives = (inputs: ExplosiveInputs): ExplosiveRecord[] =>
  applyCopies(
    Object.entries(inputs.decisions.explosives).map(([id, decision]) => buildOne(id, decision, inputs)),
    inputs,
  )
