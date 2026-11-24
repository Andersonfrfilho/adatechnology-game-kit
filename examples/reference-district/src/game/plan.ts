import { createUrban } from '@adatechnology/game-urban'
import type { CityPlanInput, PlanDistrict, PlanLandmark, PlanLine, UrbanKit } from '@adatechnology/game-urban'

import planJson from '../../data/recorte-1.plan.json'
import { readField, readList, readPoint, readPositive, readRect, readSize, readStrict, readString } from './read'
import type { Reader } from './read'

const readLocalizedName: Reader<Record<'pt-BR' | 'en', string>> = (value, path) => {
  const record = readStrict(['pt-BR', 'en'])(value, path)
  return { 'pt-BR': readField(record, path, 'pt-BR', readString), en: readField(record, path, 'en', readString) }
}

const readText: Reader<Record<'pt-BR' | 'en', { name: string; description: string }>> = (value, path) => {
  const record = readStrict(['pt-BR', 'en'])(value, path)
  const readEntry: Reader<{ name: string; description: string }> = (entry, entryPath) => {
    const fields = readStrict(['name', 'description'])(entry, entryPath)
    return { name: readField(fields, entryPath, 'name', readString), description: readField(fields, entryPath, 'description', readString) }
  }
  return { 'pt-BR': readField(record, path, 'pt-BR', readEntry), en: readField(record, path, 'en', readEntry) }
}

const readDistrict: Reader<PlanDistrict> = (value, path) => {
  const record = readStrict(['id', 'kind', 'rect'])(value, path)
  return { id: readField(record, path, 'id', readString), kind: readField(record, path, 'kind', readString), rect: readField(record, path, 'rect', readRect) }
}

const readLine: Reader<PlanLine> = (value, path) => {
  const record = readStrict(['id', 'kind', 'width', 'points'])(value, path)
  return {
    id: readField(record, path, 'id', readString),
    kind: readField(record, path, 'kind', readString),
    width: readField(record, path, 'width', readPositive),
    points: readField(record, path, 'points', readList(readPoint)),
  }
}

const readLandmark: Reader<PlanLandmark> = (value, path) => {
  const record = readStrict(['kind', 'at', 'name'])(value, path)
  return { kind: readField(record, path, 'kind', readString), at: readField(record, path, 'at', readPoint), name: readField(record, path, 'name', readLocalizedName) }
}

/** Checks the parsed JSON of a plan file as a `CityPlanInput` of `game-urban`; an error names the field (`$.districts[0].rect`). */
export function parsePlan(json: unknown): CityPlanInput {
  const record = readStrict(['id', 'scale', 'size', 'text', 'districts', 'lines', 'landmarks'])(json, '$')
  const [width, depth] = readField(record, '$', 'size', readSize)
  return {
    id: readField(record, '$', 'id', readString),
    scale: readField(record, '$', 'scale', readString),
    size: [width, depth],
    text: readField(record, '$', 'text', readText),
    districts: readField(record, '$', 'districts', readList(readDistrict)),
    lines: readField(record, '$', 'lines', readList(readLine)),
    landmarks: readField(record, '$', 'landmarks', readList(readLandmark)),
  }
}

/** The plan of the reference district, read from `data/recorte-1.plan.json`. */
export const referencePlan: CityPlanInput = parsePlan(planJson)

/** A `game-urban` kit that knows the reference plan (`urban.cities.layout(referencePlan.id)`). */
export function createReferenceUrban(): UrbanKit {
  // every lamp that is on becomes a source of the host's LightBudget, which lights only the nearest ones (its fixed slots): the urban allowance (the first 16 in draw order) would pick far ones
  return createUrban({ lights: { budget: Number.POSITIVE_INFINITY }, packs: { cityPlans: [referencePlan] } })
}
