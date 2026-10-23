/** Zone derivation from the vehicle meta, merged with builder declarations. */
import type { Kit } from './types'

export function installZoneDerive(kit: Kit): void {
  const THREE = kit.THREE
  const V3 = THREE.Vector3
  const I = kit._

  /* ---- finalisation: direction, side, owned parts, map ---- */
  function parseDir(d: any) {
    if (!d) return null
    if (d.isVector3) return d.clone().normalize()
    if (Array.isArray(d)) return new V3(d[0], d[1], d[2]).normalize()
    return (
      ({
        left: new V3(0, 0, 1),
        right: new V3(0, 0, -1),
        front: new V3(-1, 0, 0),
        rear: new V3(1, 0, 0),
        up: new V3(0, -1, 0),
        down: new V3(0, 1, 0),
      } as Record<string, any>)[d] || null
    )
  }
  function resolveObjs(c: any, list: any, z: any) {
    const out: any = []
    ;(list || []).forEach(function (o: any) {
      if (!o) return
      if (typeof o === 'string') {
        c.parts.forEach(function (p: any) {
          if ((p.label === o || p.kind === o) && p.obj) {
            if (p.light) z.lights.push(p.light)
            else out.push(p.obj)
          }
        })
        c.glass.forEach(function (g: any) {
          if (g.userData.glass && g.userData.glass.label === o) z.glass.push(g)
        })
        return
      }
      if (o.lens && o.inner) {
        z.lights.push(o)
        return
      }
      if (o.isObject3D) {
        if (o.userData.glass) z.glass.push(o)
        else if (c.wheels.indexOf(o) >= 0) z.wheels.push(o)
        else out.push(o)
      }
    })
    return out
  }
  function deriveZones(c: any) {
    const m = c.meta
    let list: any = []
    const byId: any = {}
    ;(m.zones === false ? [] : I.autoZones(c)).forEach(function (z: any) {
      byId[z.id] = z
      list.push(z)
    })
    ;(c.zoneDefs || []).forEach(function (d: any) {
      let z = byId[d.id]
      if (d.remove) {
        if (z) {
          list.splice(list.indexOf(z), 1)
          delete byId[d.id]
        }
        /* removing the left headlight also removes the extra groups on the same side (headlight_left_2...) */
        list.slice().forEach(function (q: any) {
          if (q.id.indexOf(d.id + '_') === 0 && /^\d+$/.test(q.id.slice(d.id.length + 1))) {
            list.splice(list.indexOf(q), 1)
            delete byId[q.id]
          }
        })
        return
      }
      if (z) {
        const o0 = z.objs || []
        Object.assign(z, d)
        z.objs = d.objs ? (d.replace ? d.objs : o0.concat(d.objs)) : o0
      } else {
        z = Object.assign({ type: 'panel' }, d)
        byId[d.id] = z
        list.push(z)
      }
    })
    const inv = I.worldInverseOf(c)
    const F = m.front
    const R = m.rear
    const W = m.width || 1.7
    const owner = new Map()
    /* zone created (or refined as part/wheel) with parts only, no box: the box comes from the parts themselves */
    ;(c.zoneDefs || []).forEach(function (d: any) {
      const z = byId[d.id]
      if (!z || d.remove || d.box || !d.objs || !d.objs.length) return
      if (z.box && !d.fit && !(z.type === 'part' || z.type === 'wheel')) return
      const tmp = { lights: [], glass: [], wheels: [] }
      const os = resolveObjs(c, d.objs, tmp)
      const bb = new THREE.Box3()
      os.concat(tmp.glass, tmp.wheels).forEach(function (o: any) {
        bb.union(I.localBox(c, o, inv))
      })
      tmp.lights.forEach(function (Lt) {
        bb.union(I.lightBoxOf(c, Lt, inv))
      })
      if (z.box && z.type === 'wheel')
        (z.wheels || []).forEach(function (w: any) {
          bb.union(I.localBox(c, w, inv))
        })
      if (bb.isEmpty()) return
      bb.expandByScalar(0.05)
      if (z.box && z.type === 'part' && !d.fit) {
        const B0 = z.box
        bb.union(new THREE.Box3(new V3(B0.x0, B0.y0, B0.z0), new V3(B0.x1, B0.y1, B0.z1)))
      }
      z.box = I.normalizeBox(bb)
    })
    list = list.filter(function (z: any) {
      return z.box && z.name
    })
    list.forEach(function (z: any) {
      z.glass = (z.glass || []).slice()
      z.lights = (z.lights || []).slice()
      z.wheels = (z.wheels || []).slice()
      z.tags = z.tags || []
      z.owned = resolveObjs(c, z.objs, z)
      if (z.plastic == null && (c.meta.kind === 'bike' || c.meta.kind === 'quad') && (z.fxKey === 'fairing' || z.fxKey === 'seat'))
        z.plastic = true
      if (z.plastic) z.noFlap = true
      const cen = I.boxCenter(z.box)
      if (z.side == null) z.side = cen.z < -W * 0.2 ? -1 : cen.z > W * 0.2 ? 1 : 0
      z.dir =
        parseDir(z.dir) ||
        (z.side
          ? new V3(0, 0, -z.side)
          : cen.x > F - 0.2 * (F - R)
            ? new V3(-1, 0, 0)
            : cen.x < R + 0.2 * (F - R)
              ? new V3(1, 0, 0)
              : new V3(0, -1, 0))
      z.weight = z.weight || I.ZONE_WEIGHTS[z.type] || 1
      z.internal = z.type === 'internal'
      z.health = 100
      if (z.side < 0 && z.tags.indexOf('left') < 0) z.tags.push('left')
      if (z.side > 0 && z.tags.indexOf('right') < 0) z.tags.push('right')
      z.owned.forEach(function (o: any) {
        owner.set(o, z)
      })
      z.glass.forEach(function (o: any) {
        if (!owner.has(o)) owner.set(o, z)
      })
      z.wheels.forEach(function (o: any) {
        owner.set(o, z)
      })
      z.lights.forEach(function (Lt: any) {
        if (Lt.group) owner.set(Lt.group, z)
        Lt.lens.concat(Lt.inner).forEach(function (o: any) {
          owner.set(o, z)
        })
      })
    })
    /* glass without a zone of its own goes to the panel zone that contains it (aircraft cabin, helicopter nose) */
    c.glass.forEach(function (g: any) {
      if (owner.has(g) || !g.parent || !g.userData.glass || g.userData.ghost) return
      const cg = I.localBox(c, g, inv).getCenter(new V3())
      let best: any = null
      list.forEach(function (z: any) {
        if (z.internal || z.type === 'wheel' || z.type === 'light') return
        if (I.boxContains(z.box, cg.x, cg.y, cg.z, 0.05) && (!best || I.boxVolume(z.box) < I.boxVolume(best.box))) best = z
      })
      if (best) {
        best.glass.push(g)
        owner.set(g, best)
      }
    })
    /* loose parts (children of c.vehicle) join the smallest "part" zone that contains them */
    const looseParts = list.filter(function (z: any) {
      return z.type === 'part'
    })
    if (looseParts.length)
      c.vehicle.children.forEach(function (o: any) {
        if (owner.has(o) || o.userData.decal || o.isSprite || o.userData.glass || c.wheels.indexOf(o) >= 0) return
        const bb = I.localBox(c, o, inv)
        if (bb.isEmpty()) return
        const cen = bb.getCenter(new V3())
        const sz = bb.getSize(new V3())
        let best: any = null
        looseParts.forEach(function (z: any) {
          const B = z.box
          if (!I.boxContains(B, cen.x, cen.y, cen.z, 0.02)) return
          if (sz.x > (B.x1 - B.x0) * 1.6 + 0.1 || sz.y > (B.y1 - B.y0) * 1.6 + 0.1 || sz.z > (B.z1 - B.z0) * 1.6 + 0.1) return
          if (!best || I.boxVolume(B) < I.boxVolume(best.box)) best = z
        })
        if (best) {
          best.owned.push(o)
          owner.set(o, best)
          c.lights.forEach(function (Lt: any) {
            if (Lt.group === o && best.lights.indexOf(Lt) < 0) best.lights.push(Lt)
          })
        }
      })
    /* mirrors: small parts outside the body width, at belt height, next to the front door */
    list.forEach(function (z: any) {
      if (!z.mirror) return
      z.mirrors = []
      const B = z.box
      const belt = m.belt || 1
      c.vehicle.children.forEach(function (o: any) {
        if (owner.has(o) || !o.isMesh || o.userData.decal) return
        const bb = I.localBox(c, o, inv)
        const cen = bb.getCenter(new V3())
        const sz = bb.getSize(new V3())
        if (Math.max(sz.x, sz.y, sz.z) > 0.6) return
        if (
          Math.sign(cen.z) !== z.side ||
          Math.abs(cen.z) < W / 2 + 0.015 ||
          cen.y < belt - 0.15 ||
          cen.y > belt + 0.4 ||
          cen.x < B.x1 - 0.55 ||
          cen.x > B.x1 + 0.25
        )
          return
        z.mirrors.push(o)
        owner.set(o, z)
      })
      /* the housing and the mirror glass stay next to the arm already found (the core may sit inside the body width) */
      if (z.mirrors.length) {
        const mb = new THREE.Box3()
        z.mirrors.forEach(function (o: any) {
          mb.union(I.localBox(c, o, inv))
        })
        mb.expandByScalar(0.05)
        c.vehicle.children.forEach(function (o: any) {
          if (owner.has(o) || !o.isMesh || o.userData.decal || o.userData.glass) return
          const bb = I.localBox(c, o, inv)
          const sz = bb.getSize(new V3())
          if (Math.max(sz.x, sz.y, sz.z) > 0.3 || !mb.intersectsBox(bb)) return
          z.mirrors.push(o)
          owner.set(o, z)
        })
      }
    })
    list.forEach(function (z: any) {
      const B = z.box
      z.map = z.map || [Math.max(B.x0, R - 0.3), Math.min(B.x1, F + 0.3), Math.max(B.z0, -W / 2 - 0.35), Math.min(B.z1, W / 2 + 0.35)]
    })
    carMap(c, list)
    c.zoneOwners = owner
    return list
  }
  /* more readable top-down map for cars: door on the edge, side glass inward, roof in the middle */
  function carMap(c: any, list: any) {
    const m = c.meta
    const W = m.width || 1.7
    const hw = W / 2
    const gh = m.glasshouse
    if ((m.kind || 'car') !== 'car' || !gh || gh.fb == null) return
    list.forEach(function (z: any) {
      if (z.mapSet) return
      const B = z.box
      const s = z.side
      if (z.type === 'door' || /^fender|^side_rear/.test(z.id)) z.map = [B.x0, B.x1, s < 0 ? -hw : hw - 0.16, s < 0 ? -hw + 0.16 : hw]
      else if (z.type === 'glass' && s) z.map = [B.x0, B.x1, s < 0 ? -hw + 0.17 : hw - 0.3, s < 0 ? -hw + 0.3 : hw - 0.17]
      else if (z.id === 'roof') z.map = [Math.min(gh.rt, gh.rb + 0.3), Math.max(gh.ft, gh.fb - 0.3), -hw + 0.31, hw - 0.31]
      else if (z.type === 'glass' && z.tags.indexOf('windshield') >= 0)
        z.map = [Math.max(gh.ft, gh.fb - 0.3), gh.fb + 0.02, -hw + 0.31, hw - 0.31]
      else if (z.type === 'glass') z.map = [B.x0 - 0.02, Math.min(gh.rt, gh.rb + 0.3), -hw + 0.31, hw - 0.31]
      else if (z.id === 'hood' || z.id === 'lid' || z.id === 'cargo_bed')
        z.map = [Math.max(B.x0, z.id === 'hood' ? gh.fb : -1e9), Math.min(B.x1, z.id === 'hood' ? 1e9 : gh.rb), -hw + 0.17, hw - 0.17]
      else if (z.type === 'bumper' || /^bumper/.test(z.id))
        z.map = [z.id === 'bumper_front' ? m.front - 0.2 : m.rear - 0.02, z.id === 'bumper_front' ? m.front + 0.02 : m.rear + 0.2, -hw, hw]
      else if (z.type === 'wheel') {
        const w = z.wheels[0]
        const r = (w && w.userData.r) || 0.3
        if (w)
          z.map = [
            w.position.x - r * 0.85,
            w.position.x + r * 0.85,
            w.position.z < 0 ? -hw - 0.2 : hw - 0.02,
            w.position.z < 0 ? -hw + 0.02 : hw + 0.2,
          ]
      } else if (z.type === 'light')
        z.map = [Math.max(B.x0, m.rear - 0.02), Math.min(B.x1, m.front + 0.02), Math.max(B.z0, -hw), Math.min(B.z1, hw)]
    })
  }
  function zonesOf(c: any) {
    if (!c.zones) c.zones = deriveZones(c)
    return c.zones
  }
  kit.zonesOf = zonesOf
  function ownerOf(c: any, o: any) {
    const own = c.zoneOwners
    if (!own) return null
    for (let q = o; q && q !== c.vehicle; q = q.parent) if (own.has(q)) return own.get(q)
    return null
  }
  kit.zoneOwner = ownerOf

  Object.assign(I, { parseDir, resolveObjs, deriveZones, carMap, zonesOf, ownerOf })
}
