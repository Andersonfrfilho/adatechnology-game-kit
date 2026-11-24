# T2.7 — Desenho das redes do bairro (elétrica, telecom, esgoto, drenagem, água)

Status: **proposta (2026-11-24), só desenho**; revisão do `architect` antes da T2.8a. Pedido do dono: as redes da cena são **redes de verdade
no SDK** antes de remendar fio, "de onde vem, por onde passa e onde liga". Lido em `origin/main` `231ccad02`. Regras: §1, §2, §3, §8, §11–§15.

## 1. O que a leitura achou (prints `fios-antes-{rua,norte,sul,topo,entrada}`)

| Problema visto | Causa no código |
|---|---|
| Postes dentro do lote, atrás do muro, um por casa | cada casa põe o próprio poste em `rect[1] − 0,6` (`game-floorplan-structure/src/utilities/electrical-entrance.ts` 14–30) |
| Três postes por casa e a "rede" que não vai a lugar nenhum | a casa desenha mais dois postes a ±22 m e os 4 fios entre eles (`game-floorplan-three/src/utilities/electrical.ts` 73–76): 10 lotes = 30 postes e 10 redes sobrepostas |
| Fio atravessando a rua na diagonal, pela copa da árvore e por cima do telhado | o ramal sai do poste da casa e ninguém confere vão, folga nem obstáculo |
| Poste de luz solto na calçada, sem fio | a cena põe colunas de iluminação a cada 32 m em lados alternados (`examples/reference-district/src/game/roads.ts` 28, `assemble/streets.ts` 46–51), sem rede |
| Não há esgoto, drenagem nem água fora da casa | o ralo termina "no pé da parede, onde o ramal enterrado o pega" (`game-floorplan-three/src/utilities/drains.ts` 25) e o ramal não existe; `planPlumbing` (`plumbing.ts` 23) só vai da caixa-d'água às peças |

O que se aproveita: o poste da casa já é peça de destruição com engaste (`postEmbedment`, `game-destruction/src/embedment.ts` 20) e os fios já
soltam do poste por junta que rasga (`tears`, `electrical.ts` 47–51); o `game-interactables` já tem a rede lógica da casa (`World.power.setGrid`,
`types.ts` 639; `waterSupply`, 476); o terreno já tem estratos e escavação (`game-terrain/src/types.ts` 119–160, `GroundExcavation` do
`game-contracts`). Da tentativa abandonada (`247167493`, branch `wip/fios-antes-do-desenho`): os números do poste de distribuição
(`DistributionSpec`: cruzeta, isoladores, armação secundária, trafo, braço de IP), `poleAttachmentsOf`, a flecha por tipo de condutor
(`POWER_LINE_DEFAULTS.sag`) e o padrão de entrada com o ramal ancorado a 5,7 m. O erro dela foi a ordem: desenhou antes de haver rede.

## 2. Dono e camadas

| Peça | Onde | Por quê |
|---|---|---|
| Modelo e gerador das redes (dado, sem three) | **`game-urban`, entrada `./networks`** (`packages/game-urban/src/networks/`) | o `game-urban` é dono da rua, da calçada, do plano de cidade e dos postes (T0.3 põe poste e fiação nas palavras dele; esta task acrescenta esgoto, drenagem, bueiro, boca de lobo, PV, hidrante). Pacote separado leria o mesmo plano e só o `game-urban` o usaria |
| Ponto de ligação do lote | **`game-contracts`** (`UtilityConnection`, tipo só) | a casa (`game-floorplan-structure`) produz e a rede (`game-urban`) consome sem um núcleo importar o outro; um jogo liga o prédio dele pelo mesmo tipo (teste do GTA, §2) |
| Lado da casa (padrão de entrada, caixa de inspeção, hidrômetro, buzinote) | `game-floorplan-structure/src/utilities/` (dado) e `game-floorplan-three/src/utilities/` (desenho) | já é dono do medidor, do ralo e da caixa-d'água |
| Desenho da rede | `game-urban-three/src/networks/` | adaptador do núcleo; não compõe outro `-three` (`no-domain-adapter-to-adapter`) |
| Regra de engaste e de corte do vão em trechos | `postEmbedment` do `game-destruction`; `cutRun`/`holdersOf` saem do `game-floorplan-three` para um núcleo (`game-destruction`) na T2.8f | §3: uma regra só para o poste da casa e o da rua |
| Montagem | `examples/reference-district/src/game/assemble/networks.ts` | a cena passa plano, lotes e pontos; nenhuma regra de rede no exemplo (D7) |

