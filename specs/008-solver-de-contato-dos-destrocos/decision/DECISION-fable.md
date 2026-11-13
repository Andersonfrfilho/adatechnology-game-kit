# Decisão — item 6: como os destroços soltos resolvem contato

Revisão independente (somente leitura) dos spikes A (solver próprio) e B (Rapier), sobre a base 74774f11.
Data: 2026-11-13.

## Resumo

**Recomendo A (solver próprio por impulsos sequenciais), levado a produção com mudanças específicas — e com o critério de aceite reescrito antes de qualquer código.**
B (Rapier) resolve o teste da bacia, mas piora a sala real, perde regras do §12 e custa +1,67 MB; não recomendo.
O critério "nenhuma velocidade para cima > 0,05 m/s" é incoerente com o outro número do próprio alvo (3,5 cm) e nenhum solver físico o cumpre: precisa virar um critério de energia.

## 1. Recomendação e por quê

### Antes de comparar: as métricas dos dois spikes

Os dois spikes mediram a sala com sondas diferentes. Conferi os scripts:

- A (`item6-escalation/A-probes/blast.js`): `lift` = subida do centro de massa além do que a velocidade própria carrega; `launches` = toda velocidade para cima nova > 0,05; `restLaunches` = só as de peça que não caía a mais de 0,3 m/s.
- B (`scratchpad/rapier-scripts/ag_blast.js`): `lift` = toda subida enquanto vy ≤ 0,05; `launches` = vy > 0,05 vindo de ≤ 0,05.

As colunas equivalentes batem na baseline (prova de que são comparáveis): lift do blast 0,565/0,276/0,155 (sonda A) contra 0,56/0,58/0,21 (sonda B); lançamentos 37/36/30 contra 37/39/32.
A coluna "lançamentos a partir do repouso" do relatório A (onde A parece **pior** que a baseline) **não existe em B**. Não se pode usá-la para dizer que B é melhor.
Na coluna comum (lançamentos totais), A também melhora a baseline: blast 23/24/26 (baseline 37/36/30), martelo 18/27/19 (baseline 28/31/27).

Os benchmarks também diferem (A cronometra `renderer.update` com as 40 peças forçadas acordadas; B cronometra só `pieceSys.update`). Só as razões valem: A ≈ 1,7×, B ≈ 1,5×.

### Tabela reconciliada

| Medida | Baseline | A (próprio) | B (Rapier) |
|---|---|---|---|
| Bacia, critério original (32 casos) | 15 falham | 3 falham | 0 falham (com trava de velocidade; 8 sem ela) |
| Bacia, critério reescrito (seção 2) | 11 falham | **1 falha, por 1,6 mm** | 0 |
| Sala, blast: maior lift (3 rodadas) | 0,56 / 0,28–0,58 / 0,15–0,21 m | **0,083 / 0,023 / 0,031** | 0,050 / 0,047 / 0,079 |
| Sala, blast: peças com lift > 3,5 cm | 12–16 | **1 / 0 / 0** | 5 / 3 / 5 |
| Sala, martelo: maior lift | 0,07–0,15 m | **0,033 / 0,028 / 0,014** | **0,59 / 0,58 / 0,13** |
| Sala, martelo: subida acima do nascimento | 0,03 m | 0,002–0,003 m | **0,64 / 0,84 / 0,30 m** |
| Dormindo no fim (blast; martelo) | 36/36; 37/37 | 34/36; 35/37 | 17–19/36; 7–19/37 |
| Testes do pacote que falham | só a bacia | 7 | 20 |
| Custo (razão sobre a baseline) | 1× | ~1,7× | ~1,5× |
| Tamanho da sala (gzip) | — | +3,5 KB | **+1,67 MB** |
| Inicialização | síncrona | síncrona | assíncrona (43–127 ms) |

### Por que A

1. **Na sala real, A é melhor que B em tudo o que o dono vê.** B levanta pedaços grandes 0,3–0,84 m no martelo — pior que a baseline — e deixa metade dos destroços acordada.
2. **B quebra regras do §12 que A mantém.** Conferi no código:
   - Atrito estático/dinâmico perdido: um coeficiente só (`spike-rapier/.../src/rapier-pieces.ts:266,283`). O §12 exige Coulomb com os dois.
   - Degraus viram rampa: o chão é um heightfield com células de 10 cm (`rapier-pieces.ts:34-35,347`). Mesa e laje deixam de ter quina.
   - Colisor invisível: os fixos entram como caixas alinhadas aos eixos (`rapier-pieces.ts:367`), não como o que está desenhado.
   - Sono, orçamento `maxAwake` e `restPoints` quebrados (3 testes), "lata na mesa que perde as pernas" falha.
