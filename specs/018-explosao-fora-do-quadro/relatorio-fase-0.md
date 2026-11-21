# Spec 018 — relatório da Fase 0 e recomendação para a D1

> T0.5, 2026-11-20. Fonte dos números: `evidence.md` desta spec (T0.1 a T0.4) e, onde dito, a evidência da 017. Este relatório **recomenda**;
> D1, D2 e D3 continuam abertas no `spec.md` e são do dono.
> D1 e D3 foram decididas em 2026-11-21, ver §8; o texto abaixo é mantido como foi escrito.

## 1. Resposta

**Pergunta da Fase 0:** mover trabalho da explosão para um worker tira o quadro do impacto de ~64 ms para 33,3 ms?

**Resposta dos números: não pelos caminhos A e C, nem somados.** O teto líquido de A é ~3 ms (só o que é puro) a ~8,5 ms (contando o que
escreve estado), o de C é ~1,1–2,2 ms; juntos tiram no máximo ~11 ms e o quadro fica em ~53 ms. O caminho B não foi prototipado; a conta com
os números medidos indica que ele também deixaria um quadro acima de 33,3 ms (o que recebe os ~700 eventos), além de ser uma reescrita da
fronteira do pacote. Só tirar **inteiros** o `explode` (~21 ms) **e** a aplicação dos eventos (~17 ms) leva o quadro abaixo de 33,3 ms, e
nenhum dos três caminhos faz as duas coisas.

## 2. O quadro do impacto e quanto cada caminho tira

### 2.1 Do que o quadro é feito (1x, modo de prazo, casa da sala, C4)

| Bloco | ms | De onde | Puro? | Movível por |
|---|---|---|---|---|
| **f0 inteiro** (`update` + `renderCpu`, sonda desligada) | **63–65** (62,9 / 63,5 / 64,0 / 64,9) | T0.1, pares desligados | | |
| **`world.explode`** (sonda desligada) | **20–22** (19,5–21,9) | T0.1, T0.3 | não, no todo | A (partes), B (todo) |
| ↳ `partGeometry` (onda e geometria por peça) | 1,3–1,9 (inflado pela sonda fina) | T0.1 | sim | A |
| ↳ `koGrid` (grade de unidades) | 2,1–2,3 | T0.3 | sim | A |
| ↳ `ssGraph` + `ssSolve` + `ssSpan` + `ssLoads` | 1,1–1,6 | T0.3 | sim | A |
| ↳ `ssApply` (escreve `p.st`) | 1,4–2,1 | T0.3 | não | A, teto folgado |
| ↳ `koFragments` (usa `rnd`) | 0,5–0,6 | T0.3 | não | A, teto folgado |
| ↳ `impls` (`sedan_scenery_1` 2,3–2,7 + `room_ground` 0,5–0,6) | 2,9–3,3 | T0.3 | não verificado | A, teto folgado (código fora do pacote) |
| ↳ `explodeRest`: laço por peça (`emit` + ouvintes, `applyDamage`, `wearJoints`, `units`, `bend`, `marks`) | 11,1–12,7 | T0.3 (T0.1 grosso: 10,7–12,1) | não | só B |
| **Eventos estruturais no tique** (`applyStructuralEvents`) | **17–18 com sonda**; ~16–17 sem (estimativa: a sonda custou ~1–2 ms no `update`) | T0.4 | | |
| ↳ `whNormals` + `whCollapse` + `exSlice` | 2,0–2,4 | T0.4 | sim | C |
| ↳ `splitGroups` | 1,5 | T0.4 | não (muda o mundo) | nenhum dos três |
| ↳ `apply(ev)` dos ~700 eventos | 12,1 (série 1); 12,7–13,2 somando por tipo (série 2, limite superior) | T0.4 | não (desenho, three.js) | nenhum |
| ↳ `hingeOf` + `adoptThree` + resto | 1,4–1,9 | T0.4 | não | nenhum |
| `action` (`effects.explosion`, `renderer.explode`) | ~6,6–7,5 | 017 rodada 5; **não remedido na 018** | | nenhum |
| `renderCpu` | ~8,4 | 017 rodada 3; **não remedido na 018** | | nenhum (B não toca) |
| resto (matrizes, sistemas, áudio, mundo) | ~10 | por diferença: 64 − 21 − 16,5 − 7 − 8,4 ≈ 11; 017 rodada 3 somava ~9 | | nenhum |

