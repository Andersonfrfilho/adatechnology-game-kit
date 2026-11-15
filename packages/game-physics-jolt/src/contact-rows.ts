import type { ContactBuffer } from '@adatechnology/game-physics'

import { ROW_CAPACITY } from './constants'

export class Contacts implements ContactBuffer {
  count = 0
  /** Contacts over `reportSpeed` that found no row (`maxContacts`): cleared with the events. */
  dropped = 0
  readonly a = new Int32Array(ROW_CAPACITY)
  readonly b = new Int32Array(ROW_CAPACITY)
  readonly userA = new Int32Array(ROW_CAPACITY)
  readonly userB = new Int32Array(ROW_CAPACITY)
  readonly tagA = new Int32Array(ROW_CAPACITY)
  readonly tagB = new Int32Array(ROW_CAPACITY)
  readonly point = new Float32Array(ROW_CAPACITY * 3)
  readonly normal = new Float32Array(ROW_CAPACITY * 3)
  readonly approach = new Float32Array(ROW_CAPACITY)
  readonly impulse = new Float32Array(ROW_CAPACITY)
}
