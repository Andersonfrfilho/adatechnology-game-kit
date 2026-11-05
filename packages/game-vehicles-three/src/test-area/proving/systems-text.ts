/** The words of the car's systems and driver aids in the proving ground: the bench actions that test them and the log lines of what they report. */
export interface SystemsText {
  keys: string
  profile: string
  profiles: Record<'eco' | 'normal' | 'sport', string>
  traction: string
  abs: string
  cruise: string
  cruiseSet: string
  climate: string
  demist: string
  wiperModes: Record<'off' | 'intermittent' | 'slow' | 'fast', string>
  refused: Record<'battery_flat' | 'too_slow' | 'locked' | 'missing', string>
  events: Record<'stall' | 'out_of_fuel' | 'bogged' | 'aquaplaning' | 'battery_flat' | 'overheating' | 'seized' | 'spare_fitted' | 'no_spare' | 'cruise_cancelled', string>
  actions: Record<'puncture' | 'fit_spare' | 'refuel' | 'drain_battery' | 'jump_start' | 'break_radiator' | 'empty_tank' | 'remote_lock' | 'remote_unlock' | 'force_door' | 'crash_wall' | 'park_behind', string>
  parking: Record<'placed' | 'none', string>
  track: string
  adjust: Record<'seat_forward' | 'seat_height' | 'mirror_left' | 'mirror_right', string>
  crash: { mild: string; stayed: string; ejected: string; exits: Record<'windshield' | 'left_window' | 'right_window' | 'rear_window', string> }
  bodyKeys: string
  remote: Record<'locked' | 'unlocked' | 'forced', string>
  done: Record<'puncture' | 'refuel' | 'drain_battery' | 'jump_start' | 'break_radiator' | 'empty_tank', string>
}

