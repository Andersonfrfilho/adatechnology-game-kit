import { holds } from '../conditions'
import type { ConditionContext } from '../conditions'
import type { BeatOutcome, ChangeItem, CodeBeat, ResolvedChange, StoryBeat, TextPart } from '../types'

export type BeatContext = ConditionContext & {
  /** The people an `each` with `cast: true` goes through, in order (the people the game wrote, without the extras). */
  readonly castList: readonly string[]
  readonly nameOf: (id: string) => string
  readonly codeBeats?: Readonly<Record<string, CodeBeat>>
}

const resolveChanges = (items: readonly ChangeItem[], context: BeatContext, out: ResolvedChange[]): void => {
  for (const item of items) {
    const here: BeatContext = { ...context, changes: out }
    if ('when' in item) {
      if (holds(item.when, here)) resolveChanges(item.changes, context, out)
      continue
    }
    if ('each' in item) {
      const { roles, cast, where, except } = item.each
      const ids = roles ? roles.map((role) => context.cast(role)) : cast ? context.castList : []
      const skip = new Set((except ?? []).map((role) => context.cast(role)))
      for (const id of ids) {
        if (skip.has(id) || !context.states[id]) continue
        // inside an `each`, the role `self` is the person being listed
        if (where && !holds(where, { ...here, self: id, cast: (role) => (role === 'self' ? id : context.cast(role)) })) continue
        out.push({ id, state: item.change.state, note: item.change.note, ...(item.change.base ? { base: item.change.base } : {}) })
      }
      continue
    }
    const id = context.cast(item.role)
    const base = item.base === undefined ? undefined : typeof item.base === 'string' ? item.base : context.states[context.cast(item.base.baseOf)]?.base
    out.push({ id, state: item.state, note: item.note, ...(base ? { base } : {}) })
  }
}

const renderText = (parts: readonly TextPart[], context: BeatContext, changes: readonly ResolvedChange[], join: string | undefined): string => {
  const piece = (part: TextPart): string => {
    if (typeof part === 'string') return part
    if ('when' in part) {
      const chosen = holds(part.when, { ...context, changes }) ? part.text : part.else
      if (chosen === undefined) return ''
      return typeof chosen === 'string' ? chosen : renderText(chosen, context, changes, undefined)
    }
    if ('value' in part) return context.values?.[part.value] ?? ''
    if ('count' in part) return String(changes.length)
    return context.nameOf(context.cast(part.name))
  }
  const pieces = parts.map(piece)
  return join === undefined ? pieces.join('') : pieces.filter((text) => text !== '').join(join)
}

/**
 * Runs one beat against the world as it is (nothing is applied here): the named values, the first variant whose condition holds, its changes and its
 * text. Null when no variant holds, when the variant is `none`, or when it needs changes and has none. A beat with `run` calls the game's code beat.
 */
export function runBeat(beat: StoryBeat, context: BeatContext): BeatOutcome | null {
  if (beat.run) {
    const code = context.codeBeats?.[beat.run]
    if (!code) throw new Error(`game-stories: code beat "${beat.run}" of "${beat.id}" is not registered`)
    return code({ states: context.states, actions: context.actions, flags: context.flags, cast: context.cast })
  }
  const values: Record<string, string | null> = {}
  for (const [name, options] of Object.entries(beat.values ?? {})) values[name] = options.find((option) => !option.when || holds(option.when, context))?.value ?? null
  const here: BeatContext = { ...context, values }
  const variant = (beat.variants ?? []).find((v) => !v.when || holds(v.when, here))
  if (!variant || variant.none) return null
  const changes: ResolvedChange[] = []
  resolveChanges(variant.changes ?? [], here, changes)
  if (variant.needsChanges && changes.length === 0) return null
  return {
    text: renderText(variant.text ?? [], here, changes, variant.join),
    ...(variant.alt ? { alt: true } : {}),
    ...(variant.changes ? { changes } : {}),
    ...(variant.flags ? { flags: variant.flags } : {}),
  }
}