### 2.2 Quanto sai e quanto falta (f0 de referência 64 ms; meta 33,3 ms; falta hoje 64 − 33,3 = **30,7 ms**)

| Caminho | Tira (teto líquido) | De onde | f0 que sobra | Falta para 33,3 |
|---|---|---|---|---|
| nenhum | 0 | | 64 | 30,7 |
| A, só o puro | ~3,1 | T0.3: 5,1 − 2,0 de fronteira | 60,9 | 27,6 |
| A, folgado | ~8,5 | T0.3: 10,5–10,6 − 2,0 | 55,5 | 22,2 |
| C | 1,1–2,2 | T0.4: 2,0–2,4 − 0,2 a 0,9 de fronteira | 61,8–62,9 | 28,5–29,6 |
| A puro + C | 4,2–5,4 | 3,1 + 1,1 ; 3,2 + 2,2 | 58,6–59,8 | 25,3–26,5 |
| A folgado + C | 9,6–10,8 | 8,5 + 1,1 ; 8,6 + 2,2 | 53,2–54,4 | 19,9–21,1 |
| Tudo que tem rótulo no `explode` + C, fronteira zero (limite irreal) | 12,4–14,3 | T0.3: 21,4 − 11,1 = 10,3; 24,8 − 12,7 = 12,1; + 2,1–2,2 | ~50–52 | ~16–18 |
| `explode` inteiro **e** eventos inteiros fora (nenhum caminho faz isso) | ~37,5 | 21 + 16,5 | ~26,5 | — (sobra 6,8) |

Os tetos são **otimistas por construção**: kernel de custo zero, latência do `postMessage` não contada, aplicação do plano na volta estimada
(1,0 ms em A, palpite declarado na T0.3), entrada de `koGrid`/grafo não medida (T0.3), fronteira dos hosts estimada (T0.4). O valor real de
cada linha é menor ou igual ao da tabela.

## 3. Caminho B (mundo residente no worker): o que dá para afirmar

**Não foi prototipado nem medido.** O que os números permitem dizer:

- **O que sairia do quadro, no teto:** o `world.explode` inteiro, ~20–22 ms (T0.1), incluindo os ~11–13 ms do laço por peça que A não alcança.
- **O que continuaria no quadro principal:** a aplicação dos eventos (~16–17 ms; ~85% é apresentação, malha, marcas e som, segundo a 017
  `evidence-perfil2.md`; `apply(ev)` mexe em three.js, T0.4), `action` (~7), `renderCpu` (~8,4) e o resto (~10). O desenho não vai para o worker.
- **Onde o pico vai parar (estimativa, conta à vista):** com o mundo no worker os eventos chegam em N + latência. O quadro do clarão fica com
  ~64 − 21 − 16,5 ≈ **26,5 ms** mais o custo de mandar o comando e manter o espelho (não medido). O quadro que recebe os ~700 eventos paga
  ~16,5 ms em cima de um quadro que hoje já custa ~20,5 ms (f1, 017 `design-onda.md` §9) a ~25 ms (pior dos 7 seguintes, 017 rodada 3):
  **~37–42 ms**. B sozinho **move** o pico para um quadro depois; não o tira. Para passar de 33,3 ms, B precisaria também espalhar a aplicação
  dos eventos por vários quadros, o que muda o que o jogador vê (D2) e que a 017 já tentou em parte (eventos visuais adiados: ~1 ms, não entrou).
- **Fronteira:** mandar o mundo pelo snapshot custa `serialize` 4,0 + `structuredClone` 3,3 = **~7,3 ms só de ida**, ~0,9 MB (T0.2), mais do que
  o maior rótulo do `explode`. Um espelho por quadro com o snapshot inteiro é inviável; precisaria de delta, que não existe e não foi medido.