export const SYSTEMS_TEXT: Record<string, SystemsText> = {
  'pt-BR': {
    keys: 'C embreagem (câmbio manual) · X lampejo do farol alto · Z esguicho do limpador · 7 modo econômico/normal/esporte · 8 controle de tração · 9 ABS · 0 piloto automático · - ar-condicionado · = desembaçador · ] troca a faixa do rádio ou da fita',
    profile: 'Modo de condução',
    profiles: { eco: 'econômico', normal: 'normal', sport: 'esporte' },
    traction: 'Controle de tração',
    abs: 'ABS',
    cruise: 'Piloto automático',
    cruiseSet: 'Piloto automático: segurando {0} km/h',
    climate: 'Ar-condicionado',
    demist: 'Desembaçador',
    wiperModes: { off: 'desligado', intermittent: 'intermitente', slow: 'lento', fast: 'rápido' },
    refused: { battery_flat: 'Bateria descarregada: o motor de partida não gira', too_slow: 'Piloto automático só acima de 30 km/h', locked: 'Porta travada', missing: 'Este veículo não tem essa peça' },
    events: {
      stall: 'O motor morreu',
      out_of_fuel: 'Acabou o combustível',
      bogged: 'Atolou',
      aquaplaning: 'Aquaplanagem',
      battery_flat: 'A bateria descarregou',
      overheating: 'Motor superaquecendo: perdendo potência',
      seized: 'O motor fundiu de tanto esquentar',
      spare_fitted: 'Estepe colocado',
      no_spare: 'Não há estepe',
      cruise_cancelled: 'Piloto automático desligado',
    },
    actions: { puncture: 'Furar pneu (dianteiro esquerdo)', fit_spare: 'Trocar pelo estepe', refuel: 'Abastecer', drain_battery: 'Descarregar bateria', jump_start: 'Chupeta (carregar bateria)', break_radiator: 'Furar o radiador', empty_tank: 'Deixar o tanque na reserva', remote_lock: 'Controle: travar (arma o alarme)', remote_unlock: 'Controle: destravar', force_door: 'Forçar a porta do motorista', crash_wall: 'Bater no muro (parada seca)', park_behind: 'Estacionar um carro atrás (sensor de ré)' },
    parking: { placed: 'Carro parado 3 m atrás: dê ré e escute o sensor', none: 'Sem catálogo de veículos nesta sala: o sensor não tem o que ver' },
    track: 'faixa {0}',
    adjust: { seat_forward: 'Banco: frente/trás (m)', seat_height: 'Banco: altura (m)', mirror_left: 'Retrovisor esquerdo: ângulo', mirror_right: 'Retrovisor direito: ângulo' },
    crash: { mild: 'Batida a {0} km/h: fraca demais para lançar quem está sem cinto', stayed: 'Batida a {0} km/h: o cinto segurou o motorista', ejected: 'Batida a {0} km/h sem cinto: o motorista saiu pelo {1}', exits: { windshield: 'para-brisa', left_window: 'vidro esquerdo', right_window: 'vidro direito', rear_window: 'vidro traseiro' } },
    bodyKeys: '1 a 4 portas · 5 capô · 6 porta-malas · Shift+1 a 4 vidros · Shift+5 teto solar · V trava as portas',
    remote: { locked: 'Travado pelo controle: alarme armado', unlocked: 'Destravado pelo controle', forced: 'Porta forçada' },
    done: { puncture: 'Pneu dianteiro esquerdo furado', refuel: 'Tanque cheio', drain_battery: 'Bateria quase sem carga', jump_start: 'Bateria carregada', break_radiator: 'Radiador furado: o motor vai esquentar', empty_tank: 'Tanque na reserva' },
  },
  en: {
    keys: 'C clutch (manual gearbox) · X flash the high beam · Z washer · 7 eco/normal/sport · 8 traction control · 9 ABS · 0 cruise control · - air conditioning · = demister · ] next radio or tape track',
    profile: 'Drive profile',
    profiles: { eco: 'eco', normal: 'normal', sport: 'sport' },
    traction: 'Traction control',
    abs: 'ABS',
    cruise: 'Cruise control',
    cruiseSet: 'Cruise control: holding {0} km/h',
    climate: 'Air conditioning',
    demist: 'Demister',
    wiperModes: { off: 'off', intermittent: 'intermittent', slow: 'slow', fast: 'fast' },
    refused: { battery_flat: 'Flat battery: the starter does not turn', too_slow: 'Cruise control only above 30 km/h', locked: 'The door is locked', missing: 'This vehicle has no such part' },
    events: {
      stall: 'The engine stalled',
      out_of_fuel: 'Out of fuel',
      bogged: 'Bogged down',
      aquaplaning: 'Aquaplaning',
      battery_flat: 'The battery went flat',
      overheating: 'Engine overheating: losing power',
      seized: 'The engine seized from the heat',
      spare_fitted: 'Spare tyre fitted',
      no_spare: 'No spare tyre left',
      cruise_cancelled: 'Cruise control off',
    },
    actions: { puncture: 'Puncture a tyre (front left)', fit_spare: 'Fit the spare', refuel: 'Refuel', drain_battery: 'Drain the battery', jump_start: 'Jump start (charge the battery)', break_radiator: 'Puncture the radiator', empty_tank: 'Leave the tank on reserve', remote_lock: 'Remote: lock (arms the alarm)', remote_unlock: 'Remote: unlock', force_door: "Force the driver's door", crash_wall: 'Hit a wall (dead stop)', park_behind: 'Park a car behind (rear sensor)' },
    parking: { placed: 'A car parked 3 m behind: reverse and listen to the sensor', none: 'No vehicle catalogue in this room: the sensor has nothing to see' },
    track: 'track {0}',
    adjust: { seat_forward: 'Seat: forward/back (m)', seat_height: 'Seat: height (m)', mirror_left: 'Left mirror: angle', mirror_right: 'Right mirror: angle' },
    crash: { mild: 'Crash at {0} km/h: too mild to throw an unbelted occupant out', stayed: 'Crash at {0} km/h: the belt held the driver', ejected: 'Crash at {0} km/h without a belt: the driver went out through the {1}', exits: { windshield: 'windshield', left_window: 'left window', right_window: 'right window', rear_window: 'rear window' } },
    bodyKeys: '1 to 4 doors · 5 hood · 6 trunk · Shift+1 to 4 windows · Shift+5 sunroof · V locks the doors',
    remote: { locked: 'Locked by the remote: alarm armed', unlocked: 'Unlocked by the remote', forced: 'Door forced' },
    done: { puncture: 'Front left tyre punctured', refuel: 'Tank full', drain_battery: 'Battery almost flat', jump_start: 'Battery charged', break_radiator: 'Radiator punctured: the engine will heat up', empty_tank: 'Tank on reserve' },
  },
}
