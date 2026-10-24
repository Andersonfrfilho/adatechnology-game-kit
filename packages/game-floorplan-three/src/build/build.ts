/* eslint-disable @typescript-eslint/no-unused-vars -- port of the team's closure: dead locals and shapes stay as delivered */
import type { Kernel, Shared } from '../kernel-types.js';

export function installBuildBuild(K: Kernel, shared: Shared): void {
  const { THREE, cfg, rectsOf, invalidateShadow, colliderChanged, VERSION, CARS, EPS, LIGHTS, MIRRORS, Y0, animateClotheslines, animateDoors, animateInteractive, applyLeaf, applyOutbuildings, applyPart, applyPiece, assembleInteractive, baseboardAndSidewalk, buildStairs, building, carModel, chooseMirror, closeScene, collideAt, createWater, cursor, doorText, doors, electricalStructure, elevator, floorsAndSlabs, gatesInteractive, houseItems, ivAssemble, ivBuild, ivDispose, ivParts, ivPublish, ivUpdate, lightOn, linkDoorLeaves, mailboxInteractive, newInteractiveState, newMirrorState, outbuildings, paths, perimeter, placeSwitches, roofs, roomAt, solar, targetOf, terrain, toggleDoor, toggleLight, walls, waterPipes, windows, props, TYPES, IVK, VEG, vegMaterials, markGroups, assembleStructure, createHouseDestruction, newState, enter, tagDamage } = K;
  function build(r0, opts) {
        opts = opts || {};
        const r = applyOutbuildings(r0); // R43: the outbuilding (res.outbuildings) enters the plan the SDK draws as a room, walls, door, windows and items; res.r stays the original plan
        const t0 = performance.now();
        const h: any = { ctx: { mv: props, types: TYPES }, inter: newInteractiveState(), state: opts.state || newState(), mirrors: newMirrorState(), quality: opts.quality === 'game' || opts.quality === 'high' ? opts.quality : (cfg.quality === 'game' ? 'game' : 'high'), lodCurrent: 0, lodMin: 0 };
        enter(h);
        cursor.accs.clear(); LIGHTS.length = 0;
        const pr = opts.building || {};
        shared.ctx.r = r; shared.ctx.colors = r.colors; shared.ctx.cut = !!opts.cut; shared.ctx.night = !!opts.night; shared.ctx.labels = []; shared.ctx.colliders = []; shared.ctx.stairs = []; shared.ctx.noTerrain = opts.terrain === false;
        shared.ctx.roomById = {}; for (const c of r.rooms) shared.ctx.roomById[c.id] = c;
        shared.ctx.pieces = new Map(); shared.ctx.pieceObjects = new Map(); shared.ctx.structureIndex = {}; for (const e of (r0.structure && r0.structure.parts) || []) shared.ctx.structureIndex[e.id] = e; shared.ctx.panes = (r0.roof && r0.roof.panes) || []; shared.ctx.noPiece = false;
        cursor.separate = opts.pieces === 'meshes'; cursor.pc = null;
        shared.ctx.apartment = r.template === 'apartment_modern'; shared.ctx.pa = Math.max(3, Math.min(20, pr.floors != null ? pr.floors : 5)); shared.ctx.pf = Math.max(1, Math.min(shared.ctx.pa, pr.floor != null ? pr.floor : 3)); shared.ctx.pu = Math.max(0, pr.unit != null ? pr.unit : 0);
        shared.ctx.showBuilding = shared.ctx.apartment && (pr.showIt == null ? true : !!pr.showIt);
        shared.ctx.limits = { x0: -2, z0: -2, x1: r.w + 2, z1: r.d + 2 };
        shared.ctx.vegInfo = null;
        terrain();
        if (r.lot) { if (!opts.noPerimeter) { perimeter(); gatesInteractive(); } paths(); } // GAME HOOK (stage 2): opts.noPerimeter:true does not draw the lot wall/fence/gates (the game has its own destructible wall on the Jardim Aurora lots)
        walls(); baseboardAndSidewalk(); shared.ctx.wallColliders = shared.ctx.colliders.length; doors(); windows(); floorsAndSlabs(); outbuildings(); buildStairs(); elevator();
        const water = createWater(r, h.state);
        shared.ctx.iv = null; h.IV = null;
        const noModel = houseItems(); placeSwitches(); waterPipes(); electricalStructure();
        roofs(); solar();
        if (shared.ctx.showBuilding) building();
        for (const c of r.rooms) { if (c.type === 'void') continue; const [a, b, c2, d] = rectsOf(c)[0]; shared.ctx.labels.push({ pos: new THREE.Vector3((a + c2) / 2, Y0(c.floor) + 1.1, (b + d) / 2), text: c.name, group: 'f' + c.floor, type: 'room', floor: c.floor }); }
        const mirrorsCopy = MIRRORS.map((E, i) => Object.assign({ i }, E)), gs = closeScene(shared.mats);
        for (const fo of shared.ctx.leaves) { // door leaves: loose groups with the origin at the hinge, inside the floor group
          const parent = gs['f' + fo.floor] || (gs['f' + fo.floor] = new THREE.Group()); fo.gs = [];
          for (const gd of fo.groups) { const g = gs[gd.name]; if (!g) continue; delete gs[gd.name]; g.position.set(...gd.pos); parent.add(g); fo.gs.push(g); }
          applyLeaf(fo);
        }
        assembleInteractive(gs); linkDoorLeaves(); mailboxInteractive();
        const root = new THREE.Group(), house = new THREE.Group(); root.name = 'house3d'; root.add(house); shared.mirrors.house = house;
        if (shared.ctx.apartment) { const u = r.building.units[Math.min(shared.ctx.pu, r.building.units.length - 1)]; house.position.set(u.u, shared.ctx.showBuilding ? 0 : -r.floors[0].y0, u.v); house.rotation.y = u.ry; shared.ctx.unitRy = u.ry; }
        house.updateMatrixWorld(true); shared.ctx.unitInverse = house.matrixWorld.clone().invert();
        for (const [k, g] of Object.entries<any>(gs)) { g.name = k; (k === 'floor' || k === 'building' ? root : house).add(g); }
        h.groups = gs; h.root = root; h.house = house; h.houseGroup = house;
        shared.ctx.noModel = noModel;
        shared.ctx.lights = LIGHTS.filter(l => l.type !== 'lantern' && l.type !== 'candles' || shared.ctx.night).map(l => ({ ...l })); // real lights requested by the builders (at night)
        shared.ctx.animateDoorsOn = shared.ctx.animateDoorsOn || false;

        // ---- public colliders: walls/doors/walls of the lot/gates (aabb) and furniture (obb) ----
        for (const c of shared.ctx.colliders) { c.aabb = [c.x0, c.z0, c.x1, c.z1]; if (c.type === 'wall') c.damageable = tagDamage('masonry'); }
        const colliders = shared.ctx.colliders.concat(shared.inter.objs.map(o => ({ type: 'furniture', f: o.f, obb: { cx: o.cx, cz: o.cz, hw: o.hw, hd: o.hd, c: o.c, s: o.s }, item: o.type, off: false })));

        // ---- parts (id -> {group, type, opens(t), damageable}) ----
        const parts = {}, setOpen = (def, t) => { def.target = t; def.t = t; shared.partState.set(def.name, t); if (def.col) { def.col.off = t > 0.5; colliderChanged(def.col); } applyPiece(def); shared.inter.anim.delete(def); invalidateShadow(); };
        const mark = (o, id) => { if (o) o.userData.partId = id; };
        const PART_DAMAGE = { water_tank: 'water', shower_door: 'glass', gate_leaf: 'metal', mailbox_door: 'metal', mirror: 'glass', cooking_gas_cylinder: 'gas' };
        for (const [id, g] of Object.entries<any>(shared.ctx.parts || {})) {
          const tp = g.userData.part, dn = PART_DAMAGE[tp]; if (dn) g.userData.damageable = tagDamage(dn);
          mark(g, id);
          if (tp === 'wall_pipe') { parts[id] = { id, type: tp, group: g, damageable: null, hidden: true, run: g.userData.run, to: g.userData.to, opens: t => { g.visible = t > 0.5; invalidateShadow(); }, get t() { return g.visible ? 1 : 0; }, meta: g.userData }; continue; } // R69: pipe inside the wall: hidden until the destruction stage reveals it (opens(1))
          parts[id] = { id, type: tp, group: g, damageable: g.userData.damageable || null, opens: t => { applyPart(g, t); invalidateShadow(); }, get t() { return g.userData.t || 0; }, meta: g.userData };
        }
        for (const fo of shared.ctx.leaves) {
          const id = 'door:' + fo.id, dn = tagDamage(fo.type === 'steel' ? 'metal' : 'wood'); fo.damageable = dn; for (const g of fo.gs) mark(g, id);
          parts[id] = { id, type: fo.type === 'steel' ? 'garage_door' : 'door', group: fo.gs[0] || null, groups: fo.gs, floor: fo.floor, damageable: dn, opens: t => { fo.open = t > 0.5; fo.t = t; fo.phase = null; if (fo.col) { fo.col.off = fo.open; colliderChanged(fo.col); } shared.doorState.set(fo.id, fo.open); applyLeaf(fo); invalidateShadow(); }, get t() { return fo.t; }, leaf: fo };
        }
        for (const def of shared.inter.defs.values()) {
          if (!def.outer) continue; const cab = def.kind === 'swing' || def.kind === 'drawer', gate = /^gate/.test(def.kind);
          const dn = cab ? tagDamage('wood') : gate ? tagDamage('metal') : null; if (dn) def.damageable = dn;
          mark(def.outer, def.name); parts[def.name] = { id: def.name, type: gate ? 'gate' : def.kind, group: def.outer, internal: def.inner, damageable: dn, opens: t => setOpen(def, t), get t() { return def.t; }, def };
        }
        const cars = []; // lot/garage cars: the fleet's damageables (boxes in the car space) become virtual parts in the house space
        CARS.forEach((C, i) => {
          const mod = carModel(C.k, C.seed); if (!mod) return;
          const s = Math.min(1, C.d / mod.L, Math.max(0.5, C.w - 0.05) / mod.W), co = Math.cos(C.ry || 0), si = Math.sin(C.ry || 0), ids = [];
          (mod.damageables || []).forEach((d, j) => {
            const b = d.box; let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
            for (const px of [b.min.x, b.max.x]) for (const pz of [b.min.z, b.max.z]) { const lx = (px - mod.off[0]) * s, lz = (pz - mod.off[2]) * s, wx = C.x + lx * co + lz * si, wz = C.z - lx * si + lz * co; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz); }
            y0 = C.y + (b.min.y - mod.off[1]) * s; y1 = C.y + (b.max.y - mod.off[1]) * s;
            const id = 'car:' + i + ':' + d.zone + ':' + j; ids.push(id);
            parts[id] = { id, type: 'car', part: d.part, side: d.side, zone: d.zone, group: null, virtual: true, floor: -1, car: i, aabb: [x0, y0, z0, x1, y1, z1], damageable: tagDamage(d.type), opens: () => { }, t: 0 };
          });
          cars.push({ i, k: C.k, seed: C.seed, pos: [C.x, C.y, C.z], ry: C.ry || 0, scale: s, parts: ids });
        });
        const wallAt = (f, axis, L) => r.walls.find(w => w.floor === f && w.axis === axis && Math.abs((axis === 'u' ? w.v0 : w.u0) - L) < EPS);
        for (const j of r.windows) { // windows live inside the wall geometry (virtual): a box for the shot test; the separate glass joins at the damage stage
          const alongU = j.axis === 'u', y0 = Y0(j.floor), a = j.at - j.width / 2, b = j.at + j.width / 2, w = wallAt(j.floor, j.axis, j.pos), th = w ? w.thickness || 0.15 : 0.15, L = j.pos, id = 'window:' + j.id;
          parts[id] = { id, type: 'window', group: null, virtual: true, floor: j.floor, aabb: alongU ? [a, y0 + j.y0, L - th / 2, b, y0 + j.y1, L + th / 2] : [L - th / 2, y0 + j.y0, a, L + th / 2, y0 + j.y1, b], damageable: tagDamage('glass'), opens: () => { }, t: 0 };
        }
        for (const E of mirrorsCopy) { const id = 'mirror:' + E.i, ex = Math.abs(Math.cos(E.ry)) * E.w / 2 + 0.03, ez = Math.abs(Math.sin(E.ry)) * E.w / 2 + 0.03; parts[id] = { id, type: 'mirror', group: null, virtual: true, floor: E.floor, room: E.room, pos: [E.x, E.y, E.z], aabb: [E.x - ex, E.y - E.h / 2, E.z - ez, E.x + ex, E.y + E.h / 2, E.z + ez], damageable: tagDamage('glass'), opens: () => { }, t: 0 }; }

        // ---- interactables ----
        const interactables = [], usedMap = new Map();
        const actOn = (e, a?) => { enter(h); if (cfg.onInteract && cfg.onInteract(e, a) === false) return false; shared.inter.target = a || { target: e.ref, text: e.label, action: e._action }; e._action(); return true; };
        for (const fo of shared.ctx.leaves) { const e: any = { id: 'door:' + fo.id, type: fo.type === 'steel' ? 'garage_door' : 'door', floor: fo.floor, pos: [fo.cx, Y0(fo.floor) + 1.0, fo.cz], radius: 1.7, get label() { return doorText(fo); }, ref: fo, _action: () => toggleDoor(fo) }; e.act = () => actOn(e); interactables.push(e); }
        for (const it of shared.inter.items) { const k = it.type + ':' + it.id, n = usedMap.get(k) || 0; usedMap.set(k, n + 1); const e: any = { id: n ? k + '#' + n : k, type: it.type, floor: it.floor, pos: it.anchor.slice(), radius: it.range, angle: it.angle, get label() { return it.text(); }, ref: it, _action: it.action }; e.act = () => actOn(e); interactables.push(e); it.pub = e; }
        for (const fo of shared.ctx.leaves) fo.pub = interactables.find(e => e.ref === fo);

        // ---- LOD / draw statistics ----
        const lodObjects = [];
        for (const def of shared.inter.defs.values()) if (def.outer && /^(light|drawer|swing|curtain|light_switch|handle)$/.test(def.kind)) lodObjects.push(def.outer);
        for (const [id, g] of Object.entries<any>(shared.ctx.parts || {})) if (/^(handle|shower_door)$/.test(g.userData.part) && g.visible !== false) lodObjects.push(g);
        if (shared.ctx.iv) { for (const E of shared.ctx.iv.roots) lodObjects.push(E.root); }
        const countDraw = () => { let n = 0, t = 0; root.traverseVisible(o => { if (o.isMesh) { n++; t += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; } }); return { n, t: Math.round(t) }; };
        const s0 = countDraw(); for (const o of lodObjects) o.visible = false; const s1 = countDraw(); for (const o of lodObjects) o.visible = true;
        const budget = opts.drawCallBudget != null ? opts.drawCallBudget : cfg.drawCallBudget;
        const stats = { quality: h.quality, drawCalls: s0.n, drawCallsLOD1: s1.n, triangles: s0.t, trianglesLod1: s1.t, budget: budget || null, overBudget: !!budget && s0.n > budget, tBuild: performance.now() - t0 };
        shared.ctx.tBuild = stats.tBuild;
        const applyLod = n => { n = Math.max(0, Math.min(2, n | 0)); if (n === h.lodCurrent) return; h.lodCurrent = n; for (const o of lodObjects) o.visible = n < 1; root.visible = n < 2; if (h.destruction) h.destruction.breach.setLod(n); invalidateShadow(); };
        h.lodMin = stats.overBudget ? 1 : 0; if (h.lodMin) applyLod(h.lodMin);
        const bb = new THREE.Box3().setFromObject(house), localCenter = bb.getCenter(new THREE.Vector3());
        const center = () => { house.updateMatrixWorld(); return house.localToWorld(localCenter.clone()); };
        const distance = focus => center().distanceTo(focus instanceof THREE.Vector3 ? focus : new THREE.Vector3(focus.x, focus.y, focus.z));

        // ---- destruction: tags the loose groups, describes the structure and prepares the world adapter (cfg.destruction) ----
        markGroups(r, root, parts);
        const structure = assembleStructure(r0, root), destruction = createHouseDestruction(root, house, structure, parts, colliders, water); h.destruction = destruction; destruction.breach.setLod(h.lodCurrent);
        // legacy damage: `house.damage(id, point, type, amount)` still subtracts the damageable's hp (the game reads `hp`) and calls cfg.onDamage, and now also
        // becomes a hit in the core when there is a world (cfg.destruction): the piece really breaks, hides its mesh and drops what it carries. Once fractured, hp is zeroed.
        const strikePiece = (id, point, type, amount, d, before) => {
          if (!destruction.world) return;
          const pid = id && structure.byId.has(id) ? id : (parts[id] && parts[id].type === 'water_tank' && structure.byId.has('water_tank') ? 'water_tank' : null); if (!pid) return;
          destruction.strike(pid, point, type, amount, d);
          if (destruction.active && d.hp <= 0 && before > 0) { const ps = destruction.piece(pid); if (ps && ps.status !== 'broken') destruction.strike(pid, point, 'strike', 1e6, { hpMax: 1 }); }
        };
        const fire = (id, point, type, amount) => {
          const p = parts[id]; if (!p || !p.damageable) return null; const d = p.damageable, before = d.hp;
          d.hp = Math.max(0, d.hp - (amount != null ? amount : 1));
          if (p.type === 'water_tank' && d.hp < before && !destruction.world) water.leak(water.capacity * (1 - d.hp / d.hpMax) / 30); // R69: a shot at the tank opens a leak (empties in 30 s with the tank fully destroyed)
          if (destruction.world) strikePiece(id, point, type, amount, d, before);
          if (cfg.onDamage) cfg.onDamage(p, point, type || 'bullet');
          return { part: p, hp: d.hp, destroyed: d.hp <= 0 && before > 0 };
        };
        // walls: the wall collider carries `piece` (segment id); the game subtracts its hp and calls colliderDamage so the core receives the hit
        const colliderDamage = (c, point, type, amount) => {
          if (!c || !c.damageable) return null; const d = c.damageable, before = d.hp; d.hp = Math.max(0, d.hp - (amount != null ? amount : 1));
          if (destruction.world && c.piece) strikePiece(c.piece, point, type, amount, d, before);
          if (cfg.onDamage) cfg.onDamage({ type: 'wall', damageable: d, collider: c }, point, type || 'bullet');
          return { hp: d.hp, destroyed: d.hp <= 0 && before > 0 };
        };

        const res = {
          version: VERSION, r: r0, name: r.name, quality: h.quality, group: root, house, groups: gs,
          floors: r.floors.map((a, i) => gs['f' + i] || new THREE.Group()), ceilings: r.floors.map((a, i) => gs['t' + i] || null), roof: gs.roof || null, lot: gs.lot || null, ground: gs.ground || null, building: gs.building || null,
          waterTank: r.waterTank ? (() => { const pt = Object.values<any>(parts).find(p => p.type === 'water_tank') || null; return { part: pt, group: pt ? pt.group : null, pos: shared.ctx.waterTankPos || null, plant: r.waterTank }; })() : null,
          colliders, parts, cars, interactables, doors: shared.ctx.leaves, stairs: shared.ctx.stairs, labels: shared.ctx.labels, noModel,
          lights: (() => { const by = {}; for (const l of shared.ctx.lights) { const k = l.roomId != null ? l.roomId : l.room; (by[k] || (by[k] = [])).push(l); } return { list: shared.ctx.lights, byRoom: by }; })(),
          limits: shared.ctx.limits, apartment: shared.ctx.apartment, showBuilding: shared.ctx.showBuilding, buildingConfig: { floors: shared.ctx.pa, floor: shared.ctx.pf, unit: shared.ctx.pu }, unitRy: shared.ctx.unitRy || 0, night: shared.ctx.night, cut: shared.ctx.cut,
          interactives: null,
          state: h.state, stats, vegetation: shared.ctx.vegInfo || null, solar: shared.ctx.solarInfo || null, water, electrical: shared.ctx.electricalInfo || null, gutters: shared.ctx.gutterInfo || null,
          // per frame: doors, parts, wind-blown laundry and (with a focus) distance LOD; dt in seconds, time in ms (rAF); focus = {x,y,z} in world coordinates
          update(dt, time, focus) {
            enter(h); animateDoors(dt); animateInteractive(dt); water.step(dt); if (destruction.active || destruction.statistics().falling || destruction.statistics().fragments) destruction.animate(dt);  if (shared.vegMaterials) { shared.vegMaterials.update((time != null ? time : performance.now()) / 1000); shared.vegMaterials.setActors(focus ? [{ x: focus.x, y: focus.y, z: focus.z, radius: 0.9 }] : []); }
            if (focus && cfg.lod !== false) { const L = Object.assign({ interior: 45, hide: 220 }, cfg.lod), d = distance(focus), at = h.lodCurrent; let n = d > L.hide ? 2 : d > L.interior ? 1 : 0; if (n < at) n = d < (at === 2 ? L.hide : L.interior) * 0.92 ? n : at; applyLod(Math.max(n, h.lodMin)); }
          },
          show(o) { // visibility per floor: {floor: -1 all, cut: bool, lot: bool}
            enter(h); o = o || {}; const rr = shared.ctx.r, nA = rr.floors.length, a = o.floor == null ? -1 : o.floor, sel = a >= nA ? -1 : a, cut = !!o.cut;
            for (const [k, g] of Object.entries<any>(gs)) {
              let v = true;
              if (k[0] === 'f') v = sel < 0 || +k.slice(1) <= sel;
              else if (k[0] === 't') v = !cut && (sel < 0 || +k.slice(1) < sel);
              else if (k === 'roof') v = !cut && sel < 0 && (!shared.ctx.apartment || !shared.ctx.showBuilding || shared.ctx.pf === shared.ctx.pa);
              else if (k === 'attic_tank') v = (cut || sel >= 0) && (sel < 0 || nA - 1 <= sel); // attic water tank: only with the roof cut
              else if (k === 'lot') v = o.lot == null ? true : !!o.lot;
              g.visible = v;
            }
          },
          message() { return shared.inter.msg && performance.now() < shared.inter.msg.until ? shared.inter.msg.text : null; },
          toggleDoor(fo) { enter(h); toggleDoor(typeof fo === 'string' ? shared.ctx.leaves.find(f => f.id === fo) : fo); },
          lightOn(roomId) { enter(h); return lightOn(roomId); },
          toggleLight(roomId) { enter(h); toggleLight(roomId); },
          collide(x, z, floor, opt) { enter(h); return collideAt(x, z, floor, opt); },
          roomAt(f, u, v) { enter(h); return roomAt(f, u, v); },
          y0(f) { enter(h); return Y0(f); },
          chooseMirror(camera) { enter(h); chooseMirror(camera); },
          // manual LOD: 0 full; 1 without the small interior pieces (lamps, drawers, furniture doors, curtains, switches, handles); 2 house hidden
          setLod(n) { enter(h); applyLod(Math.max(n, h.lodMin)); }, get lod() { return h.lodCurrent; },
          center, distance,
          // damage: the game calls it when a shot/fire hits a part; the SDK subtracts hp and notifies cfg.onDamage(part, point, type). Draws no damage (stage 3).
          damage: fire, colliderDamage,
          structure, destruction,
          partOf(obj) { for (let n = obj; n; n = n.parent) { const id = n.userData && n.userData.partId; if (id && parts[id]) return parts[id]; const pc = n.userData && n.userData.piece; if (pc && parts[pc.name]) return parts[pc.name]; } return null; },
          partAt(p, tol) { tol = tol || 0.05; let m = null; for (const k in parts) { const a = parts[k].aabb; if (a && p.x >= a[0] - tol && p.x <= a[3] + tol && p.y >= a[1] - tol && p.y <= a[4] + tol && p.z >= a[2] - tol && p.z <= a[5] + tol) { m = parts[k]; break; } } return m; },
          dispose() { enter(h); destruction.deactivate();   root.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.type === 'Reflector' && o.dispose) o.dispose(); }); root.removeFromParent(); },
          internal: { h, ctx: shared.ctx, inter: shared.inter, partState: shared.partState, doorState: shared.doorState, mirrors: shared.mirrors },
        };
        return res;
      }
  Object.assign(K, { build });
}
