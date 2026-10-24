import type { Decisions } from './decisions'
import type { BenchCategory } from './extract-bench'
import type { BestiaryData } from './extract-bestiary'
import type { ElencoData } from './extract-elenco'
import type { GameData } from './extract-game'

export type CatalogInputs = {
  readonly game: GameData
  readonly bestiary: BestiaryData
  readonly elenco: ElencoData
  readonly bench: readonly BenchCategory[]
  readonly decisions: Decisions
}

const hex = (color: number): string => color.toString(16).toUpperCase().padStart(6, '0')

const missing = (what: string, key: string): never => {
  throw new Error(`characters-catalog: no ${what} for "${key}" in decisions.json`)
}

const lookup = (map: Readonly<Record<string, string>>, key: string, what: string): string => map[key] ?? missing(what, key)

const withoutEvidence = (ability: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> => {
  const { evidence: _evidence, ...rest } = ability ?? {}
  return rest
}

export const buildTypes = ({ game, bestiary, bench, decisions }: CatalogInputs): unknown[] => {
  const { typeSpeeds, drownedSpawn } = decisions
  const rows = game.categories.map((category) => {
    const id = lookup(decisions.typeIds.value, category.id, 'type id')
    const text = bestiary.types.find((entry) => entry.n === category.nome)
    const benchChase = bench.find((entry) => entry[0] === category.nome)?.[2]
    const isBenchType = typeSpeeds.value.benchChaseFrom.includes(id)
    const isRunner = id === 'runner'
    const isDrowned = id === 'drowned'
    return {
      id,
      name: { en: lookup(decisions.typeNames.value, id, 'type name'), 'pt-BR': category.nome },
      spawnWeight: isDrowned ? drownedSpawn.value.spawnWeight : category.peso,
      ...(isDrowned ? { requires: drownedSpawn.value.requires } : {}),
      ...(category.noite === undefined ? {} : { nightShare: category.noite / 100 }),
      health: category.vida,
      speed: {
        wander: category.vel[0],
        chase: isBenchType ? (benchChase ?? category.vel[1]) : category.vel[1],
        ...(isBenchType ? { frenzy: category.vel[1] } : {}),
        ...(isRunner ? { chase: typeSpeeds.value.runner.chase, sprint: typeSpeeds.value.runner.sprint } : {}),
        ...(isDrowned ? { water: typeSpeeds.value.drownedWater } : {}),
      },
      damage: category.dano,
      biteChance: category.bite,
      multipliers: { head: category.mult[0], torso: category.mult[1], arms: category.mult[2], legs: category.mult[3] },
      perception: { sight: category.perc[0], hearing: category.perc[1], smell: category.perc[2] },
      eye: { color: hex(category.olho), ...(text?.dim ? { dim: true } : {}), ...(text?.blind ? { blind: true } : {}) },
      ...(category.escala === undefined ? {} : { scale: category.escala }),
      ...(category.porte === undefined ? {} : { build: category.porte }),
      ...(category.corpos === undefined ? {} : { bodyCount: category.corpos }),
      ...(category.crawl ? { crawls: true } : {}),
      posture: game.bestTypes[category.nome] ?? {},
      gait: bestiary.gaits[category.nome] ?? {},
      abilities: withoutEvidence(decisions.abilities.value[id]),
      text: text ? { 'pt-BR': { role: text.role, ai: text.ai, counter: text.counter, voice: text.voice } } : {},
    }
  })
  return decisions.typeOrder.value.map((id) => rows.find((row) => row.id === id) ?? missing('built type', id))
}

export const buildAges = ({ game, bestiary, decisions }: CatalogInputs): unknown => ({
  ages: game.ages.map((age, index) => {
    const id = decisions.ageIds.value[index] ?? missing('age id', String(index))
    return {
      id,
      name: { 'pt-BR': age.nome },
      probability: age.p,
      blood: age.sangue,
      speed: age.vel,
      health: age.vida,
      limbDamage: age.membro,
      freshBloodColor: hex(age.cor),
      dryBloodColor: hex(age.seco),
      perception: decisions.agePerception.value[id] ?? {},
    }
  }),
  skinTones: bestiary.skin.map(hex),
  bloodTones: bestiary.blood.map(hex),
  clothTones: bestiary.cloth.map(hex),
})

export const buildOutfits = ({ game, decisions }: CatalogInputs): unknown =>
  game.outfits.map((outfit, index) => {
    const id = decisions.outfitIds.value[index] ?? missing('outfit id', String(index))
    const presets = decisions.protectionPresets.value
    const protection = [
      ...(outfit.colete ? [presets[id]?.protectionId] : []),
      ...(outfit.capacete ? [presets.helmet?.protectionId] : []),
      ...(outfit.fogo !== undefined ? [presets.firefighter?.protectionId] : []),
    ].filter((entry): entry is string => entry !== undefined)
    const loot = decisions.lootPools.value[id]
    return {
      id,
      name: { 'pt-BR': outfit.nome },
      probability: outfit.p,
      color: outfit.cor === null ? null : hex(outfit.cor),
      protection,
      ...(outfit.colete ? { vest: { pistol: outfit.colete.pistola, rifle: outfit.colete.fuzil } } : {}),
      ...(outfit.capacete ? { helmet: true } : {}),
      ...(outfit.fogo === undefined ? {} : { fire: outfit.fogo }),
      ...(outfit.membro === undefined ? {} : { limbs: outfit.membro }),
      ...(loot ? { loot: { caliber: lookup(decisions.calibreIds.value, loot.item, 'calibre id'), chance: loot.chance } } : {}),
    }
  })

const STAGE_HOURS = /\((\d+) a (\d+) h\)/

export const buildInfection = ({ game, elenco, decisions }: CatalogInputs): unknown => ({
  wounds: Object.fromEntries(
    Object.entries(game.wounds).map(([key, [share, chance]]) => [lookup(decisions.woundNames.value, key, 'wound name'), { share, infectionChance: chance }]),
  ),
  accelerated: { feverSeconds: game.infection.febre, deliriumSeconds: game.infection.delirio, deathSeconds: game.infection.morte, reanimateSeconds: game.infection.reanima },
  stages: elenco.stages.map((stage) => {
    const hours = STAGE_HOURS.exec(stage.t)
    return { name: { 'pt-BR': stage.t }, ...(hours ? { fromHours: Number(hours[1]), toHours: Number(hours[2]) } : {}), skin: stage.skin, hunch: stage.hunch, arms: stage.arms }
  }),
  alternatives: { bestiaryScratchChance: 0.2 },
})

export const buildMoments = ({ decisions }: CatalogInputs): unknown => decisions.moments.value