Arquivos do núcleo, cada um até 200 linhas: `types.ts`, `rules.ts` (números padrão, `patch` por id como os postes), `power.ts` (postes, MT,
BT, trafos), `lighting.ts`, `telecom.ts`, `sewer.ts`, `storm.ts`, `water.ts`, `connect.ts` (ramais), `graph.ts` (conectividade, quem está
alimentado), `validate.ts` (`validateNetworks`, códigos estáveis em `NETWORK_VIOLATION`, como o `STRUCTURAL_VIOLATION` do §11), `build.ts`.

## 3. Modelo como dado

```ts
type NetworkKind = 'power_mv' | 'power_lv' | 'lighting' | 'telecom' | 'sewer' | 'storm' | 'water'
type NetworkNode = {
  readonly id: string                          // estável: 'pole:main_street:07', 'pv:main_street:03', 'lot:street_south_3:sewer'
  readonly kind: 'feed' | 'pole' | 'transformer' | 'light' | 'splice' | 'manhole' | 'cleanout' | 'inlet' | 'outfall'
               | 'valve' | 'hydrant' | 'reservoir' | 'treatment' | 'connection'
  readonly at: readonly [number, number, number]   // mundo; y = cota da tampa ou do ponto de fixação; enterrado leva `invert` (cota de fundo)
  readonly invert?: number
  readonly carries: readonly NetworkKind[]
  readonly spec?: string                       // id no registro (poste `concrete_distribution`, trafo `t45`, tampa `pv_600`)
  readonly lot?: string                        // nó de ligação: o lote
  readonly guyed?: boolean                     // estai: poste de fim de linha e de esquina
}
type NetworkEdge = {
  readonly id: string
  readonly kind: 'mv_span' | 'lv_span' | 'telecom_span' | 'service_drop' | 'telecom_drop' | 'light_feed'
               | 'sewer_main' | 'sewer_lateral' | 'storm_gallery' | 'storm_lateral' | 'water_main' | 'water_service'
  readonly from: string; readonly to: string   // sentido do fluxo: da fonte para a carga, da casa para o emissário
  readonly diameter?: number                   // m, enterrados
  readonly slope?: number                      // m/m, positivo no sentido do fluxo (esgoto e drenagem)
  readonly sag?: number                        // m de flecha no meio do vão, aéreos
  readonly conductors?: number                 // 3 fases MT, 4 da BT (neutro em cima), 1..n cabos de telecom
}
type UtilityNetworks = { readonly nodes: readonly NetworkNode[]; readonly edges: readonly NetworkEdge[]; readonly seed: number; readonly rules: NetworkRules }
```

`UtilityConnection` (`game-contracts`), em coordenadas do lote; a casa devolve uma lista, uma por rede que tem:

```ts
type UtilityConnection = {
  readonly network: 'power' | 'telecom' | 'sewer' | 'storm' | 'water'
  readonly at: readonly [number, number, number]   // ancoragem do ramal (5,7 m no poste do padrão), saída da caixa de inspeção, buzinote no meio-fio, cavalete
  readonly invert?: number                         // esgoto: cota de fundo na saída da caixa de inspeção
  readonly demandKva?: number                      // energia: demanda pelos circuitos da casa (o `electrical.circuits` já existe)
}
```

`game-floorplan-structure` ganha `connectionsInWorld(plan, placement)` (pura): passa os pontos para o mundo com a colocação do lote
(`lotPlacement` da cena). Prédio de silhueta do `fillBlock` ligado por ponto na fachada que o próprio `game-urban` tira do retângulo e da altura.

