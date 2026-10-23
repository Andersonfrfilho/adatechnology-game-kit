/* ZombiAdA · plugin do jogo para o VehicleSDK (sdk/veiculos-sdk.js)
   Todo o conteúdo específico do jogo mora aqui: combustíveis e seus efeitos, grupos da frota, textos de efeito por faixa de dano,
   texto das peças, sangue de zumbi (fluido), os seis cenários prontos e os efeitos da marca "horda".
   Mantém window.ZG como apelido de window.VehicleSDK para os arquivos frota-*.js e o app.js. */
(function () {
  "use strict";
  var SDK = window.VehicleSDK, V3 = THREE.Vector3;
  if (!SDK) throw new Error("zombiada/plugin.js: carregue sdk/veiculos-sdk.js antes");
  var I = SDK.internals;

  /* ---- combustíveis (fx = efeito no jogo) ---- */
  var FUELS = {
    nenhum: { n: "Sem combustível", rend: "—", val: "—", onde: "—", fx: "Só força do personagem. Cansa." },
    gasolina: { n: "Gasolina", rend: "100%", val: "6 meses", onde: "Postos, galões em garagens, sifão de carros", fx: "Padrão. Vazada, espalha rápido, faz o ar tremular, pega fogo e evapora em 60 s." },
    etanol: { n: "Etanol (álcool)", rend: "70%", val: "3 meses, absorve água", onde: "Postos e usinas no interior", fx: "Motor frio falha na partida em noites frias. Pode ser destilado em usina com energia." },
    flex: { n: "Flex", rend: "70 a 100%", val: "A do que estiver no tanque", onde: "Gasolina ou etanol", fx: "Aceita qualquer mistura de gasolina e etanol." },
    diesel: { n: "Diesel", rend: "100%, mais torque", val: "12 meses", onde: "Postos de rodovia, fazendas, garagens de ônibus", fx: "Motor mais barulhento e fumaça preta em alta rotação." },
    eletrico: { n: "Elétrico", rend: "Bateria em kWh", val: "Bateria perde 2% por mês parada", onde: "Tomada com gerador, painel solar ou carregador de shopping", fx: "Quase silencioso (15 m). Recarga lenta, em horas. Bateria batida pode pegar fogo." },
    hibrido: { n: "Híbrido", rend: "Gasolina + bateria, 40% menos consumo", val: "Como a gasolina", onde: "Postos; a bateria recarrega rodando", fx: "Modo elétrico silencioso abaixo de 40 km/h. O motor liga sozinho quando a bateria cai." },
    avgas: { n: "Gasolina de aviação (AVGAS)", rend: "100%", val: "12 meses", onde: "Aeroclubes e hangares", fx: "Rara. Funciona em carro, mas gasolina de carro não serve para avião." },
    qav: { n: "Querosene de aviação (QAV)", rend: "100% (turbina)", val: "18 meses", onde: "Aeroportos e bases militares", fx: "Só para turbinas. Helicóptero a turbina é ouvido a 450 m." }
  };

  var GROUPS = ["Motos", "Carros", "SUVs", "Picapes e bigfoot", "Vans", "Caminhões e ônibus", "Agrícola", "Militares", "Aquáticos", "Aéreos"];

  /* ---- texto do relatório de batida, por tipo de peça ---- */
  var PART_FX = {
    farol: "Farol quebrado: sem luz desse lado à noite.",
    lanterna: "Lanterna quebrada: quem vem atrás não vê o veículo frear.",
    vidro: "Vidro quebrado: zumbis alcançam quem está nesse assento.",
    roda: "Pneu furado: o veículo puxa para esse lado.",
    parachoque: "Para-choque solto: fica pendurado e a próxima batida vai direto na lataria.",
    capo: "Capô amassado: fica entreaberto e atrapalha a visão.",
    radiador: "Radiador furado: fumaça branca e motor superaquecendo em minutos.",
    motor: "Motor danificado: perde potência, vaza óleo que pinga e espalha.",
    tanque: "Tanque furado: a gasolina espalha rápido, é inflamável e evapora em 60 s.",
    bateria: "Bateria danificada: pega fogo e solta fumaça preta, recarga bloqueada.",
    carga: "Carroceria amassada: a porta traseira emperra.",
    casco: "Casco furado: entra água e o barco afunda devagar.",
    popa: "Motor de popa quebrado: só a remo.",
    helice: "Hélice torta: o avião não decola.",
    asa: "Asa danificada: o avião não decola com segurança.",
    trem: "Trem de pouso quebrado: o pouso vira acidente.",
    rotor: "Rotor principal danificado: o helicóptero não decola.",
    rotorcauda: "Rotor de cauda danificado: o helicóptero gira sem controle.",
    lagarta: "Lagarta rompida: o blindado só gira no lugar.",
    blindagem: "Blindagem atingida: só faíscas, sem amassar.",
    explosao: "Capô, portas e uma roda arrancados; a carcaça queima e o veículo não anda mais."
  };

  /* ---- efeito no jogo por chave de zona, nas cinco faixas; {quem} vira o ocupante daquele lado ---- */
  var ZONE_FX = {
    painel: ["Nenhum", "Só estético, barulho de raspagem", "o painel perde 50% de proteção", "metal rasgado: zumbi alcança quem está desse lado, a peça pode ser arrancada", "lado aberto: quem está desse lado fica exposto"],
    porta: ["Nenhum", "Só estético, barulho de raspagem", "trava emperrada, zumbi alcança {quem}", "porta pendurada numa dobradiça: zumbi alcança {quem}", "sem porta: {quem} fica exposto"],
    paralama: ["Nenhum", "Só estético, barulho de raspagem", "lata roça no pneu nas curvas, perde 50% de proteção", "metal rasgado raspa o pneu: zumbi alcança a roda", "roda e suspensão expostas"],
    lateral: ["Nenhum", "Só estético, barulho de raspagem", "o painel perde 50% de proteção", "metal rasgado: zumbi alcança {quem}", "lado aberto: {quem} fica exposto"],
    teto: ["Nenhum", "Só estético, barulho de raspagem", "teto afundado, perde 50% de proteção", "teto esmagado: zumbi alcança pelo alto", "teto arrancado: ataque por cima"],
    capo: ["Nenhum", "Só estético, barulho de raspagem", "capô entreaberto atrapalha a visão", "capô dobrado para cima: visão bloqueada", "sem capô: motor exposto a golpes"],
    tampa: ["Nenhum", "Só estético, barulho de raspagem", "tampa emperra, carga presa", "tampa pendurada: zumbi alcança a carga", "sem tampa: a carga cai"],
    cacamba: ["Nenhum", "Só estético, barulho de raspagem", "tampa da caçamba emperra", "caçamba rasgada: a carga pode cair", "caçamba aberta: a carga cai na estrada"],
    parachoque: ["Nenhum", "Só estético, barulho de raspagem", "solto de um lado, raspa no chão", "no chão: faísca e barulho atraem zumbis", "sem para-choque: a próxima batida vai direto na lataria"],
    vidro: ["Nenhum", "lascado, só estético", "trincado em teia: visão ruim", "sem vidro: zumbi alcança {quem}", "vão aberto: {quem} fica exposto"],
    parabrisa: ["Nenhum", "lascado, só estético", "trincado em teia: visão ruim, só dá para ir devagar", "afundado: sem visão, zumbi alcança a frente", "sem para-brisa: vento, chuva e zumbi pela frente"],
    farol: ["Nenhum", "lente trincada: luz fraca", "farol sem luz desse lado", "farol pendurado e apagado", "sem farol: anda no escuro desse lado"],
    lanterna: ["Nenhum", "lente trincada", "sem luz de freio desse lado", "lanterna pendurada e apagada", "sem lanterna: quem vem atrás não vê o veículo"],
    roda: ["Nenhum", "aro riscado, só estético", "pneu murcho: puxa para esse lado", "pneu rasgado: no máximo 30 km/h", "rodando no aro: faísca e barulho"],
    eixo: ["Nenhum", "aros riscados, só estético", "pneus murchos: puxa e gasta mais", "pneus rasgados: no máximo 30 km/h", "rodando no aro: faísca e barulho"],
    motor: ["Nenhum", "barulho estranho", "perde 30% de potência, fumaça cinza", "fumaça preta, falha e vaza óleo", "motor morto: não liga"],
    radiador: ["Nenhum", "Só estético", "vaza água: superaquece em 10 min", "fumaça branca: superaquece em 2 min", "sem radiador: o motor ferve em segundos"],
    tanque: ["Nenhum", "Só estético", "vazamento lento: perde 1 L por minuto", "vaza rápido: poça inflamável embaixo", "tanque perdido: sem combustível"],
    bateria: ["Nenhum", "Só estético", "recarga mais lenta", "solta fumaça: pode pegar fogo", "em chamas: veículo parado"],
    assoalho: ["Nenhum", "raspagem embaixo", "suspensão desalinhada: puxa e balança", "escapamento arrastando: barulho atrai zumbis", "sem suspensão: não anda"],
    chassi: ["Nenhum", "raspagem embaixo", "chassi torto: puxa para um lado", "longarina trincada: carga máxima pela metade", "chassi partido: não anda"],
    blindagem: ["Nenhum", "marcas de bala, só estético", "a blindagem perde 50% de proteção", "chapa rachada: tiro de fuzil atravessa", "rombo: tripulação exposta"],
    torre: ["Nenhum", "Só estético", "torre gira devagar", "torre travada, escotilha emperrada", "torre aberta: tripulação exposta"],
    arma: ["Nenhum", "mira desregulada", "arma desalinhada: erra de longe", "arma emperrada: não atira", "sem arma"],
    lagarta: ["Nenhum", "Só estético", "lagarta frouxa: anda devagar", "lagarta solta: só gira no lugar", "sem lagarta: parado"],
    casco: ["Nenhum", "Só estético", "infiltração: entra água devagar", "rombo: entra água rápido, afunda em minutos", "aberto: afunda"],
    conves: ["Nenhum", "Só estético", "convés afundado, perde proteção", "cabine destruída: zumbi sobe a bordo", "sem cabine: tripulação exposta"],
    asa: ["Nenhum", "Só estético", "asa amassada: decola só com pista longa", "asa rasgada: não decola com segurança", "sem asa: não voa"],
    cauda: ["Nenhum", "Só estético", "leme duro: curva ruim", "cauda rasgada: não decola com segurança", "sem cauda: não voa"],
    nariz: ["Nenhum", "Só estético", "vibração no motor e na hélice", "hélice torta: o avião não decola", "sem hélice: não voa"],
    cabineaero: ["Nenhum", "riscos, só estético", "vidro trincado: visão ruim", "cabine aberta: zumbi alcança o piloto", "cabine destruída: piloto exposto"],
    trem: ["Nenhum", "Só estético", "trem desalinhado: pouso duro", "o pouso vira acidente", "sem trem: pouso de barriga"],
    rotor: ["Nenhum", "vibração leve", "rotor desbalanceado: vibra muito", "pás tortas: não decola", "sem rotor: não voa"],
    rotorcauda: ["Nenhum", "Só estético", "vibração na cauda", "gira sem controle no ar", "sem rotor de cauda: não decola"],
    cone: ["Nenhum", "Só estético", "cone amassado: vibração", "cone rasgado: pode partir em voo", "sem cauda: não voa"],
    esqui: ["Nenhum", "Só estético", "esqui torto: pouso inclinado", "esqui quebrado: o pouso vira acidente", "sem esqui: pouso de barriga"],
    carenagem: ["Nenhum", "riscos, só estético", "carenagem solta, farol sem luz", "farol pendurado: anda no escuro", "sem frente: farol e painel perdidos"],
    banco: ["Nenhum", "Só estético", "banco rasgado: garupa desconfortável", "rabeta solta: sem garupa", "sem banco: pilota em pé"],
    guidao: ["Nenhum", "manopla ralada", "guidão torto: puxa para um lado", "manete quebrada: sem freio dianteiro", "sem guidão: não pilota"],
    escape: ["Nenhum", "Só estético", "escapamento furado: barulho alto", "escapamento solto, arrastando", "sem escapamento: barulho dobra e atrai zumbis"],
    quadro: ["Nenhum", "Só estético", "quadro empenado: pedala torto", "quadro trincado: pode partir", "quadro partido: inutilizável"],
    cabine: ["Nenhum", "Só estético, barulho de raspagem", "cabine amassada, perde 50% de proteção", "cabine rasgada: zumbi alcança {quem}", "cabine aberta: {quem} fica exposto"]
  };

  /* ---- sangue de zumbi: fluido de mancha (fresco brilhante, seca em 10 min; limpador e chuva tiram o fresco) ---- */
  var FLUIDS = { sangue: { fresh: "#8a0a0a", dry: "#3b1d14", dryTime: 600, roughFresh: 0.12, roughDry: 0.92, metalFresh: 0.15, metalDry: 0, wipeable: true } };

  /* ---- os seis cenários prontos ---- */
  var SCENARIOS = [
    { id: "frontal", n: "Batida frontal",
      zone: function (z, X) {
        var cen = X.cen, ty = z.type, isPB = X.isPB, clamp = X.clamp;
        var s = clamp((cen.x - (X.F - 0.42 * X.L)) / (0.42 * X.L), 0, 1); if (s <= 0 && !isPB) return;
        var k = { parachoque: 1, luz: z.fxKey === "lanterna" ? 0 : 1, capo: 0.85, painel: 0.78, porta: 0.6, vidro: 0.55, interno: z.sub === "radiador" ? 1 : z.sub === "motor" ? 0.85 : 0.4, roda: 0.55, teto: 0.3, peca: 0.85 }[ty] || 0.6;
        if (z.tags.indexOf("frente") >= 0) k = Math.max(k, 0.95);
        var v = 100 - Math.pow(s, 0.85) * 92 * k;
        if (isPB) v = Math.min(v, 42);
        if (v < 99) X.set(z, v);
        X.flags.frontBlood = true;
      } },
    { id: "lateral", n: "Batida lateral esquerda",
      zone: function (z, X) {
        var cen = X.cen, ty = z.type, clamp = X.clamp, F = X.F, R = X.R, L = X.L;
        var x0 = (F + R) / 2 + 0.12 * L, dd = clamp(1 - Math.abs(cen.x - x0) / (0.42 * L), 0, 1), sideK = z.side < 0 ? 1 : z.side > 0 ? 0 : 0.35;
        if (ty === "interno" && z.side === 0) sideK = 0.15;
        var kk = { porta: 1, painel: 0.85, vidro: 1.05, roda: 0.7, luz: 0.5, teto: 1, parachoque: 0.4, capo: 0.5, peca: 0.8, tampa: 0.4 }[ty] || 0.5, val = 100 - Math.pow(dd, 0.7) * 95 * kk * sideK;
        if (val < 99) X.set(z, val);
      } },
    { id: "capotado", n: "Capotado",
      zone: function (z, X) {
        var cen = X.cen, ty = z.type, isPB = X.isPB, clamp = X.clamp, BODY = X.BODY;
        var s2 = clamp((cen.y - X.cl) / Math.max(0.3, X.top - X.cl), 0, 1), val2 = 100;
        if (ty === "teto" || z.id === "conves" || z.id === "rotor") val2 = 14;
        else if (ty === "vidro") val2 = isPB ? 22 : z.side > 0 ? 8 : 30;
        else if (BODY[ty] || ty === "peca") val2 = 100 - s2 * 70 - (z.side > 0 ? 25 : 0);
        else if (ty === "luz") val2 = 55; else if (ty === "roda") val2 = 70;
        else if (ty === "interno") val2 = z.sub === "tanque" ? 45 : z.sub === "motor" ? 50 : 80;
        if (val2 < 99) X.set(z, val2);
        X.flags.flipped = true;
      } },
    { id: "abandonado", n: "Abandonado",
      zone: function (z, X) {
        var ty = z.type, r = X.r, BODY = X.BODY;
        var val3 = BODY[ty] || ty === "peca" ? 56 + r() * 16 : ty === "vidro" ? (r() < 0.45 ? 15 : 40) : ty === "roda" ? 38 : ty === "luz" ? 42 : ty === "interno" ? (z.sub === "tanque" ? 70 : z.sub === "motor" ? 32 : 45) : 60;
        X.set(z, val3); X.flags.abandoned = true;
      } },
    { id: "horda", n: "Atacado pela horda",
      zone: function (z, X) {
        var ty = z.type, r = X.r, BODY = X.BODY, val4 = 100;
        if (z.side && (BODY[ty] || ty === "peca")) val4 = 56 + r() * 14;
        else if (ty === "vidro" && z.side) val4 = 8;
        else if (ty === "vidro") val4 = 62;
        else if (ty === "roda") val4 = 90;
        if (val4 < 99) X.set(z, val4); X.flags.horde = true;
      } },
    { id: "queimado", n: "Queimado",
      zone: function (z, X) {
        var ty = z.type, BODY = X.BODY;
        var val5 = BODY[ty] ? 34 : ty === "peca" ? 22 : ty === "vidro" || ty === "luz" || ty === "roda" ? 0 : ty === "interno" ? (z.sub === "radiador" ? 10 : 4) : 30;
        X.set(z, val5); X.flags.burnt = true;
      } }
  ];

  /* ---- marcas de cenário do jogo ---- */
  /* respingo de sangue no vidro dianteiro (batida frontal) */
  function frontBloodFx(c) {
    var q = c.meta.quadF; if (!q) return;
    var v = 0.35, p = new V3(q.b[0] + (q.t[0] - q.b[0]) * v, q.b[1] + (q.t[1] - q.b[1]) * v, 0.18);
    SDK.splat(c, p.clone().add(new V3(q.n[0] * 0.01, q.n[1] * 0.01, 0)), new V3(q.n[0], q.n[1], 0), 0.1, { fluid: "sangue", glass: true });
  }
  /* horda: retrovisores arrancados e sangue e arranhões nas laterais */
  function hordeFx(c) {
    var m = c.meta, inv = I.gInvOf(c), R = c.rand, _zr = I.rayCaster;
    (c.zones || []).forEach(function (z) { (z.mirrors || []).forEach(function (o) { I.hideObj(c, o); }); });
    if (["boat", "plane", "heli"].indexOf(m.kind) >= 0 && m.kind !== "heli") return;
    var cands = []; c.g.traverse(function (o) { if (o.isMesh && !o.userData.decal && !o.userData.ghost && o.visible && !o.isSprite) cands.push(o); });
    [-1, 1].forEach(function (s) {
      for (var i = 0; i < 7; i++) {
        var x = m.rear + 0.3 + (m.L - 0.6) * (i + R() * 0.6) / 7, y = (m.clear || 0.3) + ((m.belt || 1) - (m.clear || 0.3)) * (0.45 + R() * 0.7);
        var org = new V3(x, y, s * ((m.W || 1.7) / 2 + 1)), dir = new V3(0, 0, -s);
        _zr.set(org.clone().applyMatrix4(c.g.matrixWorld), dir.clone().transformDirection(c.g.matrixWorld)); _zr.far = 2 + (m.W || 1.7) / 2;
        var h = _zr.intersectObjects(cands, false).find(function (q) { return q.face && q.object.visible; }); if (!h) continue;
        var lp = h.point.clone().applyMatrix4(inv), n = h.face.normal.clone().transformDirection(h.object.matrixWorld).transformDirection(inv); if (n.dot(dir) > 0) n.negate();
        I.markDecal(SDK.splat(c, lp.addScaledVector(n, 0.002), n, 0.06 + R() * 0.06, { fluid: "sangue", obj: h.object, glass: !!h.object.userData.glass }).grp);
      }
    });
  }

  SDK.plugin({
    name: "zombiada",
    configure: {
      fuels: FUELS, groups: GROUPS, waterGroups: { "Aquáticos": true },
      partFx: PART_FX, zoneFx: ZONE_FX,
      fluids: FLUIDS, impactStain: "sangue", defaultSplat: "sangue",
      scenarios: SCENARIOS, damagedScenario: "frontal",
      flags: {
        frontBlood: { order: 10, settle: false, apply: frontBloodFx },
        horde: { order: 30, settle: true, apply: hordeFx }
      },
      defaultGroup: "Carros",
      texts: { who: "quem está desse lado", plate: "ZMB4D23" }
    },
    install: function (S) {
      /* a batida padrão dos carros deixa sangue no para-brisa */
      S.on("defaultDamage", frontBloodFx);
      /* compatibilidade: os arquivos da frota passam { noBlood: true } para impact() */
      var impact0 = S.impact;
      S.impact = function (c, p, dir, force, opts) { if (opts && opts.noBlood && !opts.noStain) opts = Object.assign({ noStain: true }, opts); return impact0.call(S, c, p, dir, force, opts); };
    }
  });

  window.ZG = SDK;   /* apelido: frota-*.js e app.js continuam usando ZG.* */
})();