- **Riscos de reescrita (fatos do código, não medidos em ms):**
  - todo leitor síncrono do mundo (raio, colisão, `standing`, módulos da sala) passa a ler um espelho (`spec.md` §3);
  - os ouvintes do `emit` rodam dentro do `explode` (~3,9–4,6 ms, T0.1) e alguns leem `hp` na hora (017 `evidence-explode.md` item 3:
    `case 'fracture'` e `strikePiece`); com o mundo no worker eles passam a ser eventos atrasados;
  - o snapshot de hoje deixa de fora `blasts`, `frontQueue`, `primed`, pendências de estrutura, ouvintes e caches (`spec.md` §2);
  - a regra 14 exige o mesmo estado com worker a tempo e sempre atrasado. O único `ResidentKind` do kit (`crowd.physics`) guarda o estado no
    quadro principal e manda o quadro inteiro a cada passo, para o quadro principal poder calcular quando o worker atrasa
    (`game-crowd/src/physics/offload/kind.ts`). Para a destruição isso é mandar ~0,9 MB por passo, ou manter o mundo dos dois lados;
  - a thread de simulação inteira (T22, `game-workers/src/sim-thread.ts`) existe, mas precisa de memória compartilhada (`crossOriginIsolated`),
    e a página da régua (`file://`) não é isolada (T0.1). Nenhum módulo da destruição roda nela hoje.
- **O que não se pode afirmar:** quanto custa o espelho, a latência real de um `Worker`, quanto custa o `explode` dentro de um worker, se os
  bytes ficam iguais com o worker atrasado, e quantos quadros de latência o jogo aceita (D2).

## 4. Achados fora dos três caminhos (sem worker)

Candidatos a otimização comum sob a regra 15. **Todos são hipóteses não testadas**; o ms é o medido, não o ganho. A 017 já fez ou descartou
vários cortes (`design-tiques.md` §4, `evidence.md` rodadas 3 a 5, `evidence-explode.md`); o que ela tocou está dito.

| Achado | ms medido | De onde | O que a 017 já fez | Por que ainda vale olhar |
|---|---|---|---|---|
| `impl.hit` do `sedan_scenery_1`: uma chamada | 2,3–2,7 | T0.3 | corte A: parar na primeira peça do `implInRange` (a busca, não o `hit`) | uma chamada de um carro custa o mesmo que o `solveStructure` inteiro; ninguém olhou dentro dele. Só existe com carro no raio |
| `ssApply` (laço final do `solveStructure`) | 1,4–2,1 em 5–6 chamadas | T0.3 | o item E (resolução dentro do `knockOutUnits`) foi desfeito por mudar golden; o `ssApply` não foi tocado | é ~2/3 do `solveStructure`; o `solveSupports` em si é 0,3–0,5 |
| `koGrid` + resto próprio do `knockOutUnits` | 2,9–4,2 em 2–3 chamadas | T0.3 | corte D: sem trabalho repetido (~1 ms junto com A–C, dentro do ruído) | maior bloco de poucas chamadas do `explode`; precisa olhar por dentro da grade |
| evento `chip` | 1,4–1,7 em 2–3 eventos | T0.4 (só 2–3 relógios: pouco inflado) | nada | ~0,5–0,7 ms por evento |
| evento `fracture` (sem `writeHost` e `splitLoose`) | 2,9–3,4 em 10–11 | T0.4 | malha uma vez por lote (~1,7 ms, entrou); som pela fila (sem ganho, não entrou) | o que sobra (`extract`, `hide`, `onFracture`, fragmentos) não foi repartido na 018 |
| `computeVertexNormals` dos hosts | 1,7 (1,1–3,3 entre rodadas) | T0.4 | nada | recalcula as normais do host inteiro (23 mil vértices) quando só algumas faixas mudaram |
| `emit` + ouvintes | 3,9–4,6 (inflado pela sonda fina) | T0.1 | cópia da lista de ouvintes só na escrita (corte B, entrou); a 017 `evidence-perfil2.md` pôs ~2,2 ms no `breach.spall` | a 018 não repartiu por ouvinte; `breach.ts` já tem `deferPaint` para o `spall`, e não conferi se a sala o liga |

Não proponho: adiar `crack`/`debris` (017 rodada 3, ~1 ms, não entrou), som pela fila (017 rodada 5, não entrou), adiar o `damage` da casa
(017 `evidence-explode.md` item 3: lê `hp` na hora), dividir a explosão em tiques (017 D5 e `design-onda.md` §9). O `damage` (1,7–2,0 ms em
~560 eventos, T0.4) está fora da lista porque um par de relógios por evento é da mesma ordem que o próprio custo; sem medida sem sonda, não se
sabe se há algo ali.

