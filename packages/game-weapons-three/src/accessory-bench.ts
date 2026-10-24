import type * as THREE_NS from 'three'
import type { BenchChange, ChoiceOption, HostTool, HostToolAttachment, ModuleControl, ModuleHost, ModuleLayer, ModuleMetric, ToolCommand } from '@adatechnology/game-contracts'
import type { Arsenal, FittedAttachment, MountKind } from '@adatechnology/game-weapons'
import { attachmentsKey } from './attachments-key'
import type { AccessoryText } from './accessory-text'

/** The places of a weapon the bench offers accessories for, in the order the panel lists them. */
export const ACCESSORY_MOUNTS: readonly MountKind[] = ['muzzle', 'rail_top', 'rail_left', 'rail_right', 'rail_bottom', 'underbarrel', 'magazine', 'feed', 'sling', 'barrel']
/** Keys of the accessories. V (the stock) is the room's kick when the weapon has no stock that moves; the others are free in the room. */
export const ACCESSORY_KEYS = { light: 'KeyL', laser: 'KeyK', stock: 'KeyV', underbarrel: 'KeyU' } as const
const FIT_PREFIX = 'fit_'
const NONE = 'none'
export const SUPPORTED_CONTROL_ID = 'supported_stance'
const ACTION_IDS = { light: 'toggle_light', laser: 'toggle_laser', stock: 'toggle_stock', underbarrel: 'switch_underbarrel' } as const
const SECONDARY_BUTTON = 2
const TEXT_FIELDS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export const accessoryControls = (text: AccessoryText): ModuleControl[] => [
  ...ACCESSORY_MOUNTS.map((mount): ModuleControl => ({ kind: 'choice', id: `${FIT_PREFIX}${mount}`, name: text.mounts[mount] ?? mount, options: [{ id: NONE, name: text.none }], default: NONE })),
  { kind: 'boolean', id: SUPPORTED_CONTROL_ID, name: text.supported.name, hint: text.supported.hint, default: false },
  ...(Object.keys(ACTION_IDS) as Array<keyof typeof ACTION_IDS>).map((key): ModuleControl => ({ kind: 'action', id: ACTION_IDS[key], name: text.actions[key].name, hint: text.actions[key].hint })),
]

export const accessoryLayers = (text: AccessoryText): ModuleLayer[] => [
  { id: 'attachments', name: text.layers.attachments },
  { id: 'beams', name: text.layers.beams },
]

export const accessoryMetrics = (text: AccessoryText, tool: () => HostTool): ModuleMetric[] => [
  { id: 'weapon_mass', name: text.metrics.mass, unit: 'kg', digits: 2, read: () => tool().mass ?? 0 },
  { id: 'aim_time', name: text.metrics.aim, unit: 's', digits: 2, read: () => tool().aimSeconds ?? 0 },
  { id: 'accessories_fitted', name: text.metrics.fitted, digits: 0, read: () => (tool().attachments ?? []).length },
  { id: 'suppressed', name: text.metrics.suppressed, read: () => (tool().suppressed ? text.yes : text.no) },
]

export interface AccessoryBenchOptions {
  readonly arsenal: Arsenal
  readonly host: ModuleHost
  readonly text: AccessoryText
}

export interface AccessoryBench {
  /** Gives it a change of the bench (a choice of accessory for a mount, a button); false when the change is not one of its own. */
  handleChange(change: BenchChange): boolean
  dispose(): void
}

const fittedOf = (parts: readonly HostToolAttachment[] | undefined): FittedAttachment[] =>
  (parts ?? []).map((part) => ({ id: part.id, mount: part.mount as MountKind, ...(part.integral ? { integral: true } : {}), ...(part.on === undefined ? {} : { on: part.on }) }))

const fillText = (template: string, vars: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '')

/**
 * The accessory bench of the weapons area: a choice per mount that fits and removes what is compatible with the weapon in hand (and only that), the keys of the light (L), the laser (K),
 * the stock (V) and the launcher under the barrel (U), and the right mouse button, which aims: the camera zooms by the optic that is fitted, over the seconds the weapon takes to the sights.
 */
