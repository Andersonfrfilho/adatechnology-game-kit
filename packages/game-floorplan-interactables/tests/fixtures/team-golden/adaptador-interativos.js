// AdaptadorInterativos: ponte entre o PlantasSDK (gerador de casas do jogo) e o kit de interativos
// (GameInteractables + GameInteractablesHousehold). Código do JOGO: nada disto vai para o kit.
//
// JS puro (IIFE que define `const AdaptadorInterativos`), sem imports e sem Math.random. Os globais do kit entram por `criar(...)`.
//
//   const A = AdaptadorInterativos.criar({ GameInteractables, GameInteractablesHousehold, locale: 'pt-BR', regiao: 'br' });
//   const plano = A.planejar(res, { andar });                    // dados puros, nada é desenhado
//   const mundo = A.criarMundo(res, { agua, semente, onEvent, luzesLigadas }); // World do kit com textos, itens, loot e rede de água
//   A.adicionar(mundo, plano, { construir, bloqueado });         // adiciona tudo e ajusta as portas contra as paredes
//
// Convenções (README do PlantasSDK, "Coordenadas"): x = origemX + u, z = origemZ + inw * v, ry = atan2(fu, inw * fv).
// A frente do objeto do kit é o +z local, igual à frente (fu, fv) do móvel do PlantasSDK; por isso a geladeira encostada na parede
// do fundo fica de costas para ela. `inw` vale 1 por padrão (v cresce para os fundos).
const AdaptadorInterativos = (function () {
  'use strict';

  const VERSAO = '0.3.0';

  // ---------------------------------------------------------------------------------------------------------------------------
  // Tabelas
  // ---------------------------------------------------------------------------------------------------------------------------

  // tipo do PlantasSDK -> como vira objeto do kit. `t` = tipo household. `composto` = vira mais de um objeto.
  // `dim` diz quais medidas do móvel vão para o desenho: 'wdh' (padrão), 'wd' (largura e profundidade: o PlantasSDK dá a altura da base,
  // não a do desenho completo, como o box de 10 cm ou o banco de 50 cm sem encosto), 'wh', ou 'padrao' (nenhuma, nem a altura y).
  const MAPA_TIPOS = {
    geladeira: { t: 'fridge' },
    geladeira2: { t: 'fridge' },
    geladeira_med: { t: 'fridge', variant: 'steel' },
    refrig_exp: { t: 'fridge', variant: 'steel' },
    freezer: { t: 'fridge_compact' },
    armario_cozinha: { composto: 'pia' },
    armario_cozinha_p: { composto: 'pia' },
    armario_cozinha_g: { composto: 'pia' },
    pia_b: { composto: 'pia_b' },
    pia_coluna: { composto: 'pia_b' },
    guarda: { t: 'wardrobe' },
    guarda_peq: { t: 'wardrobe' },
    guarda_g: { t: 'wardrobe' },
    guarda_closet: { t: 'wardrobe' },
    comoda: { t: 'dresser' },
    criado: { t: 'nightstand' },
    despensa: { t: 'pantry' },
    armario_lav: { t: 'pantry' },
    cristaleira: { t: 'pantry' },
    arquivo: { t: 'dresser' },
    aparador_c: { t: 'dresser' },
    rack: { t: 'kitchen_cabinet_base' },
    rack_peq: { t: 'kitchen_cabinet_base' },
    rack_grande: { t: 'kitchen_cabinet_base' },
    fogao: { t: 'stove' },
    fogao4: { t: 'stove' },
    botijao_gas: { t: 'gas_bottle', dim: 'padrao' },
    botijao: { t: 'gas_bottle', dim: 'padrao' },
    tv: { t: 'tv' },
    tv_grande: { t: 'tv' },
    microondas: { t: 'microwave' },
    maquina: { t: 'washing_machine' },
    box: { t: 'shower', dim: 'wd' },
    box_g: { t: 'shower', dim: 'wd' },
    vaso: { t: 'toilet', dim: 'wd' },
    tanque: { t: 'utility_sink', dim: 'wd' },
    sofa2: { t: 'sofa' },
    sofa3: { t: 'sofa' },
    sofa_l: { t: 'sofa' },
    sofa_xl: { t: 'sofa' },
    poltrona: { t: 'armchair' },
    poltrona_alta: { t: 'armchair' },
    banqueta: { t: 'dining_chair' },
    cadeira_camping: { t: 'camp_chair', dim: 'wd' },
    cadeira_balanco: { t: 'armchair' },
    pia_rustica: { composto: 'pia_rustica' }, // cuba da cabana/barraco: a cuba na largura toda, sem armário embaixo; armário aéreo só se há conteudoAereo
    cama_improvisada: { t: 'bed_single', dim: 'wd' },
    banco_tronco: { t: 'bench', dim: 'wd' },
    prateleira_tabua: { t: 'pantry', variant: 'garage' },
    aparador: { t: 'dresser' },
    bufe: { t: 'dresser' },
    cama_solteiro: { t: 'bed_single', dim: 'wd' },
    cama_casal: { t: 'bed_double', dim: 'wd' },
    cama_queen: { t: 'bed_double', dim: 'wd' },
    cama_king: { t: 'bed_double', dim: 'wd' },
    banco: { t: 'bench', dim: 'wd' },
    banco_jardim: { t: 'bench', dim: 'wd' },
    espera: { t: 'bench', dim: 'wd' },
    persiana: { t: 'blinds' },
    cortina: { t: 'curtain' },
    lixeira: { t: 'trash_bin' },
    lixeira_ext: { t: 'wheelie_bin' },
    caixa_correio: { t: 'mailbox', dim: 'padrao' }, // o household desenha a caixa no poste: só posição e rotação
    casinha_cachorro: { t: 'dog_house' },
    churrasqueira: { t: 'bbq', dim: 'wd' },
    churrasqueira_simples: { t: 'bbq', dim: 'wd' },
    varal: { t: 'clothesline', dim: 'wh' },
    estante_ferr: { t: 'pantry', variant: 'garage' },
    bancada_ferr: { t: 'pantry', variant: 'garage' },
    // casas rurais e acampamento (tipos do pacote household 0.1.x: rural e camp)
    beliche: { t: 'bunk_bed', dim: 'wd' },
    fogao_lenha: { t: 'wood_stove', dim: 'wd' }, // o tubo sobe até `res.chamine.altura` (cabana); a lareira está em planejarSimples (muda de lugar e de altura)
    lareira: { t: 'fireplace', dim: 'w' },
    privada: { t: 'outhouse', dim: 'wdh' },
    poco: { t: 'well', dim: 'padrao' },
    cooler: { t: 'cooler', dim: 'wd' },
    fogueira: { t: 'campfire', dim: 'wd' },
    fogareiro: { t: 'camp_stove', dim: 'wd' },
    botijao_camping: { t: 'gas_canister', dim: 'padrao' },
    mesa_camping: { t: 'camp_table', dim: 'wdh' },
    // lampiões a querosene/gás: dispositivo `lamp` sem eletricidade (a rede não importa); o de teto é o `hanging`
    lampiao: { t: 'lantern_lamp', dim: 'x' },
    lampiao_camping: { t: 'lantern_lamp', dim: 'x' },
    lampiao_teto: { t: 'lantern_lamp', variant: 'hanging', dim: 'x' },
    // lâmpadas: objetos do adaptador (o kit não tem malha de lâmpada; o renderizador da casa desenha a luminária)
    plafon: { t: 'lamp', watts: 15 },
    pendente: { t: 'lamp', watts: 20 },
    spot_trilho: { t: 'lamp', watts: 10 },
    lustre: { t: 'lamp', watts: 60 },
    luminaria: { t: 'lamp', watts: 12 },
    abajur: { t: 'lamp', watts: 9 },
  };

  // mesas que ganham cadeiras do kit (o PlantasSDK não coloca cadeiras em volta delas). `jantar`: cadeiras nos dois lados compridos (e nas pontas
  // se a mesa tem 1,6 m ou mais); `escritorio`: uma poltrona do lado da frente da mesa. O adaptador só põe a cadeira onde cabe (parede e outros móveis).
  const MESAS_COM_CADEIRAS = {
    mesa: 'jantar', mesa_peq: 'jantar', mesa_red: 'jantar', mesa_grande: 'jantar', mesa_gourmet: 'jantar', mesa_gourmet_peq: 'jantar', mesa_ext: 'jantar',
    mesa_escr: 'escritorio', mesa_escr_g: 'escritorio', escrivaninha: 'escritorio',
  };
  const CADEIRA = 0.45; // lado da cadeira de jantar do pacote (m)

  // conteudo[].tipo do PlantasSDK -> item do catálogo household. O nome original fica em data.nome_pt.
  const MAPA_CONTEUDO = {
    // comida
    acucar: 'sugar', arroz: 'rice', biscoito: 'biscuits', cafe: 'coffee', carne: 'frozen_meat', farinha: 'flour', feijao: 'beans',
    fruta: 'apple', iogurte: 'yogurt', lata_atum: 'canned_food', lata_milho: 'canned_food', leite: 'milk_carton', macarrao: 'pasta',
    oleo: 'cooking_oil', ovos: 'eggs', queijo: 'cheese', sobras: 'bowl', sorvete: 'ice_cream', tempero: 'salt',
    // água e bebida
    agua_galao: 'water_bottle', agua_garrafa: 'water_bottle', refrigerante: 'soda_can',
    // remédio
    alcool: 'alcohol_70', curativo: 'bandage', insulina: 'first_aid_kit', paracetamol: 'painkillers', remedio: 'painkillers',
    // limpeza e higiene
    agua_sanitaria: 'bleach', desinfetante: 'bleach', detergente: 'detergent', escova_dente: 'toothbrush', esponja: 'sponge',
    luvas: 'sponge', papel_higienico: 'toilet_paper', sabao_po: 'detergent', sabonete: 'soap', shampoo: 'shampoo',
    // roupa
    calca: 'jeans', camisa: 'tshirt', camiseta: 'tshirt', casaco: 'jacket', cobertor: 'blanket', meias: 'socks',
    roupa_intima: 'underwear', sapato: 'sneakers', tenis: 'sneakers',
    // utensílios
    caneca: 'cup', copo: 'cup', prato: 'plate', taca: 'cup', panela: 'pot',
    // ferramentas e eletrônicos
    alicate: 'screwdriver', balde: 'paint_can', cabos: 'phone_charger', caneta: 'pen', carregador: 'phone_charger',
    chave_fenda: 'screwdriver', chaves: 'wallet', controle_remoto: 'batteries', corda: 'rope', fita_isolante: 'duct_tape',
    lanterna: 'flashlight', mochila: 'backpack', oculos: 'wallet', parafusos: 'duct_tape', pilhas: 'batteries', pregos: 'duct_tape',
    // armas improvisadas
    faca: 'knife', grampeador: 'scissors', martelo: 'hammer', serrote: 'hammer', tesoura: 'scissors', vassoura: 'rope',
    // papéis
    carta: 'letter', conta: 'bill', documento: 'documents', dvd: 'notebook', livro: 'notebook',
    // lixo
    comida_estragada: 'food_scraps', embalagem: 'plastic_bag', lixo_diverso: 'crumpled_paper', lata_tinta: 'paint_can',
    lata_vazia: 'empty_can', panfleto: 'flyer', papel_amassado: 'crumpled_paper', saco_lixo: 'plastic_bag', saco_lixo_cheio: 'plastic_bag',
  };

  // Quando o tipo do conteúdo não está na tabela: o item mais próximo pela categoria do PlantasSDK.
  const CONTEUDO_POR_CATEGORIA = {
    comida: 'canned_food', agua: 'water_bottle', remedio: 'painkillers', ferramenta: 'duct_tape', arma_improvisada: 'hammer',
    roupa: 'tshirt', documento: 'documents', limpeza: 'detergent', lixo: 'crumpled_paper', utensilio: 'plate',
  };

  const congelado = (s) => s.tipo === 'sorvete' || (s.tipo === 'carne' && /congel/i.test(s.nome_pt || ''));

  // Ordem de preferência dos recipientes do objeto para cada pilha (o primeiro com vaga que cabe leva a pilha).
  const PREFERENCIA = {
    fridge: (s) => (congelado(s) ? ['freezer', 'fridge'] : ['fridge', 'freezer']),
    fridge_compact: (s) => (congelado(s) ? ['freezer', 'fridge'] : ['fridge', 'freezer']),
    kitchen_cabinet_base: (s) => (s.categoria === 'arma_improvisada' || s.categoria === 'ferramenta' ? ['drawer', 'cupboard'] : ['cupboard', 'drawer']),
    wardrobe: (s) => (s.tipo === 'roupa_intima' || s.tipo === 'meias' ? ['drawer_1', 'drawer_2', 'drawer_3', 'shelves'] : ['shelves', 'drawer_1', 'drawer_2', 'drawer_3']),
  };

  // Último recurso quando nada da categoria cabe nas vagas do objeto (a caixa de correio só guarda papel fino).
  const SUBSTITUTOS_DO_OBJETO = { mailbox: ['flyer', 'postcard', 'letter'] };

  // ponto da hidráulica -> fixtures do objeto household que o consomem
  const FIXTURE_DO_PONTO = {
    torneira: ['tap'],
    chuveiro: ['shower'],
    descarga: ['flush'],
    tanque: ['tap', 'basin'],
    maquina: ['inlet'],
  };

  // objetos que o kit não tem e o adaptador cria direto (sem passar por `construir`)
  const TIPOS_DO_ADAPTADOR = { lamp: true, gas_piped: true };

  const r3 = (n) => Math.round(n * 1000) / 1000;

  function criar(opts) {
    opts = opts || {};
    const GI = opts.GameInteractables;
    const HH = opts.GameInteractablesHousehold;
    if (!GI || !HH) throw new Error('AdaptadorInterativos.criar precisa de GameInteractables e GameInteractablesHousehold');
    const locale = opts.locale || 'pt-BR';
    const regiao = opts.regiao || 'br';
    const hh = HH.createHousehold({ locale, region: regiao });
    const tiposHH = new Set(hh.types.map((t) => t.id));
    const mundos = new WeakMap(); // mundo -> { pontos: Map(fixtureGlobal -> ponto), agua }

    // ---- geometria ------------------------------------------------------------------------------------------------------
    function conv(o) {
      return {
        x: (u) => r3(o.ox + u),
        z: (v) => r3(o.oz + o.inw * v),
        ry: (fu, fv) => r3(Math.atan2(fu, o.inw * fv)),
        // deslocamento local (lx, lz) de um objeto com rotação ry -> deslocamento no mundo (mesma convenção do three.js)
        off: (ry, lx, lz) => [Math.cos(ry) * lx + Math.sin(ry) * lz, -Math.sin(ry) * lx + Math.cos(ry) * lz],
      };
    }

    function pisoDe(res, o, andar) {
      if (andar == null || andar < 0) return o.base;
      const a = (res.andares || []).find((x) => x.indice === andar);
      return r3(o.base + (a ? a.y0 : 0));
    }

    function corDe(res, cor) {
      if (cor == null) return undefined;
      if (typeof cor === 'number') return cor;
      const v = res.cores && res.cores[cor];
      return typeof v === 'number' ? v : undefined;
    }

    function paletaDe(res) {
      const c = res.cores || {};
      const p = {};
      if (c.madeira != null) p.wood = c.madeira;
      if (c.tecido_principal != null) p.fabric_main = c.tecido_principal;
      if (c.tecido_acento != null) p.fabric_accent = c.tecido_acento;
      if (c.metal != null) p.metal = c.metal;
      return p;
    }

    // ---- estado inicial das luzes ---------------------------------------------------------------------------------------
    // `luzesLigadas`: boolean ou (idDaLampada, entrada) => boolean, nas opções de planejar, criarMundo ou adicionar (a última que aparecer vence).
    // Sem ela: apagadas, a menos que `noite: true` em planejar; aí acendem as lâmpadas de uma casa com rede elétrica e luz elétrica que não
    // está abandonada (casa abandonada, sem rede ou com lampião/lanterna: apagadas).
    function luzesDoEstado(res) {
      const en = res.energia;
      return res.estado !== 'abandonada' && !!res.eletrica && !(en && en.iluminacao && en.iluminacao !== 'eletrica');
    }

    function luzInicial(res, popts, id, entry) {
      const v = popts && popts.luzesLigadas;
      if (typeof v === 'function') return !!v(id, entry);
      if (typeof v === 'boolean') return v;
      return !!(popts && popts.noite) && luzesDoEstado(res);
    }

    // ---- conteúdo -------------------------------------------------------------------------------------------------------
    const itemDoConteudo = (c) => MAPA_CONTEUDO[c.tipo] || CONTEUDO_POR_CATEGORIA[c.categoria] || 'crumpled_paper';

    const volume = (d) => d.size[0] * d.size[1] * d.size[2];
    const candidatos = (id, tipoObjeto) => {
      const def = hh.items[id];
      const irmaos = Object.values(hh.items)
        .filter((i) => i.category === def.category && i.id !== id)
        .sort((a, b) => volume(a) - volume(b) || (a.id < b.id ? -1 : 1));
      return [id].concat(irmaos.map((i) => i.id), SUBSTITUTOS_DO_OBJETO[tipoObjeto] || []);
    };

    // Distribui as pilhas do PlantasSDK nas vagas dos recipientes (sondados com o gravador, sem desenhar nada).
    // Todos os recipientes do objeto recebem lista explícita (vazia onde não coube nada): o sorteio do kit não entra.
    function distribuir(tipo, itemSonda, pilhas) {
      const spec = hh.build(tipo, itemSonda, HH.createRecorder().api);
      const conts = spec.containers || [];
      const contents = {};
      for (const c of conts) contents[c.id] = c.slots.map(() => null);
      const rejeitadas = [];
      const pref = PREFERENCIA[tipo];
      for (const p of pilhas || []) {
        const original = itemDoConteudo(p);
        const ordem = (pref ? pref(p) : []).concat(conts.map((c) => c.id));
        let colocou = false;
        // o item pedido primeiro; se não cabe em vaga nenhuma, o menor da mesma categoria que caiba
        for (const id of candidatos(original, tipo)) {
          const def = hh.items[id];
          const qtd = Math.max(1, Math.min(p.qtd || 1, (def && def.stack) || 1));
          for (const cid of ordem) {
            const c = conts.find((x) => x.id === cid);
            if (!c) continue;
            for (let i = 0; i < c.slots.length && !colocou; i++) {
              if (contents[cid][i] || !GI.fitsSlot(id, c.slots[i], hh.items)) continue;
              const data = { nome_pt: p.nome_pt, origem: p.tipo, categoria: p.categoria, pegavel: p.pegavel !== false };
              if (id !== original) data.substituto_de = original;
              contents[cid][i] = { type: id, qty: qtd, data };
              colocou = true;
            }
            if (colocou) break;
          }
          if (colocou) break;
        }
        if (!colocou) rejeitadas.push(p);
      }
      return { contents, rejeitadas };
    }

    // ---- planejar -------------------------------------------------------------------------------------------------------
    function planejar(res, popts) {
      popts = popts || {};
      const o = { ox: popts.origemX || 0, oz: popts.origemZ || 0, inw: popts.inw || 1, base: popts.base || 0 };
      const K = conv(o);
      const andarSel = popts.andar;
      const externos = popts.externos !== false;
      const semente = popts.semente != null ? popts.semente : res.semente;
      const paleta = paletaDe(res);
      const noAndar = (a, externo) => andarSel == null || a === andarSel || ((externo || a < 0) && externos);
      const eletrica = res.eletrica || null;
      const circuitos = (eletrica && eletrica.circuitos) || [];

      const plano = {
        versao: VERSAO,
        template: res.template,
        semente: res.semente,
        andar: andarSel == null ? null : andarSel,
        itens: [],
        tomadas: [], // ids das entradas wall_socket
        interruptores: [], // ids das entradas wall_switch
        luzes: [], // ids das lâmpadas (internas e externas)
        lampioes: [], // ids dos lampiões (lantern_lamp): luz a querosene/gás, sem rede
        canisters: [], // ids dos botijões pequenos do camping (gas_canister)
        entradaEnergia: null,
        quadro: null, // id da entrada electrical_panel (quadro de distribuição)
        medidor: null, // id da entrada power_meter (caixa do medidor na fachada ou no pilar)
        conduites: [],
        botijoes: [], // { id, fogao, local }
        fogoes: [],
        fixtures: [], // { objeto, fixture, global, ponto, tipoPonto }
        pontos: {}, // fixture global -> ponto da hidráulica
        mapeados: [], // ids de móveis do PlantasSDK que viraram objetos do kit (o renderizador não precisa desenhá-los)
        cadeiras: [], // ids das cadeiras que o adaptador colocou em volta das mesas (origem = a mesa, que o renderizador continua desenhando)
        naoMapeados: {}, // "categoria/tipo" -> quantidade
        descartados: 0, // pilhas de conteudo que não couberam em nenhuma vaga
        avisos: [],
        origem: { x: o.ox, z: o.oz, inw: o.inw, base: o.base },
      };
      const porOrigem = new Map(); // id do PlantasSDK -> entradas

      const seedDe = (id) => GI.hashString(String(semente) + ':' + id);

      function empurrar(e) {
        plano.itens.push(e);
        if (!porOrigem.has(e.origem)) porOrigem.set(e.origem, []);
        porOrigem.get(e.origem).push(e);
        return e;
      }

      function baseItem(m) {
        const item = {
          x: K.x(m.x),
          z: K.z(m.z),
          ry: m.fu != null ? K.ry(m.fu, m.fv) : r3(m.ry || 0),
          w: m.w,
          d: m.d,
          h: m.h,
          y: m.y || 0,
          seed: seedDe(m.id),
          palette: paleta,
        };
        const cor = corDe(res, m.cor);
        if (cor != null) item.color = cor;
        return item;
      }

      function entrada(id, tipo, item, origem, andar, extra) {
        return Object.assign({ id, tipo, item, origem, andar, piso: pisoDe(res, o, andar), ligacoes: {} }, extra || {});
      }

      // Guarda as pilhas no primeiro destino que as comporta; o que não coube segue para o próximo destino. Todo destino recebe lista
      // explícita (vazia onde não coube nada: o sorteio do kit não entra). O que sobrar no fim é contado em `descartados`.
      function guardar(destinos, pilhas) {
        let resto = pilhas || [];
        for (const [tipo, item] of destinos) {
          const d = distribuir(tipo, item, resto);
          item.contents = Object.assign(item.contents || {}, d.contents);
          resto = d.rejeitadas;
        }
        plano.descartados += resto.length;
      }

      // botijões "sob a bancada": o PlantasSDK os põe no vão do fogão (`sobre` é o slot do fogão, `oculto`); quem os esconde é o armário
      // de baixo da cozinha mais próximo (kitchen_cabinet_base: a pia com armário ou o rack). O registro só funciona com a porta
      // desse armário aberta: `requires: { object, part }` (o kit leva isso até InteractionSpec.requires).
      const escondidos = [];
      function distRetangulo(c, x, z) {
        const dx = x - c.item.x;
        const dz = z - c.item.z;
        const s = Math.sin(c.item.ry);
        const co = Math.cos(c.item.ry);
        const lx = dx * co - dz * s;
        const lz = dx * s + dz * co;
        return Math.hypot(Math.max(Math.abs(lx) - (c.item.w || 0) / 2, 0), Math.max(Math.abs(lz) - (c.item.d || 0) / 2, 0));
      }
      function esconderBotijoes() {
        for (const b of escondidos) {
          let alvo = null;
          for (const c of plano.itens) {
            if (c.tipo !== 'kitchen_cabinet_base' || c.andar !== b.andar) continue;
            const dist = distRetangulo(c, b.item.x, b.item.z);
            if (!alvo || dist < alvo.dist) alvo = { c, dist };
          }
          if (!alvo) {
            plano.avisos.push('botijão ' + b.id + ' sob a bancada sem armário de cozinha para escondê-lo');
            continue;
          }
          // a porta cujo trinco (interação toggle_part de uma peça de dobradiça) está mais perto do botijão, em coordenadas do mundo
          const c = alvo.c;
          const spec = hh.build(c.tipo, c.item, HH.createRecorder().api);
          const sn = Math.sin(c.item.ry);
          const cs = Math.cos(c.item.ry);
          let porta = null;
          for (const it of spec.interactions || []) {
            const pt = it.action && it.action.do === 'toggle_part' ? (spec.parts || []).find((q) => q.id === it.action.part) : null;
            if (!pt || pt.motion.kind !== 'hinge') continue;
            const wx = c.item.x + it.pos[0] * cs + it.pos[2] * sn;
            const wz = c.item.z - it.pos[0] * sn + it.pos[2] * cs;
            const dist = Math.hypot(wx - b.item.x, wz - b.item.z);
            if (!porta || dist < porta.dist) porta = { id: pt.id, dist };
          }
          if (!porta) {
            plano.avisos.push('armário ' + c.id + ' sem porta para o botijão ' + b.id);
            continue;
          }
          b.item.requires = { object: c.id, part: porta.id };
        }
      }

      // lampião: acende com `luzesLigadas` (como as lâmpadas) ou à noite numa casa que não está abandonada
      function luzInicialLampiao(id, entry) {
        const v = popts.luzesLigadas;
        if (typeof v === 'function') return !!v(id, entry);
        if (typeof v === 'boolean') return v;
        return !!popts.noite && res.estado !== 'abandonada';
      }

      // lareira: o pacote desenha a lareira inteira (fornalha com 45 cm de fundo, lareira de piso e peito da chaminé até o forro), com 1,0 m de
      // profundidade; o PlantasSDK reserva só a parede de 0,5 m. Fica com as costas na parede: o centro avança metade da diferença. A fumaça
      // sai no topo da chaminé de fora (`res.chamine`), que o renderizador da casa continua desenhando.
      function planejarLareira(m, e, item) {
        const def = hh.types.find((t) => t.id === 'fireplace');
        const falta = (def.d - m.d) / 2;
        item.x = r3(item.x + Math.sin(item.ry) * falta);
        item.z = r3(item.z + Math.cos(item.ry) * falta);
        const com = (res.comodos || []).find((c) => c.id === m.comodo);
        const a = (res.andares || []).find((x) => x.indice === m.andar);
        item.h = r3((com && com.pe) || (a && a.pe) || 2.6);
        const ch = res.chamine;
        if (ch && ch.lareira === m.id) {
          if (ch.material === 'stone') item.variant = 'stone';
          const cx = K.x((ch.aabb[0] + ch.aabb[2]) / 2);
          const cz = K.z((ch.aabb[1] + ch.aabb[3]) / 2);
          // topo da chaminé de fora, em coordenadas do mundo (o y é absoluto do plano + a base)
          e.ligacoes.topoChamine = [cx, r3(o.base + ch.altura), cz];
        }
      }

      function planejarSimples(m, mapa) {
        const item = baseItem(m);
        const dim = mapa.dim === 'padrao' ? '' : mapa.dim || 'wdh';
        for (const k of ['w', 'd', 'h']) if (dim.indexOf(k) < 0) delete item[k];
        if (mapa.dim === 'padrao') delete item.y;
        if (mapa.variant) item.variant = mapa.variant;
        // a TV do PlantasSDK é uma lâmina de 10 cm: o desenho precisa de pelo menos o pé
        if (mapa.t === 'tv') item.d = Math.max(item.d || 0, 0.2);
        const e = entrada(m.id, mapa.t, item, m.id, m.andar);
        if (m.conteudo) guardar([[mapa.t, item]], m.conteudo);
        if (m.tomada) e.ligacoes.tomada = m.tomada;
        if (mapa.t === 'shower') e.ligacoes.chuveiro = m.chuveiro || { eletrico: false };
        if (mapa.t === 'stove') {
          plano.fogoes.push(e.id);
          e.ligacoes.gas = m.gas || 'botijao';
          e.ligacoes.botijao = m.botijao || null;
        }
        if (mapa.t === 'gas_bottle') plano.botijoes.push({ id: e.id, fogao: m.liga || null, local: m.local || null });
        if (mapa.t === 'gas_canister') {
          plano.canisters.push(e.id);
          if (res.gas && res.gas.botijao === m.id && res.gas.fogareiro) plano.botijoes.push({ id: e.id, fogao: res.gas.fogareiro, local: null }); // o fogareiro usa este botijão
        }
        if (mapa.t === 'wood_stove') {
          // o tubo do fogão a lenha sai pelo telhado: sobe até a altura do topo da chaminé (`res.chamine.altura`, y absoluto do plano)
          const ch = res.chamine;
          if (ch && ch.fogao === m.id && ch.altura) {
            const a = (res.andares || []).find((x) => x.indice === m.andar);
            const alto = r3(ch.altura - (a ? a.y0 : 0) - (m.y || 0));
            item.h = alto;
            item.flueHeight = alto;
          }
        }
        if (mapa.t === 'fireplace') planejarLareira(m, e, item);
        if (mapa.t === 'lantern_lamp') {
          e.ligada = luzInicialLampiao(m.id, e);
          item.on = e.ligada;
          plano.lampioes.push(e.id);
        }
        if (mapa.t === 'gas_bottle' && m.local === 'sob_bancada') escondidos.push(e);
        empurrar(e);
      }

      // pia: cuba + armário de baixo (+ armário aéreo). pia_b: cuba do banheiro (+ armário de parede quando há conteúdo).
      function planejarComposto(m, kind) {
        const ry = m.fu != null ? K.ry(m.fu, m.fv) : r3(m.ry || 0);
        const cx = K.x(m.x);
        const cz = K.z(m.z);
        const parte = (id, tipo, w, d, h, y, lx, lz) => {
          const [dx, dz] = K.off(ry, lx, lz);
          const item = baseItem(m);
          item.x = r3(cx + dx);
          item.z = r3(cz + dz);
          item.ry = ry;
          item.w = r3(w);
          item.d = r3(d);
          item.h = r3(h);
          item.y = y;
          item.seed = seedDe(id);
          return entrada(id, tipo, item, m.id, m.andar);
        };
        const lista = [];
        if (kind === 'pia_rustica') {
          const dd = Math.max(m.d, 0.56); // o desenho da cuba precisa de pelo menos 56 cm de fundo; cresce para a frente e as costas ficam na parede
          const cuba = parte(m.id, 'sink_kitchen', m.w, dd, m.h + 0.3, 0, 0, -(dd - m.d) / 2);
          lista.push(cuba);
          const aer = m.conteudoAereo || [];
          if (m.aereo !== false && aer.length) {
            const aereo = parte(m.id + '#aereo', 'kitchen_cabinet_wall', m.w, 0.35, 0.6, 1.55, 0, -(m.d / 2) + 0.175);
            guardar([['kitchen_cabinet_wall', aereo.item]], aer);
            lista.push(aereo);
          }
          if (m.conteudo) guardar([['sink_kitchen', cuba.item]], m.conteudo);
          if (m.tomada) cuba.ligacoes.tomada = m.tomada;
        } else if (kind === 'pia') {
          const larg = m.w;
          const cuba = larg >= 1.5 ? 1.0 : Math.max(0.6, Math.min(0.8, larg - 0.3));
          const resto = r3(larg - cuba);
          const esq = seedDe(m.id) % 2 === 0; // lado da cuba, decidido pela semente
          const pia = parte(m.id, 'sink_kitchen', cuba, m.d, m.h + 0.25, 0, esq ? -(larg / 2) + cuba / 2 : larg / 2 - cuba / 2, 0);
          lista.push(pia);
          let armario = null;
          if (resto >= 0.35) {
            armario = parte(m.id + '#armario', 'kitchen_cabinet_base', resto, m.d, m.h, 0, esq ? larg / 2 - resto / 2 : -(larg / 2) + resto / 2, 0);
            lista.push(armario);
          }
          if (m.conteudo) guardar(armario ? [['kitchen_cabinet_base', armario.item], ['sink_kitchen', pia.item]] : [['sink_kitchen', pia.item]], m.conteudo);
          if (m.aereo !== false) {
            // y 1,55 a 2,15 m, encostado na parede do fundo da bancada
            const aereo = parte(m.id + '#aereo', 'kitchen_cabinet_wall', larg, 0.35, 0.6, 1.55, 0, -(m.d / 2) + 0.175);
            guardar([['kitchen_cabinet_wall', aereo.item]], m.conteudoAereo || []);
            lista.push(aereo);
          }
          if (m.tomada) pia.ligacoes.tomada = m.tomada;
        } else {
          const cuba = parte(m.id, 'sink_bathroom', m.w, m.d, m.h + 0.2, 0, 0, 0);
          lista.push(cuba);
          if (m.conteudo) {
            if (m.conteudo.length) {
              const arm = parte(m.id + '#armario', 'bathroom_cabinet', Math.max(0.45, Math.min(0.6, m.w)), 0.15, 0.75, 1.3, 0, -(m.d / 2) + 0.075);
              lista.push(arm);
              guardar([['bathroom_cabinet', arm.item], ['sink_bathroom', cuba.item]], m.conteudo);
            } else {
              guardar([['sink_bathroom', cuba.item]], []);
            }
          }
        }
        for (const e of lista) empurrar(e);
      }

      // circuito da lâmpada: o que a lista, senão o do interruptor que a controla, senão um circuito avulso (a luz da escada, por exemplo)
      function circuitoDaLuz(id) {
        const direto = circuitos.find((c) => (c.lampadas || []).indexOf(id) >= 0);
        if (direto) return direto.id;
        const inter = ((eletrica && eletrica.interruptores) || []).find((s) => (s.controla || []).indexOf(id) >= 0);
        const viaInter = inter && circuitos.find((c) => (c.interruptores || []).indexOf(inter.id) >= 0);
        return viaInter ? viaInter.id : 'circuito_avulso';
      }

      function planejarLampada(m, mapa) {
        const item = baseItem(m);
        delete item.palette;
        const e = entrada(m.id, 'lamp', item, m.id, m.andar, { watts: mapa.watts });
        e.ligacoes.circuito = circuitoDaLuz(m.id);
        e.ligada = luzInicial(res, popts, m.id, e);
        empurrar(e);
        plano.luzes.push(e.id);
      }

      // ---- móveis ----
      for (const m of res.moveis || []) {
        if (!noAndar(m.andar, m.externo)) continue;
        const mapa = MAPA_TIPOS[m.tipo];
        if (!mapa) {
          const k = m.categoria + '/' + m.tipo;
          plano.naoMapeados[k] = (plano.naoMapeados[k] || 0) + 1;
          continue;
        }
        plano.mapeados.push(m.id);
        if (mapa.t === 'lamp') planejarLampada(m, mapa);
        else if (mapa.composto) planejarComposto(m, mapa.composto);
        else planejarSimples(m, mapa);
      }

      // ---- cadeiras em volta das mesas (o PlantasSDK não as coloca) ----
      // Posição em (u, v) do PlantasSDK: centro da mesa + p * lx + f * lz, com f a frente da mesa e p = (-fv, fu) a direção da largura.
      // A cadeira olha para a mesa (a frente do objeto do kit é o lado em que quem senta olha). Só entra onde não há parede nem outro móvel.
      plano.cadeiras = [];
      if (opts.cadeiras !== false && popts.cadeiras !== false) {
        const bloq = bloqueadoDe(res, { origemX: o.ox, origemZ: o.oz, inw: o.inw });
        const tipoChao = (q) => !q.decor && !q.plano && (q.y || 0) < 0.9 && q.aabb;
        const colocadas = [];
        const livre = (m, cu, cv, meia) => {
          const a = [cu - meia + 0.03, cv - meia + 0.03, cu + meia - 0.03, cv + meia - 0.03];
          for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) if (bloq(K.x(cu + dx * meia * 0.9), K.z(cv + dz * meia * 0.9), m.andar)) return false;
          for (const q of res.moveis || []) {
            if (q === m || !tipoChao(q) || (q.andar !== m.andar && !(q.externo && m.externo))) continue;
            if (a[0] < q.aabb[2] && a[2] > q.aabb[0] && a[1] < q.aabb[3] && a[3] > q.aabb[1]) return false;
          }
          for (const c of colocadas) if (a[0] < c[2] && a[2] > c[0] && a[1] < c[3] && a[3] > c[1] && c[4] === m.andar) return false;
          colocadas.push([a[0], a[1], a[2], a[3], m.andar]);
          return true;
        };
        for (const m of res.moveis || []) {
          const modo = MESAS_COM_CADEIRAS[m.tipo];
          if (!modo || !noAndar(m.andar, m.externo) || m.fu == null) continue;
          const f = [m.fu, m.fv];
          const pp = [-m.fv, m.fu];
          const lugares = []; // [lx, lz, direção do olhar (fu, fv)]
          if (modo === 'jantar') {
            const n = Math.max(1, Math.min(3, Math.floor((m.w - 0.1) / 0.55)));
            for (const lado of [1, -1]) {
              for (let i = 0; i < n; i++) lugares.push([(i - (n - 1) / 2) * (m.w / n), lado * (m.d / 2 + 0.17), [-lado * f[0], -lado * f[1]]]);
            }
            if (m.w >= 1.6) for (const lado of [1, -1]) lugares.push([lado * (m.w / 2 + 0.17), 0, [-lado * pp[0], -lado * pp[1]]]);
          } else {
            lugares.push([0, m.d / 2 + 0.2, [-f[0], -f[1]]]);
          }
          lugares.forEach((lg, i) => {
            const cu = r3(m.x + pp[0] * lg[0] + f[0] * lg[1]);
            const cv = r3(m.z + pp[1] * lg[0] + f[1] * lg[1]);
            const meia = modo === 'jantar' ? CADEIRA / 2 : 0.3;
            if (!livre(m, cu, cv, meia)) return;
            const id = m.id + '#cadeira' + (i + 1);
            const item = { x: K.x(cu), z: K.z(cv), ry: K.ry(lg[2][0], lg[2][1]), seed: seedDe(id), palette: paleta };
            if (modo !== 'jantar') {
              item.w = 0.6;
              item.d = 0.6;
              item.h = 0.95;
            }
            const e = empurrar(entrada(id, modo === 'jantar' ? 'dining_chair' : 'armchair', item, m.id, m.andar));
            plano.cadeiras.push(e.id);
          });
        }
      }

      function conduite(id, pts, andar) {
        const x0 = K.x(pts[0][0]);
        const z0 = K.z(pts[0][1]);
        const item = {
          x: x0,
          z: z0,
          ry: 0,
          seed: seedDe(id),
          // os pontos do PlantasSDK já têm o y absoluto do mundo: o objeto fica no chão base e não no piso do andar
          points: pts.map((p) => [r3(K.x(p[0]) - x0), p[2], r3(K.z(p[1]) - z0)]),
        };
        const e = entrada(id, 'conduit_run', item, id, andar);
        e.piso = o.base;
        empurrar(e);
        plano.conduites.push(e.id);
      }

      // ---- elétrica ----
      if (eletrica) {
        for (const l of eletrica.lampadasExternas || []) {
          if (!noAndar(-1, true)) continue;
          const e = entrada(l.id, 'lamp', { x: K.x(l.u), z: K.z(l.v), ry: 0, y: l.y, seed: seedDe(l.id) }, l.id, -1, { watts: 15 });
          e.ligacoes.circuito = circuitoDaLuz(l.id);
          e.ligada = luzInicial(res, popts, l.id, e);
          empurrar(e);
          plano.luzes.push(e.id);
        }
        for (const t of eletrica.tomadas || []) {
          if (!noAndar(t.andar, false)) continue;
          const c = circuitos.find((x) => (x.tomadas || []).indexOf(t.id) >= 0);
          const item = { x: K.x(t.u), z: K.z(t.v), ry: K.ry(t.fu, t.fv), y: t.y, seed: seedDe(t.id) };
          if (c) item.circuit = c.id;
          const e = entrada(t.id, 'wall_socket', item, t.id, t.andar);
          e.ligacoes.circuito = c ? c.id : null;
          empurrar(e);
          plano.tomadas.push(e.id);
        }
        const luzes = new Set(plano.luzes);
        for (const s of eletrica.interruptores || []) {
          if (!noAndar(s.andar, false)) continue;
          const item = { x: K.x(s.u), z: K.z(s.v), ry: K.ry(s.fu, s.fv), y: s.y, seed: seedDe(s.id) };
          // ids de dispositivo globais ("objeto:dispositivo"): cada lâmpada é um objeto com o dispositivo `lamp`
          item.controls = (s.controla || []).map((id) => id + ':lamp');
          const e = entrada(s.id, 'wall_switch', item, s.id, s.andar);
          e.ligacoes.controla = (s.controla || []).slice();
          e.ligada = e.ligacoes.controla.some((id) => (plano.itens.find((x) => x.id === id) || {}).ligada === true); // a tecla acompanha as lâmpadas
          if (andarSel == null) for (const id of s.controla || []) if (!luzes.has(id)) plano.avisos.push('interruptor ' + s.id + ' controla ' + id + ', que não existe');
          empurrar(e);
          plano.interruptores.push(e.id);
        }
        const ee = eletrica.entradaEnergia;
        if (ee && ee.poste && noAndar(-1, true)) {
          const ramal = ee.ramal || [];
          const fim = ramal.length ? ramal[ramal.length - 1] : [ee.poste.u, ee.poste.v, 2.6];
          const px = K.x(ee.poste.u);
          const pz = K.z(ee.poste.v);
          const item = {
            x: px,
            z: pz,
            ry: 0,
            h: ee.poste.h,
            seed: seedDe('entrada_energia'),
            // ponto onde o ramal chega na casa, em coordenadas locais do poste (y absoluto)
            house: [r3(K.x(fim[0]) - px), fim[2], r3(K.z(fim[1]) - pz)],
          };
          if (ee.gato || eletrica.modo === 'gato') item.variant = 'gato'; // ligação clandestina: o ramal sai do poste direto para a casa, sem caixa de medidor
          const e = entrada('entrada_energia', 'service_entrance', item, 'entrada_energia', -1);
          empurrar(e);
          plano.entradaEnergia = e.id;
          if (ee.descida && ee.descida.length > 1) conduite('conduite_descida', ee.descida, -1);
        }
        // quadro de distribuição: um disjuntor por circuito do PlantasSDK (o rótulo é o cômodo); encostado na parede (u, v é o plano dela)
        const q = eletrica.quadro;
        if (q && noAndar(q.andar, false)) {
          const hdq = 0.06;
          const ryq = K.ry(q.fu, q.fv);
          const item = {
            x: r3(K.x(q.u) + Math.sin(ryq) * hdq),
            z: r3(K.z(q.v) + Math.cos(ryq) * hdq),
            ry: ryq,
            y: q.y,
            seed: seedDe('quadro'),
            circuits: circuitos.map((c) => ({ id: c.id, label: c.comodo })),
          };
          if (!item.circuits.length) delete item.circuits;
          const e = entrada('quadro', 'electrical_panel', item, 'quadro', q.andar);
          empurrar(e);
          plano.quadro = e.id;
        }
        // caixa do medidor (na fachada ou no pilar do portão), de frente para fora
        const med = ee && ee.medidor;
        if (med && noAndar(-1, true)) {
          const hdm = 0.08;
          const item = { x: K.x(med.u), z: r3(K.z(med.v) - o.inw * hdm), ry: K.ry(0, -1), y: med.y, seed: seedDe('medidor') };
          const e = entrada('medidor', 'power_meter', item, 'medidor', -1);
          empurrar(e);
          plano.medidor = e.id;
        }
        for (const ed of eletrica.eletrodutos || []) {
          if (!ed.exposto || !ed.pontos || ed.pontos.length < 2) continue;
          const circ = circuitos.find((c) => c.id === ed.circuito);
          const com = circ && (res.comodos || []).find((c) => c.id === circ.comodo);
          const andar = com ? com.andar : 0;
          if (!noAndar(andar, false)) continue;
          conduite(ed.id, ed.pontos, andar);
        }
      }

      // ---- gás ----
      const encanados = plano.itens.filter((e) => e.tipo === 'stove' && e.ligacoes.gas === 'encanado');
      if (encanados.length) {
        // o kit só conhece gás em botijão: o gás encanado vira uma fonte sem válvula perto do medidor
        const med = res.gas && res.gas.medidor;
        const ref = med ? { x: K.x(med.u), z: K.z(med.v), y: med.y || 1 } : { x: encanados[0].item.x, z: encanados[0].item.z, y: 0.3 };
        const e = entrada('gas_encanado', 'gas_piped', { x: ref.x, z: ref.z, ry: 0, y: ref.y, seed: seedDe('gas_encanado') }, 'gas_encanado', encanados[0].andar);
        e.piso = o.base;
        empurrar(e);
        for (const f of encanados) f.ligacoes.fuel = 'gas_encanado:gas';
      }
      for (const b of plano.botijoes) {
        const fogao = plano.itens.find((e) => e.id === b.fogao);
        if (fogao) fogao.ligacoes.fuel = b.id + ':gas';
      }

      // ---- hidráulica ----
      const hid = res.hidraulica;
      if (hid) {
        const ehArmario = (t) => t === 'kitchen_cabinet_base' || t === 'kitchen_cabinet_wall' || t === 'bathroom_cabinet';
        for (const p of hid.pontos || []) {
          const alvo = (porOrigem.get(p.item) || []).filter((e) => !ehArmario(e.tipo))[0];
          if (!alvo) {
            if (andarSel == null) plano.avisos.push('ponto ' + p.id + ' (' + p.tipo + ') sem objeto para ' + p.item);
            continue;
          }
          alvo.ponto = p.id;
          alvo.ligacoes.vazao_lpm = p.vazao_lpm;
          for (const f of FIXTURE_DO_PONTO[p.tipo] || []) {
            plano.fixtures.push({ objeto: alvo.id, fixture: f, global: alvo.id + ':' + f, ponto: p.id, tipoPonto: p.tipo });
            plano.pontos[alvo.id + ':' + f] = p.id;
          }
        }
      }
      esconderBotijoes();
      return plano;
    }

    // ---- objetos próprios do adaptador --------------------------------------------------------------------------------------
    function especProprio(entry) {
      if (entry.tipo === 'lamp') {
        const dev = { id: 'lamp', kind: 'lamp', watts: entry.watts || 15, on: !!entry.ligada };
        if (entry.ligacoes.circuito) dev.circuit = entry.ligacoes.circuito;
        return { type: 'lamp', devices: [dev] };
      }
      if (entry.tipo === 'gas_piped') return { type: 'gas_piped', fuels: [{ id: 'gas', kind: 'gas', capacity: 1000, level: 1000 }] };
      throw new Error('tipo próprio desconhecido: ' + entry.tipo);
    }

    // Liga o que o PlantasSDK já decidiu: tomada do aparelho, botijão do fogão, circuito do chuveiro, entrada de água da máquina.
    function ligar(entry, spec) {
      const L = entry.ligacoes || {};
      if (entry.tipo === 'wall_switch') for (const p of spec.parts || []) if (p.id === 'rocker') p.t0 = entry.ligada ? 1 : 0; // a tecla na posição das lâmpadas
      if (entry.tipo !== 'shower') {
        for (const dv of spec.devices || []) if (L.tomada && dv.socket === 'auto') dv.socket = L.tomada + ':socket';
      } else {
        const ch = L.chuveiro || {};
        const heater = (spec.devices || []).find((d) => d.id === 'heater');
        if (heater && ch.eletrico === false) {
          spec.devices = spec.devices.filter((d) => d !== heater);
          for (const f of spec.fixtures || []) if (f.heater === 'heater') delete f.heater;
        } else if (heater) {
          if (ch.potencia_w) heater.watts = ch.potencia_w;
          if (L.circuitoTomada) heater.circuit = L.circuitoTomada;
        }
      }
      if ((entry.tipo === 'stove' || entry.tipo === 'camp_stove') && L.fuel) for (const b of spec.burners || []) if (b.fuel === 'auto') b.fuel = L.fuel;
      if (entry.tipo === 'fireplace' && L.topoChamine) {
        // a fumaça sai no topo da chaminé de fora: o ponto do mundo volta para as coordenadas locais do objeto
        const it = entry.item;
        const dx = L.topoChamine[0] - it.x;
        const dz = L.topoChamine[2] - it.z;
        const lx = Math.cos(it.ry) * dx - Math.sin(it.ry) * dz;
        const lz = Math.sin(it.ry) * dx + Math.cos(it.ry) * dz;
        for (const em of spec.emitters || []) if (em.kind === 'smoke') em.pos = [r3(lx), r3(L.topoChamine[1] - entry.piso + 0.02), r3(lz)];
      }
      if (entry.tipo === 'washing_machine' && entry.ponto) {
        // o pacote já traz a entrada de água (`inlet`, ligada ao aparelho: corre enquanto o ciclo roda); aqui só a vazão do projeto e a rede
        spec.fixtures = spec.fixtures || [];
        const inlet = spec.fixtures.find((f) => f.id === 'inlet');
        if (inlet) {
          if (L.vazao_lpm) inlet.flow = L.vazao_lpm;
          inlet.tank = 'auto';
        } else {
          spec.fixtures.push({ id: 'inlet', kind: 'hose', outlet: [0, 0.3, -(entry.item.d || 0.6) / 2], flow: L.vazao_lpm || 8, tank: 'auto' });
        }
      }
      return spec;
    }

    // ---- criar o mundo -------------------------------------------------------------------------------------------------------
    function criarMundo(res, copts) {
      copts = copts || {};
      const info = { pontos: new Map(), agua: copts.agua || null, luzesLigadas: copts.luzesLigadas };
      const mundo = GI.createWorld({
        locale,
        strings: hh.strings,
        items: hh.items,
        loot: hh.loot,
        seed: copts.semente != null ? copts.semente : res.semente,
        // sem rede: a cabana e o camping off-grid não têm entrada de energia, tomada nem lâmpada elétrica (lampiões não precisam de rede)
        grid: copts.rede != null ? !!copts.rede : !!res.eletrica && res.eletrica.modo !== 'offgrid',
        onEvent: copts.onEvent,
        canInteract: copts.canInteract,
        waterSupply: {
          draw(fixtureId, l) {
            if (!info.agua) return l;
            const ponto = info.pontos.get(fixtureId);
            return ponto == null ? l : info.agua.consumir(ponto, l);
          },
        },
      });
      mundos.set(mundo, info);
      return mundo;
    }

    function pontoDe(mundo, fixtureId) {
      const info = mundos.get(mundo);
      return info ? info.pontos.get(fixtureId) : undefined;
    }

    // ---- paredes -> bloqueado ------------------------------------------------------------------------------------------------
    // (x, z, andar) -> true dentro de uma parede. O vão das portas já vem aberto em res.paredes. `folga` encolhe a parede de cada
    // lado (2 cm) para o móvel encostado nela não contar como "dentro".
    function bloqueadoDe(res, bopts) {
      bopts = bopts || {};
      const ox = bopts.origemX || 0;
      const oz = bopts.origemZ || 0;
      const inw = bopts.inw || 1;
      const folga = bopts.folga != null ? bopts.folga : 0.02;
      const segs = (res.paredes || []).map((p) => {
        const e = Math.max(0, p.esp / 2 - folga);
        const u0 = Math.min(p.u0, p.u1) - (p.eixo === 'u' ? 0 : e);
        const u1 = Math.max(p.u0, p.u1) + (p.eixo === 'u' ? 0 : e);
        const v0 = Math.min(p.v0, p.v1) - (p.eixo === 'v' ? 0 : e);
        const v1 = Math.max(p.v0, p.v1) + (p.eixo === 'v' ? 0 : e);
        const za = oz + inw * v0;
        const zb = oz + inw * v1;
        return { andar: p.andar, x0: ox + u0, x1: ox + u1, z0: Math.min(za, zb), z1: Math.max(za, zb) };
      });
      // índice por célula de 0,5 m e andar: o fitSweep chama isto milhares de vezes por objeto
      const CEL = 0.5;
      const grade = new Map();
      const chave = (a, i, j) => (a * 4096 + (i + 2048)) * 4096 + (j + 2048);
      for (const s of segs) {
        for (let i = Math.floor(s.x0 / CEL); i <= Math.floor(s.x1 / CEL); i++) {
          for (let j = Math.floor(s.z0 / CEL); j <= Math.floor(s.z1 / CEL); j++) {
            const k = chave(s.andar, i, j);
            if (!grade.has(k)) grade.set(k, []);
            grade.get(k).push(s);
          }
        }
      }
      // objeto do lote (andar -1) encostado na casa: vale a parede do térreo
      return function bloqueado(x, z, andar) {
        const a = andar == null || andar < 0 ? 0 : andar;
        const lista = grade.get(chave(a, Math.floor(x / CEL), Math.floor(z / CEL)));
        if (!lista) return false;
        for (const s of lista) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true;
        return false;
      };
    }

    // ---- adicionar -----------------------------------------------------------------------------------------------------------
    function adicionar(mundo, plano, aopts) {
      aopts = aopts || {};
      const info = mundos.get(mundo);
      const construir = aopts.construir || ((tipo, item) => hh.build(tipo, item, HH.createRecorder().api));
      const bloqueado = aopts.bloqueado || null;
      const saida = { adicionados: 0, partes: [], dobradicas: {}, afastados: {}, avisos: [] };
      // estado inicial das luzes: `luzesLigadas` de adicionar, senão o de criarMundo, senão o que o plano já decidiu (`entrada.ligada`)
      const ovLuz = aopts.luzesLigadas !== undefined ? aopts.luzesLigadas : info && info.luzesLigadas;
      if (ovLuz !== undefined) {
        for (const e of plano.itens) if (e.tipo === 'lamp') e.ligada = typeof ovLuz === 'function' ? !!ovLuz(e.id, e) : !!ovLuz;
        for (const e of plano.itens) if (e.tipo === 'lantern_lamp') e.ligada = typeof ovLuz === 'function' ? !!ovLuz(e.id, e) : !!ovLuz;
        for (const e of plano.itens) if (e.tipo === 'wall_switch') e.ligada = (e.ligacoes.controla || []).some((id) => (plano.itens.find((x) => x.id === id) || {}).ligada === true);
      }
      for (const e of plano.itens) if (e.tipo === 'lantern_lamp') e.item.on = !!e.ligada; // o lampião nasce no estado do plano
      let rascunho = null; // mundo descartável para testar o lado da dobradiça sem desenhar nada

      // Mede quanto as peças de dobradiça abrem (fitSweep) com um lado de dobradiça e um recuo da frente, num mundo descartável.
      function sondar(entry, hinge, recuo) {
        if (!rascunho) rascunho = GI.createWorld({ locale, strings: hh.strings, items: hh.items, loot: hh.loot, grid: false });
        const it = entry.item;
        const x = it.x + Math.sin(it.ry) * recuo;
        const z = it.z + Math.cos(it.ry) * recuo;
        const spec = hh.build(entry.tipo, Object.assign({}, it, { hinge }), HH.createRecorder().api);
        rascunho.add('__sonda', spec, { x, y: entry.piso, z, ry: it.ry });
        const bloq = (px, pz) => bloqueado(px, pz, entry.andar);
        let soma = 0;
        let min = 1;
        let n = 0;
        for (const p of spec.parts || []) {
          if (p.motion.kind !== 'hinge' || !(p.bounds || p.sweep)) continue;
          const t = rascunho.fitSweep('__sonda', p.id, bloq);
          soma += t;
          min = Math.min(min, t);
          n++;
        }
        rascunho.remove('__sonda');
        return { soma, min, n };
      }

      const melhor = (a, b) => a.soma > b.soma + 1e-9 || (Math.abs(a.soma - b.soma) <= 1e-9 && a.min > b.min + 1e-9);

      // Portas de dobradiça: fica com o lado em que o fitSweep dá o maior t (empate: o padrão do tipo). Se mesmo assim alguma peça não abre
      // por inteiro, tenta afastar o objeto da parede até 4 cm ao longo da frente (o PlantasSDK encosta o móvel na face da parede e a
      // quina da tampa de uma lixeira, por exemplo, roça nela ao girar). Se com o padrão do tipo tudo abre por inteiro, não testa mais nada.
      function ajustarPortas(entry) {
        if (!bloqueado || !tiposHH.has(entry.tipo)) return;
        const padrao = sondar(entry, undefined, 0);
        if (!padrao.n || padrao.min >= 1) return;
        let melhorLado;
        let m = padrao;
        for (const lado of ['left', 'right']) {
          const r = sondar(entry, lado, 0);
          if (melhor(r, m)) {
            m = r;
            melhorLado = lado;
          }
        }
        if (melhorLado) {
          entry.item.hinge = melhorLado;
          saida.dobradicas[entry.id] = melhorLado;
        }
        if (m.min >= 1) return;
        let alvo = { recuo: 0, r: m };
        for (const recuo of [0.01, 0.02, 0.03, 0.04]) {
          const r = sondar(entry, melhorLado, recuo);
          if (melhor(r, alvo.r)) alvo = { recuo, r };
          if (r.min >= 1) break;
        }
        if (alvo.recuo > 0 && alvo.r.soma > m.soma + 0.2) {
          entry.item.x = r3(entry.item.x + Math.sin(entry.item.ry) * alvo.recuo);
          entry.item.z = r3(entry.item.z + Math.cos(entry.item.ry) * alvo.recuo);
          entry.afastado = alvo.recuo;
          saida.afastados[entry.id] = alvo.recuo;
        }
      }

      // o circuito do chuveiro é o da tomada que o PlantasSDK ligou a ele
      for (const entry of plano.itens) {
        if (entry.tipo !== 'shower' || !entry.ligacoes.tomada) continue;
        const t = plano.itens.find((x) => x.id === entry.ligacoes.tomada);
        if (t && t.ligacoes.circuito) entry.ligacoes.circuitoTomada = t.ligacoes.circuito;
      }

      for (const entry of plano.itens) {
        let spec;
        if (TIPOS_DO_ADAPTADOR[entry.tipo]) {
          spec = especProprio(entry);
        } else {
          ajustarPortas(entry);
          spec = construir(entry.tipo, entry.item);
          if (!spec) {
            saida.avisos.push('construir devolveu vazio para ' + entry.id);
            continue;
          }
        }
        ligar(entry, spec);
        mundo.add(entry.id, spec, { x: entry.item.x, y: entry.piso, z: entry.item.z, ry: entry.item.ry });
        saida.adicionados++;
        if (!bloqueado) continue;
        for (const p of spec.parts || []) {
          if (!(p.bounds || p.sweep)) continue;
          const t = mundo.fitSweep(entry.id, p.id, (x, z) => bloqueado(x, z, entry.andar));
          if (t < 1) saida.partes.push({ objeto: entry.id, parte: p.id, t });
        }
      }
      if (info) for (const f of plano.fixtures) info.pontos.set(f.global, f.ponto);
      return saida;
    }

    return { versao: VERSAO, household: hh, planejar, criarMundo, adicionar, bloqueadoDe, pontoDe, especProprio };
  }

  return { versao: VERSAO, criar, MAPA_TIPOS, MAPA_CONTEUDO, CONTEUDO_POR_CATEGORIA };
})();