**Somando os maiores desta tabela** (`impl.hit` ~2,5 + `ssApply` ~1,8 + `chip` ~1,5 + normais ~1,7 ≈ 7,5 ms), mesmo que sumissem por inteiro o
f0 ficaria em ~56 ms. Isso não fecha a meta; é trabalho de otimização comum, item por item, cada um com tabela.

## 5. Recomendação para a D1

**Recomendo desistir da meta de 33,3 ms para o pior caso (C4 encostado na parede, casa inteira da sala), e decidir a D3 com uma medição do
caso típico antes de abrir qualquer caminho de worker.** Para o pior caso: aceitar o f0 de ~64 ms a 1x e registrar como limite conhecido.

**Por quê:**
- A, C e A+C não chegam: no melhor teto o f0 fica em ~53 ms (§2.2). Faltariam ~20 ms que nenhum deles alcança.
- B é o único que tira o `explode` inteiro, mas a conta com os números medidos põe o pico em ~37–42 ms no quadro seguinte (§3), e o custo é
  reescrever a fronteira do pacote sem nenhuma medida que garanta o resultado. Para chegar a 33,3 ms com B seria preciso também espalhar a
  aplicação dos eventos, que é apresentação e muda o que o jogador vê (D2).
- Dois projetos grandes (B + espalhar a apresentação), um deles já tentado em parte sem ganho, para um único cenário de pior caso, é custo
  alto com resultado incerto.

**O que contraria a recomendação:**
- **B não foi medido.** A estimativa de ~37–42 ms usa `action`, `renderCpu` e o quadro seguinte da 017, não da 018, e supõe que a aplicação dos
  eventos fica inteira no quadro principal. Se o dono quiser a meta mesmo no pior caso, o próximo passo honesto é um protótipo de B, não desistir.
- **Máquina mais lenta.** A 1x o pior caso perde ~1 quadro a 30 Hz; a 4x a 017 registrou f0 acima de 300 ms (`spec.md` §1 da 017, medido antes
  das melhorias dela) e o kit quer rodar em AMD. Um worker escala com núcleos; otimização no quadro principal não. Se o alvo for máquina fraca,
  o argumento a favor de B fica mais forte do que estes números a 1x mostram.
- **Não se sabe quão raro o pior caso é no jogo.** Se C4 em casa inteira for comum, desistir dele é desistir do caso que importa.

**Custo de cada opção:**

| Opção | Custo | Ganho no f0 do pior caso |
|---|---|---|
| A | kernel puro + `checkTaskKind` + aplicação em N + latência + tudo o que a 017 `design-onda.md` §2.2–§2.6 e §3 exige + latência visível (D2) | ≤ ~3 (puro) a ≤ ~8,5 (folgado), teto |
| C | kernel na faixa `build` + fronteira dos hosts + malha velha 1 quadro | ≤ ~1,1–2,2, abaixo dos ~3 ms que a régua lê no total (regra 15) |
| A + C | os dois | ≤ ~10–11; f0 ≥ ~53 |
| B | reescrita da fronteira do `game-destruction` (espelho, ouvintes, estado fora do snapshot, equivalência com worker atrasado ou thread de simulação com memória compartilhada) | até ~21 no quadro do clarão; pico estimado de ~37–42 no seguinte |
| Desistir para o pior caso | nenhum código; o pior caso fica em ~64 ms a 1x e pior em máquina lenta | 0 |

**O que a D3 muda:**
- **Meta no pior caso:** só B (mais espalhar eventos, D2) tem chance, sem garantia medida. A recomendação acima vale.
- **Meta num caso típico:** se o caso típico (granada, explosão menor, menos peças no raio) já estiver perto de 33,3 ms, os achados da §4 e um
  A pequeno podem bastar, e B deixa de ser necessário. O custo do `explode` acompanha o número de peças no raio (506 das 552 com o C4), então o
  caso típico pode ser muito mais barato; isso **não foi medido**.
