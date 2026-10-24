import type { AttachmentDef, AttachmentId, FittedAttachment, MountKind, StockState, WeaponSnapshot } from './attachment-types'
import { resolveLoadout } from './attachment-effects'
import type { Loadout } from './attachment-effects'
import { canFit, canInstallWith } from './attachments'
import type { CanFit } from './attachments'
import { createRng } from './rng'
import type { FitOptions, FitResult, ReloadRequest, WeaponStance } from './types'
import { WeaponCommands } from './weapon-commands'
import { BREAK_RNG_SALT, EPS } from './weapon-shared'
import type { WeaponStateInit } from './weapon-shared'

const NO_ATTACHMENTS: ReadonlyMap<AttachmentId, AttachmentDef> = new Map()

const copyOf = (part: FittedAttachment): FittedAttachment => ({ ...part })

/** What is on the weapon: fitting and removing accessories, the stock, how it is held, and the numbers all of that changes. */
export abstract class WeaponAttachments extends WeaponCommands {
  protected fitted: FittedAttachment[]
  protected load: Loadout
  protected stockState: StockState = 'extended'
  protected aiming = false
  protected supportedStance = false
  /** Magazine changes so far: a dual coupler makes every second one fast. */
  protected reloadCount = 0
  protected readonly catalogue: ReadonlyMap<AttachmentId, AttachmentDef>
  protected readonly isCompatible: WeaponStateInit['isCompatible']
  protected readonly breakRng: () => number

  constructor(init: WeaponStateInit) {
    super(init)
    this.catalogue = init.attachments ?? NO_ATTACHMENTS
    this.isCompatible = init.isCompatible
    this.breakRng = createRng((init.seed ^ BREAK_RNG_SALT) >>> 0)
    this.fitted = (init.snapshot?.attachments ?? init.def.fitted ?? []).map(copyOf)
    if (init.snapshot) this.stockState = init.snapshot.stock
    this.fitted = this.fitted.map((part) => (part.shotsLeft === undefined ? this.withDurability(part) : part))
    this.load = this.resolve()
    this.applyLoad()
    if (init.snapshot) this.applySnapshot(init.snapshot)
  }

  get attachments(): readonly FittedAttachment[] {
    return this.fitted.map(copyOf)
  }
  get mass(): number {
    return this.load.mass
  }
  get aimSeconds(): number {
    return this.load.aimSeconds
  }
  get suppressed(): boolean {
    return this.load.suppressed
  }
  get stock(): StockState {
    return this.stockState
  }

  private resolve(): Loadout {
    const supported = this.supportedStance
    return resolveLoadout(this.def, this.fitted, this.catalogue, { aiming: this.aiming, supported, stock: this.stockState, caliber: this.caliber, rules: this.rules })
  }

  /** Takes the numbers of the accessories on the weapon: the action, the capacity (what no longer fits goes back to the reserve) and the draw time. */
  protected applyLoad(): void {
    this.load = this.resolve()
    this.action = this.load.action
    const capacity = this.action.kind === 'firearm' ? this.action.magazine : this._capacity
    if (capacity === this._capacity) return
    this._capacity = capacity
    if (this._ammo <= capacity) return
    this.reserve += this._ammo - capacity
    this._ammo = capacity
  }

  private applySnapshot(snapshot: WeaponSnapshot): void {
    this._ammo = Math.min(snapshot.ammo, this._capacity)
    this.reserve = snapshot.reserve
    this.mode = snapshot.mode
  }

  private withDurability(part: FittedAttachment): FittedAttachment {
    const shots = this.catalogue.get(part.id)?.durability?.shots
    if (!shots) return part
    return { ...part, shotsLeft: shots[0] + Math.floor(this.breakRng() * (shots[1] - shots[0] + 1)) }
  }

  protected isWorking(): boolean {
    const phase = this.phase
    return phase !== null && (phase.id === 'fit' || phase.id === 'stock' || phase.id === 'switch')
  }

  protected drawDuration(): number {
    return super.drawDuration() * this.load.drawFactor
  }

  canFit(id: AttachmentId, mount?: MountKind): CanFit {
    const attachment = this.catalogue.get(id)
    if (!attachment) return { ok: false, reason: 'no_mount' }
    return canFit(this.def, attachment, this.fitted, { caliber: this.caliber, catalogue: this.catalogue, isCompatible: this.isCompatible }, mount)
  }