export function createAccessoryBench(options: AccessoryBenchOptions): AccessoryBench {
  const { arsenal, host, text } = options
  const camera = host.camera as THREE_NS.PerspectiveCamera
  const bench = host.bench
  const pending = new Map<MountKind, string>()
  let signature = ''
  let aiming = false
  let aimProgress = 0
  let baseFov = camera.fov
  let appliedZoom = 1

  const nameOf = (id: string): string => text.attachments[id] ?? arsenal.attachments.get(id)?.name ?? id

  const offers = (tool: HostTool, mount: MountKind): ChoiceOption[] => {
    const fitted = fittedOf(tool.attachments)
    const here = fitted.find((part) => part.mount === mount)
    const choices: ChoiceOption[] = [{ id: NONE, name: text.none }]
    if (here) choices.push({ id: here.id, name: nameOf(here.id) })
    for (const def of arsenal.attachments.values()) {
      if (def.id === here?.id || !arsenal.canFit(tool.weapon, def.id, { fitted, mount }).ok) continue
      choices.push({ id: def.id, name: nameOf(def.id) })
    }
    return choices
  }

  const refresh = (): void => {
    const tool = host.tool()
    const next = `${tool.weapon}|${attachmentsKey(tool.attachments)}`
    if (next === signature) return
    signature = next
    const def = arsenal.weapons.get(tool.weapon)
    for (const mount of ACCESSORY_MOUNTS) {
      const has = (def?.mounts ?? []).some((place) => place.kind === mount)
      const here = (tool.attachments ?? []).find((part) => part.mount === mount)
      const choices = offers(tool, mount)
      const isFixed = here?.integral === true
      bench?.patch(`${FIT_PREFIX}${mount}`, { hidden: !has, disabled: isFixed, options: choices, ...(pending.has(mount) ? {} : { value: here?.id ?? NONE }) })
    }
  }

  const refuse = (mount: MountKind, reason: string | undefined): void => {
    host.log(fillText(text.fitRefused, { mount: text.mounts[mount] ?? mount, weapon: arsenal.name(host.tool().weapon), reason: reason ?? '' }), { mount, reason })
    pending.delete(mount)
    signature = ''
  }

  const settle = (): void => {
    for (const [mount, wanted] of pending) {
      const here = (host.tool().attachments ?? []).find((part) => part.mount === mount && !part.integral)
      if (here?.id === wanted || (!here && wanted === NONE)) {
        pending.delete(mount)
        continue
      }
      const request: ToolCommand = here ? { type: 'remove', attachment: here.id } : { type: 'fit', attachment: wanted, mount }
      const result = host.command?.(request)
      if (!result || (!result.ok && result.reason !== 'busy')) refuse(mount, result?.reason)
      if (result?.reason === 'busy') return
    }
  }

  const toggleKind = (kind: 'light' | 'laser'): void => {
    const part = (host.tool().attachments ?? []).find((candidate) => arsenal.attachments.get(candidate.id)?.kind === kind)
    if (!part) host.log(kind === 'light' ? text.noLight : text.noLaser)
    else host.command?.({ type: 'toggle', attachment: part.id })
  }

  const toggleStock = (): boolean => {
    const tool = host.tool()
    const kind = arsenal.weapons.get(tool.weapon)?.stock?.kind
    if (kind === undefined || kind === 'fixed' || kind === 'none') return false
    host.command?.({ type: 'stock', state: tool.stock === 'collapsed' ? 'extended' : 'collapsed' })
    return true
  }

  const switchUnderbarrel = (): void => {
    const tool = host.tool()
    const hasLauncher = (tool.attachments ?? []).some((part) => arsenal.attachments.get(part.id)?.launcher !== undefined)
    if (!hasLauncher) host.log(text.noLauncher)
    else host.command?.({ type: 'underbarrel', on: tool.underbarrelActive !== true })
  }

  const act = (id: string): boolean => {
    if (id === ACTION_IDS.light) toggleKind('light')
    else if (id === ACTION_IDS.laser) toggleKind('laser')
    else if (id === ACTION_IDS.stock) {
      if (!toggleStock()) host.log(text.noStock)
    } else if (id === ACTION_IDS.underbarrel) switchUnderbarrel()
    else return false
    return true
  }

  const zoomOf = (tool: HostTool): number => {
    const optic = (tool.attachments ?? []).map((part) => arsenal.attachments.get(part.id)?.optic).find((entry) => entry !== undefined)
    return optic?.zoom[0] ?? 1
  }

  const isFirearm = (tool: HostTool): boolean => arsenal.weapons.get(tool.weapon)?.action.kind === 'firearm'

  const setAim = (on: boolean): void => {
    if (on === aiming) return
    aiming = on
    host.command?.({ type: 'stance', aiming: on })
  }

  const follow = (dt: number): void => {
    const tool = host.tool()
    const seconds = Math.max(0.05, tool.aimSeconds ?? 0.2)
    aimProgress = Math.max(0, Math.min(1, aimProgress + (aiming ? dt : -dt) / seconds))
    const zoom = 1 + (zoomOf(tool) - 1) * aimProgress
    if (Math.abs(zoom - appliedZoom) < 1e-4) return
    if (appliedZoom === 1) baseFov = camera.fov
    appliedZoom = zoom
    camera.fov = zoom === 1 ? baseFov : (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / zoom) * 180) / Math.PI
    camera.updateProjectionMatrix()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || TEXT_FIELDS.has((event.target as HTMLElement | null)?.tagName ?? '')) return
    const handled = event.code === ACCESSORY_KEYS.light ? act(ACTION_IDS.light) : event.code === ACCESSORY_KEYS.laser ? act(ACTION_IDS.laser) : event.code === ACCESSORY_KEYS.underbarrel ? act(ACTION_IDS.underbarrel) : event.code === ACCESSORY_KEYS.stock && toggleStock()
    if (!handled) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  // only the room's own surface aims: a click on a panel, an input or an overlay is left alone
  const isOnRoom = (event: MouseEvent): boolean => Boolean(document.pointerLockElement) || event.target instanceof HTMLCanvasElement
  const onMouseDown = (event: MouseEvent): void => {
    if (event.button !== SECONDARY_BUTTON || !isOnRoom(event) || !isFirearm(host.tool())) return
    event.preventDefault()
    event.stopImmediatePropagation()
    setAim(true)
  }
  const onMouseUp = (event: MouseEvent): void => {
    if (event.button === SECONDARY_BUTTON) setAim(false)
  }
  const onBlur = (): void => setAim(false)

  // capture phase: the room grabs on the right button and kicks on V, and these win only where the weapon in hand has something to do with them
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('mousedown', onMouseDown, true)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('blur', onBlur)
  const offFrame = host.onFrame((dt) => {
    refresh()
    settle()
    follow(dt)
  })
  const offEvents = host.on((event) => {
    if (event.type === 'attachment') {
      const template = event.action === 'fit' ? text.fitting : event.action === 'remove' ? text.removing : text.broke
      host.log(fillText(template, { attachment: nameOf(event.attachment), weapon: arsenal.name(event.weapon), seconds: String(event.duration ?? 0) }), { attachment: event.attachment, action: event.action })
    }
    if (event.type !== 'tool') return
    pending.clear()
    setAim(false)
    bench?.patch(SUPPORTED_CONTROL_ID, { value: false })
    signature = ''
  })

  return {
    handleChange(change) {
      if (change.kind === 'action') return act(change.id)
      if (change.kind === 'control' && change.id === SUPPORTED_CONTROL_ID && typeof change.value === 'boolean') {
        host.command?.({ type: 'stance', supported: change.value })
        return true
      }
      if (change.kind !== 'control' || !change.id.startsWith(FIT_PREFIX) || typeof change.value !== 'string') return false
      const mount = change.id.slice(FIT_PREFIX.length) as MountKind
      pending.set(mount, change.value)
      settle()
      return true
    },
    dispose() {
      offFrame()
      offEvents()
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('mousedown', onMouseDown, true)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', onBlur)
      if (appliedZoom !== 1) {
        camera.fov = baseFov
        camera.updateProjectionMatrix()
      }
    },
  }
}
