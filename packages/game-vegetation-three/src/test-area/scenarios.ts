import type { ModuleScenario } from '@adatechnology/game-contracts'

import type { VegetationContext, VegetationRoom } from './types'

type A = any
type V3 = [number, number, number]
type Spawned = { objectId: string; root: { userData: Record<string, any> } }

/**
 * The 13 scenarios of the Viveiro's vegetation module, literal (same objects, same tools, same sentences, in both languages). `veg_*` are the ids of the page.
 * A tool is taken with `setTool`; the room gives every tool its draw time, so each one waits for it (`room.waitUntilReady`) where the page's room used it at once.
 */
export function createScenarios(locale: string): ModuleScenario<VegetationContext>[] {
  const en = String(locale || 'pt-BR').toLowerCase().indexOf('en') === 0
  const L = (pt: string, e: string): string => (en ? e : pt)
  const yn = (b: unknown): string => (b ? L('sim', 'yes') : L('não', 'no'))

  const specOf = (so: Spawned): A => so.root.userData.vegSpec
  const partSpec = (so: Spawned, pid: string): A => specOf(so).parts.filter((p: A) => p.id === pid)[0]
  const world = (so: Spawned, local: V3): V3 => {
    const r = so.root as A
    return [r.position.x + local[0], r.position.y + local[1], r.position.z + local[2]]
  }
  const norm = (v: V3): V3 => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1
    return [v[0] / l, v[1] / l, v[2] / l]
  }
  const dist = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const DIRS: V3[] = [[0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0.7, 0, -0.7], [-0.7, 0, -0.7], [0.7, 0, 0.7], [-0.7, 0, 0.7], [0, -1, 0]]

  const center = (so: Spawned, pid: string): V3 => world(so, partSpec(so, pid).position)

  // Joint tools (saw, knife): the camera position from which the ray hits something within 0.45 m of the joint asked for. Aims the camera.
  const aim = (room: VegetationRoom, so: Spawned, target: V3, standoff: number, opt: { beyond?: number; joint?: string; jointRange?: number } = {}): A => {
    let best: A = null
    for (const dir of DIRS) {
      const d = norm(dir)
      const origin: V3 = [target[0] - d[0] * standoff, target[1] - d[1] * standoff, target[2] - d[2] * standoff]
      if (origin[1] < 0.25) continue
      const hit = room.world.raycast(origin, d, standoff + (opt.beyond == null ? 0.6 : opt.beyond))
      if (!hit || hit.object !== so.objectId) continue
      let score = dist(hit.point, target)
      if (opt.joint) {
        const nj = room.world.nearestJoint(so.objectId, hit.point, opt.jointRange || 0.45)
        if (!nj || nj.id !== opt.joint) score += 20
      }
      if (!best || score < best.score) best = { score, origin, target, hit }
    }
    if (!best) best = { score: 99, origin: [target[0], target[1], target[2] + standoff], target, hit: null }
    room.look(best.origin, best.target)
    return best
  }
  // Weapons and fire: finds a horizontal (or from above) direction from which the first hit of the ray is the piece `pid`, and puts the camera `gap` metres from the surface
  // (blade stroke: 0.5; lighter: 0.08; shot: 2.5). `at` changes the aimed point (object local).
  const AIMDIRS: V3[] = [[0, 0, -1], [0.7, 0, -0.7], [-0.7, 0, -0.7], [1, 0, 0], [-1, 0, 0], [0, -1, 0], [0.7, 0, 0.7], [-0.7, 0, 0.7], [0, 0, 1]]
  const aimPart = (room: VegetationRoom, so: Spawned, pidsIn: string | string[], gap: number, at?: V3): { origin: V3; point: V3; found: boolean; pid: string } => {
    const pids = typeof pidsIn === 'string' ? [pidsIn] : pidsIn
    let best: A = null
    for (const pid of pids) {
      const c = at ? world(so, at) : center(so, pid)
      for (const dir of AIMDIRS) {
        const d = norm(dir)
        const far = 8
        const origin: V3 = [c[0] - d[0] * far, c[1] - d[1] * far, c[2] - d[2] * far]
        if (origin[1] < 0.3) continue
        const hit = room.world.raycast(origin, d, far + 3)
        if (!hit || hit.object !== so.objectId || hit.part !== pid) continue
        const score = dist(hit.point, c)
        if (!best || score < best.score) best = { score, d, hit, pid }
      }
    }
    if (!best) best = { score: 99, d: [0, 0, -1], hit: { point: center(so, pids[0] as string) }, pid: pids[0] }
    const H = best.hit.point as V3
    const from: V3 = [H[0] - best.d[0] * gap, H[1] - best.d[1] * gap, H[2] - best.d[2] * gap]
    if (from[1] < 0.3) from[1] = 0.3
    room.look(from, [H[0] + best.d[0] * 0.3, H[1] + best.d[1] * 0.3, H[2] + best.d[2] * 0.3])
    return { origin: from, point: H, found: best.score < 99, pid: best.pid }
  }
  const crownsOf = (so: Spawned): string[] => specOf(so).parts.filter((p: A) => /^(s\d+_)?crown\d*$/.test(p.id)).map((p: A) => p.id)
  const jointPos = (so: Spawned, jid: string): V3 => {
    const j = specOf(so).joints.filter((x: A) => x.id === jid)[0]
    const a = partSpec(so, j.a)
    const b = partSpec(so, j.b)
    const box = (p: A): { min: V3; max: V3 } => {
      const h: V3 = p.shape.kind === 'box' ? p.shape.size.map((s: number) => s / 2) : [p.shape.radius, p.shape.height / 2, p.shape.radius]
      const r = p.rotation || [0, 0, 0] // only x and z (see buildSpec): Euler XYZ = Rx * Rz
      const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cz = Math.cos(r[2]), sz = Math.sin(r[2])
      const mn: V3 = [Infinity, Infinity, Infinity]
      const mx: V3 = [-Infinity, -Infinity, -Infinity]
      for (let i = 0; i < 8; i++) {
        const x = (i & 1 ? 1 : -1) * h[0], y = (i & 2 ? 1 : -1) * h[1], z = (i & 4 ? 1 : -1) * h[2]
        const x1 = x * cz - y * sz, y1 = x * sz + y * cz
        const w = [x1, y1 * cx - z * sx, y1 * sx + z * cx]
        for (let k = 0; k < 3; k++) {
          mn[k] = Math.min(mn[k] as number, p.position[k] + (w[k] as number))
          mx[k] = Math.max(mx[k] as number, p.position[k] + (w[k] as number))
        }
      }
      return { min: mn, max: mx }
    }
    const A_ = box(a)
    const B_ = box(b)
    return world(so, [0, 1, 2].map((k) => (Math.max(A_.min[k] as number, B_.min[k] as number) + Math.min(A_.max[k] as number, B_.max[k] as number)) / 2) as V3)
  }
  const lost = (p: A): boolean => !p || p.status === 'broken' || p.status === 'ashes' || p.status === 'melted'
  // The state of a piece at an instant: world.snapshot(id) gives a copy (state() / part() are live views).
  const snap = (room: VegetationRoom, so: Spawned, pid: string): A => {
    const st = room.world.snapshot(so.objectId)
    const p = st && st.parts.filter((x: A) => x.id === pid)[0]
    if (!p) return null
    return { status: p.status, hp: p.hp, maxHp: p.maxHp, temperature: p.temperature, burning: p.burning, char: p.char || 0, fuel: p.fuel, holes: (p.holes || []).length, material: p.material }
  }
  const logCount = (room: VegetationRoom, so: Spawned, type: string): number => room.log.entries({ type, objectId: so.objectId }).length
  // Joints opened in the log: 'detach' lines (one per joint, or several in one) plus those the 'fracture' event sums up in jointsOpened.
  const jointsOpened = (room: VegetationRoom, so: Spawned): number => {
    let n = 0
    for (const e of room.log.entries({ type: 'detach', objectId: so.objectId })) n += e.data && e.data.joints ? e.data.joints.length : 1
    for (const e of room.log.entries({ type: 'fracture', objectId: so.objectId })) n += (e.data && e.data.jointsOpened) || 0
    return n
  }
  const detachedJoint = (room: VegetationRoom, so: Spawned, jid: string): boolean =>
    room.log.entries({ type: 'detach', objectId: so.objectId }).some((e: A) => e.data && (e.data.joint === jid || (e.data.joints || []).indexOf(jid) >= 0))
  const spawn = (room: VegetationRoom, id: string, x: number, z: number): Spawned => room.spawn(id, [x, 0, z], 0)
  // When a group comes loose, the world moves it to a new object (`obj_N`). `home` is the original object, `loose` the ones that came off.
  const split = (room: VegetationRoom, so: Spawned): A => {
    const home = room.world.snapshot(so.objectId)
    const loose = room.world.ids().filter((i) => /^obj_/.test(i)).map((i) => ({ id: i, st: room.world.snapshot(i) }))
    const anchored: Record<string, boolean> = {}
    for (const p of specOf(so).parts) if (p.anchored) anchored[p.id] = true
    const rooted: string[] = []
    for (const g of home.groups as string[][]) if (g.some((pid) => anchored[pid])) for (const pid of g) rooted.push(pid)
    const inLoose = (pid: string): boolean => loose.some((o) => o.st.parts.some((p: A) => p.id === pid && !lost(p)))
    const inHome = (pid: string): boolean => home.parts.some((p: A) => p.id === pid && !lost(p))
    return { home, loose, rooted, inLoose, inHome, sections: home.groups.length + loose.length }
  }

  // Axe on the trunk until it breaks (at most `max` swings); gives the count and the state of the trunk.
  const fell = (room: VegetationRoom, ctx: VegetationContext, so: Spawned, max: number): { swings: number; trunk: A } => {
    take(room, 'axe')
    let swings = 0
    const h = partSpec(so, 'trunk').shape.height
    for (let i = 0; i < max; i++) {
      aimPart(room, so, 'trunk', 0.5, [0, Math.min(0.9, h / 3), 0])
      room.use()
      ctx.step(1.5)
      swings++
      if (lost(room.world.part(so.objectId, 'trunk'))) break
    }
    ctx.step(5)
    return { swings, trunk: snap(room, so, 'trunk') }
  }

  const sc = (id: string, ptName: string, enName: string, run: (ctx: VegetationContext) => void): ModuleScenario<VegetationContext> => ({ id: `veg_${id}`, name: L(ptName, enName), run })
  const pct = (x: number): string => `${Math.round((x || 0) * 100)}%`
  // the room gives every tool its draw time; the page's room used the tool the moment it was taken
  const take = (room: VegetationRoom, id: string): void => {
    room.setTool(id)
    room.waitUntilReady()
  }

  return [
    // 1 ---------------------------------------------------------------------------------------------------------------
    sc('axe_fells_crown', 'Machado no tronco de 15 cm derruba a copa (8 a 15 golpes)', 'Axe on a 15 cm trunk fells the crown (8 to 15 swings)', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'mango_young_15', 0, -6)
      const r = fell(room, ctx, so, 60)
      const sp = split(room, so)
      const crownGone = lost(room.world.part(so.objectId, 'crown')) || !sp.inHome('crown') || sp.rooted.indexOf('crown') < 0
      const branches: string[] = specOf(so).parts.filter((p: A) => p.tags.indexOf('branch') >= 0).map((p: A) => p.id)
      const branchesFree = branches.every((b) => sp.rooted.indexOf(b) < 0)
      const detach = jointsOpened(room, so)
      ctx.expect(r.trunk.status === 'broken' && r.swings >= 8 && r.swings <= 15, L(`Machado no tronco de 15 cm (hp ${Math.round(r.trunk.maxHp)}): tronco ${r.trunk.status} depois de ${r.swings} golpes (esperado: broken em 8 a 15 golpes)`, `Axe on a 15 cm trunk (hp ${Math.round(r.trunk.maxHp)}): trunk ${r.trunk.status} after ${r.swings} swings (expected: broken in 8 to 15 swings)`), { swings: r.swings, status: r.trunk.status, maxHp: r.trunk.maxHp })
      ctx.expect(sp.rooted.length === 0 && crownGone && branchesFree, L(`Nada da copa continua preso ao chão: peças ainda enraizadas ${sp.rooted.length}, copa solta ${yn(crownGone)}, ${branches.length} galhos soltos ${yn(branchesFree)} (esperado: 0, sim, sim)`, `Nothing of the crown stays rooted: rooted pieces ${sp.rooted.length}, crown free ${yn(crownGone)}, ${branches.length} branches free ${yn(branchesFree)} (expected: 0, yes, yes)`), { rooted: sp.rooted.length })
      ctx.expect(detach > 0 && sp.loose.length > 0, L(`Registro: ${detach} soltura(s) de junta (as juntas se abrem quando o tronco se perde) e ${sp.loose.length} pedaço(s) caindo como objeto próprio (esperado: 1 ou mais de cada)`, `Log: ${detach} joint detach(es) (joints open when the trunk is lost) and ${sp.loose.length} piece(s) falling as their own object (expected: 1+ each)`), { detach, loose: sp.loose.length })
    }),
    sc('axe_fells_30cm', 'Machado no tronco de 30 cm (25 a 40 golpes)', 'Axe on a 30 cm trunk (25 to 40 swings)', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'mango_young_30', 0, -6)
      const r = fell(room, ctx, so, 90)
      const sp = split(room, so)
      ctx.expect(r.trunk.status === 'broken' && r.swings >= 25 && r.swings <= 40, L(`Machado no tronco de 30 cm (hp ${Math.round(r.trunk.maxHp)}): tronco ${r.trunk.status} depois de ${r.swings} golpes (esperado: broken em 25 a 40 golpes)`, `Axe on a 30 cm trunk (hp ${Math.round(r.trunk.maxHp)}): trunk ${r.trunk.status} after ${r.swings} swings (expected: broken in 25 to 40 swings)`), { swings: r.swings, status: r.trunk.status, maxHp: r.trunk.maxHp })
      ctx.expect(sp.rooted.length === 0, L(`Árvore caída: peças ainda presas ao chão ${sp.rooted.length} (esperado: 0)`, `Fallen tree: pieces still rooted ${sp.rooted.length} (expected: 0)`), { rooted: sp.rooted.length })
    }),
    sc('axe_cuts_branch_joint', 'Machado passa pela junta tronco-galho', 'Axe works through the trunk-branch joint', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'mango_tree', 0, -6)
      const jid = 'trunk~branch1'
      take(room, 'axe')
      let swings = 0
      let detached = false
      for (let i = 0; i < 60 && !detached; i++) {
        aim(room, so, jointPos(so, jid), 0.5, { joint: jid, beyond: 0.3 })
        room.use()
        ctx.step(1.5)
        swings++
        detached = detachedJoint(room, so, jid)
      }
      ctx.step(3)
      const trunk = snap(room, so, 'trunk')
      const sp = split(room, so)
      const branchOff = sp.inLoose('branch1') && !sp.inHome('branch1')
      const restStays = sp.inHome('trunk') && sp.rooted.indexOf('trunk') >= 0
      ctx.expect(detached && branchOff, L(`Machado na junta ${jid}: galho solto ${yn(branchOff)} depois de ${swings} golpe(s), com o tronco ${trunk.status} (esperado: sim)`, `Axe on joint ${jid}: branch detached ${yn(branchOff)} after ${swings} swing(s), trunk ${trunk.status} (expected: yes)`), { swings })
      ctx.expect(trunk.status !== 'broken' && restStays, L(`A junta cedeu antes do tronco: tronco ${trunk.status}, tronco de pé e preso ao chão ${yn(restStays)} (esperado: não quebrado, sim)`, `The joint gave way before the trunk: trunk ${trunk.status}, trunk standing and rooted ${yn(restStays)} (expected: not broken, yes)`), {})
    }),
    sc('shot_cannot_fell', 'Tiro de 9 mm não derruba a árvore', 'A 9 mm shot never fells a tree', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'mango_young_15', 0, -6)
      take(room, 'pistol_9mm')
      let shots = 0
      for (let i = 0; i < 30; i++) {
        aimPart(room, so, 'trunk', 2.5, [0, 0.5, 0])
        room.use()
        ctx.step(0.4)
        shots++
      }
      const trunk = snap(room, so, 'trunk')
      const sp = split(room, so)
      ctx.expect(trunk.status !== 'broken' && trunk.hp > 0, L(`${shots} tiros de 9 mm no tronco de 15 cm: tronco ${trunk.status}, hp ${Math.round(trunk.hp)}/${Math.round(trunk.maxHp)} (esperado: não quebrado)`, `${shots} 9 mm shots on the 15 cm trunk: trunk ${trunk.status}, hp ${Math.round(trunk.hp)}/${Math.round(trunk.maxHp)} (expected: not broken)`), { shots, hp: trunk.hp })
      ctx.expect(sp.loose.length === 0 && sp.inHome('trunk') && sp.rooted.indexOf('crown') >= 0, L(`A árvore continua de pé: pedaços soltos ${sp.loose.length}, copa presa ao chão ${yn(sp.rooted.indexOf('crown') >= 0)} (esperado: 0, sim)`, `The tree still stands: loose pieces ${sp.loose.length}, crown rooted ${yn(sp.rooted.indexOf('crown') >= 0)} (expected: 0, yes)`), {})
    }),
    // 2 ---------------------------------------------------------------------------------------------------------------
    sc('saw_cuts_branch', 'Serra no galho', 'Saw on a branch', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'yellow_ipe', 0, -6)
      const jid = 'trunk~branch1'
      take(room, 'hacksaw')
      aim(room, so, jointPos(so, jid), 0.45, { joint: jid })
      room.use(4)
      ctx.step(1)
      const sp = split(room, so)
      const movedBranch = sp.inLoose('branch1') && !sp.inHome('branch1')
      const movedCrown = sp.inLoose('crown1')
      const restStays = ['trunk', 'branch0', 'branch2', 'branch3', 'crown'].every((pid) => sp.inHome(pid) && sp.rooted.indexOf(pid) >= 0)
      const detach = logCount(room, so, 'detach')
      ctx.expect(movedBranch && detach > 0, L(`Serra na junta tronco-galho 1: galho solto do tronco ${yn(movedBranch)}, ${detach} linha(s) de soltura no log (esperado: sim, 1)`, `Saw on the trunk-branch 1 joint: branch detached ${yn(movedBranch)}, ${detach} detach line(s) in the log (expected: yes, 1)`), { detach })
      ctx.expect(movedCrown, L(`A folhagem do galho cortado foi junto: ${yn(movedCrown)} (esperado: sim)`, `The foliage of the cut branch went with it: ${yn(movedCrown)} (expected: yes)`), {})
      ctx.expect(restStays, L(`O resto da árvore (tronco, outros galhos e copa) continua inteiro e preso ao chão: ${yn(restStays)} (esperado: sim)`, `The rest of the tree (trunk, other branches, crown) stays whole and rooted: ${yn(restStays)} (expected: yes)`), {})
    }),
    // 3 ---------------------------------------------------------------------------------------------------------------
    sc('lighter_ignites_foliage', 'Isqueiro na folhagem pega fogo', 'Lighter on the foliage catches fire', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'mango_tree', 0, -6)
      take(room, 'lighter')
      const a = aimPart(room, so, crownsOf(so), 0.08)
      room.use(6)
      const crown = snap(room, so, a.pid)
      const lit = crown.burning || crown.temperature > 300
      let peak = 0
      let charMax = 0
      for (let t = 0; t < 18; t++) {
        ctx.step(5)
        for (const p of room.world.state(so.objectId).parts) {
          if (p.material === 'green_wood') {
            peak = Math.max(peak, p.temperature)
            charMax = Math.max(charMax, p.char || 0)
          }
        }
      }
      const st = room.world.state(so.objectId)
      const burnt = st.parts.filter((p: A) => p.material === 'foliage' && (p.burning || p.char > 0 || p.status === 'ashes')).length
      ctx.expect(lit, L(`Isqueiro na copa: folhagem acesa ou acima de 300 °C = ${yn(lit)} (${Math.round(crown.temperature)} °C; esperado: sim)`, `Lighter on the crown: foliage lit or above 300 C = ${yn(lit)} (${Math.round(crown.temperature)} C; expected: yes)`), { temperature: crown.temperature })
      ctx.expect(burnt > 0, L(`Depois de 90 s: ${burnt} peça(s) de folhagem queimando, carbonizada(s) ou em cinza (esperado: 1 ou mais)`, `After 90 s: ${burnt} foliage piece(s) burning, charred or ash (expected: 1+)`), { burnt })
      ctx.expect(peak > 150 || charMax > 0, L(`O fogo da folhagem passa para a madeira verde (tronco e galhos): pico de ${Math.round(peak)} °C, carbonização máxima ${pct(charMax)} (esperado: pico acima de 150 °C ou carbonização acima de 0; a madeira verde só pega fogo acima de 400 °C)`, `Foliage fire reaches the green wood (trunk and branches): peak ${Math.round(peak)} C, max char ${pct(charMax)} (expected: peak above 150 C or char above 0; green wood only ignites above 400 C)`), { peak, charMax })
    }),
    // 4 ---------------------------------------------------------------------------------------------------------------
    sc('shot_strips_leaves', 'Tiro na copa arranca folhas', 'A shot into the crown strips leaves', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'mango_tree', 0, -6)
      take(room, 'pistol_9mm')
      const tgt = aimPart(room, so, crownsOf(so), 2.5).pid
      const before = snap(room, so, tgt)
      for (let i = 0; i < 3; i++) {
        aimPart(room, so, tgt, 2.5)
        room.use()
        ctx.step(0.6)
      }
      const crown = snap(room, so, tgt)
      const leaves = room.log.entries({ type: 'debris', objectId: so.objectId }).filter((e: A) => e.data && e.data.kind === 'leaves').length
      const hurt = crown.hp < before.hp || crown.status === 'broken'
      ctx.expect(hurt && crown.status !== 'intact', L(`Três tiros na copa: hp ${Math.round(before.hp)} para ${Math.round(crown.hp)}, estado ${crown.status} (esperado: hp menor, não intacta)`, `Three shots into the crown: hp ${Math.round(before.hp)} to ${Math.round(crown.hp)}, status ${crown.status} (expected: lower hp, not intact)`), { hp: crown.hp })
      ctx.expect(leaves > 0 || crown.holes > 0, L(`Folhas arrancadas: ${leaves} linha(s) de folhas voando, ${crown.holes} furo(s) na copa (esperado: 1 ou mais)`, `Leaves torn off: ${leaves} flying-leaf line(s), ${crown.holes} hole(s) in the crown (expected: 1+)`), { leaves, holes: crown.holes })
    }),
    // 5 ---------------------------------------------------------------------------------------------------------------
    sc('shot_breaks_pot', 'Tiros quebram o vaso e a terra se espalha', 'Shots break the pot and the soil spills', (ctx) => {
      const room = ctx.room
      const so = room.spawn('potted_fern', [0, 0, -4], 0)
      take(room, 'pistol_9mm')
      // terracotta pot with an explicit hp of 25: it breaks in 1 to 3 shots of 9 mm; the pot-soil joint bursts and the soil comes loose
      let shots = 0
      for (let i = 0; i < 12; i++) {
        const cur = snap(room, so, 'pot')
        if (!cur) break // the pot already left the original object
        aimPart(room, so, 'pot', 1.5)
        room.use()
        ctx.step(0.5)
        shots++
        const after = snap(room, so, 'pot')
        if (after && (after.status === 'broken' || after.hp <= 0)) break // broke
      }
      ctx.step(3)
      const sp = split(room, so)
      let potNow = snap(room, so, 'pot')
      for (const o of sp.loose) {
        const q = o.st.parts.filter((x: A) => x.id === 'pot')[0]
        if (q) potNow = q
      }
      const soilOut = sp.inLoose('soil') || !sp.inHome('soil')
      const soilApart = !sp.home.groups.some((g: string[]) => g.indexOf('soil') >= 0 && g.indexOf('pot') >= 0)
      const cracks = room.log.entries({ type: 'crack', objectId: so.objectId }).length
      const dt = jointsOpened(room, so)
      ctx.expect(!!potNow && (potNow.status === 'broken' || potNow.hp <= 0) && shots >= 1 && shots <= 4, L(`Tiros no vaso: o vaso quebra: cerâmica ${potNow && potNow.status} com hp ${potNow ? `${Math.round(potNow.hp)}/${Math.round(potNow.maxHp)}` : '?'} e ${cracks} trinca(s) depois de ${shots} tiro(s) de 9 mm (esperado: vaso quebrado em 1 a 4 tiros)`, `Shots into the pot: the pot breaks: ceramic ${potNow && potNow.status} with hp ${potNow ? `${Math.round(potNow.hp)}/${Math.round(potNow.maxHp)}` : '?'} and ${cracks} crack(s) after ${shots} 9 mm shot(s) (expected: pot broken in 1 to 4 shots)`), { status: potNow && potNow.status, shots, cracks })
      ctx.expect(soilApart || soilOut, L(`A terra saiu do vaso e caiu junto com a planta: ${yn(soilApart || soilOut)} (esperado: sim)`, `The soil left the pot and fell with the plant: ${yn(soilApart || soilOut)} (expected: yes)`), {})
      ctx.expect(dt > 0, L(`Registro: ${dt} soltura(s) de junta (esperado: 1 ou mais)`, `Log: ${dt} joint detach(es) (expected: 1+)`), { detach: dt })
    }),
    // 6 ---------------------------------------------------------------------------------------------------------------
    sc('machete_arm', 'Machete na junta do braço do mandacaru', 'Machete on the mandacaru arm joint', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'mandacaru', 0, -5)
      take(room, 'machete')
      const arm = 'arm0'
      const jid = `stem~${arm}`
      let swings = 0
      let detached = false
      for (let i = 0; i < 40 && !detached; i++) {
        aim(room, so, jointPos(so, jid), 0.55, { joint: jid, beyond: 0.3 })
        room.use()
        ctx.step(1.2)
        swings++
        detached = detachedJoint(room, so, jid) || lost(room.world.part(so.objectId, arm))
      }
      ctx.step(3)
      const a = snap(room, so, arm)
      const sp = split(room, so)
      const armOff = !a || a.status === 'broken' || (sp.inLoose(arm) && !sp.inHome(arm))
      const stemOk = sp.inHome('stem') && sp.rooted.indexOf('stem') >= 0 && room.world.part(so.objectId, 'stem').status !== 'broken'
      const spines = specOf(so).parts.filter((p: A) => p.tags.indexOf('thorns') >= 0)
      const thorny = so.root.userData.thorny === true && spines.length > 0
      const spinesOff = !sp.rooted.some((pid: string) => pid.indexOf(`${arm}_spines`) === 0)
      ctx.expect(armOff, L(`Machete na junta ${jid}: braço ${a ? a.status : 'solto como objeto próprio'} depois de ${swings} golpe(s) (esperado: solto do caule pela junta)`, `Machete on joint ${jid}: arm ${a ? a.status : 'loose as its own object'} after ${swings} swing(s) (expected: off the stem through the joint)`), { swings })
      ctx.expect(stemOk, L(`O caule principal continua de pé e preso ao chão: ${yn(stemOk)} (esperado: sim)`, `The main stem stays standing and rooted: ${yn(stemOk)} (expected: yes)`), {})
      ctx.expect(thorny && spinesOff, L(`Espinhos: cacto marcado como espinhoso (userData.thorny, ${spines.length} peças de espinho) ${yn(thorny)}, espinhos do braço saíram junto ${yn(spinesOff)} (esperado: sim, sim)`, `Thorns: cactus flagged thorny (userData.thorny, ${spines.length} spine pieces) ${yn(thorny)}, the arm spines went with it ${yn(spinesOff)} (expected: yes, yes)`), { spines: spines.length })
    }),
    // 7 ---------------------------------------------------------------------------------------------------------------
    sc('pad_pulled', 'Palma arrancada', 'Prickly pear pad pulled off', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'prickly_pear', 0, -4)
      const jid = 'pad0~pad1'
      take(room, 'utility_knife')
      aim(room, so, jointPos(so, jid), 0.25, { joint: jid, beyond: 0.3 })
      room.use(1.7)
      ctx.step(1)
      const sp = split(room, so)
      const padOff = sp.inLoose('pad1') && !sp.inHome('pad1')
      const childWith = sp.inLoose('pad3')
      const spinesWith = sp.inLoose('pad1_spines')
      const motherOk = sp.inHome('pad0') && sp.rooted.indexOf('pad0') >= 0 && sp.inHome('pad2')
      ctx.expect(padOff, L(`Raquete 1 cortada da planta-mãe na junta ${jid}: ${yn(padOff)} (esperado: sim)`, `Pad 1 cut off the mother plant at joint ${jid}: ${yn(padOff)} (expected: yes)`), {})
      ctx.expect(childWith && spinesWith, L(`A raquete filha (3) e os espinhos da raquete 1 vão junto: ${yn(childWith && spinesWith)} (esperado: sim)`, `The child pad (3) and the spines of pad 1 go with it: ${yn(childWith && spinesWith)} (expected: yes)`), {})
      ctx.expect(motherOk, L(`A planta-mãe (raquetes 0 e 2) fica presa ao chão: ${yn(motherOk)} (esperado: sim)`, `The mother plant (pads 0 and 2) stays rooted: ${yn(motherOk)} (expected: yes)`), {})
    }),
    // 8 ---------------------------------------------------------------------------------------------------------------
    sc('dead_burns_faster', 'Árvore morta queima mais rápido que viva', 'A dead tree burns faster than a living one', (ctx) => {
      const room = ctx.room
      const dead = spawn(room, 'dead_tree', -4, -6)
      const live = spawn(room, 'mango_tree', 4, -6)
      take(room, 'lighter')
      for (const so of [dead, live]) {
        aimPart(room, so, 'trunk', 0.08, [0, 0.8, 0])
        room.use(8)
      }
      const d0 = snap(room, dead, 'trunk')
      const l0 = snap(room, live, 'trunk')
      ctx.step(120)
      const d = snap(room, dead, 'trunk')
      const l = snap(room, live, 'trunk')
      const score = (p: A): number => (p ? Math.max(p.char, p.burning ? 0.01 : 0, (p.temperature - 20) / 2000) : 0)
      ctx.expect(d0.material === 'wood_soft' && l0.material === 'green_wood', L(`Materiais do tronco: árvore morta ${d0.material}, viva ${l0.material} (esperado: wood_soft, green_wood)`, `Trunk materials: dead tree ${d0.material}, living ${l0.material} (expected: wood_soft, green_wood)`), { dead: d0.material, live: l0.material })
      ctx.expect(score(d) > score(l), L(`Depois de 8 s de isqueiro e 120 s de espera: morta queimando ${yn(d.burning)}, ${Math.round(d.temperature)} °C, carbonização ${pct(d.char)}; viva queimando ${yn(l.burning)}, ${Math.round(l.temperature)} °C, carbonização ${pct(l.char)} (esperado: a morta mais queimada)`, `After 8 s of lighter and 120 s of waiting: dead burning ${yn(d.burning)}, ${Math.round(d.temperature)} C, char ${pct(d.char)}; living burning ${yn(l.burning)}, ${Math.round(l.temperature)} C, char ${pct(l.char)} (expected: dead burns more)`), { dead: score(d), live: score(l) })
    }),
    // 9 ---------------------------------------------------------------------------------------------------------------
    sc('hedge_cut_pieces', 'Cerca viva cortada em partes', 'Hedge cut into sections', (ctx) => {
      const room = ctx.room
      const so = spawn(room, 'boxwood_hedge', 0, -5)
      take(room, 'hacksaw')
      for (const jid of ['s0_stem~s1_stem', 's2_stem~s3_stem']) {
        aim(room, so, jointPos(so, jid), 0.45, { joint: jid })
        room.use(1.7)
        ctx.step(0.3)
      }
      ctx.step(1)
      const sp = split(room, so)
      const all: A[] = [...sp.home.parts]
      for (const o of sp.loose) all.push(...o.st.parts)
      const alive = all.filter((p) => !lost(p)).length
      const total = specOf(so).parts.length
      ctx.expect(sp.sections === 3, L(`Duas serradas na cerca viva: ${sp.sections} parte(s) separada(s) (esperado: 3)`, `Two saw cuts in the hedge: ${sp.sections} separate section(s) (expected: 3)`), { sections: sp.sections })
      ctx.expect(alive === total, L(`Nenhuma seção foi destruída, só separada: ${alive} de ${total} peças inteiras (esperado: todas)`, `No section was destroyed, only separated: ${alive} of ${total} pieces intact (expected: all)`), { alive, total })
    }),
    // 10 --------------------------------------------------------------------------------------------------------------
    sc('walk_on_grass', 'Pisar na grama não colide', 'Walking on grass does not collide', (ctx) => {
      const room = ctx.room
      const tuft = spawn(room, 'lawn_tuft', 0, -3)
      const tree = spawn(room, 'mango_tree', 4, -3)
      const noBlock = !tuft.root.userData.collider
      const treeBlock = !!(tree.root.userData.collider && tree.root.userData.collider.kind)
      ctx.expect(noBlock && treeBlock, L(`Colisor do SDK: touceira ${noBlock ? 'nenhum' : 'tem'}, tronco da mangueira ${treeBlock ? 'tem' : 'nenhum'} (esperado: nenhum, tem)`, `SDK collider: tuft ${noBlock ? 'none' : 'has one'}, mango trunk ${treeBlock ? 'has one' : 'none'} (expected: none, has one)`), {})
      // really walks: room.walk(to, seconds) moves the player through the room's own loop (ctx.step advances the simulation, with no host loop)
      room.look([0, 1.7, -0.5], [0, 1.7, -6])
      const before = room.camera.position.z
      room.walk([0, 1.7, -6], 3)
      ctx.step(3.2)
      const after = room.camera.position.z
      const tp = snap(room, tuft, 'stem')
      ctx.expect(after < -3.3 && !!tp && tp.status === 'intact', L(`Andando para a frente (room.walk): z foi de ${before.toFixed(1)} a ${after.toFixed(1)}, atravessou a touceira ${yn(after < -3.3)}, touceira ${tp && tp.status} (esperado: atravessou, intacta)`, `Walking forward (room.walk): z went from ${before.toFixed(1)} to ${after.toFixed(1)}, crossed the tuft ${yn(after < -3.3)}, tuft ${tp && tp.status} (expected: crossed, intact)`), { before, after })
    }),
  ]
}
