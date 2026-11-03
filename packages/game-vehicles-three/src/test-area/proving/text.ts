/** Texts of the proving ground, in Brazilian Portuguese and English. */
export type ProvingText = {
  name: string
  controls: Record<'vehicle' | 'test' | 'camera' | 'time_scale' | 'visual_check' | 'gearbox', string>
  hints: Record<'vehicle' | 'test' | 'camera' | 'time_scale' | 'visual_check' | 'gearbox', string>
  gearbox: Record<'automatic' | 'manual', string>
  actions: Record<'drive' | 'run_test' | 'run_all' | 'certify_now' | 'reverse_park' | 'sign_ok' | 'sign_fail' | 'reset', string>
  layers: Record<'mirrors' | 'reverse_camera' | 'scoreboard', string>
  metrics: Record<'gear' | 'rpm' | 'speed' | 'time' | 'value' | 'passed' | 'failed' | 'pending' | 'status', string>
  cameras: Record<'room' | 'chase' | 'cockpit' | 'hood', string>
  tests: Record<string, string>
  status: Record<'approved' | 'rejected' | 'pending', string>
  verdict: Record<'pass' | 'fail' | 'pending', string>
  board: { title: string; test: string; value: string; range: string; verdict: string; notRun: string; running: string }
  log: { start: string; result: string; signed: string; certified: string; drive: string; leave: string; shift: string }
  cabin: {
    keys: string
    on: string
    off: string
    ignition: string
    gearbox: string
    gear: string
    parkingBrake: string
    driveMode: string
    modes: Record<'4x2' | '4x4' | 'auto', string>
    lights: string
    lampModes: Record<'off' | 'position' | 'low' | 'high', string>
    fog: string
    interior: string
    alarm: string
    alarmStates: Record<'off' | 'armed' | 'ringing', string>
    radio: string
    sources: Record<'radio' | 'tape', string>
    indicator: string
    indicators: Record<'off' | 'left' | 'right' | 'hazard', string>
    wipers: string
    wiperModes: Record<'off' | 'slow' | 'fast', string>
    seatbelt: string
    refused: Record<string, string>
  }
}

