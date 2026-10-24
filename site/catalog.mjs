// What the landing page says about each example, area and package family, in pt-BR.
// `setup` runs inside the example page (window.__testRoom / window.__showroom) before its thumbnail is captured.

const roomRow = ({ ids, eye, target, z = -3, gap = 1.7 }) => `(() => {
  const r = window.__testRoom
  r.clear()
  const ids = ${JSON.stringify(ids)}
  ids.forEach((id, i) => r.spawn(id, [(i - (ids.length - 1) / 2) * ${gap}, 0, ${z}]))
  r.look(${JSON.stringify(eye)}, ${JSON.stringify(target)})
})()`

const showroomSpot = (entryId) => `(() => {
  const s = window.__showroom
  s.teleport(${JSON.stringify(entryId)})
  s.step(0.5)
})()`

export const EXAMPLES = [
  {
    name: 'test-room',
    title: 'Sala de testes',
    summary: 'Galpão em primeira pessoa onde qualquer módulo carrega seus objetos. Você pega, carrega, arremessa, atira, queima e desmonta, e cada comportamento fica num registro em JSON.',
    controls: 'WASD anda · clique olha · 1–0 troca a ferramenta · E pega · G arremessa',
    url: 'test-room/?ui=0',
    ready: 'window.__testRoom',
    setup: roomRow({ ids: ['chair', 'wooden_crate', 'concrete_block', 'small_tree'], eye: [0, 1.5, 0.6], target: [0, 0.6, -3] }),
    areas: [
      { id: 'furniture', title: 'Móveis', what: 'Cadeira, sofá, estante e TV antiga', setup: roomRow({ ids: ['chair', 'sofa', 'shelf', 'old_tv'], eye: [0, 1.5, 0.4], target: [0, 0.7, -3], gap: 2 }) },
      { id: 'structure', title: 'Estrutura', what: 'Chapa de aço, vidro, bloco de concreto, pilar de tijolo e a estrutura de prédio', setup: roomRow({ ids: ['steel_sheet', 'glass_pane', 'concrete_block', 'brick_column'], eye: [0, 1.6, 1.2], target: [0, 0.9, -3], gap: 2 }) },
      { id: 'containers', title: 'Recipientes', what: 'Caixote, tambor de aço, balde e botijão de gás', setup: roomRow({ ids: ['wooden_crate', 'steel_drum', 'plastic_bucket', 'gas_bottle'], eye: [0, 1.2, -0.6], target: [0, 0.4, -3], gap: 1.2 }) },
      { id: 'plants', title: 'Plantas', what: 'Árvore pequena e vaso com planta', setup: roomRow({ ids: ['small_tree', 'potted_plant'], eye: [0, 1.5, 0.2], target: [0, 1, -3], gap: 1.8 }) },
      { id: 'vehicles', title: 'Veículos', what: 'Porta de carro; o carro alugado entra pelo cenário do módulo de veículos', setup: roomRow({ ids: ['car_door'], eye: [1.1, 1.2, -1.2], target: [0, 0.6, -3] }) },
      { id: 'items', title: 'Itens', what: 'Xícara de café que derrama quando inclina', setup: roomRow({ ids: ['coffee_cup'], z: -1.2, eye: [0.15, 0.45, -0.75], target: [0, 0.05, -1.2] }) },
    ],
  },
  {
    name: 'interactables-showroom',
    title: 'Casa interativa',
    summary: 'Casa inteira para andar em primeira pessoa com 73 objetos que funcionam: portas e gavetas, energia por disjuntor, gás do botijão, caixa d’água, chuva, noite e vento.',
    controls: 'WASD anda · E interage · F pega · B abre a mochila',
    url: 'interactables-showroom/',
    ready: 'window.__showroom && window.__showroom.world',
    setup: showroomSpot('stove'),
    areas: [
      { id: 'kitchen', title: 'Cozinha', what: 'Geladeira, fogão com botijão, pia, armários e micro-ondas', setup: showroomSpot('stove') },
      { id: 'living', title: 'Sala', what: 'Sofá, poltrona, TV e tomadas', setup: showroomSpot('sofa') },
      { id: 'bedroom', title: 'Quarto', what: 'Cama de casal, criados-mudos, cômoda, guarda-roupa, persiana e cortina', setup: showroomSpot('bed_double') },
      { id: 'bathroom', title: 'Banheiro', what: 'Chuveiro, vaso, pia e armário', setup: showroomSpot('shower') },
      { id: 'laundry', title: 'Lavanderia', what: 'Máquina de lavar, tanque e o quadro de luz', setup: showroomSpot('washing_machine') },
      { id: 'yard', title: 'Quintal', what: 'Churrasqueira, varal, lixeiras, casinha do cachorro e caixa de correio', setup: showroomSpot('bbq') },
      { id: 'cabin', title: 'Cabana', what: 'Lareira, fogão a lenha, beliche, poço e casinha', setup: showroomSpot('wood_stove') },
      { id: 'camp', title: 'Acampamento', what: 'Fogueira, cadeiras, mesa, fogareiro, lampião e caixa térmica', setup: showroomSpot('campfire') },
    ],
  },
  {
    name: 'weapons-test-area',
    title: 'Área de armas',
    summary: 'As 121 armas e ferramentas do arsenal em balcões (78 com o modelo da Galeria 3D do Arsenal, os genéricos com o modelo da primeira marca que os aponta), alvos de aço, compensado e concreto, e a arma na mão: coice, rajada, ciclo do ferrolho e da corrediça, pane e destravar, trava, as sete recargas, cápsula e cartucho de cada calibre e o som de cada tiro (energia do calibre e distância). Granadas, foguetes, Claymore e C4 explodem pela regra do arsenal, e no canto leste barris, botijão e tanque de carro fazem a reação em cadeia. A bancada liga clarão, cápsulas e pentes, troca o estado da arma e a munição e mostra o calor. Acessórios: uma escolha por encaixe da arma na mão (só o que cabe nela: supressores, mira, empunhadura, bipé, lanterna, laser, carregadores, bandoleira, mochila de munição e o lança-granada sob o cano), coronha que dobra ou recolhe, lanterna com cone de luz, laser com feixe e ponto, tiro silenciado com o som abafado e a mira com zoom pela óptica.',
    controls: 'Mire numa arma e aperte H para equipar · clique atira ou arremessa · R recarrega · Q muda o modo (rajada) · X destrava a pane · B liga a trava · Y detona cargas postas · L liga a lanterna · K liga o laser · V dobra ou abre a coronha (sem coronha que mexe, é o chute) · U troca para o lança-granada sob o cano · botão direito mira (onde a arma não atira, agarra) · a bancada põe e tira acessórios por encaixe · E pega · G arremessa o que está na mão · barris no canto leste',
    url: 'weapons-test-area/',
    ready: 'window.__testRoom && window.__weaponsReport',
    // an M4 with a suppressor, a light and a laser, the last two on: what the accessory bench makes
    setup: `(() => { const r = window.__testRoom; const run = (s) => { for (let t = 0; t < s; t += 0.02) r.update(0.02) }; const bench = r.bench('weapons_area'); r.setTool('colt_m4a1'); run(0.6); bench.set('fit_muzzle', 'suppressor'); run(16); bench.set('fit_rail_left', 'weapon_light'); run(3); bench.set('fit_rail_right', 'laser_sight'); run(3); for (const code of ['KeyL', 'KeyK']) window.dispatchEvent(new KeyboardEvent('keydown', { code })); run(0.4); r.look([-1.5, 1.6, 6], [-2, 1.1, -7]); run(0.1) })()`,
    areas: [],
  },
  {
    name: 'items-test-area',
    title: 'Área de itens',
    summary: 'Os 327 itens do catálogo em prateleiras por categoria, todos no tamanho real: os 24 modelos do time de itens (lata de feijão, facão, rádio, botijão...) onde ele desenhou e a forma simples da categoria nos demais. No pedestal os 24 modelos giram, e uma régua de 1,55 m e uma silhueta humana de 1,80 m mostram a escala. A bancada mostra uma categoria por vez, gasta os itens (novo, usado, estragado), envelhece a comida por dias e armazenamento (a geladeira atrasa, a falta de energia não), sorteia o que um recipiente guarda por lugar, estado, dia do surto e semente (as pilhas vão para a mesa de achados) e fabrica receitas com o que elas pedem. Camadas: rótulos, caixas de tamanho e destaque das formas que ainda não têm modelo. Contadores de itens, chamadas de desenho e triângulos.',
    controls: 'Mesmos controles da sala de testes · a bancada escolhe a categoria, o desgaste, a idade e o armazenamento, o lugar, o recipiente, o estado, o dia do surto e a semente · "Sortear achados" põe as pilhas na mesa à direita · "Fabricar" faz a receita escolhida',
    url: 'items-test-area/',
    ready: 'window.__testRoom && window.__itemsReport',
    // the stand with the 24 models turning, the shelves behind it
    setup: `(() => { const r = window.__testRoom; r.openArea('items_area'); for (let t = 0; t < 1.2; t += 0.02) r.update(0.02); r.look([0, 2.4, 14.5], [0, 0.6, 7]); r.update(0.02) })()`,
    areas: [],
  },
  {
    name: 'audio-test-area',
    title: 'Área de som',
    summary: 'O motor de som do kit na sala de testes: qualquer som do banco (os do jogo, os da Cena de Arte, as armas, os materiais e os laços de motor, rotor e multidão) tocado a uma distância e direção do ouvinte ou a partir de uma sonda na área. A bancada liga e desliga reverb, compressor, pan e abafamento pela distância, troca a cadeia de mixagem (jogo ou Cena de Arte), solta uma tempestade de vinte vozes para o limite de vozes, mostra o nível de cada barramento e imprime o plano do som, número por número, da semente escolhida.',
    controls: 'Mesmos controles da sala de testes · a bancada escolhe o som, a origem (ajustes ou a sonda), a distância, a direção, o volume, a mixagem e a semente · "Tocar" e "Tempestade de vozes" · laço com nível e altura',
    url: 'audio-test-area/',
    ready: 'window.__testRoom && window.__audioReport',
    setup: `(() => { const r = window.__testRoom; r.openArea('audio_area'); for (let t = 0; t < 1.2; t += 0.02) r.update(0.02); r.look([0, 1.7, 3], [0, 1.4, -10]); r.update(0.02) })()`,
    areas: [],
  },
  {
    name: 'weather-test-area',
    title: 'Área de clima',
    summary: 'O clima do kit na sala de testes: os dez estados (de céu limpo a tufão) com troca de uma vez ou em 10 s, a hora do dia, o sorteio automático do clima a 600 vezes o tempo real e a semente. O clima é escrito no ambiente da sala (chuva, vento, névoa, visibilidade, noite, temperatura, chão molhado) e a bancada mostra o que o jogo lê dele: chuva em mm/h, visibilidade, escala de visão e de audição, vento, índice de calor, chão molhado e raios.',
    controls: 'Mesmos controles da sala de testes · a bancada escolhe o clima, a transição, a hora do dia, o sorteio automático e a semente · camadas: escrever no ambiente e névoa na cena',
    url: 'weather-test-area/',
    ready: 'window.__testRoom && window.__weatherReport',
    setup: `(() => { const r = window.__testRoom; r.openArea('weather_area'); r.bench('weather_area').set('state', 'storm'); for (let t = 0; t < 30; t += 0.1) r.update(0.1); r.look([0, 1.7, 4], [0, 1.2, -8]); r.update(0.02) })()`,
    areas: [],
  },
  {
    name: 'player-test-area',
    title: 'Área do jogador',
    summary: 'O corpo do jogador do jogo na sala de testes: a câmera da sala é o jogador, então andar e correr gastam e devolvem fôlego e os passos fazem ruído (3 m andando, 8 m correndo, vezes o ruído da ficha). A bancada dá um golpe, morde, agarra por trás (3 s para soltar com seis empurrões ou acertar a faca), derruba, faz o curativo, liga a infecção individual (desligada por padrão: mundo normal) e muda a ficha (agilidade, vigor), e mostra vida, fôlego, sangramento, feridas, estágio da infecção, pânico e a dispersão da mira.',
    controls: 'Mesmos controles da sala de testes · a bancada liga a infecção, muda agilidade, vigor e semente · Golpe, Mordida, Ser agarrado, Empurrar, Faca, Curativo, Derrubado, Agachar, Recomeçar',
    url: 'player-test-area/',
    ready: 'window.__testRoom && window.__playerReport',
    setup: `(() => { const r = window.__testRoom; r.openArea('player_area'); const b = r.bench('player_area'); b.act('hurt'); b.act('bite'); for (let t = 0; t < 1; t += 0.02) r.update(0.02); r.look([0, 1.7, 3], [0, 1.2, -8]); r.update(0.02) })()`,
    areas: [],
  },
  {
    name: 'characters-test-area',
    title: 'Área de personagens',
    summary: 'Os 13 tipos de morto-vivo e as profissões como corpos que a sala atinge: cada um tem o modelo de dano por segmento (corte na junta, osso quebrado que balança, perna que manca e rasteja, cabeça que mata, granada por raio), colete e capacete, ferimentos, olhos que brilham e o andar de cada tipo. Fileira de tiro com cinco corpos para a penetração e uma multidão instanciada de até mil. A bancada troca o modelo de penetração, a regra de morte, o golpe (calibres, facão, machado, granada a 1, 3 e 6 m), a proteção, o momento do zumbi e a pose, morde até virar (acelerado) e liga cápsulas, juntas, vetores de velocidade e só os olhos.',
    controls: 'Mesmos controles da sala de testes · a bancada tem o golpe, a proteção, o modelo de penetração e as ações curar, matar, morder e pôr 100 ou 1000 na multidão (leste)',
    url: 'characters-test-area/',
    ready: 'window.__testRoom && window.__charactersReport',
    setup: `(() => { const r = window.__testRoom; for (let t = 0; t < 1.2; t += 0.02) r.update(0.02); r.look([0, 5.5, 13], [0, 0.6, 3]); r.update(0.02) })()`,
    areas: [],
  },
  {
    name: 'animals-test-area',
    title: 'Área de animais',
    summary: 'As 13 espécies dos Bichos do Vale numa fila, desenhadas pelos construtores de verdade: estado vivo, infectado ou morto, andar e correr, juntas, vista aberta, anéis do alcance do som e do raio de atração da carcaça, a regra de surto (quem vira, quem morre, quem não sente) com relógio de mordida acelerado, e um campo de 40 bichos como pele de nós.',
    controls: 'Mesmos controles da sala de testes · a bancada troca o estado visual e o andar, morde todos os bichos e põe 40 bichos como pele de nós',
    url: 'animals-test-area/',
    ready: 'window.__testRoom && window.__animalsReport',
    setup: `(() => { const r = window.__testRoom; for (let t = 0; t < 1.2; t += 0.02) r.update(0.02); r.look([0, 4, 15], [0, 0.6, 0]); r.update(0.02) })()`,
    areas: [],
  },
  {
    name: 'interactables-test-area',
    title: 'Área de móveis na sala de testes',
    summary: 'Os móveis da casa carregados na sala de testes como um módulo: um objeto destrutível de cada tipo, com animações, líquidos e cenários prontos. A página leva também o módulo de armas, com os acessórios, para atirar, queimar e explodir os móveis com as armas de verdade.',
    controls: 'Mesmos controles da sala de testes · as armas e os acessórios da área de armas (L luz, K laser, V coronha, U lança-granada, botão direito mira) também estão aqui',
    url: 'interactables-test-area/',
    ready: 'window.__testRoom && window.__furnitureReport',
    setup: `(() => { const r = window.__testRoom; r.openArea('furniture_area'); r.look([0, 1.6, 4.2], [0, 0.6, -1]) })()`,
    areas: [],
  },
  {
    name: 'floorplan-test-area',
    title: 'Área de casas',
    summary: 'As casas dos quatro pacotes (residencial, comercial, rural e pós-apocalíptico) construídas no mundo de destruição da sala de testes: escolha a tipologia, a semente e o estado, entre pela porta com E, suba os andares, veja o nível de detalhe dividir um orçamento entre uma fileira de casas e derrube paredes a tiro ou com explosivo. Os seis cenários estruturais do time (um e dois pilares, divisória, vidro, caixa d\'água e botijão) e um que constrói todas as tipologias rodam na própria sala.',
    controls: 'Mesmos controles da sala de testes · a bancada escolhe pacote, tipologia, estado e semente, o nível de detalhe e o orçamento, o andar, o golpe (rajadas, marreta, C4, RPG) e as ações construir, entrar, subir, descer, porta, golpe e restaurar · E abre a porta mirada',
    url: 'floorplan-test-area/?arena=40',
    ready: 'window.__testRoom && window.__floorplanReport',
    setup: `(() => { const r = window.__testRoom; for (let t = 0; t < 1.2; t += 0.02) r.update(0.02); r.update(0.02) })()`,
    areas: [],
  },
  {
    name: 'vfx-test-area',
    title: 'Área de efeitos',
    summary: 'Todas as explosões do Lab e as receitas da Oficina de VFX numa bancada: sangue por idade de infecção, tiro na cabeça, desmembramento, clarão de boca e cápsulas por arma, impactos por material, vidro, portas, desabamento, incêndio, carro e os efeitos de tela. A bancada troca a variante da receita, repete sozinha, muda a distância, a faixa de LOD e a qualidade, liga e desliga as camadas e mostra a ficha e a linha do tempo do efeito, com os contadores de partículas, destroços e luzes contra o orçamento.',
    controls: 'A bancada escolhe o efeito, a variante, a distância, o LOD e a qualidade · Repetir toca de novo · Repetição automática · as camadas ligam fumaça, faíscas, brilhos, destroços, onda de choque e gotas',
    url: 'vfx-test-area/',
    ready: 'window.__testRoom && window.__vfxReport',
    setup: `(() => { const r = window.__testRoom; r.bench('vfx').set('effect', 'm67'); for (let t = 0; t < 0.5; t += 0.02) r.update(0.02) })()`,
    areas: [],
  },
]

