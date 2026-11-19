# Desenho — a explosão em tiques (T1.1)

> Estado: **validado com mudanças** por `architect` e `engenheiro-estrutural` em 2026-11-19 (correções já incorporadas; lista na seção 8).
> **Aguarda a decisão D5 do dono** (seção 6). As etapas A e B não dependem dela.

**Unidade deste documento:** *tique* é o tique do agendador, 1/60 s, que roda 2 passos de física de 1/120 s (§15, R2). A janela da D1
("6 tiques de 1/120 s, 50 ms") são **3 tiques do agendador = 6 passos de física**.

## 1. O que foi medido

Régua curta com sondas temporárias (sem commit) em `world.emit`, no ouvinte da casa e no `cut`/`paint` do furo: `blast,crater`, 1x, 3 rodadas de
estágios, `jolt-d4-worker`, commit `c2953d167`. JSON: `medicoes/perfil-f0-sondas-c2953d167.json`.
**Carga de 2,3 a 3,7 (acima do 1,5 da spec): vale pelas proporções, não como número de fechamento.** O f0 inteiro saiu em ~100 ms nesta rodada
(84 ms na rodada quieta do cache, `evidence.md`).

| Parte do f0 (média blast/crater, ms) | ms | Muda a simulação? |
|---|---|---|
| `explode`, só o mundo (sem os ouvintes) | 22,4 | sim |
| ouvintes dentro do `emit` (casa 2,7 + `cut` 1,5 + resto 1,0; `paint` do `drop` 0,0) | 5,1 | não (desenho) |
| `destruction.events`: `splitLoose` 2,4 + `adoptSplit` 1,6 + `rebuildHost` 3,0 | 7,0 | sim |
| `destruction.events`: o resto (~14,7), **não repartido por tipo de evento** | ~14,7 | parte sim, parte não (seção 3) |
| `floorplan.breach-cut` (pintura das paredes cortadas) | 11,0 | não |
| `floorplan.breach-paint` (lascado do reboco; não é `mustDrain` e mesmo assim gasta no f0) | 5,4 | não |
| `audio.voices` | 3,3 | não |
| `action` (`explosives.blastAt` fora do `explode`) | 8,8 | não medido por dentro |
| `stagesOut` | 6,9 | não medido por dentro |
| resto do update | ~14 | misto |
| `renderCpu` | 11,3 | não |

Três leituras:

1. **O `explode` no navegador é o mundo, não o furo.** O perfil do Node da parte 1 (furo com 88 de 139 ms) media a pintura rodando dentro da
   explosão, porque o teste não tem fila de quadro. Na sala a pintura já sai para as filas; os ouvintes síncronos custam ~5 ms.
2. **~20 ms do f0 são apresentação com certeza** (`breach-cut`, `breach-paint`, áudio). Dos ~14,7 ms restantes de `destruction.events`, só uma
   parte é apresentação pura; quanto, a T2.0 mede por tipo de evento.
3. **Mesmo com toda a apresentação fora do f0, sobra mais de 50 ms.** A C1 (33,3 ms) só fecha mexendo no trabalho que muda a simulação:
   `explode` (~22), a parte estrutural dos eventos, `action` (~9) e `stagesOut` (~7).

## 2. Por que a D3 (dividir o `explode`) não cabe com a D2

Dividir o `world.explode` em passos por tique, com a simulação andando entre eles, muda o estado final; a D2 só deixa regravar com estado
final idêntico.

- O mundo tem um gerador só (`rng`, `world.ts:650`), consumido pela explosão (`addCrack`, velocidades de `failPart`, atrasos de `prime`,
  `rollIgnition`) e pelo `world.update` de cada tique (`room.ts:4167`). Dividir intercala as duas sequências.
- Entre um tique e outro a física anda 2 passos: peça solta no 3º tique cai ~33 ms depois da que saiu no primeiro.
- `reachAt` compara cada peça com o retrato do início da explosão (`FLAG_LOST`/`FLAG_OPEN`, `world.ts:4833`) e lê o estado vivo da peça
  (`world.ts:4847-4864`); os eventos de um golpe são um trecho contínuo de `cur` (`cur.slice(start)`).

Existe um desenho que divide e **mantém os mesmos bytes**, ao custo de outra coisa: **congelar a simulação**. O `blastScene` vira retomável
sobre o laço de `items`; enquanto ele não termina, o agendador pula o `fixedSimulate` (sem `world.update`, sem física, entrada na fila) e
continua desenhando. Os hashes por tique ficam idênticos, só mais tarde no relógio. Custo: o movimento para 2 a 3 quadros e o empurrão
(`explosives.ts:436` precisa do resultado) sai do f0, o que bate na C5. Entra como opção da D5.

Para carga com estopim (`primed`), há ainda pré-calcular a geometria pura (candidatas, distâncias, `rayPart`) nos tiques antes da detonação,
com chave em `poseVersion`. Não cobre o golpe sem aviso; fica anotado.

## 3. Etapa A — apresentação fora do quadro do golpe (não muda estado, sem regravar golden)

