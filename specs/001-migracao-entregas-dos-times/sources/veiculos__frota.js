// fonte: site/pages/veiculos/frota.html
// texto visível: Frota ZombiAdA ZombiAdA · Documento de design · Sistema 07 Frota e veículos Como os veículos funcionam no mundo aberto de ZombiAdA: quais existem, como dirigem, o que quebra, como se conserta, o que acontece quando você bate numa horda e como tudo isso roda liso numa partida em LAN. Versão 0.4 · rascunho Revisado em 22/10/2026 Estilo: low poly sombrio com realismo Ver os 69 veículos em 3D → Pilares A frota Condução e física Combustível Peças e danos Faixas de dano Reparo e mods Atropelar hordas Barulho Onde encontrar LAN e passageiros Desempenho Equipe de veículos Roadmap Perguntas abertas 01 · Visão Pilares do sistema O carro em ZombiAdA não é um teletransporte. É uma ferramenta barulhenta, cara de manter e que pode virar caixão. Ele resolve o problema de distância e cria três novos: combustível, barulho e manutenção. Cada decisão abaixo segue estes quatro pilares. Peso de verdade Massa, inércia e transferência de peso sentidas no volante. Uma van carregada não faz curva como um hatch. Tudo cobra um preço Cada viagem gasta gasolina, pneu e paciência. Ligar o motor avisa a cidade inteira. Horda vence carro Atropelar alguns é catártico. Entrar numa horda de 300 sem preparo termina com o carro parado e as janelas quebrando. Feito para grupo Motorista, atirador na janela, mecânico. O carro é o lugar onde a equipe em LAN mais depende uma da outra. 02 · Frota A frota Sessenta e nove modelos na versão completa, em dez grupos (Motos: 12, Carros: 15, SUVs: 4, Picapes e bigfoot: 4, Vans: 2, Caminhões e ônibus: 5, Agrícola: 1, Militares: 8, Aquáticos: 7, Aéreos: 11), cada um com nome fictício próximo de um modelo real (Ônyx, Corola, Hylux, Titã 160, Guaraní 6x6...): motos, carros, SUVs, picapes, bigfoot, vans, caminhões, ônibus, trator, militares, barcos e aeronaves. A v4 somou 25 modelos novos à frota de 44 da v3. Escolha um para ver a ficha, ou abra a garagem 3D para ver cada modelo intacto, batido e modificado, e bater em qualquer ponto dele. Os valores são o ponto de partida para balanceamento, numa escala de 0 a 10 (barulho em metros de raio audível em marcha normal). Tabela resumida Veículo Inspirado em Combustível Eficiência Lugares Tanque 03 · Física Condução e física O alvo é semi-simulação : mais pesado que um arcade, bem mais perdoável que um simulador. O jogador precisa sentir que freou tarde, mas não precisa dosar embreagem. Modelo físico Corpo rígido único com centro de massa baixo e ajustável pela carga no porta-malas. Suspensão por raycast por roda (mola + amortecedor), mais barata e estável que colisores de roda completos. Curva de atrito de pneu simplificada (aderência longitudinal e lateral separadas). Câmbio automático por padrão, manual opcional. RPM simulado para som e consumo. Freio de mão trava as rodas traseiras para curvas de 180° em fuga. Superfícies Asfalto seco aderência 1,0 Asfalto molhado 0,75, com aquaplanagem acima de 90 km/h Terra 0,65 · Grama 0,55 Lama 0,4, e veículos sem 4x4 atolam Sangue e corpos 0,5 por alguns segundos

// ===== script 0 (37 KB)