3. **B muda de solver no meio do jogo.** Enquanto o WASM não carrega, roda o solver antigo, e troca quando fica pronto (`spike-rapier/.../src/pieces.ts:511-529`). O resultado depende do tempo de carga: o determinismo "bit a bit" do teste de B só vale depois do `await`. As APIs do kit são síncronas; outros pacotes rodariam o solver antigo nos testes sem aviso.
4. **A manutenção de B não fica mais fácil, fica dividida.** O que falha em B está nas costuras (chão, sono, atrito, espelho de dois mundos a cada quadro), justamente onde moram as regras do kit. Cada versão do Rapier reabre essas costuras.
5. **A API pública de A não muda** e `partBoxes`/`shownBoxes`/`onBrokenChecked`/`contacts`/cratera seguem como estão.

### O argumento mais forte contra A (e a resposta)

"Solver escrito à mão é um poço de ajuste; Rapier já resolveu warm start, ilhas e pilhas." É verdade, e o relatório A mostra o sintoma: com 10 passadas falham 3 de 32; com 6, 8, 15, 20 ou 40 falham 7 a 17. Isso é resultado sensível a constante.
Resposta: boa parte dessa sensibilidade vem do **limiar de 0,05 m/s**, que é 16 vezes mais apertado que o de 3,5 cm (seção 2). O próprio Rapier puro falha 8/32 nele. Com o critério coerente, A falha 1/32 por 1,6 mm. O risco de ajuste existe e o plano o trata com varredura de constantes como gate, não com uma constante da sorte.

### Por que não "baseline + correção pontual"

Quatro correções locais (H1–H4) só mudaram quais sementes falham. O defeito é de arquitetura: mover primeiro e consertar a posição depois, uma vez por update. A é a troca dessa arquitetura.

## 2. O alvo "nenhuma velocidade para cima > 0,05 m/s" é coerente?

**Não.** Três motivos:

1. **Os dois números do alvo se contradizem.** Uma peça a 0,05 m/s sobe 0,13 mm. Para subir 3,5 cm precisa de 0,83 m/s. O limite de velocidade é 16× mais apertado (270× em energia) que o de deslocamento.
2. **Contato real dá velocidade para cima.** Chapa presa em cunha entre o chão e uma placa de 142 kg, peça que sobe a rampa formada por outra, gangorra, peça parada atingida por outra que vem do blast. A baseline nunca fazia isso porque não transferia quantidade de movimento entre caixas — era um defeito, não uma virtude.
3. **A sonda conta quique de pouso e empurrão do blast como lançamento.** O valor 1,677 m/s aparece igual na baseline e em A; 2,7 m/s aparece nos três.

O que o dono quer dizer com "lançado" é: **a peça ganhou altura ou velocidade que ninguém pagou**. Isso se mede com energia.

### Critério de aceite proposto

Definição: **altura de energia** de uma peça = `y do centro de massa + (|v|² + ω·Iω/m) / (2g)`. Em voo livre ela é constante; contato com o chão só a reduz; contato entre peças a transfere.

- **C1 — Nenhuma energia criada (regra dura).** Em cada update sem golpe externo (`impulse`, blast, `hit`, chão subindo), a soma `Σ m·altura de energia` de cada grupo de peças em contato não aumenta além de `m_total · g · 1 mm`.
- **C2 — Peça em repouso não é lançada.** Peça que começou o update em repouso (|v| < 0,05 m/s, apoiada) e não foi atingida por contato fechando a mais de 1 m/s: ganho acumulado de altura de energia ≤ **3,5 cm** por episódio (de acordar a dormir). Isso unifica os dois números: 3,5 cm de subida **ou** 0,83 m/s **ou** qualquer combinação.
- **C3 — Correção de posição limitada.** Subida do centro de massa devida só ao passe de posição ≤ 3,5 cm por peça por episódio (a métrica `lift` de A, que já existe).
- **C4 — Assenta.** Bacia e sala: 100% das peças dormindo em até 3 s depois do último evento; nenhuma peça acordada no fim.
- **C5 — §12 intacto.** Todos os testes atuais de `game-destruction-three` e `game-destruction` passam, incluindo atrito estático/dinâmico, borda de mesa, apoio perdido e catálogo quebrado.
- **C6 — Robustez, não sorte.** Bacia em **64 sementes × dt 0,05 e 1/60**, e os mesmos casos com `SOLVER_PASSES` em 8/10/12 e as margens em ±20%: tudo passa. Uma constante que só passa no valor exato reprova.
- **C7 — Custo.** Bench de 160 + 40: mediana e p90 ≤ 1,25× a baseline; `perf.mjs` da rodada diária sem regressão; medido também numa máquina AMD.
- **C8 — Determinismo.** Mesma semente e dt: pose final de todas as peças idêntica, em dois processos separados.