**Mecanismo (segue a §15, sem cota por tique):** cada fila `mustDrain` passa a receber **só o ponto de impacto**; o resto vai para uma fila
comum de prazo (a cota é o que sobra do quadro), com **uma unidade pequena** e espera máxima igual à janela (forçada no 3º tique, como
`minEveryFrames`). Nenhuma fila `mustDrain` nova; o significado de `mustDrain` não muda (drena inteira o que recebeu).

| Fila | Hoje | Passa a ser |
|---|---|---|
| `floorplan.breach-cut` | 1 unidade = todas as paredes de todas as casas (`breach.ts:167-186`), `mustDrain` | `mustDrain` recebe as paredes do ponto de impacto (as que ganharam `opening` no golpe) **e toda parede com `fallen` novo** (parede caída não pode seguir desenhada inteira: `paint` é quem abre os furos de `fallen`, `breach.ts:556`). As outras paredes cortadas vão para a fila de prazo, 1 unidade = 1 parede, mais perto do golpe primeiro, depois por id |
| `floorplan.breach-paint` | 1 unidade = tudo; roda no f0 pela regra "ao menos uma unidade" | 1 unidade = 1 parede |
| `destruction.events` | `mustDrain` drena todos os ~900 eventos | **Estrutural** fica no quadro do golpe, na ordem de hoje. **Visual** vai para a fila de prazo, na ordem de emissão |

Classes de evento (conferidas no `applyEvent`, `renderer.ts:1610` em diante):

- **Estrutural (fica no f0):** `detach`, `collapse`, `fracture`, `expose`, `settle`, `subside`, `burnout`, `destroyed` (marcam `broken`,
  `renderer.ts:1613`); `explode` (empurrão, `loosen`, `makePiece` e o registro que entra no hash, `room.ts:530-536`); `chip` e `stage`
  (soltam fragmentos, os grandes com corpo em que o jogador bate, `fragments.ts:463`); `dent` e `bend` (mudam a malha de onde sai a colisão
  estática, `measureSolids`, `renderer.ts:1473`; tratado como estrutural sem ter sido testado).
- **Visual que pode ser adiado já:** `hole`, `crack`, `debris`, `ricochet`, sons e partículas sem sorteio.
- **Visual que só pode ser adiado depois de ganhar gerador próprio:** `spall`, `drip`, `leak`. Hoje sorteiam no gerador do renderer
  (`trickleFrom` em `renderer.ts:2051`, `drip` em `1753`), o mesmo que escolhe onde as peças levam o impulso (`3053`, `3173`), e as peças
  entram no hash. Dar a eles um gerador semeado por evento (como o `dropCage`, `renderer.ts:2235`) muda a sequência do gerador do renderer e
  portanto os goldens: **é mudança de estado, vai para a D5.**
- **Ordem:** evento visual de uma peça que tem evento estrutural no mesmo golpe aplica antes dele, no f0 (depois do `adoptSplit` o `partVis`
  devolve nulo e a marca se perde, `renderer.ts:1825`; o `clearDecals` do `chip`, `2136`, depende da ordem com `hole`). Caso da T1.2.
- `fluids.stains()` (entra no hash) não é alcançado por nenhum evento do renderer.

A pintura adiada dá a mesma máscara que a pintura no f0: as listas de dano da parede, com o teto de 64 lascados, são atualizadas na hora no
ouvinte (`breach.ts:793-805`), e `paint()` refaz tudo a partir delas.

**Golpe no meio da janela:** tiro ou golpe novo numa parede com pintura pendente põe essa parede no `mustDrain` do golpe novo.

**O `paint` do `drop()` não entra:** mediu 0,0 ms.

**Erro de hoje que entra na T1.2:** sem `workBudget`, `splitLoose` separa um grupo quando o relógio passou do prazo (`renderer.ts:2306`).
É uma decisão pelo relógio que muda a simulação (contra a §15 e os mesmos bytes). Corrigir: o caminho do prazo separa todos.

Ganho esperado no f0: ~16 a 20 ms certos (as duas filas da casa menos as paredes do impacto, e o áudio), mais a parte de `hole`/`crack`/`debris`
que a T2.0 medir. De ~84 para ~60–65 ms. **Não fecha a C1.**

## 4. Etapa B — baratear o `explode` sem mudar o resultado

Mesma saída, goldens sem diff. Candidatos, a confirmar na T2.0 com perfil do navegador por dentro do `blastScene` antes de escrever código:

1. **`reachAt` é quadrático** (`world.ts:4838-4871`): para cada alvo, testa o raio contra todas as peças de todos os objetos no alcance.
   A grade de peças do #390 (`part-grid.ts:120`) devolve os índices em ordem crescente, então `t *= ti`, as listas de `shields` e a ordem de
   inserção ficam iguais bit a bit. Condições: consultar o trecho [0, L]; manter a varredura simples para NaN; `minPath = 0` pode perder um
   raspão de comprimento zero por arredondamento (teste dedicado).