- **Medição barata que falta:** o f0 do caso típico. Duas formas, sem protótipo: (1) a fase de explosões a frio do `perf.mjs` (9 armas) já existe;
  rodá-la com a máquina quieta e ler o pior quadro de cada arma (a única passagem citada na 017, C8, rodou com carga 8–14 e não vale como
  tempo); (2) a régua `room-explosion` com outro explosivo no lugar do `c4` (hoje fixo em `room.blastAt('c4', …)`, `tools/gpu/room-explosion.mjs`;
  pede uma variável nova), contando as peças no raio com a sonda da T0.2.

## 6. Limites da evidência

**Não medido em nenhuma task da Fase 0:**
- Ida e volta real por `postMessage` a um `Worker`, o kernel rodando num worker, `loadObject` do outro lado, aplicação do resultado na volta
  (T0.2, T0.3, T0.4). A aplicação do plano de A (1,0 ms) é palpite.
- A entrada de `koGrid` e do grafo (`unitGrid`, `wedgedUnder`, `edgeLists`), a entrada dos ouvintes do `emit`, o abrigo (`reachAt`) e o raio de
  `seesFireball` como entrada (T0.2, T0.3).
- A fronteira real dos hosts no caminho C (`byteLength`, tipo do índice, `structuredClone`/`transfer`) (T0.4).
- `partGeometry` e os rótulos por peça sem relógio (T0.1, T0.3: usa-se o valor inflado); `applyStructuralEvents` inteiro sem sonda (T0.4: só pela
  diferença do `update`, ±2 ms).
- Qual código dentro do `impl.hit` do sedã custa 2,3–2,7 ms; a divisão do `emit` por ouvinte na 018.
- `action`, `renderCpu` e o resto não foram remedidos na 018 (números da 017).
- Os quadros seguintes ao impacto (`afterMs`) com qualquer protótipo: não houve protótipo (T0.3, T0.4).
- Outras casas, outros explosivos, 4x, AMD.

**Condição da máquina:**
- Cargas acima de 1,5 no meio ou no fim das séries: T0.1 fim 1,61 e 1,84; T0.3 fim 1,60; T0.4 fim 1,78 e 1,57.
- A régua da T0.2 começou com carga 3,28 (a cauda do `pnpm build` dentro da trava), acima do 1,5 das tasks; o processador foi a 72 °C.
- Antes da T0.1 a máquina passou ~35 min com carga 2–7 e 80–100 °C; picos de 88 °C durante a série fina.

**Método:**
- A sonda fina infla os rótulos por peça (~3000 relógios por explosão; +4,3 ms no `explode` da explosão, T0.1); a sonda por evento infla o
  `apply(ev)` (~1.400 relógios por tique, T0.4). Os valores por peça e por tipo de evento são limite superior.
- `performance.now` em passos de 0,1 ms (página `file://` não isolada): rótulos de centenas de chamadas curtas valem como ordem de grandeza.
- 3 rodadas por série; uma casa só; só 1x; uma série por divisão (a T0.4 viu `whNormals` variar de 1,1 a 3,3 ms entre rodadas; a cratera da T0.3
  teve duas rodadas altas e ±2 ms nas medianas).

**Divergências com o `spec.md` §1** (a tabela do §1 deveria ser corrigida antes das fases seguintes; não a alterei):
- `explode`: 20–22 ms medido (T0.1, T0.3) contra 24–26 ms no `spec.md`. A 017 rodada 3 já dava 20,4.
- Eventos estruturais: ~17–18 ms com sonda (T0.4) contra ~14 no `spec.md`. A 017 rodada 3 dava 11,9 + 6,1 = 18,0; o "~14" não bate nem com a 017.
- Peças: o mundo tem **552** peças (T0.2); as 521 do `spec.md` são as que o `blastPart` visitou (T0.1).

**Desvio do texto das tasks:** a T0.3 pedia um protótipo do caminho A (kernel, entrada plana, aplicação em N + 1, régua em pares) e a T0.4 um
protótipo do caminho C. **Nenhum dos dois kernels foi construído.** As duas pararam na conta do teto: a T0.3 pela regra "não passou: registrar e
parar" do próprio texto, aplicada ao teto em vez do protótipo; a T0.4, que não tinha critério de parada escrito, parou num limiar de ~2 ms
escolhido na execução (a regra 15 fala em ~3 ms). A conclusão não depende disso, porque os tetos ficam abaixo do exigido mesmo com kernel de
custo zero, mas é um desvio e fica dito.

