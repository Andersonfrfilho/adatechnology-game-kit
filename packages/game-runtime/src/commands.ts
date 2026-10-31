import type { Command, CommandBuffer } from './types'

/** `order` of the fixedSimulate system that takes the tick's commands: it runs before every other fixed system. */
export const COMMAND_SYSTEM_ORDER = -10000

const NONE: readonly Command[] = []

/** `nextTick` answers which fixed tick runs next: that is the tick a command pushed from `input` becomes valid at. */
export function createCommandBuffer(nextTick: () => number): CommandBuffer {
  let pending: Command[] = []
  return {
    push(kind, payload, tick) {
      pending.push({ kind, payload, tick: tick ?? nextTick() })
    },
    take(tick) {
      if (pending.length === 0) return NONE
      const due: Command[] = []
      const later: Command[] = []
      for (const command of pending) (command.tick <= tick ? due : later).push(command)
      pending = later
      return due
    },
    clear() {
      pending = []
    },
  }
}