## 4. As regras (prática brasileira, normas como referência geral, sem marca)

Todo número é `rules.<rede>.<campo>`, trocado por `patch`; valor fixo só constante física (§2).

**Energia — MT, BT, trafos** (referência: NBR 15688 rede aérea com condutor nu, normas de distribuição das concessionárias)

| Regra | Valor padrão |
|---|---|
| Postes de um lado só da rua, na faixa de serviço da calçada, a 0,4 m do meio-fio; o lado é o que tem mais lotes ligados (empate: norte/oeste) | — |
| Vão entre postes; o poste cai na **divisa entre lotes** quando há uma dentro do intervalo; nunca na frente de portão ou garagem (`plan.gates`), nem a menos de 5 m da esquina | 30 a 40 m |
| Poste de concreto duplo T, 11 m, engaste pela `postEmbedment`; de esquina e de fim de linha com estai ancorado na calçada | 300 daN; 600 daN com estai |
| MT no topo: cruzeta com 3 fases em isolador de pino; só nas ruas que levam trafo e no tronco até o alimentador | 9,9 m |
| BT em armação secundária vertical, 4 condutores, neutro em cima | 7,2 a 7,8 m |
| Trafo no poste, abaixo da MT, com chave fusível e para-raios na cruzeta; potência pela soma das `demandKva` do circuito, com fator de 0,8 | 30, 45, 75, 112,5 kVA |
| Circuito de BT de um trafo: no máximo para cada lado (queda de tensão); trafo no centro de carga do circuito | 200 m |
| Alimentador (`feed`): nó na borda do mapa onde a rua tronco sai | um por lado do rio (seção 6) |
| Ramal de ligação: do poste mais próximo **do mesmo lado do circuito** até a ancoragem do padrão; mais longe que isso, o gerador põe poste a mais | até 30 m |
| Folga do ponto mais baixo do vão (catenária) | rua ≥ 5,5 m; calçada ≥ 4,5 m; dentro do lote ≥ 3,5 m |

**Iluminação pública** (NBR 5101): o ponto de luz é um nó `light` filho do poste, braço de 1,5 a 2,5 m sobre a rua, luminária a ~7,5 m,
alimentado pela BT do mesmo poste (`light_feed`). Coluna de iluminação própria só quando o padrão do distrito pede (avenida, praça), alimentada
por baixo da calçada. **O #470 entra aqui:** o estado da lâmpada (funciona, pisca, queimada) continua `lampStateOf({ seed, x, z, shares })`,
agora por nó `light`; aceso = noite **e** `lampState` **e** trafo alimentado (seção 8). O orçamento de 16 luzes reais não muda.

**Telecom**: cabos abaixo da BT, na faixa de ocupação compartilhada do poste (0,5 m), ~5,5 a 6 m; caixa de emenda e rolo de reserva a cada
~4 vãos; ramal da casa até a fachada ou ao poste do padrão a ≥ 3,5 m. Número de cabos (operadoras) é regra (`telecom.cables`, padrão 2).

**Esgoto** (NBR 9649): rede coletora DN 150 sob o **eixo da rua**, recobrimento ≥ 0,9 m, declividade ≥ 0,5 % no sentido do emissário;
PV (tampa Ø 0,6 m) em todo cruzamento, mudança de direção e a cada ≤ 80 m; terminal de limpeza na ponta seca; ramal predial DN 100 a ≥ 1 % da
caixa de inspeção do lote (0,6 × 0,6 m, 1 m dentro da divisa da frente) até o coletor, perpendicular à rua. Profundidade máxima de 4,5 m: além
dela, nó de elevatória (não deve acontecer no recorte; o teste avisa). Com terreno de altura, a cota segue `heightAt`; no chão plano do recorte
a declividade vem só do aprofundamento.