## 7. O que fazer com a branch

`spec/018-explosao-fora-do-quadro` tem 5 commits de sonda (protótipo descartável): `dd4839359` (T0.1), `ebfe8c577` (T0.2), `39bfcd4f0` (T0.3),
`ca18530d5` e `18811e5e1` (T0.4), que mexem em `game-destruction` (`world.ts`, `explode-probe.ts`, `boundary-probe.ts`, `index.ts`),
`game-destruction-three` (`renderer.ts`, `visual.ts`, `apply-probe.ts`) e `tools/gpu/room-explosion.mjs`. **Nada disso vai para a `main`.**

Para a `main` iriam só `evidence.md`, este `relatorio-fase-0.md` e `medicoes/`, num PR só de documentação, montado a partir da `main` sem os
commits de sonda. O PR depende da aprovação do dono e não foi aberto. Se as sondas forem úteis de novo (para o caso típico da D3, por
exemplo), os commits ficam na branch para serem reaplicados.

## 8. Depois da Fase 0: o caso típico é pior que o pior caso (2026-11-21)

> Acrescentado em 2026-11-21. Os §1 a §7 acima ficam como foram escritos em 2026-11-20; o §5 recomendava decidir a D3 medindo antes o caso típico.
> Esta seção é essa medição e o que ela muda.

**O que se assumia:** que o C4 contra a casa inteira (63–65 ms) era o pior caso, e que um explosivo menor seria mais barato (§5, "O que a D3 muda").
**O que foi medido:** os explosivos de fragmentação custam cerca de 2 vezes (M67) e cerca de 3 vezes (bomba de cano) o C4.

Condições: régua `room-explosion`, modo de prazo, 1x, cena da casa, NVIDIA, sob `flock`, páginas guardadas e conferidas por hash. Quadro da explosão
(`f0Ms`), `main` depois do #417 (página `b4a1ac7e07c1`). As sessões diferem ~20% em valor absoluto; só vale comparar dentro da mesma sessão.

| Explosivo | `f0Ms` (ms) | Observação |
|---|---|---|
| molotov | 22–26 | |
| C4 | 63–67 | base da rodada diária gravada em 66,8 ms, carga 0,84 |
| M67 | 117–138 entre sessões | 120,5 e 120,6 na última sessão, carga 1,47–1,49 |
| bomba de cano | 177–227 entre sessões | 186,2 e 186,3 na última sessão, carga 1,37–1,40 |

Antes do #417 (`main` antiga): M67 140–172 ms, bomba de cano 236–293 ms.

Maiores módulos do pior quadro depois do #417:

| Módulo | M67 (ms) | Bomba de cano (ms) | C4 (ms) |
|---|---|---|---|
| `explode` (simulação dos fragmentos) | ~43–55 | ~82–109 | 21–26 |
| `destrEvents` | ~44–49 | ~61–77 | 12–16 |

As tabelas completas estão nas descrições dos PRs #417 e #419. Os JSONs brutos ficaram numa pasta de rascunho de sessão, que não é durável, e não
são citados aqui.

**O que isso muda na recomendação do §5** (o texto do §5 não foi reescrito):
- A recomendação de "desistir da meta para o pior caso" assumia que o C4 era o pior caso. Não era. O pior caso real é bem maior que o C4, e o dono escolheu a M67 como
  caso de referência (2026-11-21). Com que frequência cada explosivo aparece num jogo não foi medido.
- A conta do §2 (A, C e A+C tiram no máximo ~11 ms) foi feita sobre o C4. Para a M67, em ~120 ms, o mesmo teto é ainda menor em proporção.
  Não foi refeita para a M67.
- O dono decidiu em 2026-11-21: **D3** = o caso de referência da meta é a M67; **D1** = nenhum caminho de worker agora, atacar os explosivos de
  fragmentação na thread principal, com uma proposta de cortes (quanto rende cada um, quais goldens mudam) antes de mexer na simulação. **D2** segue
  aberta e pesa mais, porque espalhar os impactos dos fragmentos por 2 ou 3 tiques é um dos cortes candidatos.
- A meta de 33,3 ms na M67 está longe (~120 ms medidos). Nenhuma evidência atual diz que ela é alcançável.
