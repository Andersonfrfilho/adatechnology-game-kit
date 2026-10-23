import type { GoldenEvent, GoldenRecord, SceneSnapshot } from './types'

const MAX_DIFFS_PER_SECTION = 5

function describeEvent(event: GoldenEvent | undefined): string {
  return event ? JSON.stringify(event) : '(none)'
}

function diffEvents(expected: readonly GoldenEvent[], actual: readonly GoldenEvent[]): string[] {
  const messages: string[] = []
  const longest = Math.max(expected.length, actual.length)
  for (let index = 0; index < longest && messages.length < MAX_DIFFS_PER_SECTION; index++) {
    const want = describeEvent(expected[index])
    const got = describeEvent(actual[index])
    if (want !== got) messages.push(`events[${index}]\n    expected ${want}\n    actual   ${got}`)
  }
  if (messages.length > 0 && expected.length !== actual.length) {
    messages.push(`events: expected ${expected.length}, got ${actual.length}`)
  }
  return messages
}

function diffScene(label: string, expected: SceneSnapshot | undefined, actual: SceneSnapshot | undefined): string[] {
  if (!expected) return [`scene "${label}": not in the golden`]
  if (!actual) return [`scene "${label}": missing from the build`]
  if (expected.hash === actual.hash && expected.objects === actual.objects) return []
  const messages = [`scene "${label}": hash ${expected.hash} -> ${actual.hash}, objects ${expected.objects} -> ${actual.objects}`]
  const longest = Math.max(expected.lines.length, actual.lines.length)
  let shown = 0
  for (let index = 0; index < longest && shown < MAX_DIFFS_PER_SECTION; index++) {
    if (expected.lines[index] === actual.lines[index]) continue
    messages.push(`  node #${index}\n    expected ${expected.lines[index] ?? '(none)'}\n    actual   ${actual.lines[index] ?? '(none)'}`)
    shown++
  }
  return messages
}

/** Human-readable differences between a recorded golden and an SDK build; empty when they match. */
export function diffGolden(expected: GoldenRecord, actual: GoldenRecord): string[] {
  const messages: string[] = []
  if (expected.seed !== actual.seed) messages.push(`seed: expected ${expected.seed}, got ${actual.seed}`)
  messages.push(...diffEvents(expected.events, actual.events))
  const labels = new Set([...Object.keys(expected.scenes), ...Object.keys(actual.scenes)])
  for (const label of labels) messages.push(...diffScene(label, expected.scenes[label], actual.scenes[label]))
  return messages
}

/** Throws with the readable diff when the build differs from the golden; use inside any test runner. */
export function assertMatchesGolden(expected: GoldenRecord, actual: GoldenRecord): void {
  const messages = diffGolden(expected, actual)
  if (messages.length === 0) return
  throw new Error(`"${expected.name}" differs from the golden (seed ${expected.seed}):\n${messages.join('\n')}`)
}