Aplicado aos dados brutos que existem (C2 aproximado por `lift + up²/2g`): baseline falha 11/32 na bacia; A falha 1/32 (semente 10, dt 1/60, 3,66 cm). Na sala, A tem 1 peça em 1 de 6 rodadas acima (obj_41: lift 8,3 cm e 1,17 m/s).

## 3. Plano de produção (opção A)

Esforço: **3 a 4 semanas de uma pessoa** (o relatório A diz 2–3; considero otimista por causa da varredura, dos goldens e da validação na sala). Ponto de corte no fim da fase 2.

### Fase 0 — Critério e régua (2 dias) · `opus` para o texto do critério, `sonnet` para a régua
1. Dono aprova C1–C8 (ou ajusta os números).
2. Promover `tests/lift-measure.ts` a régua única com altura de energia, grupo de contato e "episódio". Um só script de sala, juntando as colunas de A e de B, mais a coluna "atingida por contato rápido".
3. Rodar a régua nova em baseline, A e B. Sem isso, não há linha de base honesta.

### Fase 1 — Base limpa (2 dias) · `sonnet`
4. Novo branch a partir do `origin/main` atual, trazendo `spike/piece-solver-rewrite` (a base 74774f11 não está no main; o main tem 13 commits que ela não tem).
5. Tirar o código morto do spike: `PAIR_WARM` e `BOTTOM_UP` (`spike-solver/.../src/pieces.ts:163,165,892,897-903,1026-1036`).
6. Testes unitários do `boxManifold`: face-face, aresta-aresta, margem, troca face/aresta (`EDGE_BIAS`), recorte. Hoje não há nenhum.

### Fase 2 — Fechar o critério (5–6 dias) · `sonnet`; item 9 é 🧠
7. **Repouso sem tremor.** Hipótese a testar primeiro: `goal = sep > 0 ? -sep/h : bounce` (`piece-solver.ts:169`) deixa um contato a 1 mm fechar a 0,12 m/s por subpasso, que é exatamente `STILL_SPEED`. Tratar `sep ≤ SLOP` como encostado (goal 0). Deve atacar as 2 peças acordadas e a porta que balança 2 s.
8. **Sono por grupo de contato**: o grupo dorme junto quando todo ele está calmo; acorda junto. Mantém `maxAwake`, `restPoints`, `wakeUnsupported`.
9. 🧠 **Pilhas pesadas: medir antes de construir.** Adicionar testes de pilha (5 peças; razão de massa 20:1). Só se falharem, fazer manifold persistente: o `feature` atual é o índice no polígono recortado (`piece-solver.ts:348`), que muda quando o recorte muda — não serve como identidade. Trocar por (face de referência, vértice ou aresta de recorte). Warm start descartado quando a normal vira, a face de referência troca ou o conjunto de pontos do par muda (a origem do "chute de cunha" de 0,2–0,4 m/s). Duas tentativas; se o chute persistir, ficar sem warm start entre peças e registrar.
10. **Trava de segurança que só tira energia** (ideia aproveitada de B, `rapier-pieces.ts:171-181`, mas restrita): só para peça em repouso sem golpe rápido, limita o ganho ao que falta para 3,5 cm. Cada acionamento conta e vai ao log da sala como `invariant: debris_launched` (mesmo padrão do `broken_floating`). Nos testes da bacia o contador tem que ser **zero**: a trava é rede, não solução.
11. Resolver os 4 testes fora da bacia: porta que não deita em 3 s, deriva de 2 mm no `separate-pair` (corrigir a causa; não afrouxar a tolerância sem motivo), `sheet-on-clutter` semente 40 (6,0 cm).

**Ponto de corte:** C1–C6 e C8 passam? Se não, parar e decidir entre (a) entregar A como está + trava do item 10, que já é muito melhor que a baseline, ou (b) reabrir a arquitetura. Não seguir ajustando constante.

