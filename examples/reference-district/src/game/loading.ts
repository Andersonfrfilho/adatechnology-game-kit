import type { BusySink, BusyTask } from '@adatechnology/game-contracts'

/** The steps the district is assembled in, in order: the one at work is on the loading card, and the bar fills as they end. */
export const DISTRICT_STEPS = ['world', 'streets', 'houses', 'horde', 'warmUp'] as const
export type DistrictStep = (typeof DISTRICT_STEPS)[number]

/** The texts of the loading card, already translated: its title, the line before the first step, the prefix of a failure, and one line per step. */
export type DistrictLoadingText = {
  readonly title: string
  readonly working: string
  readonly failed: string
  readonly steps: Readonly<Record<DistrictStep, string>>
}

export const DISTRICT_LOADING_TEXT: DistrictLoadingText = {
  title: 'Carregando o bairro…',
  working: 'Iniciando…',
  failed: 'Falha ao carregar: ',
  steps: {
    world: 'Montando o mundo…',
    streets: 'Ruas, postes e redes…',
    houses: 'Construindo as casas…',
    horde: 'Espalhando a horda…',
    warmUp: 'Preparando a imagem…',
  },
}

/**
 * The assembly as the loading card sees it: `step` names the step that starts (and waits for the card to be painted before the heavy work), `end` takes the card down, `fail` leaves it up
 * with the error on it, so a district that could not come up never leaves a black page.
 */
export type DistrictProgress = {
  step(step: DistrictStep): Promise<void>
  end(): void
  fail(error: unknown): void
}

const SILENT: DistrictProgress = { step: () => Promise.resolve(), end: () => undefined, fail: () => undefined }

/** One opaque task on the sink for the whole assembly, a bar of one notch per step; without a sink nothing is shown. */
export function startDistrictProgress(sink: BusySink | undefined, text: DistrictLoadingText): DistrictProgress {
  if (!sink) return SILENT
  const task: BusyTask = sink.begin(text.title, { total: DISTRICT_STEPS.length, opaque: true })
  return {
    async step(step) {
      task.step(text.steps[step], DISTRICT_STEPS.indexOf(step))
      await task.paint()
    },
    end: () => task.end(),
    fail: (error) => task.step(`${text.failed}${error instanceof Error ? error.message : String(error)}`),
  }
}