  /** Starts the work: the phase and the event now, the change when the phase ends. */
  private startWork(action: 'fit' | 'remove', attachment: AttachmentDef, mount: MountKind, apply: () => void): FitResult {
    const seconds = this.rules.attachments.fitSeconds[attachment.install]
    this.emit({ type: 'attachment', action, id: attachment.id, mount, at: this.clock })
    if (seconds <= EPS) {
      apply()
      return { ok: true, seconds: 0 }
    }
    this._phase = { id: 'fit', start: this.clock, end: this.clock + seconds }
    this.schedule({ at: this.clock + seconds, apply })
    return { ok: true, seconds }
  }

  fit(id: AttachmentId, options: FitOptions = {}): FitResult {
    const attachment = this.catalogue.get(id)
    if (!attachment) return { ok: false, reason: 'unknown' }
    if (this.isWorking() || this._reloading) return { ok: false, reason: 'busy' }
    if (!canInstallWith(options.install ?? 'field', attachment.install)) return { ok: false, reason: 'install' }
    const check = canFit(this.def, attachment, this.fitted, { caliber: this.caliber, catalogue: this.catalogue, isCompatible: this.isCompatible }, options.mount)
    if (!check.ok) return check
    return this.startWork('fit', attachment, check.mount, () => {
      this.fitted.push(this.withDurability({ id, mount: check.mount }))
      this.applyLoad()
    })
  }

  remove(id: AttachmentId, options: FitOptions = {}): FitResult {
    const part = this.fitted.find((candidate) => candidate.id === id)
    const attachment = this.catalogue.get(id)
    if (!part || !attachment) return { ok: false, reason: 'not_fitted' }
    if (part.integral === true || attachment.removable === false) return { ok: false, reason: 'fixed' }
    if (this.isWorking() || this._reloading) return { ok: false, reason: 'busy' }
    if (!canInstallWith(options.install ?? 'field', attachment.install)) return { ok: false, reason: 'install' }
    return this.startWork('remove', attachment, part.mount, () => {
      this.fitted = this.fitted.filter((candidate) => candidate !== part)
      this.applyLoad()
    })
  }

  toggle(id: AttachmentId): boolean | null {
    const index = this.fitted.findIndex((part) => part.id === id)
    const kind = this.catalogue.get(id)?.kind
    const part = this.fitted[index]
    if (!part || (kind !== 'light' && kind !== 'laser')) return null
    const on = part.on !== true
    this.fitted[index] = { ...part, on }
    this.emit({ type: 'toggle', id, on, at: this.clock })
    this.applyLoad()
    return on
  }

  setStock(state: StockState): boolean {
    const kind = this.def.stock?.kind
    if (kind === undefined || kind === 'fixed' || kind === 'none' || state === this.stockState || this.isWorking() || this._reloading) return false
    const seconds = this.rules.stock.seconds
    this.emit({ type: 'stock', state, kind, at: this.clock })
    const apply = (): void => {
      this.stockState = state
      this.applyLoad()
    }
    if (seconds <= EPS) {
      apply()
      return true
    }
    this._phase = { id: 'stock', start: this.clock, end: this.clock + seconds }
    this.schedule({ at: this.clock + seconds, apply })
    return true
  }

  setStance(stance: WeaponStance): void {
    this.aiming = stance.aiming ?? this.aiming
    this.supportedStance = stance.supported ?? this.supportedStance
    this.applyLoad()
  }

  snapshot(): WeaponSnapshot {
    return {
      id: this.def.id,
      attachments: this.fitted.map(copyOf),
      stock: this.stockState,
      ammo: this._ammo,
      reserve: this.reserve,
      mode: this.mode,
      condition: this._condition.id,
      ammoQuality: this._ammoQuality.id,
    }
  }

  /** A home-made accessory wears out with the shots: when the drawn number is spent it breaks and comes off. */
  protected wearAttachments(at: number): void {
    let broke = false
    this.fitted = this.fitted.flatMap((part) => {
      if (part.shotsLeft === undefined) return [part]
      if (part.shotsLeft > 1) return [{ ...part, shotsLeft: part.shotsLeft - 1 }]
      this.emit({ type: 'attachment', action: 'break', id: part.id, mount: part.mount, at })
      broke = true
      return []
    })
    if (broke) this.applyLoad()
  }

  reload(request: ReloadRequest = 'auto'): boolean {
    if (this.isWorking()) return false
    const base = this.action
    const factor = this.load.secondReloadFactor
    const isFast = factor !== 1 && this.reloadCount % 2 === 1 && base.kind === 'firearm'
    if (isFast && base.kind === 'firearm') this.action = { ...base, reload: base.reload * factor, ...(base.timings ? { timings: { ...base.timings, reload: base.timings.reload * factor, ...(base.timings.reloadEmpty === undefined ? {} : { reloadEmpty: base.timings.reloadEmpty * factor }) } } : {}) }
    const started = super.reload(request)
    this.action = base
    if (started) this.reloadCount += 1
    return started
  }
}

