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
    summary: 'As 121 armas e ferramentas do arsenal em balcões (78 com o modelo da Galeria 3D do Arsenal, os genéricos com o modelo da primeira marca que os aponta), alvos de aço, compensado e concreto, e a arma na mão: coice, rajada, ciclo do ferrolho e da corrediça, pane e destravar, trava, as sete recargas, cápsula e cartucho de cada calibre e o som de cada tiro (energia do calibre e distância). Granadas, foguetes, Claymore e C4 explodem pela regra do arsenal, e no canto leste barris, botijão e tanque de carro fazem a reação em cadeia. A bancada liga clarão, cápsulas e pentes, troca o estado da arma e a munição e mostra o calor.',
    controls: 'Mire numa arma e aperte H para equipar · clique atira ou arremessa · R recarrega · Q muda o modo (rajada) · X destrava a pane · B liga a trava · Y detona cargas postas · E pega · G arremessa o que está na mão · barris no canto leste',
    url: 'weapons-test-area/',
    ready: 'window.__testRoom && window.__weaponsReport',
    setup: `(() => { window.__testRoom.setTool('ak_47') })()`,
    areas: [],
  },
  {
    name: 'interactables-test-area',
    title: 'Área de móveis na sala de testes',
    summary: 'Os móveis da casa carregados na sala de testes como um módulo: um objeto destrutível de cada tipo, com animações, líquidos e cenários prontos.',
    controls: 'Mesmos controles da sala de testes',
    url: 'interactables-test-area/',
    ready: 'window.__testRoom && window.__furnitureReport',
    setup: `(() => { const r = window.__testRoom; r.openArea('furniture_area'); r.look([0, 1.6, 4.2], [0, 0.6, -1]) })()`,
    areas: [],
  },
]

export const FAMILIES = [
  { id: 'destruction', title: 'Destruição e armas', what: 'Como cada material amassa, queima, derrete e quebra, e as armas reais que causam isso', packages: ['game-destruction', 'game-destruction-three', 'game-weapons', 'game-weapons-three'], thumb: 'weapons-test-area', seeIn: 'weapons-test-area' },
  { id: 'interactables', title: 'Objetos interativos', what: 'Portas, gavetas, energia, gás e água dos objetos da casa', packages: ['game-interactables', 'game-interactables-household', 'game-interactables-three'], thumb: 'interactables-showroom-kitchen', seeIn: 'interactables-showroom' },
  { id: 'floorplan', title: 'Plantas de casas', what: 'Cômodos, paredes, portas e janelas gerados por semente, com pacotes residencial, comercial e pós-apocalíptico', packages: ['game-floorplan', 'game-floorplan-residential', 'game-floorplan-commercial', 'game-floorplan-post-apocalyptic'], thumb: 'interactables-showroom-living', seeIn: 'interactables-showroom' },
  { id: 'fluids', title: 'Líquidos', what: 'Recipientes com nível, temperatura e inclinação: encher, despejar, beber, derramar e vazar', packages: ['game-fluids', 'game-fluids-three'], thumb: 'test-room-containers', seeIn: 'test-room' },
  { id: 'vegetation', title: 'Vegetação', what: 'Árvores, palmeiras, cactos, flores e grama em low-poly, com cerca de 90 espécies prontas', packages: ['game-vegetation', 'game-vegetation-species'], thumb: 'test-room-plants', seeIn: 'test-room' },
  { id: 'vehicles', title: 'Veículos', what: 'Motor de veículos procedurais e uma frota de 69 modelos, de moto a caminhão', packages: ['game-vehicles', 'game-vehicles-fleet'], thumb: 'test-room-vehicles', seeIn: 'test-room' },
  { id: 'props', title: 'Objetos de cenário', what: 'Decoração, móveis modernos, quintal e estados da casa em low-poly', packages: ['game-props3d'], thumb: 'interactables-showroom-yard', seeIn: 'interactables-showroom' },
  { id: 'camera', title: 'Câmera', what: 'Câmera de ombro, terceira e primeira pessoa, com a arma na mão', packages: ['game-camera'], thumb: 'test-room', seeIn: 'test-room' },
  { id: 'infection', title: 'Contágio', what: 'Modelo de epidemia por regiões, determinístico: zumbis, pragas, boatos', packages: ['game-infection'], thumb: null, seeIn: null },
  { id: 'base', title: 'Base e ferramentas', what: 'Contratos entre módulos, sala de testes reutilizável e ferramentas de teste dentro do jogo', packages: ['game-contracts', 'game-test-room', 'game-devtools'], thumb: 'test-room-furniture', seeIn: 'test-room' },
]

export const thumbFile = (key) => `thumbs/${key}.jpg`
