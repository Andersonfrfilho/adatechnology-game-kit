/** The words of the explosives area (the P13 cylinder bench and its narration), by locale (`en` and `pt-BR`). `{name}` marks a value the module fills in. */
export interface ExplosivesText {
  group: string
  name: string
  cylinder: string
  actions: Record<'shoot' | 'valve' | 'light' | 'fire' | 'reset', { name: string; hint: string }>
  blastScale: { name: string; hint: string }
  layers: Record<'rings', string>
  metrics: Record<'gas' | 'clock' | 'phase', string>
  phases: Record<'rest' | 'leaking' | 'torch' | 'primed' | 'exploded', string>
  rings: { lethal: string; injury: string }
  triggers: Record<'shot' | 'fire' | 'explosion', string>
  things: Record<string, string>
  verdicts: { wall_pieces: string; lost_parts: string; dead: string; hurt: string; unhurt: string; wall_broken: string; wall_cracked: string; wall_intact: string; burning: string; standing: string }
  log: {
    leak_shot: string
    leak_valve: string
    valve_closed: string
    valve_closed_late: string
    primed: string
    jet_lit: string
    jet_lit_by: string
    lighter_none: string
    lighter_lit: string
    fire_set: string
    heating: string
    explode: string
    shell: string
    shell_landed: string
    residual: string
    aftermath_person: string
    aftermath_wall: string
    aftermath_object: string
    reset: string
    scale: string
    no_room: string
    shoot: string
    no_vessel: string
  }
  sheet: {
    kicker: string
    title: string
    body: string
    facts: Record<'energy' | 'lethal' | 'injury' | 'gas' | 'mass' | 'torch' | 'shot_chain' | 'fire_chain', string>
    steps: Array<{ at: string; text: string }>
    segments: Record<'jet' | 'torch' | 'blast', string>
    note: string
  }
  scenarios: {
    shot: string
    shot_leak: string
    shot_ignite: string
    shot_explode: string
    shot_zombie: string
    shot_survivor: string
    shot_wall: string
    valve: string
    valve_leak: string
    valve_quiet: string
    valve_lit: string
    valve_explode: string
    fire: string
    fire_explode: string
    chain: string
    chain_explode: string
    push_p13: string
    push_grenade: string
    push_found: string
    push_told: string
    push_outward: string
    push_falloff: string
    push_person: string
    push_heavy: string
  }
}

