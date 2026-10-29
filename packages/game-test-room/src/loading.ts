import type { BusyOptions, BusySink, BusyTask } from '@adatechnology/game-contracts'

import { LOADING_CLASS, LOADING_CSS } from './loading-view'

/** What the indicator shows now: the label of the task on top, its line of text, and how far it is (the bar) when it knows. */
export interface LoadingState {
  readonly label: string
  readonly text: string
  readonly done: number
  readonly total: number | undefined
  /** The task hides what is behind the indicator. */
  readonly opaque: boolean
  /** Tasks open at once (an area that builds a house inside a slow action counts two). */
  readonly depth: number
}

/**
 * The loading indicator of the room: an overlay with a spinner or a bar and a line of text, shown for any slow job so that the page never looks frozen. `begin` shows it at once, `busy` also waits for the
 * paint before it runs the work (the only way to show a bar before a heavy synchronous job), and the last task to end takes it down. The room lends it to modules as `ModuleHost.loading`.
 */
export interface RoomLoading extends BusySink {
  /** True while a task is open. */
  readonly active: boolean
  /** What it shows now, or undefined when nothing is open. */
  state(): LoadingState | undefined
  /** Follows it: called whenever a task opens, steps or ends, with `undefined` once none is left. Returns the function that stops following. */
  on(listener: (state: LoadingState | undefined) => void): () => void
  /** The overlay element (undefined in a room with `ui: false`, where the page draws its own from `on`). */
  readonly element: HTMLElement | undefined
  dispose(): void
}

export interface LoadingOptions {
  /** The room's container: the overlay covers it. */
  readonly container: HTMLElement
  /** False for a room with `ui: false`: the state is kept and told through `on`, nothing is drawn. Default true. */
  readonly draw?: boolean
  /** Text of a task that has none yet (already translated). */
  readonly working: string
}

interface Task {
  label: string
  text: string
  done: number
  total: number | undefined
  opaque: boolean
  ended: boolean
}

const PAINT_FALLBACK_MS = 100
let styled = false

const ensureStyle = (document: Document): void => {
  if (styled && document.getElementById('tr-loading-style')) return
  const style = document.createElement('style')
  style.id = 'tr-loading-style'
  style.textContent = LOADING_CSS
  document.head.appendChild(style)
  styled = true
}

/** Resolves once the browser has painted a frame (a frame callback, then a timer), or after a short wait when frames are not running (a hidden tab, a test). */
export const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    let done = false
    const finish = (): void => {
      if (!done) {
        done = true
        resolve()
      }
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(finish, 0))
    setTimeout(finish, PAINT_FALLBACK_MS)
  })

export function createLoading(options: LoadingOptions): RoomLoading {
  const draw = options.draw !== false && typeof document !== 'undefined'
  const tasks: Task[] = []
  const listeners = new Set<(state: LoadingState | undefined) => void>()
  let element: HTMLElement | undefined
  let labelNode: HTMLElement | null = null
  let stepNode: HTMLElement | null = null
  let barNode: HTMLElement | null = null
  let fillNode: HTMLElement | null = null
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  const current = (): Task | undefined => tasks[tasks.length - 1]
  const state = (): LoadingState | undefined => {
    const task = current()
    return task ? { label: task.label, text: task.text, done: task.done, total: task.total, opaque: task.opaque, depth: tasks.length } : undefined
  }

  const build = (): HTMLElement => {
    ensureStyle(options.container.ownerDocument)
    const root = document.createElement('div')
    root.className = `${LOADING_CLASS} tr-loading-hidden`
    root.setAttribute('role', 'status')
    root.setAttribute('aria-live', 'polite')
    root.innerHTML =
      '<div class="tr-loading-card"><div class="tr-loading-title"><span class="tr-loading-spin"></span><span class="tr-loading-label"></span></div><div class="tr-loading-bar tr-loading-indeterminate"><i></i></div><div class="tr-loading-step"></div></div>'
    labelNode = root.querySelector('.tr-loading-label')
    stepNode = root.querySelector('.tr-loading-step')
    barNode = root.querySelector('.tr-loading-bar')
    fillNode = root.querySelector('.tr-loading-bar i')
    options.container.appendChild(root)
    return root
  }

  const render = (): void => {
    const now = state()
    for (const listener of listeners) listener(now)
    if (!draw) return
    if (!now) {
      if (element) {
        element.classList.add('tr-loading-hidden')
        // the card fades out, then stops being laid out
        hideTimer = setTimeout(() => element?.style.setProperty('display', 'none'), 300)
      }
      return
    }
    if (hideTimer !== undefined) clearTimeout(hideTimer)
    element ??= build()
    element.style.removeProperty('display')
    element.classList.remove('tr-loading-hidden')
    element.classList.toggle('tr-loading-solid', now.opaque)
    if (labelNode) labelNode.textContent = now.label
    if (stepNode) stepNode.textContent = now.text
    const determinate = now.total !== undefined && now.total > 0
    barNode?.classList.toggle('tr-loading-indeterminate', !determinate)
    if (fillNode) fillNode.style.width = determinate ? `${Math.max(0, Math.min(1, now.done / (now.total as number))) * 100}%` : ''
  }

  const begin = (label: string, taskOptions: BusyOptions = {}): BusyTask => {
    const task: Task = { label, text: options.working, done: 0, total: taskOptions.total, opaque: taskOptions.opaque === true, ended: false }
    tasks.push(task)
    render()
    return {
      step(text, done) {
        if (task.ended) return
        if (text !== undefined) task.text = text
        if (done !== undefined) task.done = done
        render()
      },
      paint: nextPaint,
      end() {
        if (task.ended) return
        task.ended = true
        const at = tasks.indexOf(task)
        if (at >= 0) tasks.splice(at, 1)
        render()
      },
    }
  }

  return {
    get active() {
      return tasks.length > 0
    },
    get element() {
      return element
    },
    state,
    on(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    begin,
    async busy<T>(label: string, work: (task: BusyTask) => T | Promise<T>, taskOptions?: BusyOptions): Promise<T> {
      const task = begin(label, taskOptions)
      try {
        await task.paint()
        return await work(task)
      } finally {
        task.end()
      }
    },
    dispose() {
      if (hideTimer !== undefined) clearTimeout(hideTimer)
      tasks.length = 0
      listeners.clear()
      element?.remove()
      element = undefined
    },
  }
}
