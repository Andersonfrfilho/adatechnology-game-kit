# T2.7 — Desenho das redes do bairro (elétrica, telecom, esgoto, drenagem, água)

Status: **aprovado com mudanças pelo `architect` (2026-11-24); as 14 mudanças estão aplicadas nesta versão** (marcadas `[R1]`…`[R14]`).
Pedido do dono: as redes da cena são **redes de verdade no SDK** antes de remendar fio, "de onde vem, por onde passa e onde liga". Lido em
`origin/main` `231ccad02`. Regras: §1, §2, §3, §8, §11–§15.

## 1. O que a leitura achou (prints `fios-antes-{rua,norte,sul,topo,entrada}`)

| Problema visto | Causa no código |
|---|---|
| Postes dentro do lote, atrás do muro, um por casa | cada casa põe o próprio poste em `rect[1] − 0,6` (`game-floorplan-structure/src/utilities/electrical-entrance.ts` 14–30) |
| Três postes por casa e a "rede" que não vai a lugar nenhum | a casa desenha mais dois postes a ±22 m e os 4 fios entre eles sempre que há poste (`game-floorplan-three/src/utilities/electrical.ts` 73–76): 10 lotes = 30 postes e 10 redes sobrepostas |
| Fio atravessando a rua na diagonal, pela copa da árvore e por cima do telhado | o ramal sai do poste da casa e ninguém confere vão, folga nem obstáculo |
| Poste de luz solto na calçada, sem fio | a cena põe colunas de iluminação a cada 32 m em lados alternados (`examples/reference-district/src/game/roads.ts` 28, `assemble/streets.ts` 46–51), sem rede |
| Não há esgoto, drenagem nem água fora da casa | o ralo termina "no pé da parede, onde o ramal enterrado o pega" (`game-floorplan-three/src/utilities/drains.ts` 25) e o ramal não existe; `planPlumbing` (`plumbing.ts` 23) só vai da caixa-d'água às peças |

O que se aproveita: o poste da casa já é peça de destruição com engaste (`postEmbedment`, `game-destruction/src/embedment.ts` 20) e os fios já
soltam do poste por junta que rasga (`tears`, `electrical.ts` 47–51); o registro de postes do `game-urban` (`poles.ts`, `DEFAULT_POLES` 165, com o
`single_arm` que já tem tambor de trafo); a rede lógica da casa no `game-interactables` (`World.power.setGrid`, `types.ts` 639; `waterSupply`,
476); os estratos e a escavação do terreno (`game-terrain/src/types.ts` 119–160, `GroundExcavation` do `game-contracts`). Da tentativa
abandonada (`247167493`, branch `wip/fios-antes-do-desenho`): os números de cruzeta, isoladores, trafo e braço, `poleAttachmentsOf`, a flecha
por tipo de condutor e o padrão de entrada com o ramal a 5,7 m. O erro dela foi a ordem: desenhou antes de haver rede.

## 2. Dono e camadas

| Peça | Onde | Por quê |
|---|---|---|
| Modelo e gerador das redes (dado, sem three) | **`game-urban`, entrada `./networks`** (`packages/game-urban/src/networks/`) | o `game-urban` é dono da rua, da calçada, do plano de cidade e dos postes (T0.3 põe poste e fiação nas palavras dele; a T2.8a acrescenta esgoto, drenagem, bueiro, boca de lobo, PV, hidrante). Pacote separado leria o mesmo plano e só o `game-urban` o usaria |
| Poste de distribuição | **o registro de postes que já existe** (`poles.ts`) **[R7]** | entrada nova `concrete_distribution` em `DEFAULT_POLES` com a forma `distribution`, cujo tipo **estende** o `SingleArmSpec` (mastro, braço, luminária, lente, luz, trafo) com cruzeta, isoladores, fixação da BT, telecom e `slots`; `patch`, `packs` e `remove` como os outros. Nenhum tipo paralelo (§1) |
| Ponto de ligação do lote | **`game-contracts`** (`UtilityConnection`, tipo só) | a casa produz e a rede consome sem um núcleo importar o outro; um jogo liga o prédio dele pelo mesmo tipo (teste do GTA, §2) |
| Lado da casa (padrão de entrada, caixa de inspeção, hidrômetro, buzinote) | `game-floorplan-structure/src/utilities/` (dado), `-three` (desenho), `-interactables` (objeto) | já é dono do medidor, do ralo e da caixa-d'água |
| Desenho da rede | `game-urban-three/src/networks/` | adaptador do núcleo; não compõe outro `-three` (`no-domain-adapter-to-adapter`) |
| Engaste e corte do vão em trechos | `postEmbedment` do `game-destruction`; `cutRun`/`holdersOf` saem do `game-floorplan-three` para o `game-destruction` na T2.8f | §3: uma regra só para o poste da casa e o da rua |
| Montagem | `examples/reference-district/src/game/assemble/networks.ts` | a cena passa plano, lotes e pontos; nenhuma regra de rede no exemplo (D7) |