export const EXPLOSIVES_TEXT: Record<string, ExplosivesText> = {
  en: {
    group: 'Explosives',
    name: 'Explosives area',
    cylinder: 'Propane cylinder (P13)',
    actions: {
      shoot: { name: 'Shoot the cylinder', hint: 'Equips the 9 mm pistol, aims at the cylinder and fires: a hole in the shell, a white gas jet, a torch, the blast' },
      valve: { name: 'Open the valve', hint: 'Opens (or closes) the valve: the gas leaks with no fire until a flame reaches it' },
      light: { name: 'Light it (lighter)', hint: 'Holds a lighter flame at the valve: a gas leak catches fire and the cylinder goes off' },
      fire: { name: 'Throw it in the fire', hint: 'Lights a fire next to the cylinder (and the table): the shell heats up until the fire chain sets it off' },
      reset: { name: 'Restart', hint: 'Lays the scene again: a new cylinder, wall, furniture and people' },
    },
    blastScale: { name: 'Blast strength (game multiplier)', hint: 'Multiplies the energy and the lethal and injury radii of the P13 for the next one laid (restarts the scene). 1 is the arsenal; the arsenal itself is changed with ArsenalOptions.patch.explosives.propane_p13' },
    layers: { rings: 'Lethal and injury rings' },
    metrics: { gas: 'Gas left in the cylinder', clock: 'Seconds since the first leak', phase: 'Phase' },
    phases: { rest: 'At rest', leaking: 'Leaking gas', torch: 'Burning jet', primed: 'About to go off', exploded: 'Exploded' },
    rings: { lethal: 'lethal', injury: 'injury' },
    triggers: { shot: 'a bullet', fire: 'fire', explosion: 'another blast' },
    things: { zombie: 'Zombie', survivor: 'Survivor', fridge: 'Fridge', kitchen_cabinet_base: 'Kitchen cabinet', stove: 'Stove', camp_table: 'Table', can: 'Can of beans', bottle: 'Water bottle', chair: 'Chair' },
    verdicts: { wall_pieces: 'broke loose into {pieces} pieces and cracked ({n} marks)', lost_parts: 'lost {n} parts', dead: 'dead', hurt: 'hurt (vitality {vitality}%)', unhurt: 'unhurt', wall_broken: 'cracked and lost {n} brick panels', wall_cracked: 'cracked ({n} marks)', wall_intact: 'intact', burning: 'burning', standing: 'standing' },
    log: {
      leak_shot: 'Hole of {diameter} mm in the shell: gas leaking at {rate} l/s ({liters} l left in the cylinder)',
      leak_valve: 'Valve open: gas leaking at {rate} l/s with no fire ({liters} l left in the cylinder)',
      valve_closed: 'Valve closed: the leak stopped ({liters} l left)',
      valve_closed_late: 'Too late to close the valve: the cylinder is already going off',
      primed: 'The cylinder was set off by {trigger}: it goes off in {delay} s',
      jet_lit: 'The jet caught fire (torch) {seconds} s after the hole; the cylinder goes off in {rest} s',
      jet_lit_by: 'The leaking gas caught fire (torch) from {by}; the cylinder goes off in {rest} s',
      lighter_none: 'Lighter flame at the valve: no gas is leaking, nothing happens',
      lighter_lit: 'Lighter flame at the leaking valve: the gas lights',
      fire_set: 'Fire lit next to the cylinder ({temperature} °C, radius {radius} m): the shell heats up',
      heating: 'Shell at {temperature} °C (the fire chain starts at {limit} °C)',
      explode: 'Cylinder exploded: fireball of {fireball} m, lethal up to {lethal} m, injuries up to {injury} m (energy {energy} kJ, strength x{scale})',
      shell: 'The torn shell flew up at {speed} m/s trailing fire for {trail} s',
      shell_landed: 'The shell came down {distance} m away after {seconds} s',
      residual: 'Residual fire of {radius} m for {seconds} s',
      aftermath_person: '{who} at {distance} m: {verdict}',
      aftermath_wall: 'Wall behind the cylinder: {verdict}',
      aftermath_object: '{what} at {distance} m: {verdict}',
      reset: 'Scene laid again with a blast strength of x{scale}',
      scale: 'Blast strength x{scale}: energy {energy} kJ, lethal {lethal} m, injury {injury} m (valid for the next cylinder; the scene restarts)',
      no_room: 'The explosives area was loaded without the room: this action needs it',
      shoot: '9 mm shot at the cylinder from {distance} m',
      no_vessel: 'There is no cylinder in the scene (restart it)',
    },
    sheet: {
      kicker: 'P13 cooking gas cylinder',
      title: 'What happens to a P13 under a bullet, a flame or a blast',
      body: 'Every kitchen has one. It goes off from a bullet or from fire, and it chains. The sequence is the Explosives Lab one (SC.p13): the gas jet hisses, catches fire as a torch, and the shell goes off.',
      facts: { energy: 'Energy', lethal: 'Lethal radius', injury: 'Injury radius', gas: 'Gas', mass: 'Mass', torch: 'Torch after the hole', shot_chain: 'Blast after a bullet', fire_chain: 'Blast after fire' },
      steps: [
        { at: '0 s', text: 'The bullet goes through the 2.5 mm steel shell: a white gas jet leaves the hole, hissing and shoving the cylinder' },
        { at: '0.8 s', text: 'The jet catches fire and burns as a torch at the hole' },
        { at: '1.4 s', text: 'The fuel fireball (light 70), the mushroom rises 7 m over 8 s, the shell flies up at 13 m/s trailing fire' },
        { at: '1.4 s - 8.4 s', text: 'Residual fire of 1.4 m for 7 s; walls, furniture and people inside the rings take the blast' },
      ],
      segments: { jet: 'White gas jet', torch: 'Torch', blast: 'Blast' },
      note: 'Opening the valve leaks the gas with no fire; a flame near it lights the leak and the cylinder goes off 1.4 s later. The numbers come from the arsenal (propane_p13); the strength multiplier is a game value.',
    },
    scenarios: {
      shot: 'P13 cylinder: a 9 mm through the shell leaks gas, the jet lights and the cylinder goes off with its chain delay',
      shot_leak: 'The shot made a gas leak with a white pressurized jet',
      shot_ignite: 'The jet caught fire (torch) between 0.7 and 1.0 s after the hole',
      shot_explode: 'The cylinder exploded within 1.6 s of the shot',
      shot_zombie: 'The zombie 3 m from the cylinder did not survive the blast',
      shot_survivor: 'The survivor 8 m away, past the lethal ring, is hurt but alive',
      shot_wall: 'The brick wall behind it was marked by the blast',
      valve: 'P13 cylinder: the open valve leaks gas without fire and the cylinder goes off only when a flame lights it',
      valve_leak: 'The open valve leaks gas',
      valve_quiet: 'Four seconds of leaking gas with no flame: no fire and no blast',
      valve_lit: 'The lighter flame lit the leak',
      valve_explode: 'The cylinder went off within 1.6 s of the flame',
      fire: 'P13 cylinder in a fire: the heat sets it off by the fire chain',
      fire_explode: 'The cylinder in the fire exploded',
      chain: 'P13 cylinder: another blast next to it sets it off by the explosion chain',
      chain_explode: 'The second cylinder exploded after the first one',
      push_p13: 'P13 blast: the loose items, the furniture and the people around it are thrown away from it, less the farther they stand',
      push_grenade: 'Thrown M67 grenade: the loose items and the people around it are thrown away from it, less the farther they stand',
      push_told: 'The explosion reached the host as an event',
      push_found: '{n} bodies were laid around the blast to be measured ({kinds})',
      push_outward: 'Every body inside the reach moved away from the blast ({moved} of {n}, {least} m at the least)',
      push_falloff: '{what}: the nearer one moved more than the farther one ({near} m at {nearDistance} m, {far} m at {farDistance} m)',
      push_person: '{who} at {distance} m was pushed {moved} m away',
      push_heavy: '{what} (too heavy to grab, not fixed) was moved {moved} m by the blast',
    },
  },
  'pt-BR': {
    group: 'Explosivos',
    name: 'Área de explosivos',
    cylinder: 'Botijão de gás (P13)',
    actions: {
      shoot: { name: 'Atirar no botijão', hint: 'Equipa a pistola 9 mm, mira no botijão e atira: furo no casco, jato branco de gás, maçarico, explosão' },
      valve: { name: 'Abrir o registro', hint: 'Abre (ou fecha) o registro: o gás vaza sem fogo até uma chama encostar' },
      light: { name: 'Acender (isqueiro)', hint: 'Põe a chama de um isqueiro no registro: gás vazando pega fogo e o botijão explode' },
      fire: { name: 'Jogar no fogo', hint: 'Acende um fogo ao lado do botijão (e da mesa): o casco esquenta até a cadeia de fogo detonar' },
      reset: { name: 'Reiniciar', hint: 'Monta a cena de novo: botijão novo, parede, móveis e pessoas' },
    },
    blastScale: { name: 'Força da explosão (multiplicador de jogo)', hint: 'Multiplica a energia e os raios letal e de ferimento do P13 para o próximo botijão montado (reinicia a cena). 1 é o arsenal; o arsenal em si muda com ArsenalOptions.patch.explosives.propane_p13' },
    layers: { rings: 'Anéis letal e de ferimento' },
    metrics: { gas: 'Gás no botijão', clock: 'Segundos desde o primeiro vazamento', phase: 'Fase' },
    phases: { rest: 'Em repouso', leaking: 'Vazando gás', torch: 'Jato em chamas', primed: 'Prestes a explodir', exploded: 'Explodiu' },
    rings: { lethal: 'letal', injury: 'ferimento' },
    triggers: { shot: 'um tiro', fire: 'fogo', explosion: 'outra explosão' },
    things: { zombie: 'Zumbi', survivor: 'Sobrevivente', fridge: 'Geladeira', kitchen_cabinet_base: 'Armário de cozinha', stove: 'Fogão', camp_table: 'Mesa', can: 'Lata de feijão', bottle: 'Garrafa de água', chair: 'Cadeira' },
    verdicts: { wall_pieces: 'se soltou em {pieces} pedaços e trincou ({n} marcas)', lost_parts: 'perdeu {n} peças', dead: 'morto', hurt: 'ferido (vitalidade {vitality}%)', unhurt: 'ileso', wall_broken: 'trincou e perdeu {n} painéis de tijolo', wall_cracked: 'trincou ({n} marcas)', wall_intact: 'intacta', burning: 'pegando fogo', standing: 'de pé' },
    log: {
      leak_shot: 'Furo de {diameter} mm no casco: gás vazando a {rate} l/s ({liters} l no botijão)',
      leak_valve: 'Registro aberto: gás vazando a {rate} l/s, sem fogo ({liters} l no botijão)',
      valve_closed: 'Registro fechado: o vazamento parou ({liters} l restantes)',
      valve_closed_late: 'Tarde demais para fechar o registro: o botijão já vai explodir',
      primed: 'O botijão foi detonado por {trigger}: explode em {delay} s',
      jet_lit: 'O jato pegou fogo (maçarico) {seconds} s depois do furo; o botijão explode em {rest} s',
      jet_lit_by: 'O gás vazando pegou fogo (maçarico) por {by}; o botijão explode em {rest} s',
      lighter_none: 'Chama do isqueiro no registro: não há gás vazando, nada acontece',
      lighter_lit: 'Chama do isqueiro no registro que vaza: o gás acendeu',
      fire_set: 'Fogo aceso ao lado do botijão ({temperature} °C, raio {radius} m): o casco esquenta',
      heating: 'Casco a {temperature} °C (a cadeia de fogo começa em {limit} °C)',
      explode: 'Botijão explodiu: bola de fogo de {fireball} m, letal até {lethal} m, ferimentos até {injury} m (energia {energy} kJ, força x{scale})',
      shell: 'O casco rasgado voou para cima a {speed} m/s com rastro de fogo por {trail} s',
      shell_landed: 'O casco caiu a {distance} m depois de {seconds} s',
      residual: 'Fogo residual de {radius} m por {seconds} s',
      aftermath_person: '{who} a {distance} m: {verdict}',
      aftermath_wall: 'Parede atrás do botijão: {verdict}',
      aftermath_object: '{what} a {distance} m: {verdict}',
      reset: 'Cena montada de novo com força de explosão x{scale}',
      scale: 'Força da explosão x{scale}: energia {energy} kJ, letal {lethal} m, ferimento {injury} m (vale para o próximo botijão; a cena reinicia)',
      no_room: 'A área de explosivos foi carregada sem a sala: esta ação precisa dela',
      shoot: 'Tiro de 9 mm no botijão a {distance} m',
      no_vessel: 'Não há botijão na cena (reinicie)',
    },
    sheet: {
      kicker: 'Botijão de gás de cozinha P13',
      title: 'O que acontece com um P13 sob um tiro, uma chama ou uma explosão',
      body: 'Toda cozinha tem um. Explode com tiro ou fogo, e entra em cadeia. A sequência é a do Laboratório de Explosões (SC.p13): o jato de gás assobia, pega fogo como maçarico e o casco explode.',
      facts: { energy: 'Energia', lethal: 'Raio letal', injury: 'Raio de ferimento', gas: 'Gás', mass: 'Massa', torch: 'Maçarico após o furo', shot_chain: 'Explosão após um tiro', fire_chain: 'Explosão após fogo' },
      steps: [
        { at: '0 s', text: 'A bala atravessa o casco de aço de 2,5 mm: um jato branco de gás sai do furo, assobiando e sacudindo o botijão' },
        { at: '0,8 s', text: 'O jato pega fogo e queima como maçarico no furo' },
        { at: '1,4 s', text: 'A bola de fogo de combustível (luz 70), o cogumelo sobe 7 m em 8 s, o casco voa a 13 m/s com rastro de fogo' },
        { at: '1,4 s - 8,4 s', text: 'Fogo residual de 1,4 m por 7 s; paredes, móveis e pessoas dentro dos anéis levam a explosão' },
      ],
      segments: { jet: 'Jato branco de gás', torch: 'Maçarico', blast: 'Explosão' },
      note: 'Abrir o registro vaza o gás sem fogo; uma chama perto acende o vazamento e o botijão explode 1,4 s depois. Os números vêm do arsenal (propane_p13); o multiplicador de força é um valor de jogo.',
    },
    scenarios: {
      shot: 'Botijão P13: um 9 mm no casco vaza gás, o jato acende e o botijão explode com o atraso da cadeia',
      shot_leak: 'O tiro fez um vazamento de gás com jato branco pressurizado',
      shot_ignite: 'O jato pegou fogo (maçarico) entre 0,7 e 1,0 s depois do furo',
      shot_explode: 'O botijão explodiu até 1,6 s depois do tiro',
      shot_zombie: 'O zumbi a 3 m do botijão não sobreviveu à explosão',
      shot_survivor: 'O sobrevivente a 8 m, depois do anel letal, fica ferido mas vivo',
      shot_wall: 'A parede de tijolo atrás dele ficou marcada pela explosão',
      valve: 'Botijão P13: o registro aberto vaza gás sem fogo e o botijão só explode quando uma chama acende',
      valve_leak: 'O registro aberto vaza gás',
      valve_quiet: 'Quatro segundos de gás vazando sem chama: sem fogo e sem explosão',
      valve_lit: 'A chama do isqueiro acendeu o vazamento',
      valve_explode: 'O botijão explodiu até 1,6 s depois da chama',
      fire: 'Botijão P13 no fogo: o calor detona pela cadeia de fogo',
      fire_explode: 'O botijão no fogo explodiu',
      chain: 'Botijão P13: outra explosão ao lado detona pela cadeia de explosão',
      chain_explode: 'O segundo botijão explodiu depois do primeiro',
      push_p13: 'Explosão do P13: os itens soltos, os móveis e as pessoas em volta são jogados para longe, menos quanto mais longe estão',
      push_grenade: 'Granada M67 arremessada: os itens soltos e as pessoas em volta são jogados para longe, menos quanto mais longe estão',
      push_told: 'A explosão chegou ao host como evento',
      push_found: '{n} corpos foram postos em volta da explosão para serem medidos ({kinds})',
      push_outward: 'Todo corpo dentro do alcance se afastou da explosão ({moved} de {n}, no mínimo {least} m)',
      push_falloff: '{what}: o mais perto andou mais que o mais longe ({near} m a {nearDistance} m, {far} m a {farDistance} m)',
      push_person: '{who} a {distance} m foi empurrado {moved} m para longe',
      push_heavy: '{what} (pesado demais para pegar, mas solto) foi movido {moved} m pela explosão',
    },
  },
}

export const explosivesTextOf = (locale: string): ExplosivesText => EXPLOSIVES_TEXT[locale] ?? (EXPLOSIVES_TEXT.en as ExplosivesText)

/** Fills `{name}` marks of a template. */
export const fillText = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