export const FAMILIES = [
  { id: 'characters', title: 'Personagens', what: 'Corpo com 17 segmentos e dano por região, pessoas, uniformizados, mortos-vivos e a multidão instanciada, com feridas e olhos', packages: ['game-characters', 'game-characters-three', 'game-characters-people', 'game-characters-uniformed', 'game-characters-undead'], thumb: 'characters-test-area', seeIn: 'characters-test-area' },
  { id: 'animals', title: 'Animais', what: 'Treze espécies de quadrúpede, ave e cobra com andar, estados vivo, infectado e morto, e a regra de surto', packages: ['game-animals', 'game-animals-species', 'game-animals-three'], thumb: 'animals-test-area', seeIn: 'animals-test-area' },
  { id: 'destruction', title: 'Destruição e armas', what: 'Como cada material amassa, queima, derrete e quebra, e as armas reais que causam isso', packages: ['game-destruction', 'game-destruction-three', 'game-weapons', 'game-weapons-three'], thumb: 'weapons-test-area', seeIn: 'weapons-test-area' },
  { id: 'interactables', title: 'Objetos interativos', what: 'Portas, gavetas, energia, gás e água dos objetos da casa', packages: ['game-interactables', 'game-interactables-household', 'game-interactables-three'], thumb: 'interactables-showroom-kitchen', seeIn: 'interactables-showroom' },
  { id: 'floorplan', title: 'Plantas de casas', what: 'Cômodos, paredes, portas e janelas gerados por semente, com pacotes residencial, comercial, rural e pós-apocalíptico, a estrutura (pilares, vigas, telhado) que segura cada planta e o desenho 3D da casa, ligado à destruição', packages: ['game-floorplan', 'game-floorplan-residential', 'game-floorplan-commercial', 'game-floorplan-rural', 'game-floorplan-post-apocalyptic', 'game-floorplan-structure', 'game-floorplan-three'], thumb: 'floorplan-test-area', seeIn: 'floorplan-test-area' },
  { id: 'items', title: 'Itens', what: 'Comida, remédio, ferramenta, mochila, chave: o catálogo de itens com peso, validade, achados e receitas, o conteúdo pronto de 257 itens do time e o desenho de cada um no tamanho real', packages: ['game-items', 'game-items-goods', 'game-items-three'], thumb: 'items-test-area', seeIn: 'items-test-area' },
  { id: 'fluids', title: 'Líquidos', what: 'Recipientes com nível, temperatura e inclinação: encher, despejar, beber, derramar e vazar', packages: ['game-fluids', 'game-fluids-three'], thumb: 'test-room-containers', seeIn: 'test-room' },
  { id: 'vegetation', title: 'Vegetação', what: 'Árvores, palmeiras, cactos, flores e grama em low-poly, com cerca de 90 espécies prontas', packages: ['game-vegetation', 'game-vegetation-species'], thumb: 'test-room-plants', seeIn: 'test-room' },
  { id: 'vehicles', title: 'Veículos', what: 'Motor de veículos procedurais e uma frota de 69 modelos, de moto a caminhão', packages: ['game-vehicles', 'game-vehicles-fleet'], thumb: 'test-room-vehicles', seeIn: 'test-room' },
  { id: 'props', title: 'Objetos de cenário', what: 'Decoração, móveis modernos, quintal e estados da casa em low-poly', packages: ['game-props3d'], thumb: 'interactables-showroom-yard', seeIn: 'interactables-showroom' },
  { id: 'effects', title: 'Efeitos', what: 'Explosões, sangue, tiros, impactos, destruição, fogo e efeitos de tela, tocados por id e sorteados por semente', packages: ['game-vfx', 'game-vfx-three'], thumb: null, seeIn: 'vfx-test-area' },
  { id: 'audio', title: 'Som', what: 'Motor de som semeado: receitas de som como dado, plano puro e realização em WebAudio, barramentos, mixagem do jogo e da Cena de Arte, limite de vozes, pan e abafamento pela distância, laços', packages: ['game-audio'], thumb: 'audio-test-area', seeIn: 'audio-test-area' },
  { id: 'weather', title: 'Clima', what: 'Clima semeado: dez estados de céu limpo a tufão, climas com sorteio no tempo do jogo, frentes, raios com atraso do trovão, chão molhado, efeitos de jogo e índice de calor', packages: ['game-weather'], thumb: 'weather-test-area', seeIn: 'weather-test-area' },
  { id: 'player', title: 'Jogador', what: 'O corpo do jogador: ficha com atributos e derivados, fôlego, feridas e sangramento, curativo, agarrão com empurrão e faca, derrubada, pulo de muro baixo, ruído de passos, pânico, empurrão e golpe corpo a corpo, e a infecção individual como camada opcional', packages: ['game-player'], thumb: 'player-test-area', seeIn: 'player-test-area' },
  { id: 'camera', title: 'Câmera', what: 'Câmera de ombro, terceira e primeira pessoa, com a arma na mão', packages: ['game-camera'], thumb: 'test-room', seeIn: 'test-room' },
  { id: 'infection', title: 'Contágio', what: 'Modelo de epidemia por regiões, determinístico: zumbis, pragas, boatos', packages: ['game-infection'], thumb: null, seeIn: null },
  { id: 'base', title: 'Base e ferramentas', what: 'Contratos entre módulos, sala de testes reutilizável e ferramentas de teste dentro do jogo', packages: ['game-contracts', 'game-test-room', 'game-devtools'], thumb: 'test-room-furniture', seeIn: 'test-room' },
]

export const thumbFile = (key) => `thumbs/${key}.jpg`
