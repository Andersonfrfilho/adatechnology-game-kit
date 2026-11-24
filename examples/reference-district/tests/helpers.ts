import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { engine } from '@adatechnology/game-floorplan'
import { register as registerCommercial } from '@adatechnology/game-floorplan-commercial'
import { register as registerResidential } from '@adatechnology/game-floorplan-residential'
import type { PlanLine, PlanPoint, PlanRect } from '@adatechnology/game-urban'

import { parsePlan } from '../src/game/plan'
import { parseSite } from '../src/game/site'
import { parseScripts } from '../src/test/scripts'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '../data')

export const readJson = (name: string): unknown => JSON.parse(readFileSync(join(DATA_DIR, name), 'utf8'))

export const plan = parsePlan(readJson('recorte-1.plan.json'))
export const site = parseSite(readJson('recorte-1.site.json'))
export const scripts = parseScripts(readJson('recorte-1.scripts.json'))

/** The shared engine with the residential and commercial packs, as the packages' own tests register them. */
export function createTestEngine(): typeof engine {
  registerResidential(engine, { region: 'br' })
  registerCommercial(engine, { region: 'br' })
  return engine
}

export const rectsOverlap = (a: PlanRect, b: PlanRect): boolean => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

function distanceToSegment(point: PlanPoint, from: PlanPoint, to: PlanPoint): number {
  const [dx, dz] = [to[0] - from[0], to[1] - from[1]]
  const lengthSquared = dx * dx + dz * dz
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) / lengthSquared))
  return Math.hypot(point[0] - (from[0] + t * dx), point[1] - (from[1] + t * dz))
}

function segmentCrossesRect(from: PlanPoint, to: PlanPoint, rect: PlanRect): boolean {
  let [t0, t1] = [0, 1]
  const deltas = [to[0] - from[0], to[1] - from[1]] as const
  const starts = [from[0], from[1]] as const
  for (const axis of [0, 1] as const) {
    const [low, high] = [rect[axis], rect[axis + 2]]
    const delta = deltas[axis]
    if (delta === 0) {
      if (starts[axis] <= low || starts[axis] >= high) return false
      continue
    }
    const [ta, tb] = [(low - starts[axis]) / delta, (high - starts[axis]) / delta]
    t0 = Math.max(t0, Math.min(ta, tb))
    t1 = Math.min(t1, Math.max(ta, tb))
  }
  return t0 < t1
}

const distanceToRect = (point: PlanPoint, rect: PlanRect): number =>
  Math.hypot(Math.max(rect[0] - point[0], 0, point[0] - rect[2]), Math.max(rect[1] - point[1], 0, point[1] - rect[3]))

/** True when the band of a plan line (its width around the polyline) covers part of the rect; touching the edge does not count. */
export function lineBandOverlapsRect(line: PlanLine, rect: PlanRect): boolean {
  const half = line.width / 2
  const corners: PlanPoint[] = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]]
  for (let index = 0; index + 1 < line.points.length; index++) {
    const [from, to] = [line.points[index] as PlanPoint, line.points[index + 1] as PlanPoint]
    if (segmentCrossesRect(from, to, rect)) return true
    // a segment outside the rect comes closest to it at an end of the segment or at a corner of the rect
    const closest = Math.min(distanceToRect(from, rect), distanceToRect(to, rect), ...corners.map((corner) => distanceToSegment(corner, from, to)))
    if (closest < half - 1e-9) return true
  }
  return false
}

/** The urban kit that knows the reference plan. */
export { createReferenceUrban as createUrbanForTest } from '../src/game/plan'
