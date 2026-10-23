import { assignDeep, createMatchers, createTranslate, registerLocale, resolveStrings } from './locale'
import { LEGACY_STATES } from './legacy-seeds'
import { clamp, hash, markDecal, rng, smooth, strHash } from './util'
import type { Kit } from './types'
import type { VehicleKit, VehicleKitOptions } from './api'
import { installMaterials } from './materials'
import { installGeometry } from './geometry'
import { installContext } from './context'
import { installWarp } from './warp'
import { installBody } from './body'
import { installGlass } from './glass'
import { installLights } from './lights'
import { installInterior } from './interior'
import { installHood } from './hood'
import { installCar } from './car'
import { installTrucks } from './trucks'
import { installWheels } from './wheels'
import { installParticles } from './particles'
import { installFluids } from './fluids'
import { installGlassDamage } from './glass-damage'
import { installImpact } from './impact'
import { installExplosion } from './explosion'
import { installRollover } from './rollover'
import { installTick } from './tick'
import { installArmor } from './armor'
import { installZoneCore } from './zone-core'
import { installZoneDecals } from './zone-decals'
import { installZoneDent } from './zone-dent'
import { installDamagePanels } from './damage-panels'
import { installDamageParts } from './damage-parts'
import { installZoneDerive } from './zone-derive'
import { installZoneAuto } from './zone-auto'
import { installZoneApply } from './zone-apply'
import { installScenarios } from './scenarios'
import { installUi } from './ui'

/**
 * Creates a vehicle kit bound to a three.js namespace and a locale.
 * The returned object is the public API; every call creates an independent kit (its own registry, caches and configuration).
 */
