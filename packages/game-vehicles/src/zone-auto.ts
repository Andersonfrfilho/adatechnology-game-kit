/** Automatic zone derivation for each vehicle family. */
import type { Kit } from './types'
import { legacyGlassId, legacyLightId } from './legacy-seeds'

const REAR_GLASS_KEYS = ['rear_window', 'window_rear', 'quarter_glass']

export function installZoneAuto(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._
  const t = kit.t
  const matchers = kit.matchers

  /* ---- automatic derivation by vehicle type ---- */
  function autoZones(c: any) {
    const m = c.meta
    let Z: any = []
    const inv = I.worldInverseOf(c)
    const kind = m.kind || 'car'
    const F = m.front
    const R = m.rear
    const L = m.length || F - R
    const W = m.width || 1.7
    const cl = m.clearance == null ? 0.3 : m.clearance
    const belt = m.belt || cl + 0.6
    const top = m.top || belt + 0.5
    const hw = W / 2
    const WH = I.wheelInfo(c)
    function add(id: any, name: any, type: any, box: any, o?: any) {
      const z = Object.assign({ id: id, name: name, type: type, box: I.normalizeBox(box) }, o || {})
      Z.push(z)
      return z
    }
    let fam = kind
    if (kind === 'quad') fam = 'bike'
    if (kind === 'bus' || kind === 'truck' || kind === 'tractor') fam = 'heavy'
    if (kind === 'car' && (m.bullet || m.armored || I.partsOf(c, 'track').length)) fam = 'military'
    let glassDone = false
    let lightsDone = false
    let wheelsDone = false

    /* glass, lights and wheels in common */
    function glassZones(grouped: any) {
      glassDone = true
      const gl = c.glass.filter(function (g: any) {
        return g.parent && g.userData.glass && !g.userData.ghost
      })
      if (!gl.length) return
      const info = gl.map(function (g: any) {
        const pt = c.parts.find(function (p: any) {
          return p.obj === g
        })
        const gd = g.userData.glass
        const bb = I.localBox(c, g, inv)
        const label = (pt && pt.label) || gd.label || t('parts.glass')
        const key = (pt && pt.key) || gd.key || null
        return { g: g, n: label, key: key, side: gd.side || 0, bb: bb, cen: bb.getCenter(new V3()) }
      })
      const isWindshield = function (q: any) {
        return q.key ? /(^|_)windshield($|_)/.test(q.key) : matchers.windshield.test(q.n)
      }
      const isRearGlass = function (q: any) {
        return q.key ? REAR_GLASS_KEYS.indexOf(q.key) >= 0 || /(^|_)rear($|_)/.test(q.key) : matchers.rear.test(q.n)
      }
      if (!grouped && gl.length <= 10) {
        const used: any = {}
        const usedSeed: any = {}
        info.forEach(function (q: any) {
          let n = q.n
          let word = q.side ? (q.side < 0 ? 'left' : 'right') : null
          let appended = null
          if (!q.side && !matchers.side.test(n) && Math.abs(q.cen.z) > W * 0.2) {
            n = t('parts.glass_side_m', { label: n, s: q.cen.z < 0 ? -1 : 1 })
            appended = q.cen.z < 0 ? 'left' : 'right'
            word = appended
          }
          /* keyed glass gets "<key>_<side>"; free-text labels keep the slug of the label */
          let id = q.key ? q.key + (word ? '_' + word : '') : I.slug(n)
          if (!matchers.glassId.test(id)) id = 'glass_' + id
          if (used[id]) id += '_' + ++used[id]
          else used[id] = 1
          let seed = legacyGlassId(q.key, q.n, q.side, appended, id)
          if (usedSeed[seed]) seed += '_' + ++usedSeed[seed]
          else usedSeed[seed] = 1
          const front = isWindshield(q)
          const rearG = isRearGlass(q) && Math.abs(q.cen.z) < W * 0.2
          const who = front
            ? t('who.front_seats')
            : rearG
              ? t('who.rear_seats')
              : q.cen.x >
                  (m.glasshouse && m.glasshouse.pillars && m.glasshouse.pillars.length
                    ? Math.max.apply(null, m.glasshouse.pillars)
                    : (F + R) / 2)
                ? q.cen.z < 0
                  ? t('who.driver')
                  : t('who.passenger')
                : t(q.cen.z < 0 ? 'who.rear_left' : 'who.rear_right')
          add(id, n, 'glass', q.bb.clone().expandByScalar(0.04), {
            glass: [q.g],
            fxKey: front ? 'windshield' : 'glass',
            who: who,
            tags: front ? ['windshield'] : [],
            seedId: seed,
          })
        })
        return
      }
      const groups: any = { f: [], l: [], r: [], b: [] }
      info.forEach(function (q: any) {
        const k =
          isWindshield(q) || (Math.abs(q.cen.z) < W * 0.25 && q.cen.x > (F + R) / 2)
            ? 'f'
            : Math.abs(q.cen.z) < W * 0.25
              ? 'b'
              : q.cen.z < 0
                ? 'l'
                : 'r'
        groups[k].push(q)
      })
      ;[
        ['f', 'windshield', 'windshield', 'who.front_seats', 'glass_front', 'vidros_f'],
        ['l', 'glass_left', 'glass', 'who.left_side', 'glass_left', 'vidros_e'],
        ['r', 'glass_right', 'glass', 'who.right_side', 'glass_right', 'vidros_d'],
        ['b', 'rear_window', 'glass', 'who.rear_seats', 'glass_rear', 'vidros_t'],
      ].forEach(function (G) {
        const L2 = groups[G[0]]
        if (!L2.length) return
        const bb = new THREE.Box3()
        L2.forEach(function (q: any) {
          bb.union(q.bb)
        })
        add(G[4], t('zones.' + G[1]), 'glass', bb.expandByScalar(0.04), {
          glass: L2.map(function (q: any) {
            return q.g
          }),
          fxKey: G[2],
          who: t(G[3]),
          tags: G[0] === 'f' ? ['windshield'] : [],
          seedId: G[5],
        })
      })
    }
    function lightZones() {
      lightsDone = true
      const G: any = {}
      c.lights.forEach(function (Lt: any) {
        const cen = I.lightCenter(c, Lt, inv)
        const k = Lt.kind === 'taillight' ? 'taillight' : 'headlight'
        const s = Math.abs(cen.z) < W * 0.12 ? 'center' : cen.z < 0 ? 'left' : 'right'
        const key = k + '_' + s
        ;(G[key] || (G[key] = [])).push(Lt)
      })
      Object.keys(G).forEach(function (key) {
        const p = key.split('_')
        const n =
          p[1] === 'center'
            ? p[0] === 'headlight'
              ? t('zones.light_bar_front')
              : fam === 'bike'
                ? t('zones.taillight')
                : t('zones.light_bar_rear')
            : t(p[0] === 'headlight' ? 'zones.headlight' : 'zones.taillight_side', { s: p[1] === 'left' ? -1 : 1 })
        if (fam === 'bike' && p[0] === 'headlight') return /* the motorcycle headlight sits in the fairing */
        /* lights on the same side that are far apart (roof light, trunk taillight) become separate zones, so the box does not cover half the vehicle */
        const cl2: any = []
        const split = fam === 'car' || fam === 'heavy' || fam === 'military'
        G[key].forEach(function (Lt: any) {
          if (!split) {
            if (!cl2.length) cl2.push({ L: [], bb: new THREE.Box3() })
            cl2[0].L.push(Lt)
            cl2[0].bb.union(I.lightBoxOf(c, Lt, inv))
            return
          }
          const lb = I.lightBoxOf(c, Lt, inv)
          const q = cl2.find(function (k2: any) {
            return k2.bb.distanceToPoint(lb.getCenter(new V3())) < 0.7
          })
          if (q) {
            q.L.push(Lt)
            q.bb.union(lb)
          } else cl2.push({ L: [Lt], bb: lb.clone() })
        })
        cl2.sort(function (a2: any, b2: any) {
          return (p[0] === 'headlight' ? -1 : 1) * (a2.bb.max.x - b2.bb.max.x) || a2.bb.min.y - b2.bb.min.y
        })
        cl2.forEach(function (q: any, i: any) {
          add(i ? key + '_' + (i + 1) : key, i ? n + ' (' + (i + 1) + ')' : n, 'light', q.bb.expandByScalar(0.03), {
            lights: q.L,
            fxKey: p[0],
            seedId: legacyLightId(p[0], p[1], i),
          })
        })
      })
    }
    function wheelZones(byAxle: any) {
      wheelsDone = true
      if (!WH) return
      const ws = WH.list
      if (byAxle || ws.length > 6) {
        const ax: any = []
        ws.slice()
          .sort(function (a: any, b: any) {
            return b.position.x - a.position.x
          })
          .forEach(function (w: any) {
            const a = ax.find(function (q: any) {
              return Math.abs(q.x - w.position.x) < 0.75
            })
            if (a) a.w.push(w)
            else ax.push({ x: w.position.x, w: [w] })
          })
        ax.forEach(function (a: any, i: any) {
          const bb = new THREE.Box3()
          a.w.forEach(function (w: any) {
            bb.union(I.localBox(c, w, inv))
          })
          const n =
            ax.length === 1
              ? t('zones.wheels')
              : i === 0
                ? t('zones.wheels_axle_front')
                : i === ax.length - 1
                  ? t('zones.wheels_axle_rear')
                  : t('zones.wheels_axle_n', { n: i + 1 })
          add('wheels_axle_' + (i + 1), n, 'wheel', bb.expandByScalar(0.04), { wheels: a.w, fxKey: 'axle', seedId: 'rodas_eixo' + (i + 1) })
        })
        return
      }
      const used: any = {}
      ws.forEach(function (w: any) {
        const fr = w.position.x >= (WH.xf + WH.xr) / 2 ? 'front' : 'rear'
        const sd = Math.abs(w.position.z) < 0.08 ? 0 : w.position.z < 0 ? -1 : 1
        let n = sd ? t('zones.wheel_' + fr + '_side', { s: sd }) : t('zones.wheel_' + fr)
        let id = 'wheel_' + fr + (sd ? (sd < 0 ? '_left' : '_right') : '')
        let seed = 'roda_' + (fr === 'front' ? 'dianteira' : 'traseira') + (sd ? (sd < 0 ? '_esquerda' : '_direita') : '')
        if (used[id]) {
          id += '_' + ++used[id]
          seed += '_' + used[id]
          n += ' ' + used[id]
        } else used[id] = 1
        add(id, n, 'wheel', I.localBox(c, w, inv).expandByScalar(0.04), { wheels: [w], who: '', seedId: seed })
      })
    }
    function internal(kind2: any, n: any, fxKey: any, sz?: any) {
      const ps = I.partsOf(c, kind2)
      if (!ps.length) return null
      const p = ps[0].pos
      const s = sz || [0.42, 0.3, 0.4]
      return add(kind2, n, 'internal', [p.x - s[0], p.x + s[0], p.y - s[1], p.y + s[1], p.z - s[2], p.z + s[2]], {
        fxKey: fxKey || kind2,
        pos: p.clone(),
        sub: kind2,
      })
    }

    if (fam === 'car') {
      const gh = m.glasshouse && m.glasshouse.fb != null ? m.glasshouse : null
      const sb = 0.34
      const out = 0.25
      const fb = gh ? gh.fb : F - 0.3 * L
      const rb = gh && gh.rb != null ? gh.rb : R + 0.2 * L
      const xr = WH ? WH.xr : R + 0.25 * L
      const rr = WH ? WH.rr : 0.3
      const doorF = fb - 0.03
      const pil =
        gh && gh.pillars
          ? gh.pillars.slice().sort(function (a: any, b: any) {
              return b - a
            })
          : []
      const B = pil.length && pil[0] < doorF - 0.45 && pil[0] > rb + 0.2 ? pil[0] : Math.max(rb + 0.1, doorF - 1.1)
      const rearDoor = pil.length > 0 && pil[0] < doorF - 0.45 && B - Math.max(rb, xr) > 0.5
      const C = rearDoor ? Math.max(pil[1] != null && pil[1] < B - 0.4 ? pil[1] : rb, xr + rr * 0.2) : B
      const y0s = Math.max(0.03, cl - 0.12)
      const y1s = belt + 0.03
      const sideB = function (x0: any, x1: any, s: any, y0?: any, y1?: any) {
        return s < 0
          ? [x0, x1, y0 == null ? y0s : y0, y1 == null ? y1s : y1, -hw - out, -hw + sb]
          : [x0, x1, y0 == null ? y0s : y0, y1 == null ? y1s : y1, hw - sb, hw + out]
      }
      let bF = m.frontBumper && m.frontBumper.parent ? m.frontBumper : null
      let bR = m.rearBumper && m.rearBumper.parent ? m.rearBumper : null
      I.partsOf(c, 'bumper').forEach(function (p: any) {
        if (!p.obj || !p.obj.parent) return
        if (p.pos.x > (F + R) / 2) bF = bF || p.obj
        else bR = bR || p.obj
      })
      add('bumper_front', t('zones.bumper_front'), bF ? 'bumper' : 'panel', [F - 0.3, F + 0.25, -0.02, cl + 0.36, -hw - 0.2, hw + 0.2], {
        objs: bF ? [bF] : [],
        dir: [-1, 0, 0],
        fxKey: 'bumper',
        tags: ['front'],
      })
      if (c.hood && c.hood.piv && c.hood.x1 > (F + R) / 2) {
        const hb = I.localBox(c, c.hood.piv, inv)
        add(
          'hood',
          t('zones.hood'),
          'hood',
          [hb.min.x - 0.02, hb.max.x + 0.03, hb.min.y - 0.08, hb.max.y + 0.15, hb.min.z - 0.02, hb.max.z + 0.02],
          { objs: [c.hood.piv], dir: [0, -1, 0] },
        )
      } else
        add('hood', t('zones.hood'), 'panel', [fb + 0.02, F - 0.22, (cl + belt) / 2, belt + 0.2, -hw + 0.12, hw - 0.12], {
          dir: [0, -1, 0],
          fxKey: 'hood',
        })
      ;[-1, 1].forEach(function (s) {
        const e = s < 0 ? 'left' : 'right'
        if (F - 0.22 - doorF > 0.2)
          add('fender_front_' + e, t('zones.fender_front', { s }), 'panel', sideB(doorF, F - 0.22, s), { side: s, fxKey: 'fender' })
        add(
          'door_front_' + e,
          t(rearDoor || pil.length ? 'zones.door_front' : 'zones.door', { s }),
          'door',
          sideB(B, doorF, s, null, y1s),
          {
            side: s,
            hinge: 'front',
            mirror: true,
            who: t(s < 0 ? 'who.driver' : 'who.passenger'),
          },
        )
        if (rearDoor)
          add('door_rear_' + e, t('zones.door_rear', { s }), 'door', sideB(C, B, s), {
            side: s,
            hinge: 'front',
            who: t(s < 0 ? 'who.rear_left' : 'who.rear_right'),
          })
        if (C - (R + 0.22) > 0.22)
          add('side_rear_' + e, t('zones.side_rear', { s }), 'panel', sideB(R + 0.22, C, s), {
            side: s,
            fxKey: 'side_panel',
            who: t(m.bed ? 'who.cargo' : 'who.rear_seats'),
          })
      })
      if (gh && gh.roof)
        add(
          'roof',
          t('zones.roof'),
          'roof',
          [Math.min(rb, gh.rt) - 0.06, Math.max(fb, gh.ft) + 0.06, belt + 0.1, top + 0.15, -hw - 0.05, hw + 0.05],
          { dir: [0, -1, 0], alsoGlass: true },
        )
      else
        add('roof', t('zones.roof'), 'roof', [R + 0.25 * L, F - 0.35 * L, belt + 0.1, top + 0.15, -hw - 0.05, hw + 0.05], {
          dir: [0, -1, 0],
          alsoGlass: true,
        })
      if (m.bed) {
        const bx1 = Math.max(m.bed.x0, m.bed.x1)
        add('cargo_bed', t('zones.cargo_bed'), 'lid', [R - 0.15, bx1 + 0.04, cl - 0.05, belt + 0.2, -hw + sb - 0.02, hw - sb + 0.02], {
          dir: [1, 0, 0],
          fxKey: 'cargo_bed',
          hinge: 'down',
          tags: ['rear'],
        })
      } else {
        const tx1 = Math.max(R + 0.35, Math.min(rb + 0.12, R + 1.1))
        add(
          'lid',
          t(rb - R > 0.7 ? 'zones.trunk_lid' : 'zones.tail_lid'),
          'lid',
          [R - 0.15, tx1, cl + 0.3, belt + 0.22, -hw + 0.12, hw - 0.12],
          { dir: [1, 0, 0], hinge: 'up', tags: ['rear'] },
        )
      }
      add('bumper_rear', t('zones.bumper_rear'), bR ? 'bumper' : 'panel', [R - 0.25, R + 0.3, -0.02, cl + 0.36, -hw - 0.2, hw + 0.2], {
        objs: bR ? [bR] : [],
        dir: [1, 0, 0],
        fxKey: 'bumper',
        tags: ['rear'],
      })
      add('underbody', t('zones.underbody'), 'internal', [R, F, -0.05, cl + 0.06, -hw, hw], { fxKey: 'underbody', sub: 'underbody' })
      glassZones(false)
      lightZones()
      wheelZones(false)
      internal('engine', t(c.meta.bay && c.meta.bay.motor === 'electric' ? 'zones.engine_electric' : 'zones.engine'), 'engine')
      internal('radiator', t('zones.radiator'), 'radiator', [0.2, 0.25, 0.45])
      internal('fuel_tank', t('zones.fuel_tank'), 'fuel_tank', [0.35, 0.18, 0.4])
      internal('battery', t('zones.battery'), 'battery', [0.35, 0.2, 0.4])
    } else if (fam === 'bike') {
      const xf = WH ? WH.xf : F - 0.3
      const xrb = WH ? WH.xr : R + 0.3
      const rf2 = WH ? WH.rf : 0.3
      const wb = xf - xrb
      const bici = c.spec && c.spec.fuel === 'none'
      const wq = Math.max(0.36, hw + 0.05)
      const tb = top
      if (kind === 'quad') {
        add('fairing', t('zones.fairing'), 'part', [xf - 0.25, F + 0.12, rf2 * 1.2, tb - 0.08, -wq, wq], {
          fxKey: 'fairing',
          dir: [-1, 0, 0],
        })
        add('handlebar', t('zones.handlebar_levers'), 'part', [xf - 0.75, xf - 0.25, belt + 0.05, tb + 0.12, -wq, wq], {
          fxKey: 'handlebar',
          dir: [0, -1, 0],
        })
        add('fuel_tank', t('zones.tank'), 'part', [xrb + wb * 0.45, xf - 0.75, belt - 0.15, belt + 0.25, -0.25, 0.25], {
          fxKey: 'fuel_tank',
          dir: [0, -1, 0],
          seedId: 'tanque_moto',
        })
        add('seat', t('zones.seat_rack'), 'part', [R - 0.12, xrb + wb * 0.45, belt - 0.2, tb + 0.12, -wq, wq], {
          fxKey: 'seat',
          dir: [0, -1, 0],
        })
      } else if (bici) {
        add('handlebar', t('zones.handlebar'), 'part', [xf - 0.45, xf + 0.15, tb - 0.22, tb + 0.12, -0.4, 0.4], {
          fxKey: 'handlebar',
          dir: [0, -1, 0],
        })
        add('frame', t('zones.frame'), 'part', [xrb + rf2 * 0.6, xf - rf2 * 0.3, rf2 * 0.6, tb - 0.22, -0.12, 0.12], {
          fxKey: 'frame',
          dir: [0, 0, 1],
        })
        add('seat', t('zones.seat_rack'), 'part', [R - 0.1, xrb + rf2 * 0.6, rf2 * 1.4, tb + 0.12, -0.3, 0.3], {
          fxKey: 'seat',
          dir: [0, -1, 0],
        })
      } else {
        add('fairing', t('zones.fairing'), 'part', [xf - 0.3, F + 0.12, rf2 * 1.5, tb - 0.2, -0.38, 0.38], {
          fxKey: 'fairing',
          dir: [-1, 0, 0],
        })
        add('handlebar', t('zones.handlebar_levers'), 'part', [xf - 0.6, xf + 0.05, tb - 0.2, tb + 0.15, -0.55, 0.55], {
          fxKey: 'handlebar',
          dir: [0, -1, 0],
        })
        add('fuel_tank', t('zones.tank'), 'part', [xrb + wb * 0.52, xf - 0.28, belt - 0.12, tb - 0.2, -0.3, 0.3], {
          fxKey: 'fuel_tank',
          dir: [0, -1, 0],
          seedId: 'tanque_moto',
        })
        add('seat', t('zones.seat_tail'), 'part', [R - 0.12, xrb + wb * 0.52, belt - 0.2, tb - 0.15, -0.3, 0.3], {
          fxKey: 'seat',
          dir: [0, -1, 0],
        })
      }
      if (!bici) {
        const ex = m.exhaust
        const es = ex && ex.z < 0 ? -1 : 1
        add('engine', t('zones.engine'), 'part', [xrb + wb * 0.3, xf - wb * 0.22, 0.12, belt - 0.12, -0.24, 0.24], {
          fxKey: 'engine',
          dir: [0, 0, 1],
          sub: 'engine',
        })
        add(
          'exhaust',
          t('zones.exhaust'),
          'part',
          es > 0 ? [R - 0.25, xrb + wb * 0.45, 0.08, belt - 0.12, 0.1, 0.5] : [R - 0.25, xrb + wb * 0.45, 0.08, belt - 0.12, -0.5, -0.1],
          { fxKey: 'exhaust', dir: [0, 0, -es], side: es },
        )
      }
      glassZones(true)
      lightZones()
      wheelZones(false)
    } else if (fam === 'heavy') {
      const bus = kind === 'bus'
      const tractor = kind === 'tractor'
      const sbH = 0.42
      const cabL = m.cabLength || (bus ? 2.0 : tractor ? 0 : 2.3)
      if (tractor) {
        const xc = (WH ? WH.xr : R + 0.6) + 0.35
        add('front', t('zones.grille_front'), 'panel', [F - 0.4, F + 0.25, 0.1, belt + 0.3, -hw * 0.6, hw * 0.6], {
          dir: [-1, 0, 0],
          tags: ['front'],
        })
        add(
          'tractor_hood',
          t('zones.engine_hood'),
          c.hood && c.hood.piv ? 'hood' : 'panel',
          [xc + 0.3, F - 0.4, belt - 0.25, belt + 0.45, -hw * 0.45, hw * 0.45],
          { dir: [0, -1, 0], fxKey: 'hood', objs: c.hood && c.hood.piv ? [c.hood.piv] : [] },
        )
        ;[-1, 1].forEach(function (s) {
          add(
            'fender_rear_' + (s < 0 ? 'left' : 'right'),
            t('zones.fender_rear', { s }),
            'panel',
            s < 0 ? [R - 0.1, xc + 0.5, 0.6, top - 0.6, -hw - 0.2, -hw + 0.55] : [R - 0.1, xc + 0.5, 0.6, top - 0.6, hw - 0.55, hw + 0.2],
            { side: s, fxKey: 'fender' },
          )
        })
        /* operator station: seat, steering wheel and platform (not the canopy, which is the roll-bar zone) */
        const stp = c.seatTops[0]
        const sy = stp ? stp.y : belt + 0.2
        add('operator_station', t('zones.operator_station'), 'part', [R - 0.1, xc + 0.5, sy - 0.45, sy + 0.75, -hw * 0.45, hw * 0.45], {
          dir: [0, -1, 0],
          fxKey: 'cab',
          who: t('who.tractor_driver'),
          noFlap: true,
        })
      } else {
        const cx0 = F - cabL
        add(
          'cab_front',
          t(bus ? 'zones.bus_front' : 'zones.cab_front'),
          'panel',
          [F - 0.45, F + 0.25, Math.max(0.05, cl - 0.1), top + 0.1, -hw - 0.1, hw + 0.1],
          { dir: [-1, 0, 0], fxKey: 'cab', who: t('who.driver'), tags: ['front'] },
        )
        ;[-1, 1].forEach(function (s) {
          const e = s < 0 ? 'left' : 'right'
          add(
            'cab_' + e,
            t(bus ? 'zones.bus_front_side' : 'zones.cab_side', { s }),
            'panel',
            s < 0
              ? [cx0, F - 0.45, Math.max(0.05, cl - 0.1), top + 0.1, -hw - 0.25, -hw + sbH]
              : [cx0, F - 0.45, Math.max(0.05, cl - 0.1), top + 0.1, hw - sbH, hw + 0.25],
            { side: s, fxKey: 'cab', who: t(s < 0 ? 'who.driver' : bus ? 'who.boarding_door' : 'who.helper') },
          )
        })
        const big = bus
          ? t('zones.body_saloon')
          : m.bigBlast || matchers.tank.test((c.spec && c.spec.name) || '')
            ? t('zones.body_tank')
            : m.bodyLabel || t(m.bodyKind === 'body' ? 'zones.body_body' : 'zones.body_box')
        ;[-1, 1].forEach(function (s) {
          add(
            'body_' + (s < 0 ? 'left' : 'right'),
            t('zones.body_side', { label: big, s }),
            'panel',
            s < 0
              ? [R + 0.4, cx0, Math.max(0.05, cl - 0.1), top + 0.15, -hw - 0.25, -hw + sbH]
              : [R + 0.4, cx0, Math.max(0.05, cl - 0.1), top + 0.15, hw - sbH, hw + 0.25],
            { side: s, fxKey: 'side_panel', who: t(bus ? 'who.seated_side' : 'who.cargo') },
          )
        })
        add(
          'body_rear',
          t('zones.body_rear', { label: big }),
          'panel',
          [R - 0.25, R + 0.4, Math.max(0.05, cl - 0.1), top + 0.15, -hw - 0.1, hw + 0.1],
          {
            dir: [1, 0, 0],
            fxKey: bus ? 'side_panel' : 'lid',
            who: t(bus ? 'who.back_seats' : 'who.cargo'),
            tags: ['rear'],
          },
        )
      }
      add('chassis', t('zones.chassis'), 'internal', [R, F, -0.05, cl + 0.12, -hw, hw], { fxKey: 'chassis', sub: 'underbody' })
      glassZones(true)
      lightZones()
      wheelZones(true)
      internal('engine', t('zones.engine'), 'engine', [0.6, 0.45, 0.5])
      internal('fuel_tank', t(bus ? 'zones.diesel_tank' : 'zones.fuel_tank'), 'fuel_tank', [0.4, 0.3, 0.35])
    } else if (fam === 'military') {
      const sbm = 0.45
      const lag = I.partsOf(c, 'track')
      const hb2 = (m.hullTop || belt) + 0.12
      add('armor_front', t('zones.armor_front'), 'panel', [F - 0.65, F + 0.3, Math.max(0.05, cl - 0.15), hb2, -hw - 0.2, hw + 0.2], {
        dir: [-1, 0, 0],
        fxKey: 'armor',
        tags: ['front'],
      })
      ;[-1, 1].forEach(function (s) {
        add(
          'armor_' + (s < 0 ? 'left' : 'right'),
          t('zones.armor_side', { s }),
          'panel',
          s < 0
            ? [R + 0.45, F - 0.65, Math.max(0.05, cl - 0.15), hb2, -hw - 0.3, -hw + sbm]
            : [R + 0.45, F - 0.65, Math.max(0.05, cl - 0.15), hb2, hw - sbm, hw + 0.3],
          { side: s, fxKey: 'armor', who: t('who.crew_side') },
        )
      })
      add('armor_rear', t('zones.armor_rear'), 'panel', [R - 0.3, R + 0.45, Math.max(0.05, cl - 0.15), hb2, -hw - 0.2, hw + 0.2], {
        dir: [1, 0, 0],
        fxKey: 'armor',
        tags: ['rear'],
      })
      /* weapon: the longest mesh in x above the belt line (barrel) */
      let gun: any = null
      let gl2 = 0
      c.vehicle.traverse(function (o: any) {
        if (!o.isMesh || o.userData.decal) return
        const bb = I.localBox(c, o, inv)
        const sx = bb.max.x - bb.min.x
        const sy = bb.max.y - bb.min.y
        const sz = bb.max.z - bb.min.z
        if (bb.min.y > belt - 0.1 && sx > 0.7 && sx > 5 * Math.max(sy, sz) && sx > gl2) {
          gl2 = sx
          gun = { o: o, bb: bb }
        }
      })
      if (gun)
        add('weapon', t(gl2 > 2 ? 'zones.cannon' : 'zones.weapon'), 'part', gun.bb.clone().expandByScalar(0.08), {
          objs: [gun.o],
          fxKey: 'weapon',
          dir: [0, -1, 0],
          anchor: [gun.bb.min.x, (gun.bb.min.y + gun.bb.max.y) / 2, (gun.bb.min.z + gun.bb.max.z) / 2],
        })
      add('turret', t('zones.turret'), 'roof', [R + 0.35, F - 0.3, hb2, top + 0.25, -hw + 0.12, hw - 0.12], {
        dir: [0, -1, 0],
        fxKey: 'turret',
        alsoGlass: true,
      })
      if (lag.length)
        lag.forEach(function (p: any) {
          const s = p.pos.z < 0 ? -1 : 1
          const bb = I.localBox(c, p.obj, inv)
          const ws2 = c.wheels.filter(function (w: any) {
            return Math.sign(w.position.z) === s
          })
          const objs = [p.obj]
          c.spin.forEach(function (sp: any) {
            if (sp.track && Math.sign(sp.o.position.z) === s) objs.push(sp.o)
          })
          add('track_' + (s < 0 ? 'left' : 'right'), t('zones.track', { s }), 'part', bb.expandByScalar(0.05), {
            objs: objs,
            wheels: ws2,
            fxKey: 'track',
            side: s,
            track: p.obj,
            dir: [0, 0, -s],
          })
        })
      else if (WH)
        [-1, 1].forEach(function (s) {
          const ws3 = WH.list.filter(function (w: any) {
            return Math.sign(w.position.z) === s
          })
          if (!ws3.length) return
          const bb = new THREE.Box3()
          ws3.forEach(function (w: any) {
            bb.union(I.localBox(c, w, inv))
          })
          add('wheels_' + (s < 0 ? 'left' : 'right'), t('zones.wheels_side', { s }), 'wheel', bb.expandByScalar(0.04), {
            wheels: ws3,
            fxKey: 'axle',
            side: s,
          })
        })
      wheelsDone = true
      glassZones(true)
      lightZones()
      internal('engine', t('zones.engine'), 'engine', [0.6, 0.4, 0.55])
    } else if (fam === 'boat') {
      const bowL = 0.28 * L
      const sternL = 0.2 * L
      add('bow', t('zones.bow'), 'panel', [F - bowL, F + 0.3, cl - 0.4, belt + 0.25, -hw - 0.3, hw + 0.3], {
        dir: [-1, 0, 0],
        fxKey: 'hull',
        tags: ['front'],
        anyMesh: true,
      })
      ;[-1, 1].forEach(function (s) {
        add(
          'side_' + (s < 0 ? 'left' : 'right'),
          t(s < 0 ? 'zones.port_side' : 'zones.starboard_side'),
          'panel',
          s < 0
            ? [R + sternL, F - bowL, cl - 0.4, belt + 0.06, -hw - 0.35, -hw + 0.4]
            : [R + sternL, F - bowL, cl - 0.4, belt + 0.06, hw - 0.4, hw + 0.35],
          { side: s, fxKey: 'hull', who: t('who.boat_side'), anyMesh: true },
        )
      })
      add('stern', t('zones.stern'), 'panel', [R - 0.25, R + sternL, cl - 0.4, belt + 0.35, -hw - 0.3, hw + 0.3], {
        dir: [1, 0, 0],
        fxKey: 'hull',
        tags: ['rear'],
        anyMesh: true,
      })
      add('deck', t('zones.deck'), 'roof', [R + sternL, F - bowL, belt + 0.06, top + 0.4, -hw + 0.4, hw - 0.4], {
        dir: [0, -1, 0],
        fxKey: 'deck',
        alsoGlass: true,
      })
      const pp = I.partsOf(c, 'stern')[0]
      if (pp && pp.obj) {
        const pb = I.localBox(c, pp.obj, inv)
        add('engine', t('zones.outboard_engine'), 'part', pb.expandByScalar(0.05), {
          objs: [pp.obj],
          fxKey: 'engine',
          dir: [1, 0, 0],
          sub: 'engine',
          pos: pp.pos.clone(),
        })
      } else internal('engine', t('zones.engine'), 'engine', [0.5, 0.35, 0.45])
      internal('fuel_tank', t('zones.fuel_tank'), 'fuel_tank', [0.35, 0.25, 0.35])
      glassZones(true)
      lightZones()
      wheelZones(false)
    } else if (fam === 'plane') {
      const fw = (m.fuselageWidth || 1.2) / 2
      const span = W / 2
      const wingBB = new THREE.Box3()
      const tailX = R + Math.min(2.0, 0.28 * L)
      c.vehicle.traverse(function (o: any) {
        if (!o.isMesh || o.userData.decal) return
        const bb = I.localBox(c, o, inv)
        if (Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z)) > Math.max(2.0, span * 0.45) && bb.min.x > tailX) wingBB.union(bb)
      })
      if (wingBB.isEmpty()) wingBB.set(new V3(F - 3.0, belt, -span), new V3(F - 1.5, top, span))
      const hp = I.partsOf(c, 'propeller')[0]
      add(
        'nose',
        t(hp ? 'zones.nose_propeller' : 'zones.nose_engine'),
        'panel',
        [F - 1.25, F + 0.6, cl - 0.8, top + 0.2, -fw - 0.5, fw + 0.5],
        {
          dir: [-1, 0, 0],
          fxKey: 'nose',
          objs: hp && hp.obj ? [hp.obj] : [],
          tags: ['front'],
          anyMesh: true,
        },
      )
      add('cab', t('zones.cabin_glass'), 'panel', [wingBB.min.x - 0.4, F - 1.25, belt - 0.4, top + 0.15, -fw - 0.12, fw + 0.12], {
        dir: [0, 0, 1],
        fxKey: 'aircraft_cabin',
        who: t('who.pilot'),
        anyMesh: true,
      })
      ;[-1, 1].forEach(function (s) {
        add(
          'wing_' + (s < 0 ? 'left' : 'right'),
          t('zones.wing', { s }),
          'panel',
          s < 0
            ? [wingBB.min.x - 0.15, wingBB.max.x + 0.15, wingBB.min.y - 0.25, wingBB.max.y + 0.25, -span - 0.3, -fw - 0.18]
            : [wingBB.min.x - 0.15, wingBB.max.x + 0.15, wingBB.min.y - 0.25, wingBB.max.y + 0.25, fw + 0.18, span + 0.3],
          { side: s, dir: [0, -1, 0], fxKey: 'wing', cutAll: true, anyMesh: true },
        )
      })
      add('fuselage', t('zones.rear_fuselage'), 'panel', [tailX, wingBB.min.x - 0.4, cl - 0.2, top, -fw - 0.12, fw + 0.12], {
        dir: [0, 0, 1],
        fxKey: 'panel',
        anyMesh: true,
      })
      add('tail', t('zones.tail'), 'panel', [R - 0.4, tailX, 0, top + 0.6, -span * 0.5, span * 0.5], {
        dir: [0, -1, 0],
        fxKey: 'tail',
        cutAll: true,
        anyMesh: true,
        tags: ['rear'],
      })
      const gear = c.wheels.filter(function (w: any) {
        return w.parent
      })
      if (gear.length) {
        /* legs and fairings of the wheels (low parts near each wheel) belong to the gear: they fold and disappear together */
        const gb = new THREE.Box3()
        const gobj: any = []
        gear.forEach(function (w: any) {
          gb.union(I.localBox(c, w, inv))
        })
        c.vehicle.children.forEach(function (o: any) {
          if (!o.isMesh || o.userData.decal || o.userData.glass || c.wheels.indexOf(o) >= 0) return
          const bb = I.localBox(c, o, inv)
          const cen = bb.getCenter(new V3())
          const sz = bb.getSize(new V3())
          if (bb.isEmpty() || cen.y > cl * 0.85 || bb.max.y > cl + 0.45 || Math.max(sz.x, sz.y, sz.z) > 1.6) return
          if (
            !gear.some(function (w: any) {
              return Math.abs(w.position.x - cen.x) < 0.7 && Math.abs(w.position.z - cen.z) < 0.9
            })
          )
            return
          gobj.push(o)
          gb.union(bb)
        })
        add('landing_gear', t('zones.landing_gear'), 'wheel', gb.expandByScalar(0.06), { wheels: gear, objs: gobj, fxKey: 'landing_gear' })
      }
      add(
        'fuel_tanks',
        t('zones.wing_tanks'),
        'internal',
        [wingBB.min.x, wingBB.max.x, wingBB.min.y - 0.1, wingBB.max.y + 0.1, -span * 0.55, span * 0.55],
        { fxKey: 'fuel_tank', sub: 'fuel_tank', pos: new V3((wingBB.min.x + wingBB.max.x) / 2, wingBB.min.y, -span * 0.35) },
      )
      glassZones(true)
      glassDone = true
      lightZones()
      wheelsDone = true
      Z = Z.filter(function (z: any) {
        return z.type !== 'glass'
      }) /* the aircraft glass stays in the cabin */
    } else if (fam === 'heli') {
      const fw2 = (m.fuselageWidth || 1.3) / 2
      const ft2 = m.fuselageTop || Math.min(top - 0.5, belt + 1.0)
      const rp = I.partsOf(c, 'rotor')[0]
      const rt = I.partsOf(c, 'tail_rotor')[0]
      add('nose', t('zones.nose_bubble'), 'panel', [F - 1.05, F + 0.3, cl - 0.25, ft2 + 0.1, -fw2 - 0.2, fw2 + 0.2], {
        dir: [-1, 0, 0],
        fxKey: 'aircraft_cabin',
        who: t('who.pilot'),
        tags: ['front'],
        anyMesh: true,
      })
      add('cab', t('zones.cabin'), 'panel', [F - Math.min(3.2, 0.36 * L), F - 1.05, cl - 0.25, ft2 + 0.1, -fw2 - 0.25, fw2 + 0.25], {
        dir: [0, 0, 1],
        fxKey: 'cab',
        who: t('who.passengers'),
        anyMesh: true,
      })
      add('tail_cone', t('zones.tail_cone'), 'panel', [R + 1.0, F - Math.min(3.2, 0.36 * L), cl, ft2 + 0.6, -fw2 - 0.3, fw2 + 0.3], {
        dir: [0, -1, 0],
        fxKey: 'tail_cone',
        cutAll: true,
        anyMesh: true,
        tags: ['rear'],
      })
      if (rp && rp.obj)
        add('rotor', t('zones.main_rotor'), 'part', I.localBox(c, rp.obj, inv).expandByScalar(0.05), {
          objs: [rp.obj],
          fxKey: 'rotor',
          dir: [0, -1, 0],
          kindPart: 'rotor',
        })
      if (rt && rt.obj)
        add('tail_rotor', t('zones.tail_rotor'), 'part', I.localBox(c, rt.obj, inv).expandByScalar(0.05), {
          objs: [rt.obj],
          fxKey: 'tail_rotor',
          dir: [0, 0, 1],
          kindPart: 'tail_rotor',
        })
      const gear2 = c.wheels.filter(function (w: any) {
        return w.parent
      })
      add(
        'skids',
        t(gear2.length ? 'zones.landing_gear' : 'zones.skids'),
        gear2.length ? 'wheel' : 'part',
        [R + 1.0, F, -0.05, cl + 0.05, -W / 2 - 0.2, W / 2 + 0.2],
        { wheels: gear2, fxKey: gear2.length ? 'landing_gear' : 'skid', dir: [0, 1, 0] },
      )
      add('engine', t('zones.engine_transmission'), 'internal', [F - Math.min(3.4, 0.4 * L), F - 1.4, ft2 - 0.35, ft2 + 0.5, -fw2, fw2], {
        fxKey: 'engine',
        sub: 'engine',
      })
      glassZones(true)
      lightZones()
      wheelsDone = true
      Z = Z.filter(function (z: any) {
        return z.type !== 'glass'
      }) /* glass goes to the nose and the cabin */
    } else {
      /* generic: four sides and top */
      add('front', t('zones.front'), 'panel', [F - 0.4, F + 0.3, 0, top, -hw - 0.2, hw + 0.2], { dir: [-1, 0, 0], tags: ['front'] })
      ;[-1, 1].forEach(function (s) {
        add(
          'side_' + (s < 0 ? 'left' : 'right'),
          t('zones.side', { s }),
          'panel',
          s < 0 ? [R + 0.4, F - 0.4, 0, top, -hw - 0.3, -hw + 0.4] : [R + 0.4, F - 0.4, 0, top, hw - 0.4, hw + 0.3],
          { side: s },
        )
      })
      add('rear', t('zones.rear'), 'panel', [R - 0.3, R + 0.4, 0, top, -hw - 0.2, hw + 0.2], { dir: [1, 0, 0], tags: ['rear'] })
      add('top', t('zones.top'), 'roof', [R + 0.4, F - 0.4, top - 0.4, top + 0.2, -hw + 0.4, hw - 0.4], { dir: [0, -1, 0] })
    }
    if (!glassDone) glassZones(true)
    if (!lightsDone) lightZones()
    if (!wheelsDone) wheelZones(false)
    return Z
  }

  Object.assign(I, { autoZones })
}
