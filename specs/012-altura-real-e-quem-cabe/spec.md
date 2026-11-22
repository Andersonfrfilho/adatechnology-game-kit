# Spec 012 — Altura real do personagem e quem cabe no veículo

Origem: `docs/animacoes-e-modelos-melhorias.md` (seções 3.4 e 7.3), itens A1, H1 a H7 e V2.

## Por quê

O dono decidiu em 2026-11-19: a altura do personagem é **customizável, em metros reais**, e vale como na vida real — **quem não cabe
no veículo não entra**. Hoje isso não é possível por três motivos:

- **A base não mede o que declara.** `body.json` diz 1,80 m; a malha rica mede 1,98 m no crânio e 2,06 m com cabelo (cabeça em
  y = 1,80 com raio 0,165 × 1,1, `game-characters-three/src/rich/best-builder.ts:225`). O Brutamonte mede 2,93 m.
- **A altura é fator relativo e não chega a todo lugar.** O núcleo escala o esqueleto (`createRig`, `rig.ts:51-62`) e o sobrevivente é
  desenhado com fator (`person-builder.ts:56`), mas o corpo do jogador e o Bestiário têm medidas fixas (`HIP_HEIGHT = 0.95`,
  `avatar.ts:38`; alcance de porta, `avatar.ts:390`), e os acessórios instanciados usam referência de 1,80 m (`accessory.ts:32-33`).
- **O veículo não sabe o espaço que tem.** O único dado por assento é o topo da almofada (`seatTops`, `game-vehicles/src/context.ts:58`).
  O ocupante é um olho fixo (`SEATED_EYE`, `game-vehicles-three/src/build.ts:132`). A altura livre medida nos carros tem mediana de
  0,69 m (hatch 0,61 m, sedã 0,64 m), contra 0,95 a 1,00 m de um carro real: ligada hoje, a regra reprovaria todo mundo.

## Decisões do dono (2026-11-19)

- **D1** Altura customizável por personagem, em metros.
- **D2** A regra de caber é **binária com motivo**: não entra, e o jogo recebe por quê (`head`, `legs`, `shoulders`, `door`).
- **D3** Mudança sobre o porte literal do Bestiário v17 e do Retratos é **desvio registrado no kit** (o que mudou, por quê, golden novo).

## Requisitos

- **R1 — A base mede o declarado.** Com fator 1, o topo do crânio (sem cabelo nem chapéu) fica em `heightMetres` ± 1 cm em todo tipo
  de corpo rico, instanciado e assado. Cada tipo declara a própria altura em metros no dado (o Brutamonte deixa de ser "escala").
- **R2 — Altura em metros, convertida num lugar só.** A entrada pública é `heightMetres` por pessoa; uma função do núcleo converte em
  fator. As faixas por idade do `game-characters-people` passam a metros. Fora da faixa suportada o construtor recusa com erro tipado.
- **R3 — Tudo acompanha a altura.** Esqueleto, passada, olho e câmera de primeira pessoa, alcance do IK, alcance de porta e maçaneta,
  pega de arma, acessórios, sombra, colisor do jogador e agente da multidão. Nenhuma constante de 1,80 m sobra fora do dado.
- **R4 — Medidas do corpo.** Função pura devolve, a partir de altura e largura: altura sentado (assento ao topo da cabeça), altura do
  olho sentado, largura de ombros, comprimento de coxa e de canela.
- **R5 — Espaço por assento.** Todo assento de todo veículo da frota (69) declara: ponto do quadril, altura livre, espaço de pernas,
  largura; toda porta declara o vão (largura e altura). Moto, quadriciclo e veículo aberto têm assento com altura livre infinita.
- **R6 — Cabine em medida real.** Bancos dianteiros de carro com altura livre ≥ 0,95 m; a tabela por categoria fica no dado e é
  testada na frota inteira.
- **R7 — `fits`.** Função pura recebe as medidas do corpo, o assento e a porta e devolve `{ fits: true }` ou
  `{ fits: false, reason }`. Sem efeito colateral, sem three.js.
- **R8 — Dá para ver.** A área de teste de veículos mostra três corpos (1,55 m, 1,80 m, 2,05 m) contra a frota, com o resultado e o
  motivo, e o olho do motorista passa a sair das medidas do corpo, não de `SEATED_EYE`.

## Fora do escopo

- Corpo desenhado dentro do carro, entrar e sair (spec 016, que depende desta).
- Pose sentada que se adapta ao espaço (spec 016).
- Proporção de perna e tronco por pessoa: a primeira entrega escala altura e largura; proporção individual fica para depois.
- Passagem por porta de casa (`passesOpening`): o dado de medidas desta spec serve, a regra fica para uma spec de regras.

## Critérios de aceite

1. Teste mede o topo do crânio de todos os tipos e variantes: `heightMetres` ± 1 cm.
2. Teste varre `heightMetres` de 1,40 a 2,10 m: olho, quadril, alcance e colisor seguem a proporção; a passada continua casando com o chão (`footfall.test.ts`).
3. Teste de frota: 69 veículos, todo assento e toda porta com dado; carros com altura livre dianteira ≥ 0,95 m.
4. Teste de `fits`: matriz 3 corpos × frota com resultado esperado em golden; 1,80 m cabe em todo carro de passeio.
5. Prints da sala nas duas câmeras com 1,55 m, 1,80 m e 2,05 m (§5), e da cabine do hatch com o olho abaixo do forro.
6. Arquivo de desvios do porte atualizado; `pnpm build && pnpm test && pnpm typecheck && pnpm lint`, `check:layers` e `kit-audit` verdes.