**Drenagem**: sarjeta dos dois lados (dado: o meio-fio é a T3.9); boca de lobo **com grelha** (não depende do meio-fio) na esquina a montante
da faixa e a cada ≤ 60 m, dos dois lados; ramal DN 400 até a galeria DN 600 sob a rua, deslocada 2 m do eixo para não cruzar o esgoto no mesmo
plano; recobrimento ≥ 1 m; declividade ≥ 0,5 %; saída com muro de ala na margem do rio, fundo acima do nível da água. O telhado da casa
escoa por buzinote sob a calçada até a sarjeta (`UtilityConnection` `storm`). Guia-chapéu (boca no meio-fio) entra depois da T3.9.

**Água** (NBR 12218; entra porque é barata: dado e três peças de superfície): rede DN 75 sob o terço da calçada do lado oposto aos postes,
0,8 m de recobrimento; registro nos cruzamentos; hidrante de coluna nas esquinas do tronco; ramal DN 20 até o cavalete com hidrômetro no muro,
ao lado do medidor de luz. A fonte é um nó `reservoir` na borda do mapa. Gás encanado fica fora: o bairro popular usa botijão (`gas.ts`).

## 5. Visível e enterrado

| Visível (peça desenhada) | Só dado (com a tampa ou a saída que aparece) |
|---|---|
| poste, cruzeta, isoladores, armação, trafo, chave, estai, braço e luminária, caixa de emenda e rolo | rede coletora, ramal predial, galeria, ramal da boca de lobo |
| vãos de MT, BT, telecom; ramais aéreos | rede de água, ramal de água |
| tampa de PV, grelha de boca de lobo, muro de ala na margem, buzinote no meio-fio, tampa da caixa de inspeção no quintal, caixa do hidrômetro, hidrante, tampa de registro | alimentador e ETE fora do mapa (nós na borda) |

Cano enterrado não é desenhado nem colide. Cratera que passa do recobrimento sobre um trecho é gancho de dano (seção 8), não desenho.

## 6. O recorte 1

Só duas ruas são linhas do plano (`main_street` z = 0, de −220 a 225, cortada pelo rio; `crossing_street` x = −100): ~650 m de rua, ~20
postes, 15 lotes. O rio (x ≈ −20) divide em dois sistemas **sem travessia**: o centro é alimentado pela borda oeste, o bairro pela leste
(sem vão de 40 m sobre a água nem rede na ponte, que é `missing` T3.3). Esgoto: coletor da rua principal até um interceptor na margem, que
corre para o sul até a borda (destino: pergunta 1). Drenagem: as duas metades saem no rio por muros de ala. Água: reservatório na borda leste
e na oeste.

## 7. Como a cena monta (ordem dentro do `main.ts`)

1. `engine.generate` de cada lote (dado, sem desenho), com `utilities: { street: 'network' }`: a entrada vira **poste do padrão** de 6 m
   atrás do medidor (ou pontalete na fachada sem quintal), sem poste de rua nem os dois vizinhos a ±22 m; o padrão `'own'` continua o de hoje
   (goldens do time iguais).
2. `connectionsInWorld(plan, placement)` de cada casa.
3. `urban.networks.build({ plan, lots, buildings, seed, rules?, feeds? })` → `UtilityNetworks` e `validateNetworks` (violação = erro de carga
   com o id do nó, como o `read.ts` do recorte).
4. `createUrbanThree(...).drawNetworks(networks, { lights, isNight })` e as casas com `renderer.build(plan)`; o ramal aéreo é da rede (ela
   conhece as duas pontas); o eletroduto do padrão até o medidor é da casa.

`polePointsOf` (`roads.ts` 28) e o laço de postes de `streets.ts` 46–51 saem da cena.

**Determinismo:** o gerador é função pura de plano, lotes, pontos e semente; escolhas sorteadas (lado no empate, rolos de telecom, estado da
lâmpada) por hash da semente com o id, **nunca pelo `b.random` do builder**, para a ordem do gerador da cena e o golden do `game-urban-three`
não mudarem. Roda na carga, no quadro principal (centenas de nós); por ser puro, vira `TaskKind` de faixa `build` (§14) quando um plano de
cidade inteiro pedir, sem mudar a API.