export function createVehicleKit(options: VehicleKitOptions): VehicleKit {
  const opts: any = options || {}
  const THREE = opts.THREE
  if (!THREE || !THREE.Vector3) throw new Error('createVehicleKit: options.THREE (the three.js namespace) is required')
  const strings = resolveStrings(opts.locale)
  const t = createTranslate(strings)
  const doc = opts.document || (typeof document !== 'undefined' ? document : undefined)

  const kit: Kit = {
    THREE,
    V3: THREE.Vector3,
    PI: Math.PI,
    document: doc,
    strings,
    t,
    matchers: createMatchers(strings),
    hash,
    clamp,
    smooth,
    _: {},
  }

  /* ================= data ================= */
  /* registries filled by the content pack (configure({ fuels, groups, waterGroups })) */
  kit.fuels = {}
  kit.groups = []
  kit.waterGroups = {}
  /* live configuration: everything that is content comes in through configure() / plugin() */
  kit.config = {
    defaultGroup: t('groups.default'),
    plate: 'ABC1D23',
    impactStain: null,
    defaultSplat: 'stain',
    damagedScenario: null,
    texts: { who: t('texts.who'), noEffect: t('texts.no_effect') },
  }
  kit.fleet = []
  kit.builders = {}
  kit.register = function (spec: any, build: any) {
    if (!spec || !spec.key || typeof build !== 'function') throw new Error('kit.register: spec.key and a build function are required')
    const i = kit.fleet.findIndex(function (v: any) {
      return v.key === spec.key
    })
    spec.build = build
    if (!spec.group) spec.group = kit.config.defaultGroup
    if (i >= 0) kit.fleet[i] = spec
    else kit.fleet.push(spec)
    kit.builders[spec.key] = build
    return spec
  }
  kit.find = function (key: string) {
    return (
      kit.fleet.find(function (v: any) {
        return v.key === key
      }) || null
    )
  }

  /* ================= modules ================= */
  installMaterials(kit)
  installGeometry(kit)
  installContext(kit)
  installWarp(kit)
  installBody(kit)
  installGlass(kit)
  installLights(kit)
  installInterior(kit)
  installHood(kit)
  installCar(kit)
  installTrucks(kit)
  installWheels(kit)
  installParticles(kit)
  installFluids(kit)
  installGlassDamage(kit)
  installImpact(kit)
  installExplosion(kit)
  installRollover(kit)
  installTick(kit)
  installArmor(kit)
  installZoneCore(kit)
  installZoneDecals(kit)
  installZoneDent(kit)
  installDamagePanels(kit)
  installDamageParts(kit)
  installZoneDerive(kit)
  installZoneAuto(kit)
  installZoneApply(kit)
  installScenarios(kit)
  installUi(kit)

  const I = kit._

  /* ================= extension: configure, plugin, hooks ================= */
  const HOOKS: Record<string, Array<(...args: any[]) => void>> = {}
  /** `kit.on(event, fn)` / `kit.hook(event, ...args)`. Events: `defaultDamage(c)` after the default damage of a car. */
  kit.on = function (ev: string, fn: (...args: any[]) => void) {
    ;(HOOKS[ev] = HOOKS[ev] || []).push(fn)
    return kit
  }
  kit.hook = function (ev: string, ...args: any[]) {
    ;(HOOKS[ev] || []).forEach(function (fn) {
      fn.apply(kit, args)
    })
  }
  kit.configure = function (o: any) {
    o = o || {}
    if (o.bands)
      o.bands.forEach(function (b: any, i: number) {
        if (kit.bands[i] && b) Object.assign(kit.bands[i], b)
      })
    if (o.zoneEffects)
      Object.keys(o.zoneEffects).forEach(function (k) {
        kit.zoneEffects[k] = o.zoneEffects[k]
      })
    if (o.partEffects) Object.assign(kit.partEffects, o.partEffects)
    if (o.scenarios) o.scenarios.forEach(kit.scenario)
    if (o.flagEffects)
      Object.keys(o.flagEffects).forEach(function (k) {
        kit.flagEffects[k] = Object.assign({ order: 50, settle: true }, o.flagEffects[k])
      })
    if (o.fluids)
      Object.keys(o.fluids).forEach(function (k) {
        kit.defineFluid(k, o.fluids[k])
      })
    if (o.fuels) Object.assign(kit.fuels, o.fuels)
    if (o.groups)
      o.groups.forEach(function (g: string) {
        if (kit.groups.indexOf(g) < 0) kit.groups.push(g)
      })
    if (o.waterGroups) Object.assign(kit.waterGroups, o.waterGroups)
    if (o.palette && o.palette.rust) I.RUST.set(o.palette.rust)
    if (o.plate != null) kit.config.plate = o.plate
    if (o.texts) {
      const tx = o.texts
      if (tx.who != null) kit.config.texts.who = tx.who
      if (tx.noEffect != null) kit.config.texts.noEffect = tx.noEffect
      if (tx.plate != null) kit.config.plate = tx.plate
      if (tx.ui) kit.config.texts.ui = Object.assign(kit.config.texts.ui || {}, tx.ui)
    }
    ;['impactStain', 'defaultSplat', 'defaultGroup', 'damagedScenario'].forEach(function (k) {
      if (o[k] !== undefined) kit.config[k] = o[k]
    })
    return kit
  }
  kit.plugins = []
  kit.plugin = function (p: any) {
    if (!p) return kit
    if (p.configure) kit.configure(p.configure)
    if (typeof p.install === 'function') p.install(kit)
    kit.plugins.push(p.name || '(unnamed)')
    return kit
  }
  /** Helpers for plugins that create their own scenario flag effects. */
  kit.internals = {
    rng,
    strHash,
    zonesOf: kit.zonesOf,
    worldInverseOf: I.worldInverseOf,
    hideObj: I.hideObj,
    markDecal,
    rayCaster: I._zr,
    boxCenter: I.boxCenter,
    wheelInfo: I.wheelInfo,
  }

  /* ================= assembly ================= */
  function defaultDamage(c: any) {
    const kd = c.meta.kind
    if (kd === 'plane') {
      kit.zoneImpact(c, 'front', 1.2)
      kit.zoneImpact(c, 'left', 1.1)
      kit.impact(c, new kit.V3(0.05, 0.45, 1.25), new kit.V3(0, 1, 0), 1.0, { noStain: true })
    } else if (kd === 'heli') {
      kit.zoneImpact(c, 'front', 1.1)
      kit.impact(c, new kit.V3(0, 0.12, -0.95), new kit.V3(0, 0, 1), 0.9, { noStain: true })
      kit.impact(c, new kit.V3(c.meta.rear + 0.3, 2.0, 0), new kit.V3(0.4, 0, 1), 1.0, { noStain: true })
      kit.impact(c, new kit.V3(-0.6, 2.4, 0.3), new kit.V3(0, -1, 0), 1.0, { noStain: true })
    } else if (kd === 'boat') {
      kit.zoneImpact(c, 'front', 1.1)
      kit.zoneImpact(c, 'left', 1.0)
    } else {
      kit.zoneImpact(c, 'front', 1.0)
      kit.zoneImpact(c, 'left', 0.7)
      kit.hook('defaultDamage', c)
    }
  }
  kit.defaultDamage = defaultDamage

  /**
   * Builds vehicle `key` in a state (`'intact' | 'damaged' | 'modified'`). Returns the context; add `c.root` to the scene.
   * `zoneState` (optional) = `{ health: { zoneId: 0..100 }, flags: { flipped, burnt, abandoned, ...plugin flags } }` applies the damage zones.
   * Without it, `'damaged'` uses the scenario `config.damagedScenario` when a plugin registered one.
   */
  kit.build = function (key: string, state?: string, zoneState?: any) {
    const spec = kit.find(key)
    if (!spec) throw new Error('Unknown vehicle: ' + key)
    const st = state || 'intact'
    const c = new kit.BuildContext(st, strHash(key + (LEGACY_STATES[st] || st)))
    c.spec = spec
    c.key = key
    spec.build(c, kit)
    const m = c.meta
    m.kind = m.kind || 'car'
    if (m.length == null || m.width == null || m.front == null) {
      const bb = new THREE.Box3().setFromObject(c.vehicle)
      const sz = bb.getSize(new kit.V3())
      if (m.length == null) m.length = sz.x
      if (m.width == null) m.width = sz.z
      if (m.front == null) m.front = bb.max.x
      if (m.rear == null) m.rear = bb.min.x
      if (m.top == null) m.top = bb.max.y
      if (m.clearance == null) m.clearance = Math.max(0.1, bb.min.y + 0.2)
      if (m.bodyHeight == null) m.bodyHeight = sz.y * 0.5
      if (m.belt == null) m.belt = m.clearance + m.bodyHeight
    }
    if (c.engineHealth == null) c.engineHealth = 1
    if (['electric', 'none'].indexOf(spec.fuel) < 0 && ['boat', 'plane', 'heli'].indexOf(m.kind) < 0 && m.exhaust !== false) {
      const ex = m.exhaust || new kit.V3(m.rear + 0.05, Math.max(0.2, (m.clearance || 0.3) * 0.7), (m.width || 1.6) * 0.3)
      kit.addEmitter(c, ex, 'exhaust', { dir: m.exhaustDir || new kit.V3(-1, 0, 0) })
    }
    try {
      kit.zonesOf(c)
    } catch (e: any) {
      c.zones = []
      ;(c.zoneErrors = c.zoneErrors || []).push('zones: ' + (e && e.message))
    }
    if (st === 'modified') {
      if (m.armor) m.armor(c, kit)
      else kit.applyArmor(c)
    }
    if (zoneState == null && st === 'damaged' && kit.config.damagedScenario) zoneState = kit.zoneScenario(c, kit.config.damagedScenario)
    if (zoneState) kit.applyZones(c, zoneState)
    else {
      c.zoneState = { health: {}, flags: {} }
      c.zones.forEach(function (z: any) {
        c.zoneState.health[z.id] = 100
      })
    }
    c.vehicle.traverse(function (o: any) {
      if (o.isMesh && !(o.material && o.material.transparent)) o.receiveShadow = true
    })
    return c
  }
  /** Releases the geometries of a built vehicle (shared particle geometries and materials are kept). */
  kit.dispose = function (c: any) {
    const shared = Object.values(I.PARTICLE_GEOMETRIES)
    c.root.traverse(function (o: any) {
      if (o.isSprite) {
        if (o.material && o.material.userData.dis) o.material.dispose()
        return
      }
      if (o.geometry && !shared.includes(o.geometry)) o.geometry.dispose()
    })
  }

  /* a content pack adds its own strings (under its own top-level key) to the locale this kit was created with */
  kit.registerLocale = function (code: string, table: Record<string, any>) {
    registerLocale(code, table)
    assignDeep(strings, resolveStrings(opts.locale))
    return kit
  }

  /* options that are configuration (everything except THREE, locale and document) */
  const { THREE: _three, locale: _locale, document: _document, plugins, ...config } = opts
  void _three
  void _locale
  void _document
  kit.configure(config)
  ;(plugins || []).forEach(kit.plugin)

  return kit as unknown as VehicleKit
}
