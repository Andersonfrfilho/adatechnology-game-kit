import { readFileSync } from 'node:fs'

import type { CatalogInputs } from './build-undead'
import type { Decisions } from './decisions'
import { penetrationLine, torsoResistance } from './penetration'
import type { CaliberInput } from './penetration'
import { WEAPONS_CALIBERS_PATH } from './paths'

const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places

const readCalibers = (): readonly CaliberInput[] => JSON.parse(readFileSync(WEAPONS_CALIBERS_PATH, 'utf8')) as CaliberInput[]

export const buildTeamGame = ({ game, decisions }: CatalogInputs): unknown => ({
  id: 'team-game',
  segments: { head: game.segments.cabeca, arm: game.segments.braco, leg: game.segments.perna },
  calibers: Object.fromEntries(
    Object.entries(game.calibers).map(([key, caliber]) => [
      decisions.calibreIds.value[key] ?? key,
      {
        gameKey: key,
        name: caliber.nome,
        points: caliber.dano,
        ...(caliber.bagos === undefined ? {} : { pellets: caliber.bagos }),
        penetration: caliber.pen,
        effectiveRangeMetres: caliber.alc,
        noiseMetres: caliber.ruido,
        skullRange: caliber.cranio,
        class: caliber.classe === 'pistola' ? 'pistol' : 'rifle',
      },
    ]),
  ),
  regionCost: decisions.teamGamePenetration.value.regionCost,
  damageKeptPerBody: decisions.teamGamePenetration.value.damageKeptPerBody,
  falloff: { fullAtRange: 1, atTwiceRange: decisions.teamGamePenetration.value.falloffAtTwiceRange },
  helmetAbsorbs: decisions.protectionPresets.value.helmet?.absorbs,
  regions: decisions.regionIds.value,
})

export const buildPhysical = ({ decisions }: CatalogInputs): unknown => {
  const rule = decisions.physicalPenetration.value
  const calibers = new Map(readCalibers().map((caliber) => [caliber.id, caliber]))
  return {
    id: 'physical',
    ...rule,
    torsoResistance: torsoResistance(rule),
    calibration: rule.calibration.map((row) => {
      const caliber = calibers.get(row.caliber)
      if (!caliber) throw new Error(`characters-catalog: calibre "${row.caliber}" is not in game-weapons`)
      return { ...penetrationLine(caliber, rule), expectedBodies: row.bodies, ...(row.bestiaryEnergyKept === undefined ? {} : { bestiaryEnergyKept: row.bestiaryEnergyKept }) }
    }),
  }
}

export const buildBody = ({ game, decisions }: CatalogInputs): unknown => ({
  guide: decisions.proportions.value.guide,
  teamGame: { source: decisions.proportions.value.teamGame, joints: game.joints, heightMetres: 1.8 },
  lodDistancesMetres: game.lodDistances,
  triangleBudget: decisions.triangleBudget.value,
})

const regionOf = (segment: string, decisions: Decisions): string => decisions.segmentRegions.value[segment] ?? segment

export const buildSegments = ({ game, elenco, decisions }: CatalogInputs, arsenal: import('./extract-arsenal-body').ArsenalBodyData): unknown => {
  const segments = Object.keys(arsenal.hitPoints).map((id) => ({
    id,
    region: regionOf(id, decisions),
    hitPoints: arsenal.hitPoints[id],
    multiplier: arsenal.multiplier[id],
    bleed: arsenal.bleed[id],
  }))
  const regionTotals = (region: string): number => segments.filter((segment) => segment.region === region).reduce((sum, segment) => sum + (segment.hitPoints ?? 0), 0)
  const gameHp: Readonly<Record<string, number>> = { head: game.segments.cabeca, arm: game.segments.braco, leg: game.segments.perna }
  const mapElenco = (key: string): string => decisions.elencoSegmentIds.value[key] ?? key
  return {
    segments,
    regions: Object.fromEntries(
      Object.entries(gameHp).map(([region, hitPoints]) => [region, { hitPoints, segmentSum: regionTotals(region), scale: round(hitPoints / regionTotals(region), 4) }]),
    ),
    arsenalWeapons: arsenal.weapons,
    elenco: {
      segments: Object.fromEntries(Object.entries(elenco.segments).map(([key, value]) => [mapElenco(key), value])),
      below: Object.fromEntries(Object.entries(elenco.below).map(([key, list]) => [mapElenco(key), list.map(mapElenco)])),
      falls: Object.fromEntries(Object.entries(elenco.falls).map(([key, text]) => [mapElenco(key), text])),
      cutWeapons: elenco.cutWeapons,
    },
    severity: decisions.severity.value,
    defaultCut: decisions.defaultCut.value,
    deathRule: decisions.deathRule.value,
  }
}

export const buildGait = ({ bestiary, elenco, game, decisions }: CatalogInputs): unknown => ({
  cascade: bestiary.cascade,
  moves: elenco.moves,
  poses: game.poseNames.map((name, index) => ({ index, id: decisions.poseIds.value[index] ?? name, name: { 'pt-BR': name } })),
  walk: game.walk,
})

export const buildAppearance = ({ game, decisions }: CatalogInputs): unknown => ({
  variance: decisions.appearanceVariance.value,
  civilianColors: game.civilianColors.map((color) => color.toString(16).toUpperCase().padStart(6, '0')),
  corpses: game.corpses,
})