export const PROVING_TEXT: Record<string, ProvingText> = {
  'pt-BR': {
    name: 'Banco de provas',
    controls: { vehicle: 'Veículo', test: 'Prova', camera: 'Câmera', time_scale: 'Velocidade da simulação', visual_check: 'Checagem visual', gearbox: 'Câmbio' },
    gearbox: { automatic: 'Automático', manual: 'Manual' },
    hints: {
      gearbox: 'Automático troca sozinho. Manual: E sobe e Q desce a marcha (abaixo da 1ª vêm o neutro e a ré). M alterna dirigindo',
      vehicle: 'Veículo da frota que vai para a pista',
      test: 'Prova medida que o botão Rodar prova executa',
      camera: 'Sala: a câmera do jogador. Perseguição, cabine e capô seguem o veículo',
      time_scale: 'Quantas vezes mais rápido que o tempo real a prova roda',
      visual_check: 'O que você olhou e vai aprovar ou reprovar',
    },
    actions: { drive: 'Dirigir (entrar / sair)', run_test: 'Rodar prova', run_all: 'Rodar todas na pista', certify_now: 'Homologar agora (sem animação)', reverse_park: 'Dar ré (câmera de ré)', sign_ok: 'Aprovar checagem visual', sign_fail: 'Reprovar checagem visual', reset: 'Limpar ficha' },
    layers: { mirrors: 'Retrovisores', reverse_camera: 'Câmera de ré', scoreboard: 'Painel da ficha' },
    metrics: { gear: 'Marcha (-1 ré, 0 neutro)', rpm: 'Rotação', speed: 'Velocidade', time: 'Tempo da prova', value: 'Medição', passed: 'Aprovadas', failed: 'Reprovadas', pending: 'Pendentes', status: 'Situação (0 pend., 1 aprov., -1 reprov.)' },
    cameras: { room: 'Sala', chase: 'Perseguição (3ª pessoa)', cockpit: 'Cabine (1ª pessoa)', hood: 'Capô' },
    tests: {
      accel_0_100: '0 a 100 km/h',
      top_speed: 'Velocidade máxima',
      brake_100_0: 'Frenagem 100 a 0',
      turn_circle: 'Diâmetro de giro',
      wet_brake_80_0: 'Frenagem molhada 80 a 0',
      mud_traction: 'Tração na lama',
      cabin: 'Cabine e personagem',
      cameras: 'Câmeras',
      mirrors: 'Retrovisores e ré',
      terrain: 'Terrenos',
      wind_tunnel: 'Túnel de vento',
      crash_test: 'Crash test',
      pedestrian: 'Atropelamento',
      performance: 'Desempenho',
      buoyancy: 'Flutuação',
      flight: 'Voo',
    },
    status: { approved: 'APROVADO', rejected: 'REPROVADO', pending: 'PENDENTE' },
    verdict: { pass: 'ok', fail: 'falhou', pending: '…' },
    board: { title: 'Ficha de homologação', test: 'Prova', value: 'Medido', range: 'Faixa', verdict: 'Resultado', notRun: 'não rodada', running: 'rodando' },
    log: { start: 'Prova {0}: {1}', result: '{0} · {1}: {2} {3} (faixa {4}) → {5}', signed: '{0} · {1}: {2} na sala', certified: '{0}: {1}', drive: 'Dirigindo {0}: I liga o motor, F sai do carro', leave: 'Saiu do volante', shift: 'Câmbio {0}, marcha {1}' },
    cabin: {
      keys: 'W ou ↑ acelera · S ou ↓ freia (parado, dá ré) · A/D ou ←/→ vira · Espaço freio de mão · P puxa o freio de mão · I liga e desliga · M câmbio manual/automático · E sobe e Q desce marcha · G tração 4x2/4x4/4x4 automática · L luzes (posição, baixa) · K farol alto · N neblina · U luz interna · vírgula e ponto setas · B pisca-alerta · O limpador · J cinto · H buzina · Y alarme · R rádio · T rádio/fita · F sai do carro',
      on: 'ligado',
      off: 'desligado',
      ignition: 'Motor',
      gearbox: 'Câmbio',
      gear: 'Marcha',
      parkingBrake: 'Freio de mão',
      driveMode: 'Tração',
      modes: { '4x2': '4x2', '4x4': '4x4', auto: '4x4 automática' },
      lights: 'Luzes',
      lampModes: { off: 'apagadas', position: 'posição', low: 'farol baixo', high: 'farol alto' },
      fog: 'Neblina',
      interior: 'Luz interna',
      alarm: 'Alarme',
      alarmStates: { off: 'desligado', armed: 'armado', ringing: 'disparado' },
      radio: 'Som',
      sources: { radio: 'rádio', tape: 'toca-fitas' },
      indicator: 'Setas',
      indicators: { off: 'desligadas', left: 'esquerda', right: 'direita', hazard: 'pisca-alerta' },
      wipers: 'Limpador',
      wiperModes: { off: 'desligado', slow: 'lento', fast: 'rápido' },
      seatbelt: 'Cinto',
      refused: { no_four_wheel_drive: 'Este veículo não tem tração 4x4', no_fog_lamps: 'Este veículo não tem farol de neblina', ignition_off: 'Ligue o motor primeiro' },
    },
  },
  en: {
    name: 'Proving ground',
    controls: { vehicle: 'Vehicle', test: 'Test', camera: 'Camera', time_scale: 'Simulation speed', visual_check: 'Visual check', gearbox: 'Gearbox' },
    gearbox: { automatic: 'Automatic', manual: 'Manual' },
    hints: {
      gearbox: 'Automatic shifts by itself. Manual: E shifts up and Q down (below 1st come neutral and reverse). M switches while driving',
      vehicle: 'Fleet vehicle that goes on the track',
      test: 'Measured test the Run test button runs',
      camera: 'Room: the player camera. Chase, cockpit and hood follow the vehicle',
      time_scale: 'How many times faster than real time the test runs',
      visual_check: 'What you looked at and will approve or refuse',
    },
    actions: { drive: 'Drive (get in / out)', run_test: 'Run test', run_all: 'Run all on the track', certify_now: 'Certify now (no animation)', reverse_park: 'Reverse (reversing camera)', sign_ok: 'Approve visual check', sign_fail: 'Refuse visual check', reset: 'Clear certificate' },
    layers: { mirrors: 'Mirrors', reverse_camera: 'Reversing camera', scoreboard: 'Certificate board' },
    metrics: { gear: 'Gear (-1 reverse, 0 neutral)', rpm: 'Engine speed', speed: 'Speed', time: 'Test time', value: 'Measured', passed: 'Passed', failed: 'Failed', pending: 'Pending', status: 'Status (0 pending, 1 approved, -1 rejected)' },
    cameras: { room: 'Room', chase: 'Chase (third person)', cockpit: 'Cockpit (first person)', hood: 'Hood' },
    tests: {
      accel_0_100: '0 to 100 km/h',
      top_speed: 'Top speed',
      brake_100_0: 'Braking 100 to 0',
      turn_circle: 'Turning circle',
      wet_brake_80_0: 'Wet braking 80 to 0',
      mud_traction: 'Mud traction',
      cabin: 'Cabin and character',
      cameras: 'Cameras',
      mirrors: 'Mirrors and reversing',
      terrain: 'Terrain',
      wind_tunnel: 'Wind tunnel',
      crash_test: 'Crash test',
      pedestrian: 'Pedestrian impact',
      performance: 'Performance',
      buoyancy: 'Buoyancy',
      flight: 'Flight',
    },
    status: { approved: 'APPROVED', rejected: 'REJECTED', pending: 'PENDING' },
    verdict: { pass: 'ok', fail: 'failed', pending: '…' },
    board: { title: 'Certificate', test: 'Test', value: 'Measured', range: 'Range', verdict: 'Result', notRun: 'not run', running: 'running' },
    log: { start: 'Test {0}: {1}', result: '{0} · {1}: {2} {3} (range {4}) → {5}', signed: '{0} · {1}: {2} in the room', certified: '{0}: {1}', drive: 'Driving {0}: I starts the engine, F gets out', leave: 'Left the wheel', shift: 'Gearbox {0}, gear {1}' },
    cabin: {
      keys: 'W or ↑ accelerates · S or ↓ brakes (stopped, reverses) · A/D or ←/→ steer · Space handbrake · P pulls the handbrake · I ignition · M manual/automatic gearbox · E shifts up, Q down · G drive 4x2/4x4/auto 4x4 · L lamps (position, low) · K high beam · N fog · U cabin light · comma and period indicators · B hazard · O wipers · J seat belt · H horn · Y alarm · R radio · T radio/tape · F gets out',
      on: 'on',
      off: 'off',
      ignition: 'Engine',
      gearbox: 'Gearbox',
      gear: 'Gear',
      parkingBrake: 'Handbrake',
      driveMode: 'Drive',
      modes: { '4x2': '4x2', '4x4': '4x4', auto: 'automatic 4x4' },
      lights: 'Lamps',
      lampModes: { off: 'off', position: 'position', low: 'low beam', high: 'high beam' },
      fog: 'Fog lamps',
      interior: 'Cabin light',
      alarm: 'Alarm',
      alarmStates: { off: 'off', armed: 'armed', ringing: 'ringing' },
      radio: 'Sound',
      sources: { radio: 'radio', tape: 'tape' },
      indicator: 'Indicators',
      indicators: { off: 'off', left: 'left', right: 'right', hazard: 'hazard' },
      wipers: 'Wipers',
      wiperModes: { off: 'off', slow: 'slow', fast: 'fast' },
      seatbelt: 'Seat belt',
      refused: { no_four_wheel_drive: 'This vehicle has no 4x4', no_fog_lamps: 'This vehicle has no fog lamps', ignition_off: 'Start the engine first' },
    },
  },
}

export const fillText = (template: string, ...values: Array<string | number>): string => template.replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)] ?? ''))
