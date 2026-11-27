import type { CameraChoice, DistrictOptions } from '../game/options'
import { SCENARIO_IDS } from './scripts'
import type { ScenarioId, Script, Scripts } from './scripts'

/** What the page address chooses: `?cena=tipico|pior|caos` and `?camera=third|first` (third person is the default, there is no view from above). */
export type PageChoice = {
  readonly scenario: ScenarioId
  /** `?lang=en` writes the HUD in English; the default is `pt-BR`. */
  readonly locale: 'pt-BR' | 'en'
  readonly camera: CameraChoice
  /** `?roteiro=1`: the page starts with an empty street and the script releases the horde (the determinism run). */
  readonly isScripted: boolean
  /** `?estado=clear` and `?hora=21.5`: hold another weather state and hour than the scenario's (the prints of the sky). */
  readonly weather: string | undefined
  readonly hour: number | undefined
}

export const DEFAULT_SCENARIO: ScenarioId = 'tipico'
const HOUR_OF = { day: 14, night: 23 } as const
const WEATHER_OF = { overcast: 'overcast', rain: 'heavy_rain' } as const

const SCENARIO_TITLE: Readonly<Record<'pt-BR' | 'en', Readonly<Record<ScenarioId, string>>>> = {
  'pt-BR': { tipico: 'Cena típica', pior: 'Pior caso', caos: 'Caos' },
  en: { tipico: 'Typical scene', pior: 'Worst case', caos: 'Chaos' },
}

/** The scenario's name the HUD shows, in `pt-BR` (default) or `en`. */
export const scenarioTitleOf = (scenario: ScenarioId, locale = 'pt-BR'): string => SCENARIO_TITLE[locale.toLowerCase().startsWith('en') ? 'en' : 'pt-BR'][scenario]

const hourOf = (value: string | null): number | undefined => {
  const hour = value === null ? Number.NaN : Number(value)
  return hour >= 0 && hour <= 24 ? hour : undefined
}

const isScenario = (value: string | null): value is ScenarioId => SCENARIO_IDS.some((id) => id === value)

/** Reads the address; an unknown scenario or camera falls back to the default one (the page always opens). */
export function parsePageChoice(search: string): PageChoice {
  const query = new URLSearchParams(search)
  const scenario = query.get('cena')
  return {
    scenario: isScenario(scenario) ? scenario : DEFAULT_SCENARIO,
    locale: query.get('lang') === 'en' ? 'en' : 'pt-BR',
    camera: query.get('camera') === 'first' ? 'first' : 'shoulder',
    isScripted: query.get('roteiro') === '1',
    weather: query.get('estado') ?? undefined,
    hour: hourOf(query.get('hora')),
  }
}

/** The script a scenario runs (§5 of the spec: `tipico` and `pior` the street, `caos` the crossing). */
export function scriptOf(scripts: Scripts, scenario: ScenarioId): Script {
  const script = scripts.scripts.find((candidate) => candidate.scenarios.includes(scenario))
  if (!script) throw new Error(`no script runs the scenario "${scenario}"`)
  return script
}

/** The horde zones a script releases, in order and without repeats: the zones the page fills at the start. */
export function zonesOfScript(script: Script): readonly string[] {
  const zones = script.events.flatMap((event) => (event.kind === 'horde_release' ? [event.zone] : []))
  return [...new Set(zones)]
}

/** The yaw that looks from one point toward another (yaw 0 looks toward -z, the way the camera and the player count it). */
export const yawToward = (from: { readonly x: number; readonly z: number }, to: { readonly x: number; readonly z: number }): number => Math.atan2(-(to.x - from.x), -(to.z - from.z))

/** The options of the district for a scenario: the zombies, the weather and the hour the scripts file gives it, the start of the script's path looking along it. */
export function districtOptionsOf({ scripts, choice, container }: { readonly scripts: Scripts; readonly choice: PageChoice; readonly container: HTMLElement }): DistrictOptions {
  const settings = scripts.scenarios[choice.scenario]
  const script = scriptOf(scripts, choice.scenario)
  const [first, second] = script.path
  if (!first || !second) throw new Error(`the script "${script.id}" has no path to start on`)
  return {
    container,
    zombies: choice.isScripted ? 0 : settings.zombies,
    hordeReserve: choice.isScripted ? settings.zombies : 0,
    hordeZones: zonesOfScript(script),
    weather: choice.weather ?? WEATHER_OF[settings.weather],
    hour: choice.hour ?? HOUR_OF[settings.timeOfDay],
    ...(settings.lights === undefined ? {} : { lights: settings.lights }),
    ...(settings.fog === undefined ? {} : { fog: settings.fog }),
    camera: choice.camera,
    start: { x: first.x, z: first.z, yaw: yawToward(first, second) },
    locale: choice.locale,
    title: scenarioTitleOf(choice.scenario, choice.locale),
  }
}