Arquivos do núcleo, até 200 linhas cada: `types.ts`, `rules.ts` (números padrão, `patch` por id), `power.ts`, `lighting.ts`, `telecom.ts`,
`sewer.ts`, `storm.ts`, `water.ts`, `connect.ts` (ramais), `graph.ts` (conectividade, quem está alimentado), `validate.ts` (`validateNetworks`,
códigos estáveis em `NETWORK_VIOLATION`, como o `STRUCTURAL_VIOLATION` do §11), `build.ts`.

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
  readonly guyed?: boolean                     // estai: poste de esquina e de fim de linha
}
type NetworkEdge = {
  readonly id: string
  readonly kind: 'mv_span' | 'lv_span' | 'telecom_span' | 'service_drop' | 'telecom_drop' | 'light_feed'
               | 'sewer_main' | 'sewer_lateral' | 'storm_gallery' | 'storm_lateral' | 'water_main' | 'water_service'
  readonly from: string; readonly to: string   // sentido do fluxo: da fonte para a carga, da casa para o destino
  readonly diameter?: number                   // m, enterrados
  readonly slope?: number                      // m/m, positivo no sentido do fluxo (esgoto e drenagem)
  readonly sag?: number                        // m de flecha no meio do vão, aéreos
  readonly conductors?: number                 // 3 fases MT, 4 da BT, 1..n cabos de telecom
}
type UtilityNetworks = { readonly nodes: readonly NetworkNode[]; readonly edges: readonly NetworkEdge[]; readonly seed: number; readonly rules: NetworkRules }
```

**`UtilityConnection` (`game-contracts`) [R6]**, uma por rede que o lote tem:

```ts
type UtilityConnection = {
  readonly lot: string                             // id do lote do site (o `Lot.id`)
  readonly network: 'power' | 'telecom' | 'sewer' | 'storm' | 'water'
  readonly frame: 'plan' | 'world'                 // 'plan': u, v da planta da casa e y sobre o chão do lote; 'world': já passado pelo placement
  readonly at: readonly [number, number, number]   // energia: ancoragem do ramal no poste do padrão; telecom: ancoragem própria (outra);
                                                   // esgoto: saída da caixa de inspeção; drenagem: buzinote no meio-fio; água: cavalete
  readonly invert?: number                         // esgoto: cota de fundo na saída da caixa de inspeção
  readonly installedKva?: number                   // energia: carga instalada pelos circuitos da casa (`electrical.circuits`)
}
```

`power` liga ao nó `power_lv` (nunca à MT); `telecom` a `telecom`; `sewer`, `storm` e `water` às redes de mesmo nome. Energia e telecom têm
ancoragens distintas (telecom ~0,6 m abaixo, na fachada ou no mesmo poste do padrão). `connectionsInWorld(plan, lotId, placement)`
(`game-floorplan-structure`, pura) devolve as conexões em `frame: 'world'` com a colocação do lote (`lotPlacement` da cena); a rede recusa
`frame: 'plan'`. Prédio de silhueta do `fillBlock` ligado por ponto na fachada que o `game-urban` tira do retângulo e da altura.

## 4. As regras (prática brasileira, normas como referência geral, sem marca)

Todo número é `rules.<rede>.<campo>`, trocado por `patch`; valor fixo só constante física (§2).

**Faixas do poste [R1].** Poste de concreto duplo T de 11 m, engaste `postEmbedment(11)` = 1,7 m: **9,3 m fora do chão**. Cada spec de poste
de distribuição declara `slots` (cotas sobre o chão), na ordem:

| Faixa | Cota (m) | O que vai |
|---|---|---|
| MT | 9,0 a 9,25 | cruzeta a 9,0, fases no topo dos isoladores de pino a 9,25; chave fusível e para-raios na cruzeta |
| Trafo | 7,7 a 8,7 | tambor no suporte, abaixo da cruzeta (≥ 0,3 m livre até ela) |
| BT | 7,1 a 7,4 | grampo de suspensão do cabo multiplexado a 7,3 (padrão, seção 11); BT nua em armação usa 4 níveis de 7,1 a 7,4 |
| IP | 6,5 a 6,8 | braço de 1,5 a 2,5 m sobre a rua, luminária a 6,6: **abaixo** da faixa da BT, nunca dentro dela |
| Telecom | 5,7 a 6,1 | uma braçadeira por cabo, 0,1 m entre cabos, a primeira a 6,1 (≥ 0,4 m abaixo da luminária, faixa de 0,5 m de ocupação) |

Teste `pole-slots.test.ts`: toda faixa de todo spec do registro cabe em [0, altura − engaste], as faixas não se sobrepõem e seguem a ordem e
as separações da tabela. Poste de 12 m (`concrete_distribution_12`) sobe as faixas igual quando um `patch` pede.

**Folgas por classe de condutor [R2]** (ponto mais baixo da catenária amostrada; referência: NBR 15688 e as regras de compartilhamento
das distribuidoras):

| Classe | Sobre rua | Sobre calçada | Dentro do lote |
|---|---|---|---|
| MT | 7,0 | 6,0 | — (não entra no lote) |
| BT e ramal de energia | 5,5 | 4,5 | 3,5 |
| Telecom e ramal de telecom | 5,0 | 4,5 | 3,0 |

Com o cabo mais baixo fixado a 5,7 m, a flecha da telecom fica ≤ 0,6 m em 35 m (`sag.telecom`, cabo tensionado), e o ponto mais baixo ≥ 5,1 m sobre a rua.

**Energia — MT, BT, trafos**

| Regra | Valor padrão |
|---|---|
| Postes de um lado só da rua, na faixa de serviço da calçada, a 0,4 m do meio-fio; o lado é o que tem mais lotes ligados (empate: norte/oeste) | — |
| Vão entre postes; o poste cai na **divisa entre lotes** quando há uma dentro do intervalo; nunca na frente de portão ou garagem (`plan.gates`) | 30 a 40 m |
| **Esquina [R4]:** onde a linha de postes vira ou acaba, o poste de esquina fica na calçada do lado dos postes, na curva do meio-fio, a 0,4 m dele e fora da faixa de pedestre, com estai para cada direção de tração ancorado na calçada. A regra dos 5 m vale só para o poste **intermediário**: a ≥ 5 m da borda da pista transversal | 600 daN na esquina; 300 daN no meio |
| MT só nas ruas que levam trafo e no tronco até o alimentador | — |
| **Trafo [R3]:** a demanda do circuito é a **demanda diversificada pelo número de consumidores** (tabela `rules.power.diversity`, por faixa de carga instalada); escolhe-se a menor potência padrão cuja demanda fique dentro do **carregamento máximo** (80 % da nominal). Iluminação do circuito soma pela potência das luminárias | 30, 45, 75, 112,5 kVA |
| Tabela padrão de demanda diversificada por consumidor (carga instalada até 5 kW / acima) | 1–5 consumidores 2,0 / 3,0 kVA; 6–15 1,5 / 2,4; 16–30 1,2 / 2,0; 31–60 1,0 / 1,7; > 60 0,9 / 1,5 |
| Circuito de BT de um trafo, para cada lado; trafo no centro de carga | ≤ 200 m |
| Alimentador (`feed`): nó na borda do mapa onde a rua tronco sai | um por lado do rio (seção 6) |
| Ramal de ligação: do poste mais próximo do mesmo circuito até a ancoragem do padrão; mais longe, o gerador põe poste a mais | ≤ 30 m |

**Iluminação pública** (NBR 5101): o ponto de luz é um nó `light` filho do poste, na faixa IP, alimentado pela BT do mesmo poste (`light_feed`).
Coluna própria só quando o padrão do distrito pede (avenida, praça), alimentada por baixo da calçada. **O #470 entra aqui:** o estado da lâmpada
(funciona, pisca, queimada) continua `lampStateOf({ seed, x, z, shares })`, agora por nó `light`; aceso = noite **e** `lampState` **e** trafo
alimentado (seção 8). O orçamento de 16 luzes reais não muda.

**Telecom**: cabos na faixa telecom; caixa de emenda e rolo de reserva a cada ~4 vãos; ramal da casa até a ancoragem de telecom.
`telecom.cables` por distrito (padrão na seção 11).

**Esgoto** (NBR 9649): coletor DN 150 sob o **eixo da rua**, declividade ≥ 0,5 % no sentido do destino; PV (tampa Ø 0,6 m) em todo
cruzamento, mudança de direção e a cada ≤ 80 m; terminal de limpeza na ponta seca; ramal predial DN 100 a ≥ 1 % da caixa de inspeção do lote
(0,6 × 0,6 m, 1 m dentro da divisa da frente) até o coletor, perpendicular à rua, entrando por cima (selim). Profundidade máxima 4,5 m; além
dela, nó de elevatória (o teste avisa). Com terreno de altura, a cota segue `heightAt`; no chão plano do recorte, só pelo aprofundamento.

**Drenagem**: sarjeta dos dois lados (dado; o meio-fio é da T3.9); boca de lobo **com grelha** (não depende do meio-fio) na esquina a
montante da faixa e a cada ≤ 60 m, dos dois lados; ramal DN 400 até a galeria DN 600 sob a rua, 2 m ao lado do eixo; declividade ≥ 0,5 %;
saída com muro de ala na margem do rio, fundo acima do nível da água. O telhado escoa por buzinote sob a calçada até a sarjeta. Guia-chapéu
(boca no meio-fio) entra depois da T3.9.

**Água** (NBR 12218; entra porque é barata): rede DN 75 sob o terço da calçada do lado oposto aos postes; registro nos cruzamentos; hidrante
de coluna nas esquinas do tronco; ramal DN 20 até o cavalete com hidrômetro no muro, ao lado do medidor de luz; fonte `reservoir` na borda.
Gás encanado fica fora: o bairro popular usa botijão (`gas.ts`).

**Profundidades e cruzamentos [R5]** (recobrimento = do chão ao topo do cano; separação vertical mínima nos cruzamentos `rules.crossing` = 0,2 m):

| Rede | Recobrimento | Ordem de cima para baixo |
|---|---|---|
| Água (rede e ramal) | 0,6 a 0,8 m | 1ª: sempre acima do esgoto e da galeria |
| Ramal predial de esgoto | fundo ≤ 0,85 m onde cruza a galeria | 2ª: passa **por cima** da galeria e desce ao coletor por cima |
| Galeria e ramal de drenagem | topo ≥ 1,2 m (ramal 1,0 a 1,2 m) | 3ª |
| Coletor de esgoto | ≥ 1,8 m sob rua com galeria; ≥ 0,9 m sem | 4ª: abaixo do ramal de drenagem que cruza o eixo |

`slope.test.ts` confere a separação em todo cruzamento em planta, além das declividades.

## 5. Visível e enterrado

| Visível (peça desenhada) | Só dado (com a tampa ou a saída que aparece) |
|---|---|
| poste, cruzeta, isoladores, fixação da BT, trafo, chave, estai, braço e luminária, caixa de emenda e rolo | coletor, ramal predial, galeria, ramal da boca de lobo |
| vãos de MT, BT, telecom; ramais aéreos | rede e ramal de água |
| tampa de PV, grelha de boca de lobo, muro de ala, buzinote, tampa da caixa de inspeção no quintal, caixa do hidrômetro, hidrante, tampa de registro | alimentador e ETE fora do mapa (nós na borda) |

Cano enterrado não é desenhado nem colide. **Escavação ou cratera mais funda que o recobrimento não mostra cano, de propósito [R12]**: o trecho
vira dado rompido (seção 8); mostrar o cano é outra peça, se o dono pedir.

## 6. O recorte 1

Só duas ruas são linhas do plano (`main_street` z = 0, de −220 a 225, cortada pelo rio; `crossing_street` x = −100): ~650 m de rua, ~20
postes, 15 lotes. O rio (x ≈ −20) divide em dois sistemas **sem travessia**: o centro é alimentado pela borda oeste, o bairro pela leste (sem
vão sobre a água nem rede na ponte, `missing` T3.3). Esgoto: coletor da rua principal até um interceptor ao longo da margem, que corre para o
sul até um nó `treatment` na borda. Drenagem: as duas metades saem no rio por muros de ala. Água: reservatório na borda leste e na oeste.

## 7. Como a cena monta

1. `engine.generate` de cada lote (dado), com `utilities: { street: 'network' }` (seção 10, T2.8c).
2. `connectionsInWorld(plan, lot.id, placement)` de cada casa.
3. `urban.networks.build({ plan, lots, buildings, seed, rules?, feeds?, obstacles? })` → `UtilityNetworks` e `validateNetworks` (violação =
   erro de carga com o id do nó). **Árvores [R12]:** `obstacles.crowns` (`{ x, z, radius, bottom, top }`) vem da saída do provedor de plantas
   da cena, por opção; o `game-urban` não importa espécie.
4. `createUrbanThree(...).drawNetworks(networks, { lights, isNight })` e as casas; o ramal aéreo é da rede (ela conhece as duas pontas); o
   eletroduto do padrão até o medidor é da casa. `polePointsOf` (`roads.ts` 28) e o laço de `streets.ts` 46–51 saem da cena.

**Determinismo:** gerador puro de plano, lotes, pontos e semente; o sorteado (lado no empate, rolos, gatos, estado da lâmpada) vem do hash da
semente com o id, **nunca do `b.random` do builder**: a ordem do gerador da cena e o golden do `game-urban-three` não mudam. Roda na carga, no
quadro principal (centenas de nós); por ser puro, vira `TaskKind` de faixa `build` (§14) quando um plano de cidade inteiro pedir.

**Custo [R13]** (portão `--cost-check`): mastros instanciados por spec; ferragem instanciada; vãos fundidos **numa malha por classe de
condutor**, tubo de 4 lados com a catenária em 8 trechos; tampas e grelhas instanciadas. Alvo do recorte: **≤ 25 chamadas de desenho e ≤ 20 mil
triângulos perto (LOD 0)**; o LOD de longe (`LineSegments`, sem ferragem) conta à parte, ≤ 8 chamadas. Orçamento por classe no `shapes-bench`:
`urban/network:poles`, `:hardware`, `:mv`, `:lv`, `:telecom`, `:drops`, `:surface` (a tentativa gastou 31 chamadas só nos fios).

**Vão fundido e rasgo por vão [R8]:** cada malha fundida guarda `spanId → [início, quantidade]` dos índices. Ao soltar um vão, a faixa dele
vira índices degenerados na malha (um envio de índice por lote de eventos, marcado sujo, §15) e o vão nasce como malha própria entregue à
destruição, pendurado no poste que ficou (`tears`). Nada é refundido no quadro do golpe.

**§8:** `drawNetworks` devolve `dispose()` que solta malhas fundidas, instâncias, malhas de vão soltas e materiais próprios; `leak.mjs` monta e
solta 3 vezes. **§13:** fio nunca coplanar; tampa e grelha 3 mm acima do asfalto (a 2 cm), fora da faixa tracejada; ferragem afastada ≥ 2 mm;
poste, trafo, tampa, grelha, muro de ala, hidrante e o poste do padrão entram em `tests/catalog-cases.ts` dos `-three`. **§11:** poste do
padrão e muro de ala passam pelo `engenheiro-estrutural` e pelo teste de construção.

**§12 [R11]:** cada peça visível tem estado quebrado no catálogo: poste partido na base ou no meio, trafo caído, hidrante arrancado. Colide:
poste, trafo, hidrante, estai (estáticos até soltar). Tampa e grelha são chão; abaixo de um limiar de sopro ficam fechadas. Acima dele, saem
como peça solta **com colisor enquanto soltas**, e a abertura mostra o poço: casca de 0,6 m de diâmetro e 1,2 m de fundo (caixa da boca de
lobo: 0,8 × 0,5 m), aberta no chão como `GroundExcavation` do mesmo tamanho. Assim nada colide sem ser visto e ninguém anda sobre um furo
desenhado como chão.

## 8. Estado lógico e destruição (ganchos; o comportamento é a T2.8f)

- `graph.ts` dá `supplied(nodeId)` por busca a partir da fonte de cada rede. Perder nó ou aresta (`networks.lose(id)`) recalcula **só no
  evento**, nunca por quadro (§15), e emite `outage { network, nodes }`.
- **Classe dos eventos [R10]:** `network.lost` (aresta ou nó perdido, vindo do `released` do poste ou do `blow` do chão) e `network.outage`
  mudam estado que a simulação lê (aparelhos ligados, água que corre): entram como `structural` no `EVENT_CLASS`
  (`game-destruction-three/src/event-class.ts` 10) e são aplicados dentro do tique (§15). Se não passarem pelo barramento da destruição, a T2.8f
  dá a eles tabela de classe equivalente, com o mesmo teste de 30/60/120/144 Hz.
- **Energia:** poste que cai (`released` da peça `net:pole:<id>`, `holder: 'ground'`, engaste da `postEmbedment`) solta os vãos ligados a ele e
  tira o nó; trafo ou vão de MT perdido apaga o circuito: as luminárias dele apagam e as casas dele perdem a rede.
- **`setGrid` é do `World` inteiro [R9]** (`game-interactables/src/types.ts` 639). A cena monta as casas com um renderizador e o adaptador de
  interativos de cada `build` (`assemble/houses.ts` 102); a T2.8f confere se isso dá um `World` por casa. Sendo por casa, `setGrid(false)` por
  casa do circuito basta. Se a cena passar a um `World` compartilhado, a T2.8f acrescenta estado de rede por lote no `game-interactables`
  (`power.setGrid(on, { lot })`, os aparelhos leem o do lote deles), com teste, antes de ligar as quedas.
- **Água:** ramo perdido corta o `waterSupply` a jusante. Cratera mais funda que o recobrimento sobre a rede (`world.ground.on('blow')`) tira
  a aresta; jato do hidrante arrancado é do `game-fluids` depois. **Esgoto e drenagem:** só o dado de que o trecho rompeu.
- Colisão e destruição do poste dependem da L10 (o `game-urban-three` ainda não tem colisão): a T2.8f faz as duas juntas.

## 9. Testes que provam (sem GPU, no CI)

| Teste | Confere |
|---|---|
| `networks/graph.test.ts` | cada rede é uma árvore ligada à sua fonte (alimentador, reservatório, ETE, rio); MT e BT radiais; esgoto e drenagem sem ciclo e todo fluxo termina no destino |
| `networks/connect.test.ts` | todo lote com `UtilityConnection` de uma rede está ligado a ela **uma vez** (energia ao `power_lv`); ramal ≤ 30 m; ramal predial perpendicular e ≥ 1 %; `frame: 'plan'` recusado |
| `networks/slope.test.ts` | declividade ≥ mínima no sentido do fluxo; recobrimentos e profundidade máxima da tabela [R5]; separação ≥ 0,2 m em todo cruzamento; PV ≤ 80 m e em todo cruzamento; boca de lobo ≤ 60 m e em toda esquina a montante |
| `networks/clearance.test.ts` | folgas por classe da tabela [R2] sobre rua, calçada e lote; nenhum vão cruza a planta de uma casa nem um prédio abaixo da altura dele; nenhum vão por `obstacles.crowns` |
| `poles/pole-slots.test.ts` | as faixas [R1] de todo spec cabem acima do chão, em ordem, sem sobrepor; luminária fora da faixa da BT |
| `networks/placement.test.ts` | poste só na faixa de serviço, nunca em lote, rua, rio, faixa de pedestre ou frente de portão; vão no intervalo; esquina e fim de linha com estai; intermediário ≥ 5 m da pista transversal |
| `networks/load.test.ts` | demanda diversificada de cada trafo (tabela [R3]) dentro do carregamento máximo; circuito de BT ≤ 200 m para cada lado |
| `networks/determinism.test.ts` | mesma entrada, mesmos bytes (hash); golden do `game-urban-three` sem diff |
| `validate.test.ts` | cada código de `NETWORK_VIOLATION` com um caso que reprova |
| exemplo `tests/networks.test.ts` | o recorte 1 inteiro passa no `validateNetworks`; cada um dos 15 lotes ligado às cinco redes |

Prints: os mesmos cinco enquadramentos dos `fios-antes-*`, antes e depois, na T2.8d; câmera de ombro e 1ª pessoa (§5).

## 10. Ordem em PRs pequenos [R14]

| Task | PR | Pacotes | Modelo |
|---|---|---|---|
| **T2.7 🧠** | este desenho, revisado pelo `architect` | `specs/` | `opus` |
| T2.8a | `UtilityConnection` no `game-contracts`; tipos, `graph.ts` e `validate.ts` com fixtures à mão; `kit-audit/rules.json` com as palavras novas | contracts, urban | `sonnet` |
| T2.8b | **depois do #470 mergeado**: `concrete_distribution` no registro de postes com `slots` (o `pole-slots.test.ts` passa a varrer o `DEFAULT_POLES` e exige ao menos um poste com faixas); gerador de energia e iluminação (postes, MT, BT, trafos, ramais como dado); o `light` herda o `lampStateOf` | urban | `sonnet` |
| T2.8c | lado da casa (abaixo) | floorplan-structure, -three, -interactables | `sonnet` |
| T2.8d | desenho de energia, iluminação e telecom; a cena troca `polePointsOf` pela rede; prints antes e depois | urban-three, exemplo | `sonnet` |
| T2.8e | esgoto, drenagem e água (dado) e as peças de superfície (tampa, grelha, muro de ala, hidrante, registro); no `validateNetworks`, as regras que pedem o plano da rua e ficaram fora da T2.8a: PV em todo cruzamento e mudança de direção, boca de lobo a cada ≤ 60 m e na esquina a montante, ramal predial e da boca de lobo perpendiculares à rua (a T2.8a já confere coletor ≤ 80 m entre PVs, recobrimento de 1,8 m sob rua com galeria e ramal ≤ 0,85 m onde cruza a galeria) | urban, urban-three, exemplo | `sonnet` |
| T2.8f | estado lógico (`supplied`, `outage`, luminárias, `setGrid`, `waterSupply`), poste e vão como peças de destruição, `EVENT_CLASS`; `cutRun` para o `game-destruction`; depende da L10 | urban, urban-three, destruction, interactables, exemplo | `sonnet` |

**T2.8c, o lado da casa:**
- O modo fica **no registro da planta**: `electrical.serviceEntrance.street: 'own' | 'network'`, padrão `'own'` (o de hoje, goldens do time
  iguais). Em `'network'` a entrada é o **poste do padrão** de 6 m atrás do medidor (ou pontalete na fachada sem quintal), sem poste de rua.
- Os dois postes vizinhos e a rede entre eles (`electrical.ts` 75, desenhados sempre que há poste) passam a sair **só** em `'own'`.
- O poste do padrão é **objeto do `game-floorplan-interactables`**, como o poste de hoje (o adaptador lê `serviceEntrance` em `adapter.ts` 692):
  com interativos o kit desenha o objeto e o `-three` não (a regra `KV.serviceEntrance` de `electrical.ts` 74); sem interativos o `-three`
  desenha. Nunca os dois, nunca nenhum; teste dos dois caminhos.
- `ElectricalInfo.pole` muda de sentido em `'network'`: é o poste do padrão, não o da concessionária. Fica dito no changeset e no README.
- Sai também: caixa de inspeção, hidrômetro, buzinote, ancoragem de telecom, `connectionsInWorld`, `installedKva`.

**#470** mergeia como está (estado da lâmpada por ponto); na T2.8b os pontos passam a ser os nós `light`, e a posição dos postes muda: os
prints de noite e a régua do `pior` são regravados nesse PR, com a mudança dita no `evidence.md`.

## 11. Perguntas ao dono — **padrão até o dono decidir**

1. **Para onde vai o esgoto?** Padrão: coletor → interceptor ao longo do rio → ETE fora do mapa (nó `treatment` na borda sul), o certo pela
   norma. Alternativas: lançamento no rio sem tratamento (margem suja), ou parte do bairro sem rede, com fossa no lote.
2. **Época da rede.** Padrão: MT nua na cruzeta e BT em cabo multiplexado (um cabo torcido no neutro, o mais comum hoje). Alternativa: BT nua
   em armação de 4 fios (bairro antigo) ou MT compacta com espaçador; todas são estilo do poste no registro.
3. **Quanto de "periferia de verdade".** Padrão: centro limpo; no bairro popular, feixe de 3 a 5 cabos de telecom com rolos e alguns gatos
   (ramal sem medidor: a casa fica ligada no grafo e soma na demanda do trafo, sem medidor, ~1 em 10 lotes, pela semente). Alternativa: tudo limpo, ou mais bagunça.
