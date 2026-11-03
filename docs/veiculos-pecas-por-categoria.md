# Peças importantes por categoria de veículo

Regra do dono (2026-11-02): todo veículo do kit é verificado peça por peça. Esta tabela diz **quais peças cada categoria tem que ter, de que material, como se movem e o que cada uma faz quando apanha**. Modelo novo, mudança em modelo ou revisão de frota confere a lista da sua categoria antes de dar o veículo como pronto. O que muda entre categorias está dito em cada uma; o que vale para todas está no fim.

Junto com esta lista valem `CLAUDE.md` §7 (regras dos veículos), `criterios-fisica-objetos.md` (os 21 critérios) e `veiculos-verificacao.md` (o resultado por modelo).

## Carro (passeio, SUV, picape, van)

| Peça | Material | Movimento | Ao apanhar | Verificar |
|---|---|---|---|---|
| Portas | aço (alumínio em alguns) | abre na dobradiça, leva pele, forro, borda, vidro, borracha, maçaneta e espelho | furo no ponto, amassa, solta da dobradiça com dano grande | maçaneta na ponta livre, longe da dobradiça; forro liso por dentro; nenhuma faixa da carroceria atravessando o vão aberto |
| Capô | aço | abre na dobradiça da frente ou de trás | furo, amassa, voa na explosão | rente ao paralama fechado (emenda fina, sem degrau) |
| Tampa do porta-malas / tampa traseira | aço | abre para cima (picape: para baixo) | furo, amassa | rente à carroceria fechada |
| Para-brisa e vidro traseiro | vidro laminado | fixo | fura e trinca no ponto; cede depois de vários tiros; blindado só trinca | encostado na lataria, moldura fina e rente; nada da lataria nem da placa de baixo aparecendo por dentro |
| Janelas das portas e vidros laterais | vidro temperado | vão com a porta | estilhaça inteiro no primeiro tiro; blindado trinca e fica | todo vidro desenhado é peça de vidro (nunca responde como o aço da cabine) |
| Retrovisores | plástico e espelho | vão com a porta | quebra, pende, solta | espelho embutido na carcaça, sem nada saltado; um retrovisor só por lado |
| Para-choques | plástico | fixos | racham, soltam, derretem no fogo | — |
| Faróis e lanternas | vidro/plástico | fixos | lente quebra, apagam | — |
| Rodas e pneus | aço/alumínio e borracha | giram | pneu murcha no tiro, queima | — |
| Tanque | aço/plástico | fixo | vaza pelo furo; incendeia só com faísca, fogo ou explosão | — |
| Motor, bateria, radiador | aço, plástico, alumínio | fixos | dano mecânico, vazamento, faísca | — |
| Bancos e painel | espuma, tecido, plástico | fixos | rasgam, queimam | painel escuro e fosco visto pelo para-brisa |
| Colunas, teto, soleiras | aço | fixos | furo, amassa | coluna e soleira com espessura de carro real |

**Blindagem** (`armour.ts`): `IIIA` civil (para pistola até .44, fuzil atravessa) ou `III` contra fuzil (para até 7.62x51). Cada modelo diz a sua; o jogo troca por opção. Carro-forte é `III`.

## Moto

Sem portas, sem para-brisa laminado (viseira de plástico), tanque exposto, piloto sem proteção. Retrovisores no guidão. Peças: tanque, motor, escapamento, rodas e pneus, guidão, banco, carenagem de plástico, faróis.

## Caminhão e ônibus

Como o carro, com cabine alta, portas de cabine e portas de passageiro (ônibus, que deslizam ou dobram), baú ou carroceria separada da cabine, vários eixos, tanque grande de diesel. Para-brisa pode ser dividido em dois.

## Trator

Cabine aberta ou de vidro com estrutura de proteção (arco), sem capô de passeio (capô do motor articulado), rodas traseiras grandes, engates e implementos. Vidros da cabine são planos e cobrem a cabine inteira.

## Barco

Casco de fibra ou alumínio, sem rodas; boia, afunda pela entrada de água no furo abaixo da linha d'água. Para-brisa de acrílico ou vidro curto, cabine com portas de correr, motor de popa ou de centro, tanque. Fogo e explosão no motor e no tanque.

## Avião e helicóptero

Fuselagem de alumínio, asas ou rotor, trem de pouso, portas que abrem para fora ou deslizam, para-brisa de acrílico em gomos, tanques nas asas. Furo no tanque vaza combustível de aviação; rotor e hélice quebram ao bater.

## Militar

Como a categoria de base (carro, caminhão), com blindagem `III` ou maior, vidros pequenos e grossos, escotilhas e periscópios no lugar de janelas.

## Para todas as categorias

- O tiro acerta o que está desenhado (`surfaceRay`), e toda marca (furo, trinca, amassado, queimado) pertence à peça e vai com ela.
- Peça que abre leva tudo o que está desenhado nela.
- Nada de cubo, esfera ou placa solta saindo da forma do veículo (o compressor do v8 virou uma bola por um erro de escala, a placa sob o para-brisa aparecia por dentro).
- Cada modelo novo passa pelo teste de aceitação da frota e ganha linha em `veiculos-verificacao.md`, com print no jogo real, fechado e com a porta aberta.