**Custo** (portão `--cost-check`, entradas novas `urban/network:*` no `shapes-bench`): mastros instanciados por tipo de poste; ferragem
(cruzeta, isolador, armação, carretel, chave, estai) instanciada; vãos fundidos **numa malha por classe de condutor** (MT, BT, telecom,
ramais), tubo de 4 lados com a catenária em 8 trechos (perto) e `LineSegments` além do LOD; tampas e grelhas instanciadas. Alvo para o
recorte: **≤ 20 chamadas de desenho e ≤ 20 mil triângulos para todas as redes** (a tentativa gastou 31 chamadas só nos fios).

**§8:** `drawNetworks` devolve `dispose()` que solta malhas fundidas, instâncias e materiais próprios; teste `leak.mjs` monta e solta 3 vezes.
**§13:** fio nunca coplanar; tampa e grelha 3 mm acima do asfalto (o asfalto está a 2 cm), fora da faixa tracejada; ferragem afastada ≥ 2 mm;
poste, trafo, tampa, grelha, muro de ala, hidrante e o poste do padrão entram em `tests/catalog-cases.ts` dos dois `-three`.
**§11:** o poste do padrão e o muro de ala passam pelo `engenheiro-estrutural` e pelo teste de construção do pacote.
**§12:** cada peça visível tem estado quebrado no catálogo: poste partido na base ou no meio, trafo caído, tampa deslocada (o sopro a levanta),
grelha solta, hidrante arrancado. Colide: poste, trafo, hidrante, estai (cápsula/caixa estática até soltar); tampa e grelha são chão até soltarem.

## 8. Estado lógico e destruição (ganchos; o comportamento é a T2.8f)

- `graph.ts` dá `supplied(nodeId)` por busca a partir da fonte de cada rede. Perder um nó ou aresta (`networks.lose(id)`) recalcula **só no
  evento**, nunca por quadro (§15), e emite `outage { network, nodes }`.
- **Energia:** poste que cai (evento `released` do renderizador da destruição, peça `net:pole:<id>` com `holder: 'ground'` e o engaste da
  `postEmbedment`) solta os vãos ligados a ele (`tears`, como os fios da casa hoje) e tira o nó; trafo ou vão de MT perdido apaga o circuito:
  cada casa dele recebe `World.power.setGrid(false)` (`game-interactables`), as luminárias dele apagam. Faísca e queda do fio são efeito do
  `game-vfx` pela mesma ponte.
