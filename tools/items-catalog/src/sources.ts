import { readFileSync } from 'node:fs'

import { loadDecisions } from './decisions'
import type { Decisions } from './decisions'
import { extractGame } from './extract-game'
import type { GameData } from './extract-game'
import { extractIte } from './extract-ite'
import type { IteData } from './extract-ite'
import { extractIteHtml } from './extract-ite-html'
import type { IteHtml } from './extract-ite-html'
import { extractVc3 } from './extract-vc3'
import type { HouseData } from './extract-vc3'
import { HOUSEHOLD_ITEMS_PATH } from './paths'

/** The household item of the SDK, frozen in `base/household-items.sdk.json`. */
export type HouseholdItem = {
  readonly id: string
  readonly category: string
  readonly size: readonly [number, number, number]
  readonly weight: number
  readonly stack: number
  readonly shape: string
  readonly color: number
}

export type Sources = {
  readonly ite: IteData
  readonly html: IteHtml
  readonly game: GameData
  readonly house: HouseData
  readonly household: Readonly<Record<string, HouseholdItem>>
  readonly decisions: Decisions
}

export const loadSources = (): Sources => ({
  ite: extractIte(),
  html: extractIteHtml(),
  game: extractGame(),
  house: extractVc3(),
  household: JSON.parse(readFileSync(HOUSEHOLD_ITEMS_PATH, 'utf8')) as Record<string, HouseholdItem>,
  decisions: loadDecisions(),
})