2. `emit` copia a lista de ouvintes a cada evento (`world.ts:675-677`). Trocar por cópia só quando o conjunto de ouvintes mudou (um ouvinte
   pode se inscrever durante o `emit`; a semântica de hoje fica).
3. `lightLeaksNear` (`world.ts:4376`) varre todas as peças de todos os objetos, dentro ou fora do alcance.
4. `action` (~9 ms) e `stagesOut` (~7 ms): não medidos por dentro.

Ganho esperado: desconhecido até a T2.0.

## 5. Etapa C — dividir o que muda a simulação (só com a D5)

**Já existe no código:** `splitWithin`/`splitQueue`/`queueLoose`/`runSplits` (`renderer.ts:2300-2535`) adiam a separação dos grupos soltos por
unidades do `WorkBudget`, sem teto de tiques. A 010 mediu `workBudget=4`: o f0 piorou (99 / 103 ms contra 91,5 / 89,2), porque todo evento
ainda é aplicado no quadro dele. Com a etapa A feita, vale medir de novo. Não se cria segunda fila; a etapa C é pôr o teto da janela nessa.

Regras que a revisão estrutural exige:

- **Ordem de saída: o que é carregado sai no mesmo tique do que o carrega, ou antes** (de cima para baixo); distância ao centro só desempata.
  Sair "mais perto primeiro" deixa o de cima parado no ar com o apoio já caindo (§12).
- Ao esvaziar a fila de um objeto, remarcar `broken`: o `checkBroken` (`renderer.ts:2730`) roda antes de os grupos pendentes saírem.
- O caminho de carga não é afetado: carga, colapso e queda fecham dentro do `run()` (`world.ts:729-738`); peça colapsada não é contada de
  novo (`stress = 0`, fora de vento e solo). §11 e o validador não mudam.

O que lê um grupo pendente no intervalo (a cobrir com teste): `measureSolids` (colide como parte fixa), raios (só objeto separado é pulado,
`renderer.ts:2779`), explosão em cadeia (entra em `inRange` e no abrigo), `hingeOf`, e `loosenIfFootless`/`onBrokenChecked` (pode registrar
`broken_floating`, `room.ts:544`).

**Não há como manter o `world.serialize()` igual:** `world.splitGroups` dá ids por contador (`world.ts:753`, `5768`); adiar a separação
desloca os ids, e o `world.update` roda entre os tiques com outro conjunto de objetos.

## 6. Decisão pedida ao dono (D5)

A D2 diz: regravar só com estado final idêntico. Depois de A + B, o que sobra para fechar a C1 muda estado. Escolher:

- **(a) Manter a D2.** Fazem-se A e B; a spec fecha com o f0 que A + B alcançarem e registra a diferença para a C1.
- **(b) Estado final novo, determinístico.** Libera: gerador próprio de `spall`/`drip`/`leak` (seção 3) e a etapa C. Goldens regravados com a
  comparação por **conjunto de peças por grupo** (não por id nem por pose) no `evidence.md`.
- **(c) Congelar a simulação** enquanto o `explode` roda em fatias (seção 2): mesmos bytes, mas o movimento para 2 a 3 quadros e o empurrão
  sai do f0 (mexe na C5).
- **(d) Worker** (§14): fora do escopo (§4), spec própria.

Recomendação: **(a) agora; decidir entre (b) e (c) com a régua de A + B na mão.** Sem esse número não dá para saber quanto falta.

## 7. O que muda nas tasks

- **T1.2:** mesmos bytes da janela, mais: caso a 30 Hz (2 tiques antes de um dreno); "pintura adiada = mesma máscara"; ordem visual antes do
  estrutural na mesma peça; correção do `splitLoose` pelo relógio (`renderer.ts:2306`).
- **T2.0 (nova, `sonnet`):** perfil no navegador do `blastScene`, de `action`, de `stagesOut` e de `destruction.events` por tipo de evento.
- **T2.1 = etapa B** (`reachAt` com a grade, `emit`, `lightLeaksNear`), goldens sem diff.
- **T2.2 =** classes de `destruction.events` (estrutural no f0, visual na fila de prazo). **T2.3 =** golpe no meio da janela.
- **T3.1 =** `breach-cut` e `breach-paint` por parede.
- **T3.2 = etapa C e gerador próprio dos visuais**, bloqueada pela D5.

## 8. Revisões (2026-11-19)

- **`architect`: aprova com mudanças.** Corrigido: classes de evento (`chip`, `stage`, `explode`, `dent`, `bend` são estruturais; `spall`,
  `drip`, `leak` dependem do gerador); `splitLoose` pelo relógio; etapa C sobre o `splitWithin` que já existe; unidade de tique; fila de prazo
  no lugar da cota por tique; opção de congelar a simulação; `emit` com cópia só na mudança.
- **`engenheiro-estrutural`: aprova com mudanças.** Corrigido: parede com `fallen` novo pinta no quadro do golpe; ordem de saída da etapa C de
  cima para baixo; `burnout` e `destroyed` estruturais; `broken` remarcado; comparação da D5(b) por conjunto de peças. Caminho de carga, §11 e
  validador: sem impacto.