- **Água:** ramo perdido corta o `waterSupply` das casas a jusante (a caixa-d'água esvazia com o uso). Cratera mais funda que o recobrimento
  sobre a rede (evento `blow` do chão, `world.ground.on('blow')`) tira a aresta; o jato do hidrante arrancado é do `game-fluids` depois.
- **Esgoto e drenagem:** só o dado de que o trecho rompeu (cheiro, alagamento são de outra spec).
- A colisão e a destruição do poste dependem da L10 (o `game-urban-three` ainda não tem colisão): a T2.8f faz as duas juntas.

## 9. Testes que provam (sem GPU, no CI)

| Teste | Confere |
|---|---|
| `networks/graph.test.ts` | cada rede é uma árvore ligada à sua fonte (alimentador, reservatório, emissário/ETE, rio); MT e BT radiais; esgoto e drenagem sem ciclo e todo fluxo termina no destino |
| `networks/connect.test.ts` | todo lote com `UtilityConnection` de uma rede está ligado a ela **uma vez**; ramal ≤ 30 m; ramal predial perpendicular e ≥ 1 % |
| `networks/slope.test.ts` | toda aresta de esgoto e drenagem desce no sentido do fluxo com declividade ≥ mínima; recobrimento ≥ mínimo; profundidade ≤ máxima; PV a cada ≤ 80 m e em todo cruzamento; boca de lobo ≤ 60 m e em toda esquina a montante |
| `networks/clearance.test.ts` | catenária amostrada: folga sobre rua, calçada e lote; MT acima da BT acima da telecom com as separações; nenhum vão cruza a planta de uma casa nem um prédio abaixo da altura dele; nenhum vão pela copa de árvore plantada |
| `networks/placement.test.ts` | poste só na faixa de serviço, nunca dentro de lote, rua ou rio, nem na frente de portão; vão no intervalo; estai em esquina e fim de linha |
| `networks/load.test.ts` | demanda de cada trafo ≤ 0,8 × potência; circuito de BT ≤ 200 m para cada lado |
| `networks/determinism.test.ts` | mesma entrada, mesmos bytes (hash); o golden do `game-urban-three` sem diff (o gerador não toca o `b.random`) |
| `validate.test.ts` | cada código de `NETWORK_VIOLATION` com um caso que reprova |
| exemplo `tests/networks.test.ts` | o recorte 1 inteiro passa no `validateNetworks`; cada um dos 15 lotes ligado às cinco redes |

Prints: os mesmos cinco enquadramentos dos `fios-antes-*`, antes e depois, na T2.8d; câmera de ombro e 1ª pessoa (§5).

## 10. Ordem em PRs pequenos

| Task | PR | Pacotes | Modelo |
|---|---|---|---|
| **T2.7 🧠** | este desenho, revisado pelo `architect` | `specs/` | `opus` |
| T2.8a | `UtilityConnection` no `game-contracts`; tipos, `graph.ts` e `validate.ts` com fixtures à mão; `kit-audit/rules.json` com as palavras novas | contracts, urban | `sonnet` |
| T2.8b | gerador de energia e iluminação (postes, MT, BT, trafos, ramais como dado); o `light` herda o `lampStateOf` do #470 | urban | `sonnet` |
| T2.8c | lado da casa: `street: 'network'`, poste do padrão e pontalete, caixa de inspeção, hidrômetro, buzinote, `connectionsInWorld`, `demandKva`; sem objeto `service_entrance` de poste no `game-floorplan-interactables` | floorplan-structure, -three, -interactables | `sonnet` |
| T2.8d | desenho de energia, iluminação e telecom (poste `concrete_distribution` com os números da tentativa, vãos fundidos, ferragem instanciada); a cena troca `polePointsOf` pela rede; prints antes e depois | urban-three, exemplo | `sonnet` |
| T2.8e | esgoto, drenagem e água (dado) e as peças de superfície (tampa, grelha, muro de ala, hidrante, registro) | urban, urban-three, exemplo | `sonnet` |
| T2.8f | estado lógico (`supplied`, `outage` → `setGrid`, luminárias, `waterSupply`), poste e vão como peças de destruição; `cutRun` para um núcleo; depende da L10 | urban, urban-three, destruction, exemplo | `sonnet` |

**#470** mergeia como está (estado da lâmpada por ponto); na T2.8b os pontos passam a ser os nós `light` da rede, e a posição dos postes muda:
os prints de noite e a régua do `pior` são regravados nesse PR, com a mudança dita no `evidence.md`.

## 11. Perguntas ao dono

1. **Para onde vai o esgoto?** (a) interceptor na margem até uma ETE fora do mapa (o certo pela norma); (b) lançado no rio sem tratamento
   (comum na periferia, dá a margem suja que a cena quer); (c) parte do bairro sem rede, com fossa no lote. O padrão proposto é (a).
2. **Época da rede:** BT nua em armação (4 fios, visual de bairro antigo) ou cabo multiplexado (um cabo torcido, mais comum hoje); MT de
   cruzeta ou compacta com espaçador. Os dois viram estilo do poste; o padrão proposto é BT nua e MT de cruzeta, que se leem melhor no jogo.
3. **Quanto de "periferia de verdade":** muitos cabos de telecom com rolos pendurados e ligações clandestinas (gato) em parte das casas, ou
   rede limpa. Gato é ramal sem medidor no grafo (a casa fica ligada, fora da conta do trafo); o padrão proposto é 2 cabos e sem gato.