(function () {
  // vel, acel, manobra, resist, carga, consumo (10 = beberrão), barulho em metros
  var fleet = [
 {
  "g": "Motos",
  "n": "Monarca Barra Circular",
  "c": "Bicicleta",
  "d": "A clássica bicicleta de barra dupla curva, de aço, com bagageiro. Silenciosa, sem combustível e totalmente exposta.",
  "insp": "Monark Barra Circular",
  "s": [
   1,
   10,
   10,
   1,
   1,
   0
  ],
  "r": 5,
  "seats": "1 (+1 no bagageiro)",
  "tank": "—",
  "eff": "—",
  "fuel": "Nenhum",
  "auto": "Fôlego do ciclista",
  "vmax": 25,
  "tags": [
   "Nenhum",
   "Inspirado no Monark Barra Circular"
  ]
 },
 {
  "g": "Motos",
  "n": "PXC 160",
  "c": "Scooter 160 cc",
  "d": "Câmbio automático, assoalho plano e baú sob o banco. Fácil de pilotar no meio do engarrafamento abandonado; rodas pequenas sofrem na terra.",
  "insp": "Honda PCX 160",
  "s": [
   5,
   9,
   9,
   3,
   2,
   1
  ],
  "r": 50,
  "seats": "2",
  "tank": "8,1 L",
  "eff": "40 km/L",
  "fuel": "Gasolina",
  "auto": "320 km",
  "vmax": 115,
  "tags": [
   "Gasolina",
   "Inspirado no Honda PCX 160"
  ]
 },
 {
  "g": "Motos",
  "n": "Titã 160",
  "c": "Moto urbana 160 cc",
  "d": "A moto mais vendida do país: passa entre carros parados e se conserta com qualquer peça. Uma queda no meio da horda pode ser fatal.",
  "insp": "Honda CG 160 Titan",
  "s": [
   5,
   9,
   9,
   3,
   2,
   1
  ],
  "r": 70,
  "seats": "2",
  "tank": "16,1 L",
  "eff": "40 km/L (G) · 28 km/L (E)",
  "fuel": "Flex",
  "auto": "640 km",
  "vmax": 115,
  "tags": [
   "Flex",
   "Inspirado no Honda CG 160 Titan"
  ]
 },
 {
  "g": "Motos",
  "n": "Brós 160",
  "c": "Moto trail 160 cc",
  "d": "Suspensão longa e pneus de cravo: sobe barranco, atravessa lama e foge da horda por trilha onde carro não passa.",
  "insp": "Honda NXR 160 Bros",
  "s": [
   5,
   9,
   9,
   3,
   2,
   1
  ],
  "r": 70,
  "seats": "2",
  "tank": "12 L",
  "eff": "38 km/L (G) · 26 km/L (E)",
  "fuel": "Flex",
  "auto": "450 km",
  "vmax": 115,
  "tags": [
   "Flex",
   "Inspirado no Honda NXR 160 Bros"
  ]
 },
 {
  "g": "Motos",
  "n": "GZ 1250 Aventura",
  "c": "Big trail 1250 cc",
  "d": "Motor boxer, tanque de 30 litros e malas de alumínio. Atravessa o país sem parar em posto, mas pesa muito para levantar sozinho.",
  "insp": "BMW R 1250 GS Adventure",
  "s": [
   10,
   8,
   8,
   4,
   3,
   2
  ],
  "r": 85,
  "seats": "2",
  "tank": "30 L",
  "eff": "20 km/L",
  "fuel": "Gasolina",
  "auto": "600 km",
  "vmax": 220,
  "tags": [
   "Gasolina",
   "Inspirado no BMW R 1250 GS Adventure"
  ]
 },
 {
  "g": "Motos",
  "n": "GZ 1250 Rodoviária",
  "c": "Big trail policial",
  "d": "A big trail da polícia rodoviária: branca e azul, malas com faixas, sirene e luzes no protetor do motor. Feita para rodar centenas de quilômetros por dia na rodovia.",
  "insp": "BMW R 1250 GS da PRF",
  "s": [
   10,
   8,
   8,
   4,
   3,
   2
  ],
  "r": 85,
  "seats": "2",
  "tank": "30 L",
  "eff": "20 km/L",
  "fuel": "Gasolina",
  "auto": "600 km",
  "vmax": 220,
  "tags": [
   "Gasolina",
   "Inspirado no BMW R 1250 GS da PRF"
  ]
 },
 {
  "g": "Motos",
  "n": "Grizzli 700",
  "c": "Quadriciclo 4x4",
  "d": "Tração 4x4 e bagageiros na frente e atrás. Bom em fazenda e mato; instável em alta velocidade e sem nenhuma proteção.",
  "insp": "Yamaha Grizzly 700",
  "s": [
   5,
   8,
   8,
   4,
   3,
   5
  ],
  "r": 65,
  "seats": "1 (+1 improvisado)",
  "tank": "18 L",
  "eff": "13 km/L",
  "fuel": "Gasolina",
  "auto": "230 km",
  "vmax": 100,
  "tags": [
   "Gasolina",
   "Inspirado no Yamaha Grizzly 700"
  ]
 },
 {
  "g": "Motos",
  "n": "Bis 125",
  "c": "Cub 125 cc (motoneta)",
  "d": "A motoneta de passagem baixa: sobe-se nela de saia, cabe capacete sob o banco e roda quase 50 km com um litro. Rodas pequenas e pouca proteção na horda.",
  "insp": "Honda Biz 125",
  "s": [
   4,
   8,
   9,
   3,
   2,
   1
  ],
  "r": 55,
  "seats": "2",
  "tank": "5,1 L",
  "eff": "50 km/L (G) · 35 km/L (E)",
  "fuel": "Flex",
  "auto": "255 km",
  "vmax": 95,
  "tags": [
   "Flex",
   "Inspirado no Honda Biz 125"
  ]
 },
 {
  "g": "Motos",
  "n": "Fazê 250",
  "c": "Naked 250 cc",
  "d": "Naked de 250 cc com farol de LED e tanque musculoso. Mais fôlego que as 160 para fugir na estrada, sem perder o jeito de moto de cidade.",
  "insp": "Yamaha FZ25 Fazer 250",
  "s": [
   5,
   9,
   9,
   3,
   2,
   2
  ],
  "r": 75,
  "seats": "2",
  "tank": "14 L",
  "eff": "30 km/L (G) · 21 km/L (E)",
  "fuel": "Flex",
  "auto": "420 km",
  "vmax": 135,
  "tags": [
   "Flex",
   "Inspirado no Yamaha FZ25 Fazer 250"
  ]
 },
 {
  "g": "Motos",
  "n": "Ninjá 400",
  "c": "Esportiva 400 cc",
  "d": "Esportiva bicilíndrica leve: passa dos 180 km/h na estrada vazia. Posição de corrida e carenagem de plástico, que racha na primeira queda.",
  "insp": "Kawasaki Ninja 400",
  "s": [
   8,
   9,
   9,
   3,
   2,
   3
  ],
  "r": 85,
  "seats": "2",
  "tank": "14 L",
  "eff": "25 km/L",
  "fuel": "Gasolina",
  "auto": "350 km",
  "vmax": 190,
  "tags": [
   "Gasolina",
   "Inspirado no Kawasaki Ninja 400"
  ]
 },
 {
  "g": "Motos",
  "n": "Fat Boi 114",
  "c": "Custom V2 1868 cc",
  "d": "Custom pesada de rodas fechadas e motor V2 de 1,9 litro. O ronco chama zumbi de longe, mas o torque arrasta qualquer obstáculo.",
  "insp": "Harley-Davidson Fat Boy 114",
  "s": [
   8,
   8,
   6,
   4,
   3,
   5
  ],
  "r": 110,
  "seats": "2",
  "tank": "18,9 L",
  "eff": "18 km/L",
  "fuel": "Gasolina",
  "auto": "340 km",
  "vmax": 180,
  "tags": [
   "Gasolina",
   "Inspirado no Harley-Davidson Fat Boy 114"
  ]
 },
 {
  "g": "Motos",
  "n": "Titã 160 Cargo",
  "c": "Moto de entrega 160 cc",
  "d": "A moto de motoboy: banco só do piloto, bagageiro de aço e baú de entrega. O baú leva remédio, comida e munição pela cidade tomada.",
  "insp": "Honda CG 160 Cargo",
  "s": [
   5,
   9,
   9,
   3,
   4,
   1
  ],
  "r": 70,
  "seats": "1 (sem garupa)",
  "tank": "16,1 L + baú de 90 L (20 kg)",
  "eff": "38 km/L (G) · 27 km/L (E)",
  "fuel": "Flex",
  "auto": "610 km",
  "vmax": 110,
  "tags": [
   "Flex",
   "Inspirado no Honda CG 160 Cargo"
  ]
 },
 {
  "g": "Carros",
  "n": "Ônyx",
  "c": "Hatch compacto",
  "d": "O carro mais comum da cidade. Econômico, ágil e frágil. Peça de reposição em qualquer garagem.",
  "insp": "Chevrolet Onix",
  "s": [
   8,
   7,
   7,
   5,
   4,
   5
  ],
  "r": 60,
  "seats": "5",
  "tank": "44 L",
  "eff": "13,9 km/L (G) · 9,8 km/L (E)",
  "fuel": "Flex",
  "auto": "610 km",
  "vmax": 170,
  "tags": [
   "Flex",
   "Inspirado no Chevrolet Onix"
  ]
 },
 {
  "g": "Carros",
  "n": "Ônyx Plus Táxi",
  "c": "Sedã compacto (táxi)",
  "d": "Sedã branco com luminoso no teto e rádio da cooperativa. Porta-malas grande para mantimentos.",
  "insp": "Chevrolet Onix Plus",
  "s": [
   8,
   7,
   7,
   5,
   4,
   5
  ],
  "r": 60,
  "seats": "5",
  "tank": "44 L",
  "eff": "13,4 km/L (G) · 9,4 km/L (E)",
  "fuel": "Flex",
  "auto": "590 km",
  "vmax": 175,
  "tags": [
   "Flex",
   "Inspirado no Chevrolet Onix Plus"
  ]
 },
 {
  "g": "Carros",
  "n": "Kwyd",
  "c": "Hatch de entrada",
  "d": "Leve, alto do chão e barato de manter. Cabe em qualquer beco, mas a lataria fina amassa fácil.",
  "insp": "Renault Kwid",
  "s": [
   7,
   7,
   7,
   5,
   4,
   4
  ],
  "r": 55,
  "seats": "5",
  "tank": "38 L",
  "eff": "15,3 km/L (G) · 10,8 km/L (E)",
  "fuel": "Flex",
  "auto": "580 km",
  "vmax": 156,
  "tags": [
   "Flex",
   "Inspirado no Renault Kwid"
  ]
 },
 {
  "g": "Carros",
  "n": "Dolfin",
  "c": "Hatch elétrico",
  "d": "Silencioso o bastante para passar por uma horda dormindo. Precisa de energia para recarregar; bateria batida pega fogo.",
  "insp": "BYD Dolphin",
  "s": [
   7,
   7,
   6,
   6,
   4,
   1
  ],
  "r": 15,
  "seats": "5",
  "tank": "44,9 kWh",
  "eff": "6,5 km/kWh",
  "fuel": "Elétrico",
  "auto": "291 km",
  "vmax": 150,
  "tags": [
   "Elétrico",
   "Inspirado no BYD Dolphin"
  ]
 },
 {
  "g": "Carros",
  "n": "Corola",
  "c": "Sedã médio",
  "d": "Equilíbrio entre conforto, porta-malas e velocidade. Confiável até o fim do mundo.",
  "insp": "Toyota Corolla",
  "s": [
   9,
   7,
   6,
   6,
   4,
   6
  ],
  "r": 60,
  "seats": "5",
  "tank": "50 L",
  "eff": "11,8 km/L (G) · 8,2 km/L (E)",
  "fuel": "Flex",
  "auto": "590 km",
  "vmax": 195,
  "tags": [
   "Flex",
   "Inspirado no Toyota Corolla"
  ]
 },
 {
  "g": "Carros",
  "n": "Cruzi Patrulha",
  "c": "Sedã policial",
  "d": "Motor turbo, giroflex, sirene e grade separando o banco de trás. Rádio e armário de armas vazios. A sirene atrai a horda num raio de 250 m.",
  "insp": "Chevrolet Cruze da PM",
  "s": [
   9,
   7,
   6,
   6,
   4,
   6
  ],
  "r": 70,
  "seats": "4 + 1 detido",
  "tank": "52 L",
  "eff": "11,5 km/L (G) · 8,1 km/L (E)",
  "fuel": "Flex",
  "auto": "600 km",
  "vmax": 205,
  "tags": [
   "Flex",
   "Inspirado no Chevrolet Cruze da PM"
  ]
 },
 {
  "g": "Carros",
  "n": "Cruzi Rodoviária",
  "c": "Sedã policial rodoviário",
  "d": "A mesma viatura com a pintura da polícia rodoviária: branca com faixas azul e amarela. Achada parada em postos de fiscalização à beira da estrada. A sirene atrai a horda num raio de 250 m.",
  "insp": "Chevrolet Cruze da PRF",
  "s": [
   9,
   7,
   6,
   6,
   4,
   6
  ],
  "r": 70,
  "seats": "4 + 1 detido",
  "tank": "52 L",
  "eff": "11,5 km/L (G) · 8,1 km/L (E)",
  "fuel": "Flex",
  "auto": "600 km",
  "vmax": 205,
  "tags": [
   "Flex",
   "Inspirado no Chevrolet Cruze da PRF"
  ]
 },
 {
  "g": "Carros",
  "n": "Fusquinha 1300",
  "c": "Sedã clássico (motor traseiro)",
  "d": "Motor a ar atrás, sem radiador para furar. Mecânica simples: qualquer um conserta com chave e arame. Barulhento e lento, mas não morre.",
  "insp": "Volkswagen Fusca",
  "s": [
   5,
   8,
   7,
   5,
   4,
   6
  ],
  "r": 75,
  "seats": "5 (apertados)",
  "tank": "40 L",
  "eff": "11 km/L",
  "fuel": "Gasolina",
  "auto": "440 km",
  "vmax": 120,
  "tags": [
   "Gasolina",
   "Inspirado no Volkswagen Fusca"
  ]
 },
 {
  "g": "Carros",
  "n": "Unno Mille",
  "c": "Hatch popular quadrado",
  "d": "O quadradinho que sobreviveu a tudo. Leve, alto do chão e com peça em qualquer ferro-velho. Este veio com a escada do eletricista no teto: serve para subir em muro e telhado.",
  "insp": "Fiat Uno Mille",
  "s": [
   6,
   6,
   7,
   4,
   3,
   3
  ],
  "r": 62,
  "seats": "5",
  "tank": "50 L",
  "eff": "12,8 km/L (G) · 9,0 km/L (E)",
  "fuel": "Flex",
  "auto": "640 km",
  "vmax": 153,
  "tags": [
   "Flex",
   "Inspirado no Fiat Uno Mille"
  ]
 },
 {
  "g": "Carros",
  "n": "Gól G5",
  "c": "Hatch compacto",
  "d": "O carro mais vendido de uma década inteira. Mecânica conhecida, suspensão firme e porta-malas pequeno. Fácil de achar parado em qualquer rua.",
  "insp": "Volkswagen Gol G5",
  "s": [
   7,
   7,
   7,
   5,
   4,
   4
  ],
  "r": 60,
  "seats": "5",
  "tank": "55 L",
  "eff": "12,9 km/L (G) · 8,9 km/L (E)",
  "fuel": "Flex",
  "auto": "700 km",
  "vmax": 168,
  "tags": [
   "Flex",
   "Inspirado no Volkswagen Gol G5"
  ]
 },
 {
  "g": "Carros",
  "n": "HB-21",
  "c": "Hatch compacto",
  "d": "Hatch moderno de frota de aplicativo. Econômico, confortável e cheio de eletrônica que ninguém mais sabe consertar.",
  "insp": "Hyundai HB20",
  "s": [
   7,
   7,
   7,
   5,
   4,
   4
  ],
  "r": 58,
  "seats": "5",
  "tank": "50 L",
  "eff": "13,9 km/L (G) · 9,9 km/L (E)",
  "fuel": "Flex",
  "auto": "690 km",
  "vmax": 161,
  "tags": [
   "Flex",
   "Inspirado no Hyundai HB20"
  ]
 },
 {
  "g": "Carros",
  "n": "Pólo",
  "c": "Hatch compacto",
  "d": "Motor turbo pequeno e bem firme na estrada. Rápido para fugir, econômico para viajar, mas a eletrônica sofre com a falta de oficina.",
  "insp": "Volkswagen Polo",
  "s": [
   8,
   7,
   7,
   5,
   4,
   5
  ],
  "r": 58,
  "seats": "5",
  "tank": "52 L",
  "eff": "15,0 km/L (G) · 10,4 km/L (E)",
  "fuel": "Flex",
  "auto": "780 km",
  "vmax": 197,
  "tags": [
   "Flex",
   "Inspirado no Volkswagen Polo"
  ]
 },
 {
  "g": "Carros",
  "n": "Cívico",
  "c": "Sedã médio fastback",
  "d": "Sedã baixo e largo, de motor que gira alto. Corre muito na estrada, mas raspa o para-choque em qualquer lombada ou monte de entulho.",
  "insp": "Honda Civic G10",
  "s": [
   9,
   7,
   6,
   6,
   4,
   6
  ],
  "r": 62,
  "seats": "5",
  "tank": "56 L",
  "eff": "12,1 km/L (G) · 8,5 km/L (E)",
  "fuel": "Flex",
  "auto": "680 km",
  "vmax": 200,
  "tags": [
   "Flex",
   "Inspirado no Honda Civic G10"
  ]
 },
 {
  "g": "Carros",
  "n": "Opalla Comodoro",
  "c": "Sedã clássico (seis cilindros)",
  "d": "Seis cilindros em linha, tração traseira e lataria grossa de chapa antiga. Bebe muito, mas aguenta pancada e empurra carro parado da rua.",
  "insp": "Chevrolet Opala Comodoro",
  "s": [
   7,
   7,
   5,
   6,
   5,
   8
  ],
  "r": 78,
  "seats": "5 (6 apertados)",
  "tank": "84 L",
  "eff": "7,6 km/L",
  "fuel": "Gasolina",
  "auto": "640 km",
  "vmax": 170,
  "tags": [
   "Gasolina",
   "Inspirado no Chevrolet Opala Comodoro"
  ]
 },
 {
  "g": "Carros",
  "n": "Mustangue GT",
  "c": "Cupê esportivo V8",
  "d": "V8 de cinco litros e tração traseira. O mais rápido da garagem em reta, mas o ronco acorda a horda de quarteirões inteiros e o tanque some rápido.",
  "insp": "Ford Mustang GT",
  "s": [
   10,
   9,
   5,
   6,
   3,
   9
  ],
  "r": 120,
  "seats": "4 (2 + 2 apertados)",
  "tank": "61 L",
  "eff": "7,2 km/L",
  "fuel": "Gasolina",
  "auto": "440 km",
  "vmax": 250,
  "tags": [
   "Gasolina",
   "Inspirado no Ford Mustang GT"
  ]
 },
 {
  "g": "SUVs",
  "n": "T-Crux",
  "c": "SUV compacto",
  "d": "SUV compacto de cidade: alto o bastante para pular meio-fio, curto para manobrar entre carros abandonados. Turbo flex bebe o que achar.",
  "insp": "Volkswagen T-Cross",
  "s": [
   8,
   7,
   6,
   6,
   4,
   6
  ],
  "r": 60,
  "seats": "5",
  "tank": "52 L",
  "eff": "11,8 km/L (G) · 8,2 km/L (E)",
  "fuel": "Flex",
  "auto": "610 km",
  "vmax": 190,
  "tags": [
   "Flex",
   "Inspirado no Volkswagen T-Cross"
  ]
 },
 {
  "g": "SUVs",
  "n": "Corola Crux Híbrido",
  "c": "SUV híbrido flex",
  "d": "Anda no modo elétrico em silêncio pela cidade e liga o motor flex na estrada. Bateria híbrida batida pode pegar fogo.",
  "insp": "Toyota Corolla Cross Hybrid",
  "s": [
   8,
   7,
   6,
   6,
   4,
   3
  ],
  "r": 20,
  "seats": "5",
  "tank": "36 L + bateria de 1,3 kWh",
  "eff": "17,0 km/L (G) · 11,8 km/L (E)",
  "fuel": "Híbrido",
  "auto": "610 km",
  "vmax": 170,
  "tags": [
   "Híbrido",
   "Inspirado no Toyota Corolla Cross Hybrid"
  ]
 },
 {
  "g": "SUVs",
  "n": "Compas Longitude",
  "c": "SUV médio 4x4 diesel",
  "d": "Grade de sete fendas, teto preto e tração 4x4 com diesel. Confortável na estrada e firme na terra.",
  "insp": "Jeep Compass",
  "s": [
   9,
   7,
   6,
   6,
   4,
   6
  ],
  "r": 70,
  "seats": "5",
  "tank": "60 L",
  "eff": "10,3 km/L (cidade) · 13,5 km/L (estrada)",
  "fuel": "Diesel",
  "auto": "800 km",
  "vmax": 190,
  "tags": [
   "Diesel",
   "Inspirado no Jeep Compass"
  ]
 },
 {
  "g": "SUVs",
  "n": "Hylux SW-4",
  "c": "SUV 4x4 de 7 lugares",
  "d": "Alta, pesada e com chassi de picape. Sete lugares, reduzida e diesel: leva a família inteira para fora da cidade.",
  "insp": "Toyota SW4",
  "s": [
   8,
   7,
   6,
   6,
   5,
   7
  ],
  "r": 75,
  "seats": "7",
  "tank": "80 L",
  "eff": "9,8 km/L (cidade) · 11,2 km/L (estrada)",
  "fuel": "Diesel",
  "auto": "800 km",
  "vmax": 180,
  "tags": [
   "Diesel",
   "Inspirado no Toyota SW4"
  ]
 },
 {
  "g": "Picapes e bigfoot",
  "n": "Estrada Cabine Dupla",
  "c": "Picape compacta",
  "d": "A picape mais vendida do país: leve, econômica e com caçamba para 650 kg. Não tem 4x4, mas acha peça em qualquer cidade.",
  "insp": "Fiat Strada",
  "s": [
   8,
   7,
   7,
   5,
   4,
   5
  ],
  "r": 60,
  "seats": "5",
  "tank": "55 L",
  "eff": "12,5 km/L (G) · 8,9 km/L (E)",
  "fuel": "Flex",
  "auto": "690 km",
  "vmax": 171,
  "tags": [
   "Flex",
   "Inspirado no Fiat Strada"
  ]
 },
 {
  "g": "Picapes e bigfoot",
  "n": "Touro Ultra",
  "c": "Picape média 4x4 diesel",
  "d": "Picape com jeito de SUV: farol dividido em dois andares, tampa traseira que abre como porta e diesel 4x4.",
  "insp": "Fiat Toro",
  "s": [
   9,
   7,
   6,
   6,
   5,
   6
  ],
  "r": 70,
  "seats": "5",
  "tank": "60 L",
  "eff": "10,1 km/L (cidade) · 12,6 km/L (estrada)",
  "fuel": "Diesel",
  "auto": "610 a 750 km",
  "vmax": 193,
  "tags": [
   "Diesel",
   "Inspirado no Fiat Toro"
  ]
 },
 {
  "g": "Picapes e bigfoot",
  "n": "Hylux Cabine Dupla",
  "c": "Picape média 4x4 diesel",
  "d": "A favorita dos sobreviventes: chassi forte, reduzida, santo-antônio e caçamba para uma tonelada.",
  "insp": "Toyota Hilux",
  "s": [
   8,
   7,
   6,
   6,
   5,
   6
  ],
  "r": 75,
  "seats": "5",
  "tank": "80 L",
  "eff": "10,1 km/L (cidade) · 11,3 km/L (estrada)",
  "fuel": "Diesel",
  "auto": "800 km",
  "vmax": 180,
  "tags": [
   "Diesel",
   "Inspirado no Toyota Hilux"
  ]
 },
 {
  "g": "Picapes e bigfoot",
  "n": "Bigfut",
  "c": "Monster truck",
  "d": "Carroceria de picape antiga em cima de pneus de 1,68 m. Passa por cima de carros, muros e hordas. O V8 com blower acorda a cidade inteira.",
  "insp": "monster truck Bigfoot",
  "s": [
   5,
   6,
   5,
   7,
   5,
   10
  ],
  "r": 220,
  "seats": "1",
  "tank": "120 L",
  "eff": "0,7 km/L",
  "fuel": "Etanol",
  "auto": "80 km",
  "vmax": 110,
  "tags": [
   "Etanol",
   "Inspirado no monster truck Bigfoot"
  ]
 },
 {
  "g": "Vans",
  "n": "Sprinta Furgão",
  "c": "Furgão de carga teto alto",
  "d": "Teto alto, porta lateral corrediça e 1,9 tonelada de carga. Sem tração para lama, mas cabe um acampamento inteiro no baú.",
  "insp": "Mercedes-Benz Sprinter",
  "s": [
   7,
   7,
   6,
   6,
   5,
   6
  ],
  "r": 75,
  "seats": "3",
  "tank": "71 L",
  "eff": "10,3 km/L (cidade) · 11,8 km/L (estrada)",
  "fuel": "Diesel",
  "auto": "730 km",
  "vmax": 155,
  "tags": [
   "Diesel",
   "Inspirado no Mercedes-Benz Sprinter"
  ]
 },
 {
  "g": "Vans",
  "n": "Ducatto Resgate",
  "c": "Ambulância de resgate",
  "d": "Furgão com maca, cilindro de oxigênio e armário de remédios. Ótimo para levar feridos; a sirene atrai zumbis de longe.",
  "insp": "Fiat Ducato ambulância",
  "s": [
   7,
   6,
   6,
   7,
   5,
   7
  ],
  "r": 80,
  "seats": "3 na cabine + 2 atrás + 1 maca",
  "tank": "90 L",
  "eff": "8,6 km/L",
  "fuel": "Diesel",
  "auto": "770 km",
  "vmax": 150,
  "tags": [
   "Diesel",
   "Inspirado no Fiat Ducato ambulância"
  ]
 },
 {
  "g": "Caminhões e ônibus",
  "n": "Delivéri 11.180 Baú",
  "c": "Caminhão leve com baú",
  "d": "Cabine avançada estreita, faróis em cunha e baú de 5,5 m. Atravessa horda média sem parar e guarda suprimentos trancados. A cabine bascula para mostrar o diesel de 4 cilindros.",
  "insp": "Volkswagen Delivery 11.180",
  "s": [
   5,
   6,
   5,
   7,
   5,
   8
  ],
  "r": 105,
  "seats": "3",
  "tank": "150 L",
  "eff": "5,5 km/L",
  "fuel": "Diesel",
  "auto": "820 km",
  "vmax": 110,
  "tags": [
   "Diesel",
   "Inspirado no Volkswagen Delivery 11.180"
  ]
 },
 {
  "g": "Caminhões e ônibus",
  "n": "Constelação 24.280 Tanque",
  "c": "Caminhão-tanque 6x2",
  "d": "Cabine alta com grade preta e tanque elíptico de 20 mil litros de gasolina. Um tiro no tanque e a rua explode. A cabine bascula para mostrar o diesel de 6 cilindros.",
  "insp": "Volkswagen Constellation 24.280",
  "s": [
   5,
   5,
   5,
   8,
   6,
   10
  ],
  "r": 115,
  "seats": "2",
  "tank": "275 L (+20.000 L de carga)",
  "eff": "2,9 km/L",
  "fuel": "Diesel",
  "auto": "790 km",
  "vmax": 100,
  "tags": [
   "Diesel",
   "Inspirado no Volkswagen Constellation 24.280"
  ]
 },
 {
  "g": "Caminhões e ônibus",
  "n": "ON Escolar",
  "c": "Ônibus escolar rural",
  "d": "O ônibus amarelo das escolas do interior: alto, robusto e com motor dianteiro. Porta dupla atrás da roda, 44 alunos sentados e nenhuma discrição. A tampa da frente abre para o motor.",
  "insp": "Volksbus ORE 2 (Caminho da Escola)",
  "s": [
   4,
   5,
   5,
   8,
   6,
   9
  ],
  "r": 100,
  "seats": "44 alunos (ou 31 adultos) + motorista",
  "tank": "210 L",
  "eff": "3,8 km/L",
  "fuel": "Diesel",
  "auto": "800 km",
  "vmax": 90,
  "tags": [
   "Diesel",
   "Inspirado no Volksbus ORE 2 (Caminho da Escola)"
  ]
 },
 {
  "g": "Caminhões e ônibus",
  "n": "Marcopólo Torino",
  "c": "Ônibus urbano de piso baixo",
  "d": "O ônibus de linha das capitais: para-brisa gigante, letreiro de LED e duas portas largas. Piso baixo, catraca e motor traseiro com tampa que abre.",
  "insp": "Marcopolo Torino",
  "s": [
   4,
   5,
   4,
   8,
   6,
   10
  ],
  "r": 105,
  "seats": "37 sentados + 43 em pé",
  "tank": "275 L",
  "eff": "2,3 km/L",
  "fuel": "Diesel",
  "auto": "630 km",
  "vmax": 90,
  "tags": [
   "Diesel",
   "Inspirado no Marcopolo Torino"
  ]
 },
 {
  "g": "Caminhões e ônibus",
  "n": "Atego Forte",
  "c": "Carro-forte blindado",
  "d": "Cabine avançada blindada e cofre de aço com seteiras. Vidros à prova de tiro e de mordida. Pesado e beberrão, mas ninguém entra. A cabine bascula para o diesel.",
  "insp": "Mercedes-Benz Atego (carro-forte)",
  "s": [
   5,
   5,
   4,
   8,
   6,
   9
  ],
  "r": 90,
  "seats": "4 (motorista + 3 vigilantes)",
  "tank": "210 L",
  "eff": "3,6 km/L",
  "fuel": "Diesel",
  "auto": "750 km",
  "vmax": 100,
  "tags": [
   "Diesel",
   "Inspirado no Mercedes-Benz Atego (carro-forte)"
  ]
 },
 {
  "g": "Agrícola",
  "n": "Massei 275",
  "c": "Trator agrícola",
  "d": "O trator vermelho de toda fazenda: capô comprido, rodões traseiros e arco de proteção com toldo. Lento, mas não atola nunca e empurra carros parados. O capô abre para mostrar o diesel de quatro cilindros.",
  "insp": "Massey Ferguson 275",
  "s": [
   1,
   6,
   6,
   7,
   5,
   8
  ],
  "r": 90,
  "seats": "1",
  "tank": "68 L",
  "eff": "5,5 L/h",
  "fuel": "Diesel",
  "auto": "12 h de uso",
  "vmax": 28,
  "tags": [
   "Diesel",
   "Inspirado no Massey Ferguson 275"
  ]
 },
 {
  "g": "Militares",
  "n": "Maruá AM2",
  "c": "Viatura leve 4x4",
  "d": "Jipe militar de duas portas, capota de lona e para-brisa que rebate. Sobe barranco, atravessa riacho de 60 cm e leva seis com equipamento.",
  "insp": "Agrale Marruá AM2",
  "s": [
   5,
   7,
   6,
   6,
   5,
   7
  ],
  "r": 85,
  "seats": "2 + 4 combatentes",
  "tank": "100 L + 20 L de reserva",
  "eff": "9,5 km/L",
  "fuel": "Diesel",
  "auto": "1.000 km",
  "vmax": 120,
  "tags": [
   "Diesel",
   "Inspirado no Agrale Marruá AM2"
  ]
 },
 {
  "g": "Militares",
  "n": "Worqer 15.210 Militar",
  "c": "Caminhão de tropa 4x4",
  "d": "Cabine avançada que bascula, tração 4x4 e carroceria com lona e dois bancos de madeira. Leva um pelotão inteiro ou cinco toneladas de suprimentos.",
  "insp": "Volkswagen Worker 15.210 4x4 militar",
  "s": [
   4,
   5,
   5,
   8,
   6,
   9
  ],
  "r": 120,
  "seats": "3 + 20 combatentes",
  "tank": "275 L",
  "eff": "3,6 km/L",
  "fuel": "Diesel",
  "auto": "950 km",
  "vmax": 95,
  "tags": [
   "Diesel",
   "Inspirado no Volkswagen Worker 15.210 4x4 militar"
  ]
 },
 {
  "g": "Militares",
  "n": "Guaraní 6x6",
  "c": "Blindado de transporte de tropa 6x6",
  "d": "Casco em cunha com laterais inclinadas, seis rodas e estação de armas no teto. Flutua, leva onze e aguenta tiro de fuzil por todos os lados.",
  "insp": "VBTP-MR Guarani",
  "s": [
   5,
   5,
   4,
   9,
   7,
   10
  ],
  "r": 140,
  "seats": "3 + 8 combatentes",
  "tank": "550 L",
  "eff": "1,1 km/L",
  "fuel": "Diesel",
  "auto": "600 km",
  "vmax": 100,
  "tags": [
   "Diesel",
   "Inspirado no VBTP-MR Guarani"
  ]
 },
 {
  "g": "Militares",
  "n": "Cascável EE-9",
  "c": "Blindado de reconhecimento 6x6",
  "d": "Proa em cunha, bogie traseiro de balancim e torre com canhão de 90 mm. Rápido no asfalto, abre caminho em barricada e a tripulação vê tudo pelos periscópios.",
  "insp": "Engesa EE-9 Cascavel",
  "s": [
   5,
   5,
   4,
   8,
   6,
   10
  ],
  "r": 120,
  "seats": "3",
  "tank": "360 L",
  "eff": "2,2 km/L",
  "fuel": "Diesel",
  "auto": "750 km",
  "vmax": 100,
  "tags": [
   "Diesel",
   "Inspirado no Engesa EE-9 Cascavel"
  ]
 },
 {
  "g": "Militares",
  "n": "Leopardo 1A5",
  "c": "Carro de combate sobre lagartas",
  "d": "Quarenta toneladas sobre lagartas, torre em cunha e canhão de 105 mm. Passa por cima de carro, muro e horda. Bebe diesel como ninguém e é ouvido de longe.",
  "insp": "Leopard 1A5 BR",
  "s": [
   3,
   4,
   3,
   10,
   8,
   10
  ],
  "r": 320,
  "seats": "4",
  "tank": "955 L",
  "eff": "0,6 km/L (≈ 160 L/100 km)",
  "fuel": "Diesel",
  "auto": "600 km",
  "vmax": 65,
  "tags": [
   "Diesel",
   "Inspirado no Leopard 1A5 BR"
  ]
 },
 {
  "g": "Militares",
  "n": "Falcão Negro HM-2",
  "c": "Helicóptero de assalto e transporte",
  "d": "Dois turboeixos, rotor de quatro pás e portas corrediças largas. Tira onze soldados de um telhado cercado e aguenta tiro de fuzil nas pás.",
  "insp": "Sikorsky UH-60 Black Hawk",
  "s": [
   10,
   6,
   5,
   8,
   6,
   8
  ],
  "r": 600,
  "seats": "2 pilotos + 2 artilheiros + 11 soldados",
  "tank": "1.360 L",
  "eff": "≈ 600 L/h",
  "fuel": "Querosene de aviação",
  "auto": "590 km",
  "vmax": 295,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Sikorsky UH-60 Black Hawk"
  ]
 },
 {
  "g": "Militares",
  "n": "Super Tucanno",
  "c": "Turboélice de ataque leve, 2 lugares em tandem",
  "d": "Turboélice de ataque leve e treinamento avançado. Voa baixo e devagar o bastante para ver a horda, com duas .50 nas asas e foguetes nos pilones.",
  "insp": "Embraer EMB-314 Super Tucano (A-29)",
  "s": [
   10,
   9,
   7,
   7,
   5,
   10
  ],
  "r": 800,
  "seats": "2 (piloto e operador em tandem)",
  "tank": "695 L internos (+ tanques externos)",
  "eff": "≈ 260 L/h",
  "fuel": "Querosene de aviação",
  "auto": "1.330 km",
  "vmax": 590,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Embraer EMB-314 Super Tucano (A-29)"
  ]
 },
 {
  "g": "Militares",
  "n": "Sabre AH-2",
  "c": "Helicóptero de ataque e transporte",
  "d": "Tanque voador: blindado, armado com canhão duplo e foguetes, e ainda leva oito soldados no meio. Barulhento e sedento, mas abre caminho em qualquer horda.",
  "insp": "Mil Mi-35M (AH-2 Sabre da FAB)",
  "s": [
   10,
   7,
   5,
   9,
   7,
   10
  ],
  "r": 900,
  "seats": "2 tripulantes + 8 soldados",
  "tank": "≈ 2.100 L internos",
  "eff": "≈ 700 L/h",
  "fuel": "Querosene de aviação",
  "auto": "460 km",
  "vmax": 300,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Mil Mi-35M (AH-2 Sabre da FAB)"
  ]
 },
 {
  "g": "Aquáticos",
  "n": "Levfort Marajó",
  "c": "Barco de alumínio com motor de popa",
  "d": "Barco de alumínio de fundo semichato, o táxi dos rios. Leve, rápido e barulhento.",
  "insp": "Levefort Marajó",
  "s": [
   2,
   8,
   8,
   4,
   3,
   8
  ],
  "r": 90,
  "seats": "5",
  "tank": "25 L (tanque portátil)",
  "eff": "≈ 9 L/h (30 hp)",
  "fuel": "Gasolina",
  "auto": "≈ 70 km",
  "vmax": 50,
  "tags": [
   "Gasolina",
   "Inspirado no Levefort Marajó"
  ]
 },
 {
  "g": "Aquáticos",
  "n": "Foker 240",
  "c": "Lancha de 24 pés com proa aberta",
  "d": "Casco em V fundo e um motor de popa de 250 hp. Rota de fuga pela represa com a família inteira.",
  "insp": "Focker 240",
  "s": [
   4,
   7,
   6,
   6,
   4,
   8
  ],
  "r": 110,
  "seats": "10",
  "tank": "140 L",
  "eff": "≈ 50 L/h (cruzeiro)",
  "fuel": "Gasolina",
  "auto": "≈ 110 km",
  "vmax": 85,
  "tags": [
   "Gasolina",
   "Inspirado no Focker 240"
  ]
 },
 {
  "g": "Aquáticos",
  "n": "Traineira Esperança",
  "c": "Traineira de madeira",
  "d": "Casco de madeira com casaria a ré e pneus de defensa. Dá para morar nele, longe da margem.",
  "insp": "barco de pesca artesanal",
  "s": [
   1,
   5,
   5,
   8,
   6,
   8
  ],
  "r": 80,
  "seats": "10",
  "tank": "1.200 L",
  "eff": "≈ 14 L/h",
  "fuel": "Diesel",
  "auto": "≈ 900 km",
  "vmax": 18,
  "tags": [
   "Diesel",
   "Inspirado no barco de pesca artesanal"
  ]
 },
 {
  "g": "Aquáticos",
  "n": "Si-Dú Spark",
  "c": "Moto aquática de 3 lugares",
  "d": "Pequeno, leve e nervoso, com turbina em vez de hélice. Pula marola e foge por canal raso.",
  "insp": "Sea-Doo Spark",
  "s": [
   4,
   9,
   9,
   3,
   3,
   6
  ],
  "r": 85,
  "seats": "3",
  "tank": "30 L",
  "eff": "≈ 10 L/h (cruzeiro) · 17 L/h (máx.)",
  "fuel": "Gasolina",
  "auto": "≈ 2,5 h · ≈ 100 km",
  "vmax": 80,
  "tags": [
   "Gasolina",
   "Inspirado no Sea-Doo Spark"
  ]
 },
 {
  "g": "Aquáticos",
  "n": "Veleiro Delta 26",
  "c": "Veleiro de oceano de 26 pés (vela e motor diesel auxiliar)",
  "d": "Vela de dia, motor de 10 hp quando o vento some. Lento, mas cruza até o horizonte sem posto de gasolina.",
  "insp": "veleiro de oceano de 26 pés",
  "s": [
   1,
   3,
   4,
   7,
   6,
   2
  ],
  "r": 30,
  "seats": "6 (4 pernoites)",
  "tank": "40 L diesel · 80 L água",
  "eff": "≈ 1,5 L/h no motor · zero na vela",
  "fuel": "Diesel",
  "auto": "≈ 250 km no motor · ilimitada na vela",
  "vmax": 13,
  "tags": [
   "Diesel",
   "Inspirado no veleiro de oceano de 26 pés"
  ]
 },
 {
  "g": "Aquáticos",
  "n": "Zodiaque de resgate",
  "c": "Bote inflável de resgate com motor de popa",
  "d": "Boias de borracha que não afundam nem com furo em um gomo. Entra na enchente e sai com gente pendurada no cabo.",
  "insp": "bote inflável Zodiac FC 470",
  "s": [
   3,
   7,
   8,
   3,
   4,
   5
  ],
  "r": 75,
  "seats": "10",
  "tank": "25 L (tanque portátil)",
  "eff": "≈ 14 L/h (40 hp)",
  "fuel": "Gasolina",
  "auto": "≈ 90 km",
  "vmax": 55,
  "tags": [
   "Gasolina",
   "Inspirado no bote inflável Zodiac FC 470"
  ]
 },
 {
  "g": "Aquáticos",
  "n": "Lancha Patrulha",
  "c": "Lancha de patrulha fluvial armada",
  "d": "Casco de alumínio, dois jatos d'água e metralhadora na proa. Entra em rio raso e sai de ré sem leme.",
  "insp": "lancha de patrulha fluvial LPR-40",
  "s": [
   3,
   4,
   5,
   9,
   5,
   9
  ],
  "r": 160,
  "seats": "4 tripulantes + 8",
  "tank": "≈ 1.600 L",
  "eff": "≈ 120 L/h (cruzeiro de 20 nós)",
  "fuel": "Diesel",
  "auto": "≈ 450 km",
  "vmax": 54,
  "tags": [
   "Diesel",
   "Inspirado no lancha de patrulha fluvial LPR-40"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Sesna 172",
  "c": "Monomotor de asa alta, 4 lugares",
  "d": "Avião de aeroclube. Asa alta, trem fixo e quatro lugares. Precisa de pista livre de zumbis e de gasolina de aviação.",
  "insp": "Cessna 172 Skyhawk",
  "s": [
   10,
   7,
   7,
   5,
   4,
   8
  ],
  "r": 300,
  "seats": "4",
  "tank": "212 L (201 L utilizáveis)",
  "eff": "36 L/h",
  "fuel": "Gasolina de aviação",
  "auto": "1.185 km",
  "vmax": 302,
  "tags": [
   "Gasolina de aviação",
   "Inspirado no Cessna 172 Skyhawk"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Ipanemá EMB-203",
  "c": "Monomotor agrícola a etanol",
  "d": "Avião de lavoura movido a etanol. Pousa em pista de terra e a barra de pulverização pode espalhar isca ou fogo.",
  "insp": "Embraer Ipanema",
  "s": [
   10,
   7,
   6,
   6,
   4,
   8
  ],
  "r": 300,
  "seats": "1",
  "tank": "264 L",
  "eff": "≈ 75 L/h de etanol",
  "fuel": "Etanol",
  "auto": "940 km",
  "vmax": 230,
  "tags": [
   "Etanol",
   "Inspirado no Embraer Ipanema"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Robinsom R44",
  "c": "Helicóptero leve a pistão",
  "d": "Quatro lugares, rotor bipá e motor a pistão. Leve o bastante para pousar em telhado de prédio.",
  "insp": "Robinson R44",
  "s": [
   10,
   7,
   7,
   5,
   4,
   8
  ],
  "r": 400,
  "seats": "4",
  "tank": "185 L",
  "eff": "≈ 57 L/h",
  "fuel": "Gasolina de aviação",
  "auto": "560 km",
  "vmax": 240,
  "tags": [
   "Gasolina de aviação",
   "Inspirado no Robinson R44"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Esquillo AS350",
  "c": "Helicóptero a turbina, 6 lugares",
  "d": "Turbina, rotor de três pás, holofote e guincho de resgate. Tira gente de telhado cercado.",
  "insp": "Helibras AS350 Esquilo",
  "s": [
   10,
   7,
   6,
   6,
   5,
   8
  ],
  "r": 450,
  "seats": "6 (piloto + 5)",
  "tank": "540 L",
  "eff": "≈ 180 L/h",
  "fuel": "Querosene de aviação",
  "auto": "650 km",
  "vmax": 287,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Helibras AS350 Esquilo"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Paipa Cub",
  "c": "Monomotor de treinamento, asa alta, 2 lugares em tandem",
  "d": "O amarelinho de aeroclube. Pousa em pasto, estrada de terra e clareira, e decola em 150 m. Pouco combustível e quase nenhuma proteção.",
  "insp": "Piper J-3 Cub",
  "s": [
   6,
   5,
   6,
   3,
   2,
   3
  ],
  "r": 250,
  "seats": "2 (em tandem)",
  "tank": "45 L",
  "eff": "≈ 15 L/h",
  "fuel": "Gasolina de aviação",
  "auto": "350 km",
  "vmax": 140,
  "tags": [
   "Gasolina de aviação",
   "Inspirado no Piper J-3 Cub"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Bandeirantte EMB-110",
  "c": "Bimotor turboélice regional, 2 + 16 lugares",
  "d": "O avião que ligou o interior do Brasil. Pousa em pista de terra curta, leva dezesseis pessoas e carga, e tem dois motores: perde um e ainda volta.",
  "insp": "Embraer EMB-110 Bandeirante",
  "s": [
   10,
   6,
   5,
   7,
   7,
   9
  ],
  "r": 650,
  "seats": "2 pilotos + 16 passageiros",
  "tank": "1.720 L",
  "eff": "≈ 300 L/h (dois motores)",
  "fuel": "Querosene de aviação",
  "auto": "1.960 km",
  "vmax": 430,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Embraer EMB-110 Bandeirante"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Caravana Anfíbio",
  "c": "Monomotor turboélice anfíbio, 10 lugares",
  "d": "Pousa em rio, represa e pista. Na Amazônia vira ônibus, ambulância e caminhão. Os flutuadores aguentam o tranco, mas atolar na margem é um risco.",
  "insp": "Cessna 208 Caravan anfíbio (flutuadores Wipline)",
  "s": [
   10,
   7,
   6,
   6,
   6,
   9
  ],
  "r": 500,
  "seats": "1 piloto + 9 passageiros",
  "tank": "1.257 L",
  "eff": "≈ 200 L/h",
  "fuel": "Querosene de aviação",
  "auto": "1.500 km",
  "vmax": 300,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Cessna 208 Caravan anfíbio (flutuadores Wipline)"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Fenom 100",
  "c": "Jato executivo leve, 2 + 4 lugares",
  "d": "Jatinho de empresário. Rápido, alto e pressurizado: tira gente de uma cidade perdida em uma hora, se houver pista de asfalto inteira.",
  "insp": "Embraer Phenom 100",
  "s": [
   10,
   9,
   6,
   6,
   4,
   10
  ],
  "r": 900,
  "seats": "2 pilotos + 4 passageiros (até 6)",
  "tank": "1.590 L",
  "eff": "≈ 380 L/h",
  "fuel": "Querosene de aviação",
  "auto": "2.180 km",
  "vmax": 722,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Embraer Phenom 100"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Robinsom R22",
  "c": "Helicóptero leve de 2 lugares a pistão",
  "d": "O helicóptero de escola. Leve, barato e nervoso no comando. Pousa em qualquer laje, mas leva só duas pessoas e quase nenhuma carga.",
  "insp": "Robinson R22 Beta II",
  "s": [
   8,
   7,
   8,
   3,
   2,
   5
  ],
  "r": 350,
  "seats": "2",
  "tank": "112 L (72 L + 40 L)",
  "eff": "≈ 30 L/h",
  "fuel": "Gasolina de aviação",
  "auto": "390 km",
  "vmax": 190,
  "tags": [
   "Gasolina de aviação",
   "Inspirado no Robinson R22 Beta II"
  ]
 },
 {
  "g": "Aéreos",
  "n": "Bel 206 Jato",
  "c": "Helicóptero leve a turbina, 5 lugares",
  "d": "Turbina pequena, cinco lugares e fama de indestrutível. Táxi aéreo, reportagem e polícia: tem um em cada heliponto de cidade grande.",
  "insp": "Bell 206B-3 JetRanger III",
  "s": [
   9,
   7,
   7,
   5,
   4,
   7
  ],
  "r": 450,
  "seats": "1 piloto + 4",
  "tank": "344 L",
  "eff": "≈ 100 L/h",
  "fuel": "Querosene de aviação",
  "auto": "690 km",
  "vmax": 225,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Bell 206B-3 JetRanger III"
  ]
 },
 {
  "g": "Aéreos",
  "n": "H-145 Águia",
  "c": "Helicóptero bimotor policial, 2 + 6 lugares",
  "d": "O helicóptero da polícia. Dois motores, câmera térmica, holofote e guincho: acha gente presa no telhado de noite e ainda desce corda.",
  "insp": "Airbus H145 policial",
  "s": [
   10,
   7,
   6,
   7,
   6,
   9
  ],
  "r": 600,
  "seats": "2 pilotos + 6 tripulantes",
  "tank": "≈ 905 L",
  "eff": "≈ 270 L/h",
  "fuel": "Querosene de aviação",
  "auto": "650 km",
  "vmax": 268,
  "tags": [
   "Querosene de aviação",
   "Inspirado no Airbus H145 policial"
  ]
 }
];
  var labels = ["Velocidade","Aceleração","Manobra","Resistência","Carga","Consumo"];
  var picker = document.getElementById("picker");
  var plate = document.getElementById("plate");
  var current = fleet.findIndex(function (v) { return v.n === "Hylux Cabine Dupla"; });
  var lastGroup = null;

  fleet.forEach(function (v, i) {
    if (v.g !== lastGroup) {
      var g = document.createElement("div"); g.className = "grp"; g.textContent = v.g; picker.appendChild(g); lastGroup = v.g;
    }
    var b = document.createElement("button");
    b.type = "button"; b.id = "veh-" + i; b.textContent = v.n;
    b.setAttribute("aria-pressed", i === current ? "true" : "false");
    b.addEventListener("click", function () { select(i); });
    picker.appendChild(b);
  });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }

  function render(v) {
    var bars = v.s.map(function (val, k) {
      return '<div class="bar"><span>' + labels[k] + '</span><span class="track"><span class="fill" style="width:' + (val * 10) + '%"></span></span><span class="v">' + val + '/10</span></div>';
    }).join("");
    bars += '<div class="bar noise"><span>Barulho</span><span class="track"><span class="fill" style="width:' + Math.min(100, v.r / 1.2) + '%"></span></span><span class="v">' + v.r + ' m</span></div>';
    plate.innerHTML =
      '<div class="cls">' + esc(v.c) + ' · ' + esc(v.fuel) + '</div>' +
      '<h4>' + esc(v.n) + '</h4><p>' + esc(v.d) + '</p>' +
      '<div class="bars">' + bars + '</div>' +
      '<div class="specs"><div>Lugares<b>' + esc(v.seats) + '</b></div><div>Tanque<b>' + esc(v.tank) + '</b></div><div>Eficiência<b>' + esc(v.eff) + '</b></div><div>Autonomia<b>' + esc(v.auto) + '</b></div></div>' +
      '<div class="tags">' + v.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") + '</div>';
  }

  function select(i) {
    current = i;
    picker.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.id === "veh-" + i ? "true" : "false"); });
    render(fleet[i]);
  }

  var tb = document.querySelector("#fleetTable tbody");
  tb.innerHTML = fleet.map(function (v) {
    return "<tr><td>" + esc(v.n) + "</td><td>" + esc(v.insp) + "</td><td>" + esc(v.fuel) + '</td><td>' + esc(v.eff) + '</td><td>' + esc(v.seats) + '</td><td class="num">' + esc(v.tank) + "</td></tr>";
  }).join("");

  render(fleet[current]);
})();
