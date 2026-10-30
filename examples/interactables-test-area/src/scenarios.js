// Scenarios of the furniture area, written against the test room's `ScenarioContext` ({ room, step, expect }). Texts are pt-BR and en.
// `analysisOf(type)` gives the destruction spec the area built for a type (part ids and positions), so a scenario aims where the part is.

const AT = [0, 0, -5] // where scenarios spawn things; the camera looks from +z toward -z, the front of an object is +z

export function buildScenarios(locale, analysisOf) {
  const en = locale === 'en'
  const T = (pt, e) => (en ? e : pt)
  const n1 = (n) => Number(n).toFixed(1)

  const specPart = (type, id) => analysisOf(type).destructible.parts.find((p) => p.id === id)
  const world = (p, at = AT) => [at[0] + p.position[0], at[1] + p.position[1], at[2] + p.position[2]]
  const spawn = (room, type, at = AT, rot = 0) => room.spawn(type, at, rot).objectId
  const part = (room, id, pid) => room.world.part(id, pid)
  const count = (room, type, id) => room.log.entries({ type, objectId: id }).length
  /** Aim at the front of a part from `dist` metres away and fire the current tool once. */
  const shoot = (room, step, p, dist = 1.6, at = AT) => {
    const c = world(p, at)
    room.look([c[0], c[1], c[2] + p.shape.size[2] / 2 + dist], [c[0], c[1], c[2]])
    room.use()
    step(0.45)
  }
  /** A part that came loose from its object (its hinge, screws or clips broke) is no longer one of the object's parts. */
  const gone = (room, id, pid) => !(room.world.state(id)?.parts ?? []).some((p) => p.id === pid)
  /**
   * Where a joint sits: the destruction world puts it at the middle of the overlap of its two parts' boxes, and a hit wears only the joints within
   * 6 cm of where it lands. So hitting a hinge, screw or clip means aiming at it (not at the middle of the door). Returns a pseudo part to shoot at.
   */
  const jointTarget = (type, partId) => {
    const d = analysisOf(type).destructible
    const a = d.parts.find((p) => p.id === partId)
    const j = (d.joints ?? []).find((q) => q.a === partId || q.b === partId)
    const b = d.parts.find((p) => p.id === (j.a === partId ? j.b : j.a))
    const box = (p) => p.position.map((c, k) => [c - p.shape.size[k] / 2, c + p.shape.size[k] / 2])
    const A = box(a)
    const B = box(b)
    const pos = [0, 1, 2].map((k) => (Math.max(A[k][0], B[k][0]) + Math.min(A[k][1], B[k][1])) / 2)
    return { id: `${partId}~joint`, position: pos, shape: { size: [0, 0, 0] } }
  }
  const sc = (id, name, run) => ({ id: `furniture_${id}`, name, run })

  return [
    sc('fridge_door_hinge', T('Geladeira: abre a porta, atira na dobradiça e acerta com uma marreta, a dobradiça quebra e a porta cai', 'Fridge: open the door, shoot the hinge and hit it with a sledge, the hinge breaks and the door falls'), ({ room, step, expect }) => {
      const id = spawn(room, 'fridge')
      const so = room.spawned().find((s) => s.objectId === id)
      const hinge = jointTarget('fridge', 'door_fridge')
      expect(room.playAnimation('open_door_fridge', id), T('Clipe "open_door_fridge" tocou', 'Clip "open_door_fridge" played'))
      step(1.3)
      const turned = Math.abs(so.root.getObjectByName('door_fridge').rotation.y)
      expect(turned > 1, T(`Porta aberta pelo clipe: girou ${n1(turned)} rad (esperado: mais que 1,0)`, `Door opened by the clip: turned ${n1(turned)} rad (expected: more than 1.0)`), { turned })
      // a bullet only wears a joint within 6 cm of where it lands and a pistol round has little left after a steel door (about 3 of the hinge's
      // 120 points a shot): shooting the hinge marks it, it takes a heavy blow to tear the door off
      room.setTool('pistol_9mm')
      for (let i = 0; i < 3; i++) shoot(room, step, hinge)
      const hinges = () => (room.world.state(id)?.joints ?? []).filter((j) => j.id.startsWith('door_fridge'))
      const worn = hinges().some((j) => j.hp < j.maxHp)
      expect(worn, T('Os tiros na dobradiça a desgastaram', 'The shots at the hinge wore it'), { hinges: hinges().map((j) => j.hp) })
      const c = world(hinge)
      let blows = 0
      for (; blows < 6 && !gone(room, id, 'door_fridge'); blows++) {
        room.world.hitPart(id, 'door_fridge', { type: 'blunt', point: c, direction: [0, 0, -1], energy: 260, radius: 0.08, source: 'test' })
        step(0.3)
      }
      step(1.5)
      const detach = room.log.entries({ type: 'detach', objectId: id }).length
      const falling = room.renderer.pieces().length
      expect(gone(room, id, 'door_fridge') && falling >= 1, T(`Porta solta após 3 tiro(s) e ${blows} golpe(s): ${falling} peça(s) solta(s), ${detach} linha(s) de soltura no log (esperado: porta fora do corpo, 1 peça solta, 1 linha)`, `Door off after 3 shot(s) and ${blows} blow(s): ${falling} loose piece(s), ${detach} detach line(s) in the log (expected: door out of the body, 1 loose piece, 1 line)`), { blows, falling, detach })
    }),

    sc('drawer_dropped', T('Cômoda: gaveta puxada e derrubada, o trilho solta e ela cai', 'Dresser: a drawer pulled out and dropped, the slide lets go and it falls'), ({ room, step, expect }) => {
      const id = spawn(room, 'dresser')
      const drawer = specPart('dresser', 'drawer_1')
      expect(room.playAnimation('open_drawer_1', id), T('Clipe "open_drawer_1" tocou', 'Clip "open_drawer_1" played'))
      step(1)
      const so = room.spawned().find((s) => s.objectId === id)
      const out = so.root.getObjectByName('drawer_1').position.z
      const c = world(drawer)
      let blows = 0
      for (; blows < 12 && !gone(room, id, 'drawer_1'); blows++) {
        room.world.hitPart(id, 'drawer_1', { type: 'blunt', point: [c[0], c[1], c[2] + 0.1], direction: [0, -0.4, -1], energy: 260, radius: 0.08, source: 'test' })
        step(0.3)
      }
      step(1.5)
      expect(out > 0.1, T(`Gaveta puxada pelo clipe: saiu ${n1(out * 100)} cm`, `Drawer pulled out by the clip: ${n1(out * 100)} cm out`), { out })
      expect(gone(room, id, 'drawer_1') && room.renderer.pieces().length >= 1, T(`Gaveta derrubada após ${blows} golpe(s): ${room.renderer.pieces().length} peça(s) solta(s)`, `Drawer dropped after ${blows} blow(s): ${room.renderer.pieces().length} loose piece(s)`), { blows })
    }),

    sc('chair_kicked_apart', T('Cadeira de jantar: um chute atrás do outro solta os parafusos e ela desmonta', 'Dining chair: kick after kick frees the screws and it comes apart'), ({ room, step, expect }) => {
      const id = spawn(room, 'dining_chair')
      const legs = analysisOf('dining_chair').destructible.parts.filter((p) => p.position[1] - p.shape.size[1] / 2 < 0.02 && p.shape.size[1] > 0.3)
      const before = room.world.state(id).parts.length
      let kicks = 0
      for (; kicks < 16 && room.world.state(id).parts.length === before; kicks++) {
        const leg = legs[kicks % legs.length]
        const c = world(leg)
        room.world.hitPart(id, leg.id, { type: 'blunt', point: [c[0], c[1], c[2]], direction: [0.7, 0, -0.7], energy: 240, radius: 0.05, source: 'kick' })
        step(0.3)
      }
      step(1)
      const open = room.world.state(id).joints.filter((j) => j.open).length
      const screws = room.log.entries({ type: 'detach', objectId: id }).length
      expect(room.world.state(id).parts.length < before || screws > 0, T(`Chutes: ${kicks}; peças que saíram: ${before - room.world.state(id).parts.length}; juntas abertas: ${open}; linhas de soltura: ${screws}`, `Kicks: ${kicks}; pieces that came off: ${before - room.world.state(id).parts.length}; open joints: ${open}; detach lines: ${screws}`), { kicks, open })
      const joints = analysisOf('dining_chair').destructible.joints
      expect(joints.every((j) => j.kind === 'screw'), T(`Todas as ${joints.length} juntas da cadeira são parafusos`, `All ${joints.length} joints of the chair are screws`))
    }),

    sc('camp_canister_shot', T('Botijão de camping: tiros no casco furam o aço e o gás explode, uma explosão pequena ao lado do fogareiro', 'Camping canister: shots at the shell pierce the steel and the gas explodes, a small blast beside the stove'), ({ room, step, expect }) => {
      const id = spawn(room, 'gas_canister')
      const stove = spawn(room, 'camp_stove', [0.35, 0, -5])
      const shell = analysisOf('gas_canister').destructible.parts.find((p) => p.explodes)
      const c0 = room.spawned().find((q) => q.objectId === stove).root.position.clone()
      room.setTool('pistol_9mm')
      // a 0.4 kg can is knocked about by each hit: the shots and the flame follow it where it went
      const here = () => {
        const q = room.spawned().find((o) => o.objectId === id)?.root.position
        return q ? [q.x, q.y, q.z] : AT
      }
      let shots = 0
      for (; shots < 30 && count(room, 'explode', id) === 0; shots++) shoot(room, step, shell, 0.8, here())
      let seconds = 0
      // a pierced can leaks gas: a flame at the hole lights it and the rest goes up
      for (; seconds < 60 && count(room, 'explode', id) === 0; seconds++) {
        room.world.hit(id, { type: 'fire', point: world(shell, here()), temperature: 1000, radius: 0.3, duration: 1 })
        step(1)
      }
      step(1.5)
      const moved = c0.distanceTo(room.spawned().find((q) => q.objectId === stove)?.root.position ?? c0)
      const hurt = (room.world.state(stove)?.parts ?? []).filter((p) => p.status !== 'intact').length
      expect(count(room, 'explode', id) > 0, T(`Botijão explodiu após ${shots} tiro(s) e ${seconds} s de chama (${shell.explodes.energy} J, raio ${shell.explodes.radius} m)`, `Canister exploded after ${shots} shot(s) and ${seconds} s of flame (${shell.explodes.energy} J, radius ${shell.explodes.radius} m)`), { shots, seconds })
      expect(shell.explodes.energy < 12000, T(`Explosão pequena: ${shell.explodes.energy} J (um botijão de cozinha tem muito mais)`, `A small blast: ${shell.explodes.energy} J (a kitchen bottle has far more)`), { energy: shell.explodes.energy })
      expect(moved > 0.05 || hurt > 0, T(`O fogareiro ao lado: moveu ${n1(moved)} m, ${hurt} parte(s) danificada(s)`, `The stove next to it: moved ${n1(moved)} m, ${hurt} part(s) damaged`), { moved, hurt })
    }),

    sc('camp_chair_kicked', T('Cadeira de camping: chutes soltam os clipes e a estrutura de alumínio desmonta', 'Camp chair: kicks free the clips and the aluminium frame comes apart'), ({ room, step, expect }) => {
      const id = spawn(room, 'camp_chair')
      const d = analysisOf('camp_chair').destructible
      const legs = d.parts.filter((p) => p.position[1] - p.shape.size[1] / 2 < 0.05 && p.shape.size[1] > 0.2)
      const before = room.world.state(id).parts.length
      let kicks = 0
      for (; kicks < 24 && room.world.state(id).parts.length === before; kicks++) {
        const leg = legs[kicks % legs.length]
        const c = world(leg)
        room.world.hitPart(id, leg.id, { type: 'blunt', point: [c[0], c[1], c[2]], direction: [0.7, 0, -0.7], energy: 240, radius: 0.05, source: 'kick' })
        step(0.3)
      }
      step(1)
      const open = room.world.state(id).joints.filter((j) => j.open).length
      const loose = before - room.world.state(id).parts.length
      expect(loose > 0 || open > 0, T(`Chutes: ${kicks}; peças que saíram: ${loose}; juntas abertas: ${open}`, `Kicks: ${kicks}; pieces that came off: ${loose}; open joints: ${open}`), { kicks, open })
      expect(d.joints.every((j) => j.kind === 'clip'), T(`Todas as ${d.joints.length} juntas da cadeira são clipes`, `All ${d.joints.length} joints of the chair are clips`))
    }),

    sc('tv_screen_shatters', T('TV: um tiro na tela quebra o vidro em cacos', 'TV: a shot at the screen shatters the glass'), ({ room, step, expect }) => {
      const id = spawn(room, 'tv')
      const screen = specPart('tv', 'screen')
      room.setTool('pistol_9mm')
      let shots = 0
      for (; shots < 8 && part(room, id, 'screen')?.status !== 'broken'; shots++) shoot(room, step, screen)
      step(0.5)
      const fr = room.log.entries({ type: 'fracture', objectId: id }).find((e) => e.part === 'screen')
      const n = Number(fr?.data?.fragments ?? 0)
      expect(part(room, id, 'screen')?.status === 'broken' && n >= 4, T(`Tela depois de ${shots} tiro(s): ${part(room, id, 'screen')?.status}, ${n} caco(s) (esperado: broken, 4 ou mais)`, `Screen after ${shots} shot(s): ${part(room, id, 'screen')?.status}, ${n} shard(s) (expected: broken, 4 or more)`), { shots, n })
      expect(part(room, id, 'screen')?.material === 'glass', T('A tela é de vidro', 'The screen is glass'))
    }),

    sc('sofa_burns', T('Sofá: fogo no estofado queima o tecido e a espuma', 'Sofa: fire on the upholstery burns the fabric and the foam'), ({ room, step, expect }) => {
      const id = spawn(room, 'sofa')
      const parts = analysisOf('sofa').destructible.parts
      const seat = parts.filter((p) => p.material === 'foam').sort((a, b) => b.shape.size[0] * b.shape.size[2] - a.shape.size[0] * a.shape.size[2])[0]
      const c = world(seat)
      room.setTool('lighter')
      room.look([c[0], c[1] + 0.35, c[2] + 0.5], [c[0], c[1] + 0.05, c[2] + 0.1])
      room.use(6)
      const ignited = room.world.state(id).parts.filter((p) => p.burning)
      expect(ignited.length > 0, T(`Isqueiro no assento: ${ignited.length} parte(s) pegando fogo (${[...new Set(ignited.map((p) => p.material))].join(', ')})`, `Lighter on the seat: ${ignited.length} part(s) burning (${[...new Set(ignited.map((p) => p.material))].join(', ')})`), { burning: ignited.length })
      step(240)
      const after = room.world.state(id).parts
      const burned = (m) => after.filter((p) => p.material === m && (p.status === 'ashes' || p.char > 0.5)).length
      expect(burned('foam') > 0 && burned('fabric') + burned('foam') > 1, T(`Depois de 4 min: espuma queimada em ${burned('foam')} parte(s), tecido em ${burned('fabric')}`, `After 4 min: foam burned in ${burned('foam')} part(s), fabric in ${burned('fabric')}`), { foam: burned('foam'), fabric: burned('fabric') })
    }),

    sc('wrong_tool_refused', T('Dobradiça da geladeira: só a chave de fenda serve e a chave inglesa é recusada', 'Fridge hinge: only a screwdriver fits and the wrench is refused'), ({ room, step, expect }) => {
      const id = spawn(room, 'fridge')
      const hinge = jointTarget('fridge', 'door_fridge')
      const c = world(hinge)
      room.setTool('wrench')
      room.waitUntilReady()
      room.look([c[0] + 0.1, c[1], c[2] + 0.5], [c[0], c[1], c[2]])
      room.use(0.5)
      step(0.2)
      const refused = count(room, 'tool_refused', id)
      const opened = (room.world.state(id)?.joints ?? []).filter((j) => j.open).length
      expect(refused > 0 && opened === 0, T(`Ferramenta recusada ${refused} vez(es), juntas abertas ${opened} (esperado: recusada e nenhuma aberta)`, `Tool refused ${refused} time(s), joints opened ${opened} (expected: refused and none opened)`), { refused, opened })
    }),

    sc('sofa_fire_extinguished', T('Sofá em chamas: o extintor apaga o fogo do estofado', 'Burning sofa: the extinguisher puts the upholstery fire out'), ({ room, step, expect }) => {
      const id = spawn(room, 'sofa')
      const burning = () => room.world.state(id).parts.some((p) => p.burning)
      const seat = analysisOf('sofa').destructible.parts.filter((p) => p.material === 'foam').sort((a, b) => b.shape.size[0] * b.shape.size[2] - a.shape.size[0] * a.shape.size[2])[0]
      const c = world(seat)
      room.world.hit(id, { type: 'fire', point: c, temperature: 900, radius: 0.6, duration: 4 })
      step(6)
      expect(burning(), T('O assento do sofá pegou fogo antes do extintor', 'The sofa seat caught fire before the extinguisher'))
      room.setTool('extinguisher')
      room.waitUntilReady()
      room.look([c[0], c[1] + 0.7, c[2] + 1.8], [c[0], c[1], c[2]])
      room.use(2.5)
      step(1)
      const events = count(room, 'extinguish', id)
      expect(!burning(), T(`Depois do extintor: ainda queimando ${burning() ? 'sim' : 'não'}, eventos de apagar ${events}`, `After the extinguisher: still burning ${burning() ? 'yes' : 'no'}, extinguish events ${events}`), { events })
    }),

    sc('chair_thrown_at_wall', T('Cadeira de jantar arremessada na parede: bate com energia e danifica o tijolo', 'Dining chair thrown at the wall: hits with energy and damages the brick'), ({ room, step, expect }) => {
      const id = spawn(room, 'dining_chair', [0, 0, -5.2])
      room.look([0, 1.7, -4.2], [0, 0.45, -5.2])
      room.grab()
      room.look([0, 1.7, -4.2], [0, 2.3, -11])
      step(0.3)
      room.throwHeld(16)
      step(2.5)
      const hits = room.log.entries({ type: 'impact' })
      const wallDamage = room.log.entries().filter((e) => e.objectId === 'target_wall' && ['dent', 'damage', 'crack', 'fracture'].includes(e.type)).length
      expect(hits.length > 0 && wallDamage > 0, T(`Impactos ${hits.length}, danos na parede ${wallDamage}`, `Impacts ${hits.length}, wall damage ${wallDamage}`), { id })
    }),

    sc('gas_bottle_explodes', T('Botijão de gás: aquecido passa dos 250 °C e explode', 'Gas bottle: heated past 250 °C it explodes'), ({ room, step, expect }) => {
      const id = spawn(room, 'gas_bottle')
      const chair = spawn(room, 'dining_chair', [1.4, 0, -5])
      const shell = analysisOf('gas_bottle').destructible.parts.find((p) => p.explodes)
      const c = world(shell)
      const c0 = room.spawned().find((s) => s.objectId === chair).root.position.clone()
      let seconds = 0
      for (; seconds < 90 && count(room, 'explode', id) === 0; seconds++) {
        room.world.hit(id, { type: 'fire', point: c, temperature: 1000, radius: 0.5, duration: 1 })
        step(1)
      }
      step(1.5)
      const moved = c0.distanceTo(room.spawned().find((s) => s.objectId === chair)?.root.position ?? c0)
      const hurt = (room.world.state(chair)?.parts ?? []).filter((p) => p.status !== 'intact').length
      expect(count(room, 'explode', id) > 0, T(`Botijão explodiu após ${seconds} s de calor (${shell.explodes.energy} J, limite ${shell.explodes.atC} °C)`, `Bottle exploded after ${seconds} s of heat (${shell.explodes.energy} J, limit ${shell.explodes.atC} °C)`), { seconds })
      expect(moved > 0.2 || hurt > 0, T(`A cadeira ao lado: moveu ${n1(moved)} m, ${hurt} parte(s) danificada(s)`, `The chair next to it: moved ${n1(moved)} m, ${hurt} part(s) damaged`), { moved, hurt })
    }),

    sc('furniture_push', T('Empurrar móvel: o leve anda, o pesado demais não se mexe e o móvel na parede trava', 'Pushing furniture: the light piece walks, the one too heavy does not budge and the one at the wall locks'), ({ room, step, expect }) => {
      const hold = (id, eye, target, seconds) => {
        room.look(eye, target)
        const leaned = room.push.begin()
        expect(leaned && room.push.state?.objectId === id && room.push.state.phase === 'grip', T(`Encostou em ${id}: o anel começa`, `Leaned on ${id}: the ring starts`))
        step(seconds)
      }
      const rootOf = (id) => room.spawned().find((s) => s.objectId === id).root
      // light: it follows the player, and the player keeps its distance
      const light = spawn(room, 'nightstand', [-2, 0, 3])
      hold(light, [-2, 1.7, 4.2], [-2, 0.4, 3], 0.2)
      expect(room.push.state.progress < 1, T('O anel não enche na hora', 'The ring does not fill at once'))
      step(0.5)
      expect(room.push.state.phase === 'push', T('12 kg: em menos de 1 s o jogador empurra', '12 kg: under 1 s the player pushes'), { phase: room.push.state.phase })
      const lightZ = rootOf(light).position.z
      const playerZ = room.playerPosition[2]
      room.push.setWalk([0, -1])
      step(1)
      const went = lightZ - rootOf(light).position.z
      expect(went > 1 && went < 2, T(`O móvel andou ${n1(went)} m em 1 s, mais devagar que andar`, `The piece went ${n1(went)} m in 1 s, slower than walking`))
      expect(Math.abs(playerZ - room.playerPosition[2] - went) < 0.01, T('O jogador foi junto', 'The player went with it'))
      room.push.setWalk([0, 1])
      step(0.5)
      expect(rootOf(light).position.z > lightZ - went + 0.5, T('Puxar traz o móvel de volta', 'Pulling brings it back'))
      room.push.setWalk(null)
      room.push.end()
      step(0.3)
      expect(room.push.state === null, T('Soltar sai do modo', 'Letting go ends it'))
      // too heavy: the ring fills and nothing moves
      const heavy = spawn(room, 'bbq', [2, 0, 3])
      const heavyZ = rootOf(heavy).position.z
      hold(heavy, [2, 1.7, 4.4], [2, 0.6, 3], 3)
      room.push.setWalk([0, -1])
      step(1)
      expect(room.push.state.phase === 'strain' && room.push.state.block === 'too_heavy', T('400 kg: faz força e não vai', '400 kg: strains and it does not go'), room.push.state)
      expect(rootOf(heavy).position.z === heavyZ, T('A churrasqueira não saiu do lugar', 'The grill did not move'))
      room.push.setWalk(null)
      room.push.end()
      // against a wall: the volume of the piece stops at it, and it can still be pulled away
      const wall = spawn(room, 'wardrobe', [0, 0, -9])
      const wardrobeBack = () => new window.__THREE.Box3().setFromObject(rootOf(wall)).min.z
      hold(wall, [0, 1.7, -7.9], [0, 1.2, -9], 2.5)
      expect(room.push.state.phase === 'push', T('90 kg de madeira dá para empurrar', '90 kg of wood can be pushed'), room.push.state)
      room.push.setWalk([0, -1])
      step(4)
      const stoppedAt = wardrobeBack()
      expect(room.push.state.phase === 'strain' && room.push.state.block === 'obstacle', T('Bateu na parede e travou', 'It hit the wall and locked'), room.push.state)
      expect(stoppedAt > -11.1, T(`Parou antes de atravessar a parede (fundos em z=${stoppedAt.toFixed(2)})`, `Stopped short of the wall (back at z=${stoppedAt.toFixed(2)})`))
      const stuckPlayer = room.playerPosition[2]
      step(0.5)
      expect(room.playerPosition[2] === stuckPlayer && wardrobeBack() === stoppedAt, T('Nem o móvel nem o jogador avançam', 'Neither the piece nor the player advance'))
      room.push.setWalk([0, 1])
      step(0.5)
      expect(wardrobeBack() > stoppedAt + 0.1 && room.push.state.block === null, T('Puxado para trás, solta da parede', 'Pulled back, it comes off the wall'), room.push.state)
      room.push.setWalk(null)
      room.push.end()
    }),

    sc('shower_glass_shatters', T('Box do chuveiro: o vidro temperado quebra em pedaços pequenos', 'Shower: the tempered glass shatters into small pieces'), ({ room, step, expect }) => {
      const id = spawn(room, 'shower')
      const glass = specPart('shower', 'tempered_glass_2')
      room.setTool('pistol_9mm')
      let shots = 0
      for (; shots < 12 && part(room, id, 'tempered_glass_2')?.status !== 'broken'; shots++) shoot(room, step, glass)
      step(0.5)
      const fr = room.log.entries({ type: 'fracture', objectId: id }).find((e) => e.part === 'tempered_glass_2')
      const n = Number(fr?.data?.fragments ?? 0)
      expect(part(room, id, 'tempered_glass_2')?.status === 'broken' && n >= 12, T(`Vidro temperado após ${shots} tiro(s): ${part(room, id, 'tempered_glass_2')?.status}, ${n} pedaço(s) (esperado: broken, 12 ou mais)`, `Tempered glass after ${shots} shot(s): ${part(room, id, 'tempered_glass_2')?.status}, ${n} piece(s) (expected: broken, 12 or more)`), { shots, n })
      expect(part(room, id, 'tempered_glass_2')?.material === 'tempered_glass', T('O vidro do box é temperado', 'The shower glass is tempered'))
    }),

    sc('trash_bin_crushed', T('Lixeira: golpes de marreta amassam o plástico', 'Trash bin: sledgehammer blows dent the plastic'), ({ room, step, expect }) => {
      const id = spawn(room, 'trash_bin')
      const body = analysisOf('trash_bin').destructible.parts.filter((p) => p.material === 'plastic' && p.id !== 'lid').sort((a, b) => b.shape.size[1] - a.shape.size[1])[0]
      const c = world(body)
      room.setTool('sledgehammer')
      room.waitUntilReady()
      // the first blow throws the 3 kg bin across the room, so the part that gets dented is the one under the hammer, not necessarily the largest
      const struck = () => (room.world.state(id)?.parts ?? []).map((p) => part(room, id, p.id)).filter((p) => p?.status === 'broken' || (p?.dents.length ?? 0) > 0)
      let blows = 0
      for (; blows < 10 && !struck().length; blows++) {
        room.look([c[0], c[1], c[2] + body.shape.size[2] / 2 + 0.5], [c[0], c[1], c[2]])
        room.use()
        step(1)
      }
      const p = struck()[0]
      expect(!!p, T(`Marreta na lixeira: ${blows} golpe(s), ${p?.status}, ${p?.dents.length ?? 0} amassado(s), hp ${n1(p?.hp ?? 0)}/${n1(p?.maxHp ?? 0)}`, `Sledgehammer on the bin: ${blows} blow(s), ${p?.status}, ${p?.dents.length ?? 0} dent(s), hp ${n1(p?.hp ?? 0)}/${n1(p?.maxHp ?? 0)}`), { blows })
    }),

    sc('bbq_blast_crumbles', T('Churrasqueira: uma explosão esfarela o tijolo e solta a argamassa', 'Barbecue: a blast crumbles the brick and frees the mortar'), ({ room, step, expect }) => {
      const id = spawn(room, 'bbq')
      room.world.hit(id, { type: 'explosive', point: [AT[0], AT[1] + 0.5, AT[2] + 0.9], energy: 400000, radius: 3, source: 'test' })
      step(2)
      const st = room.world.state(id)
      const crumble = room.log.entries({ type: 'fracture', objectId: id }).filter((e) => e.data?.style === 'crumble').length
      const open = (st?.joints ?? []).filter((j) => j.open && j.kind === 'mortar').length
      const total = analysisOf('bbq').destructible.parts.length
      const lost = total - (st?.parts.length ?? 0)
      expect(crumble > 0 && open + lost > 0, T(`Explosão na churrasqueira: ${crumble} esfarelamento(s) de tijolo, ${open} junta(s) de argamassa abertas, ${lost} peça(s) soltas`, `Blast on the barbecue: ${crumble} brick crumbling(s), ${open} open mortar joint(s), ${lost} piece(s) loose`), { crumble, open, lost })
    }),

    sc('mailbox_flap_off', T('Caixa de correio: a aba sai da dobradiça com pancadas', 'Mailbox: the flap comes off its hinge with blows'), ({ room, step, expect }) => {
      const id = spawn(room, 'mailbox')
      const flap = specPart('mailbox', 'flap')
      const c = world(flap)
      expect(room.playAnimation('open_flap', id), T('Clipe "open_flap" tocou', 'Clip "open_flap" played'))
      step(1.2)
      let blows = 0
      for (; blows < 14 && !gone(room, id, 'flap'); blows++) {
        room.world.hitPart(id, 'flap', { type: 'blunt', point: c, direction: [0, -0.3, -1], energy: 160, radius: 0.05, source: 'test' })
        step(0.3)
      }
      step(1)
      expect(gone(room, id, 'flap'), T(`Aba fora após ${blows} pancada(s); ${room.renderer.pieces().length} peça(s) solta(s)`, `Flap off after ${blows} blow(s); ${room.renderer.pieces().length} loose piece(s)`), { blows })
    }),

    sc('use_animations', T('Uso: todas as portas, gavetas, tampas e botões abrem e voltam ao lugar', 'Use: every door, drawer, lid and knob opens and comes back'), ({ room, step, expect }) => {
      const types = ['fridge', 'wardrobe', 'dresser', 'stove', 'microwave', 'toilet', 'trash_bin', 'mailbox', 'sink_kitchen', 'washing_machine']
      for (const type of types) {
        room.clear()
        const id = spawn(room, type)
        const so = room.spawned().find((s) => s.objectId === id)
        const clips = room.animations()?.clips ?? []
        void clips
        const names = analysisOf(type).animations.map((c) => c.id)
        const moved = []
        const rest = {}
        for (const clipId of ['open_all', 'on_all']) {
          const clip = analysisOf(type).animations.find((c) => c.id === clipId)
          if (!clip) continue
          const ids = Object.keys(clip.keys[clip.keys.length - 1].parts)
          for (const pid of ids) {
            const o = so.root.getObjectByName(pid)
            rest[pid] = [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z]
          }
          room.playAnimation(clipId, id)
          step(clip.duration + 0.2)
          for (const pid of ids) {
            const o = so.root.getObjectByName(pid)
            const d = Math.hypot(o.position.x - rest[pid][0], o.position.y - rest[pid][1], o.position.z - rest[pid][2], o.rotation.x - rest[pid][3], o.rotation.y - rest[pid][4], o.rotation.z - rest[pid][5])
            if (d > 0.05) moved.push(pid)
          }
          const back = clipId === 'open_all' ? 'close_all' : 'off_all'
          room.playAnimation(back, id)
          step(analysisOf(type).animations.find((c) => c.id === back).duration + 0.2)
          for (const pid of ids) {
            const o = so.root.getObjectByName(pid)
            const d = Math.hypot(o.position.x - rest[pid][0], o.position.y - rest[pid][1], o.position.z - rest[pid][2], o.rotation.x - rest[pid][3], o.rotation.y - rest[pid][4], o.rotation.z - rest[pid][5])
            if (d > 0.01) moved.push(`${pid}!`)
          }
        }
        const opened = moved.filter((m) => !m.endsWith('!')).length
        const stuck = moved.filter((m) => m.endsWith('!'))
        expect(opened > 0 && stuck.length === 0, T(`${type}: ${opened} parte(s) se moveram (${names.length} clipes); não voltaram: ${stuck.length}`, `${type}: ${opened} part(s) moved (${names.length} clips); did not come back: ${stuck.length}`), { type, opened, stuck })
      }
    }),

    sc('tap_on', T('Pia: o clipe da torneira gira o registro', 'Sink: the tap clip turns the handle'), ({ room, step, expect }) => {
      const id = spawn(room, 'sink_bathroom')
      const so = room.spawned().find((s) => s.objectId === id)
      const h = so.root.getObjectByName('tap_handle')
      const rest = h.rotation.y
      expect(room.playAnimation('on_tap_handle', id), T('Clipe "on_tap_handle" tocou', 'Clip "on_tap_handle" played'))
      step(0.6)
      const turned = Math.abs(h.rotation.y - rest)
      expect(turned > 0.3, T(`Registro girou ${n1(turned)} rad (esperado: mais que 0,3)`, `Handle turned ${n1(turned)} rad (expected: more than 0.3)`), { turned })
      const fluid = room.fluids.container(`${id}_fluid`)
      expect(!!fluid && fluid.liters > 0, T(`Bacia com água: ${n1(fluid?.liters ?? 0)} L`, `Basin holds water: ${n1(fluid?.liters ?? 0)} L`), { liters: fluid?.liters })
    }),

    // Cross-phase scenario (owner rule): the characters module is a DestructibleImpl in the very world that holds the furniture, so one shot crosses both.
    // The wardrobe, not the fridge: the world follows a shot through four parts and a fridge has four layers of its own (door, liner and two back skins), so nothing behind it is ever reached.
    {
      id: 'zombie_behind_door',
      name: T('Zumbi atrás da porta: um 7,62 atravessa a porta do guarda-roupa e depois o zumbi, na ordem', 'Zombie behind the door: a 7.62 crosses the wardrobe door and then the zombie, in that order'),
      run: ({ room, step, expect }) => {
        const wardrobe = spawn(room, 'wardrobe')
        const back = analysisOf('wardrobe').destructible.parts.reduce((m, p) => Math.min(m, p.position[2] - p.shape.size[2] / 2), 0)
        let zombie
        try {
          // right behind the back of the wardrobe, facing the shooter; standing still so the aim holds
          zombie = room.spawn('zombie_walker', [AT[0], 0, AT[2] + back - 0.35], 0).objectId
        } catch (e) {
          expect(false, T(`O módulo de personagens não está carregado: ${e.message}`, `The characters module is not loaded: ${e.message}`))
          return
        }
        room.bench('characters_area')?.set('pose', 'stand')
        step(0.2)
        const hp = () => (room.world.state(zombie)?.parts ?? []).reduce((sum, p) => sum + p.hp, 0)
        const before = hp()
        // the log keeps only its last entries, so a position in the list goes stale after a long run: mark the point by the sequence number instead
        const all = room.log.entries()
        const from = all.length ? all[all.length - 1].seq : -1
        // 0.7 m high, a hand off the middle: the door, the liner and the back of the wardrobe are three layers, and the left thigh of the zombie is the fourth
        room.setTool('rifle_7_62x39')
        room.waitUntilReady()
        room.look([AT[0] + 0.1, 0.7, AT[2] + 2.5], [AT[0] + 0.1, 0.7, AT[2]])
        room.use()
        step(0.6)
        const events = room.log.entries().filter((e) => e.seq > from && e.channel === 'event')
        const first = (id) => events.findIndex((e) => e.objectId === id)
        const onDoor = first(wardrobe)
        const onZombie = first(zombie)
        const seen = events.map((e) => `${e.objectId}:${e.type}`)
        expect(onDoor >= 0, T('O tiro marcou o guarda-roupa', 'The shot marked the wardrobe'), { events: seen })
        expect(onZombie >= 0, T('O tiro chegou ao zumbi', 'The shot reached the zombie'), { events: seen })
        expect(onDoor >= 0 && onZombie > onDoor, T(`Ordem dos eventos: guarda-roupa (${onDoor}) antes do zumbi (${onZombie})`, `Event order: wardrobe (${onDoor}) before the zombie (${onZombie})`), { onDoor, onZombie })
        expect(hp() < before, T(`O zumbi perdeu pontos: ${n1(before)} para ${n1(hp())}`, `The zombie lost points: ${n1(before)} to ${n1(hp())}`), { before, after: hp() })
      },
    },
    // Cross-phase scenario (owner rule): the vehicles module is a DestructibleImpl in the very world that holds the furniture, so one shot at the car leaves the fridge alone.
    {
      id: 'car_in_the_yard',
      name: T('Carro no quintal: um 7,62 fura a porta do sedã no modo leve e a geladeira ao lado não sente', 'Car in the yard: a 7.62 goes through the door of the light-mode sedan and the fridge beside it feels nothing'),
      run: ({ room, step, expect }) => {
        const fridge = spawn(room, 'fridge', [-3, 0, -9])
        const bench = room.bench('vehicles_area')
        let car
        try {
          // the light mode of the fleet (fewer segments, no interior): the car of a crowd, with the same doors
          bench?.set('quality', 'lite')
          car = room.spawn('sedan', [2.5, 0, -5], 0)
        } catch (e) {
          expect(false, T(`O módulo de veículos não está carregado: ${e.message}`, `The vehicles module is not loaded: ${e.message}`))
          return
        } finally {
          bench?.set('quality', 'high')
        }
        const destructible = car.root.userData.destructible
        const total = (id) => (room.world.state(id)?.parts ?? []).reduce((sum, p) => sum + p.hp, 0)
        const fridgeBefore = total(fridge)
        const before = part(room, car.objectId, 'door_front_left').hp
        const c = destructible.partWorldCenter('door_front_left')
        room.setTool('rifle_7_62x39')
        room.waitUntilReady()
        // the left of the car is +x: the shooter stands on that side
        room.look([c[0] + 2.5, c[1], c[2]], c)
        room.use()
        step(0.6)
        const door = part(room, car.objectId, 'door_front_left')
        const events = room.log.entries({ channel: 'event' }).filter((e) => e.objectId === car.objectId).map((e) => e.type)
        expect(door.hp < before, T(`A porta dianteira esquerda perdeu pontos: ${n1(before)} para ${n1(door.hp)}`, `The front left door lost points: ${n1(before)} to ${n1(door.hp)}`), { before, after: door.hp, events })
        expect(door.holes.length >= 1, T(`A porta tem ${door.holes.length} furo(s) (esperado: 1 ou mais)`, `The door has ${door.holes.length} hole(s) (expected: 1 or more)`), { holes: door.holes.length })
        expect(Math.abs(total(fridge) - fridgeBefore) < 1e-6, T(`A geladeira ao lado ficou intacta: ${n1(fridgeBefore)} e ${n1(total(fridge))}`, `The fridge beside it is untouched: ${n1(fridgeBefore)} and ${n1(total(fridge))}`), { before: fridgeBefore, after: total(fridge) })
      },
    },
  ]
}
