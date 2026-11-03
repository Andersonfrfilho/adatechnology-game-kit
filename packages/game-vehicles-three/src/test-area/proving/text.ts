/** Texts of the proving ground, in Brazilian Portuguese and English. */
export type ProvingText = {
  name: string
  controls: Record<'vehicle' | 'test' | 'camera' | 'time_scale' | 'visual_check', string>
  hints: Record<'vehicle' | 'test' | 'camera' | 'time_scale' | 'visual_check', string>
  actions: Record<'run_test' | 'run_all' | 'certify_now' | 'reverse_park' | 'sign_ok' | 'sign_fail' | 'reset', string>
  layers: Record<'mirrors' | 'reverse_camera' | 'scoreboard', string>
  metrics: Record<'speed' | 'time' | 'value' | 'passed' | 'failed' | 'pending' | 'status', string>
  cameras: Record<'room' | 'chase' | 'cockpit' | 'hood', string>
  tests: Record<string, string>
  status: Record<'approved' | 'rejected' | 'pending', string>
  verdict: Record<'pass' | 'fail' | 'pending', string>
  board: { title: string; test: string; value: string; range: string; verdict: string; notRun: string; running: string }
  log: { start: string; result: string; signed: string; certified: string }
}

export const PROVING_TEXT: Record<string, ProvingText> = {
  'pt-BR': {
    name: 'Banco de provas',
    controls: { vehicle: 'Veículo', test: 'Prova', camera: 'Câmera', time_scale: 'Velocidade da simulação', visual_check: 'Checagem visual' },
    hints: {
      vehicle: 'Veículo da frota que vai para a pista',
      test: 'Prova medida que o botão Rodar prova executa',
      camera: 'Sala: a câmera do jogador. Perseguição, cabine e capô seguem o veículo',
      time_scale: 'Quantas vezes mais rápido que o tempo real a prova roda',
      visual_check: 'O que você olhou e vai aprovar ou reprovar',
    },
    actions: { run_test: 'Rodar prova', run_all: 'Rodar todas na pista', certify_now: 'Homologar agora (sem animação)', reverse_park: 'Dar ré (câmera de ré)', sign_ok: 'Aprovar checagem visual', sign_fail: 'Reprovar checagem visual', reset: 'Limpar ficha' },
    layers: { mirrors: 'Retrovisores', reverse_camera: 'Câmera de ré', scoreboard: 'Painel da ficha' },
    metrics: { speed: 'Velocidade', time: 'Tempo da prova', value: 'Medição', passed: 'Aprovadas', failed: 'Reprovadas', pending: 'Pendentes', status: 'Situação (0 pend., 1 aprov., -1 reprov.)' },
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
    log: { start: 'Prova {0}: {1}', result: '{0} · {1}: {2} {3} (faixa {4}) → {5}', signed: '{0} · {1}: {2} na sala', certified: '{0}: {1}' },
  },
  en: {
    name: 'Proving ground',
    controls: { vehicle: 'Vehicle', test: 'Test', camera: 'Camera', time_scale: 'Simulation speed', visual_check: 'Visual check' },
    hints: {
      vehicle: 'Fleet vehicle that goes on the track',
      test: 'Measured test the Run test button runs',
      camera: 'Room: the player camera. Chase, cockpit and hood follow the vehicle',
      time_scale: 'How many times faster than real time the test runs',
      visual_check: 'What you looked at and will approve or refuse',
    },
    actions: { run_test: 'Run test', run_all: 'Run all on the track', certify_now: 'Certify now (no animation)', reverse_park: 'Reverse (reversing camera)', sign_ok: 'Approve visual check', sign_fail: 'Refuse visual check', reset: 'Clear certificate' },
    layers: { mirrors: 'Mirrors', reverse_camera: 'Reversing camera', scoreboard: 'Certificate board' },
    metrics: { speed: 'Speed', time: 'Test time', value: 'Measured', passed: 'Passed', failed: 'Failed', pending: 'Pending', status: 'Status (0 pending, 1 approved, -1 rejected)' },
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
    log: { start: 'Test {0}: {1}', result: '{0} · {1}: {2} {3} (range {4}) → {5}', signed: '{0} · {1}: {2} in the room', certified: '{0}: {1}' },
  },
}

export const fillText = (template: string, ...values: Array<string | number>): string => template.replace(/\{(\d+)\}/g, (_, i) => String(values[Number(i)] ?? ''))