### Fase 3 — Custo (3 dias) · `sonnet`
12. Laço sem alocação: `prepare` cria ~10 arrays por contato por subpasso (`piece-solver.ts:103-121,165`), `invInertia` devolve array novo a cada chamada (`:20`), `pieces.ts` cria `Map`/arrays e `{...contact}` por subpasso (`:872-905,1060`). Trocar por pool em `Float64Array` reaproveitado.
13. Resolver por grupo de contato, com saída antecipada quando a maior correção da passada fica abaixo de um limiar.
14. Medir C7, inclusive em AMD.

### Fase 4 — Goldens e sala (3–4 dias) · `haiku` para recalibrar, `sonnet` para validar
15. Recalibrar os goldens de destruição do floorplan (breach, spall, fracture) e o hash do blast-presentation, comparando com o `origin/main` atual. As 6 falhas do floorplan são as mesmas em A e na baseline (conferi as listas).
16. Sala: blast, martelo e deslizamento de terreno, 5 rodadas cada, com print. Atualizar o critério 5/10/17 de `docs/criterios-fisica-objetos.md`. Rodar `leak.mjs` (o pool novo não pode vazar) e a bateria `GPU_SCOPE=nightly` na mão antes do merge.
17. Entrar no `README` do pacote e na skill `game-destruction-three`: o que mudou para quem usa (peça de baixo sente o peso; peça dormindo acorda a 1 m/s; `onKnock` também entre caixas).

### Riscos

| Risco | Mitigação |
|---|---|
| Ajuste caótico: passa por sorte numa constante | C6 como gate (64 sementes × varredura); ponto de corte na fase 2 |
| Critério novo mascara lançamento real | C1 é regra dura de energia; trava do item 10 conta e reprova se acionar na bacia |
| Custo 1,7× e pausas de GC em máquina fraca | Fase 3 com meta 1,25× em mediana **e** p90; medir em AMD |
| Regressão do §12 (flutuar, colisor invisível) | Caminho de `partBoxes`/`shownBoxes` não muda; testes do §12 no gate C5; catálogo quebrado no CI |
| Goldens mudam e escondem regressão de outra origem | Recalibrar por último, num commit só, contra o main atual |
| `pieces.ts` com 1770 linhas vira o próximo ponto cego | Na fase 1, separar a geração de contatos (chão e pares) do arquivo; o solver já está isolado e sem three.js |

### O que fazer com os branches

- `spike/piece-solver-rewrite`: vira a base do branch de produção (fase 1). Não vai ao main como está.
- `spike/piece-solver-rapier`: arquivar, não apagar. Guardar o `REPORT-B` como registro de decisão em `docs/` ("por que não Rapier em 2026-11"). Reabrir só se o kit passar a precisar de juntas/ragdoll ou de mais de ~500 corpos ativos — aí como motor de um pacote novo, não por baixo do `PieceSystem`.
- Os dois worktrees saem depois que a fase 1 fechar.

## 4. O que não pude verificar

- **Sala:** não rodei as sondas (navegador/GPU). Usei os `.out` gravados. As rodadas da sala não são determinísticas (a casa é montada com `requestAnimationFrame` real antes da medição), então 3 rodadas é amostra pequena.
- **obj_41 a 1,17 m/s** (o pior caso de A): não sei se foi cunha ou pancada de outra peça vinda do blast. A régua da fase 0 responde.
- **Causa do sono pior e da porta que balança em A:** o item 7 é hipótese minha lida no código, não medida.
- **Sensibilidade às passadas com o critério novo:** só tenho os dados de 10 passadas.
- **Testes e bench de B:** não rodei de novo; números do relatório e de `room.out`. Benchmarks de A também não foram repetidos.
- **Rapier 0.21:** as afirmações "limiares de sono não expostos" e "hooks só com EventQueue" não foram conferidas na documentação.
- **Determinismo entre máquinas:** os dois testes comparam duas execuções no mesmo processo, uma semente só; o de A compara 3 números, não a pose. Rodei a bacia de A em processo novo: 32 linhas idênticas às do relatório (4 casas decimais). Entre CPUs/navegadores, nada medido.
- **H1–H4:** aceitei o diagnóstico do brief; não reli os patches nem os traços.
- **AMD / CPU fraca:** nenhuma medição existe em nenhum dos spikes.
