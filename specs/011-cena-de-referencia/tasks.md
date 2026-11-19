# Tasks — Spec 011, cena de referência

Leia `spec.md`, `plan.md`, `cartas.md` e as regras §1, §2, §5, §11, §13, §14 e §15 antes de começar. Uma task por vez, na ordem; worktree
próprio. Antes de criar qualquer peça, `kit_owner` e `kit_origin` (MCP `game-kit`) dizem o pacote dono.

Cada task responde **Mecânica?** e **Aceite por comando?**; duas vezes "sim" → `haiku`. 🧠 = decisão herdada por outras tasks.

## Gates de toda task

1. Typecheck e testes sem GPU dos pacotes tocados; goldens sem diff; lint; `pnpm check:layers`; `node tools/kit-audit/audit.mjs --check`.
2. Peça nova: os testes do pacote dono (21 critérios §6, `coincidentFacesOf` §13, catálogo de objetos quebrados §12, `leak.mjs` §8) e print na
   sala da área dela. Estrutura (ponte, prédio, laje): agente `engenheiro-estrutural` (§11). Geometria nova: agente `revisor-z-fighting`.
3. Tempo de quadro: régua da spec 010 antes e depois (§15). Pose, arma ou câmera: 3ª e 1ª pessoa (§5).
4. Commit isolado por task e uma linha no `evidence.md`. `room.ts` não cresce.

## Fase 1 — Host do mundo no SDK
> 🤖 Modelo: `sonnet` (T1.1 é 🧠 — `opus`, validar com `architect`)

- **T1.1 🧠** Desenho do `createKitWorld` em `design-host.md`: a lista das ligações que a sala faz à mão (`room.ts` 321, 372–375, 384, 429,
  464–467, 492–514, 612, 631–639, 925, 4068–4072, 4511, 4788–4827, 5562–5583), o que vira opção, o que o jogo pluga, um arquivo por ligação,
  e onde mora a oclusão de áudio. Inclui como ele registra as filas da spec 010.
- **T1.2** Oclusão de áudio do mundo (`game-test-room/src/world-occlusion.ts`) vai para o pacote decidido na T1.1; a sala importa de lá.
- **T1.3** `createKitWorld` no `game-kit-defaults`, conforme a T1.1, com teste sem GPU (mundo montado com THREE de teste, um passo, `dispose`
  sem sobra pelo `leak.mjs`).
- **T1.4** Regra de camada `scene-not-testing` no `.dependency-cruiser.cjs`: `examples/reference-district` não importa `game-test-room`,
  `test-area` nem `bench`.
- **T1.5** A sala monta o mundo pelo `createKitWorld`. Só tira código do `room.ts`; testes e checagens da sala iguais (`pnpm check:room`).

## Fase 2 — Esqueleto da cena só com o que já existe
> 🤖 Modelo: `sonnet` (T2.1 é 🧠 — `opus`; T2.5 → `haiku`)

- **T2.1 🧠** Formato do JSON do recorte (D2) e o recorte 1 desenhado nele: ruas, lotes com tipologia e semente, rio, ponte, zonas de horda,
  pontos de explosão do cenário `pior`. Onde falta peça (tabela do `plan.md`), um marcador `missing` com o dono, desenhado como caixa de aviso.
- **T2.2** `examples/reference-district`: página, `build.mjs`, montador que lê o JSON e chama `createKitWorld` e os pacotes; câmera de 3ª e
  1ª pessoa (`?camera=`); cenários `tipico` e `pior` (`?cena=`). Área `district` no `tools/check-area`.
- **T2.3** Teste de cobertura sem GPU no CI (R2): lista de pacotes instanciados contra `packages/`, menos as duas exceções; os `missing`
  aparecem como pendência com o dono, e o teste falha quando a lista fica com pacote sem uso.
- **T2.4** Cenário `pior` roteirizado e determinístico (semente, horários das explosões, caminho do jogador), para medir sempre igual.
- **T2.5** `PERF_PAGE` no `perf.mjs` e no `room-explosion.mjs` para apontar a medição para a página da cena. Mecânica.
- **T2.6** Primeira régua da cena (R5) nos dois cenários, a 1x e a 4x, com a trava; prints em 3ª e 1ª pessoa (R4). Entrega à spec 010.

## Fase 3 — Peças que faltam, cada uma no pacote dono
> 🤖 Modelo: `sonnet` (T3.1 e T3.3 são 🧠 — `opus`, validar com `engenheiro-estrutural`; T3.9 e T3.10 → `haiku` se o padrão do catálogo bastar)

Ordem: o que é jogável primeiro, o que é cenário depois. Cada peça troca o seu `missing` no JSON e entra na sala da área dela com print.

- **T3.1 🧠** Prédio de 4 a 8 andares com planta e loja no térreo (`game-floorplan-residential`), enterável e destrutível, com estrutura NBR 6118.
- **T3.2** Sobrado de uso misto (loja + moradia), usando as zonas `mixed` que já existem.
- **T3.3 🧠** Ponte de concreto destrutível sobre o rio: estrutura e caminho de carga (`game-floorplan-structure`), traçado (`game-urban`).
- **T3.4** Rio com correnteza no `game-terrain`: zona de água corrente com direção e velocidade, arrasto e empuxo nos corpos.
- **T3.5** Viela entre casas no traçado do `game-urban`.
- **T3.6** Bar/boteco (`game-floorplan-commercial`), com móveis do catálogo.
- **T3.7** Vergalhão exposto na laje pronta (`game-floorplan-three`, a partir de `slab.exposedRebar`).
- **T3.8** Galinheiro de quintal (catálogo residencial e builder 3D).
- **T3.9** Cone, cavalete, fita zebrada (`game-props3d`); semáforo, faixa de pedestre e meio-fio (`game-urban`).
- **T3.10** Contexto `riverbank` na região `br` (`game-vegetation-species`); peixe e garça (`game-animals-species`).
- **T3.11** História do `game-stories` num bilhete posto numa casa (`game-items-goods`, achados do floorplan).
- **T3.12** Régua da cena de novo (gate 3) com as peças novas.

## Fase 4 — Visual nublado
> 🤖 Modelo: `sonnet` (T4.1 é 🧠 — `opus`)

- **T4.1 🧠** Desenho do preset `overcast` e da corrente de pós em `design-visual.md`: luz de céu, sol suave, céu com nuvens, tone mapping,
  gradação de cor, oclusão de ambiente em meia resolução; custo esperado por faixa; degraus do `tuner` (pós desligado antes de baixar
  resolução na integrada). Sem mudar o visual de quem não pede o preset (goldens).
- **T4.2** Preset `overcast` no `game-render-three` (luz, céu, tone mapping, gradação), sem pós. A cena liga por `?look=overcast`.
- **T4.3** Pós-processamento no `game-render-three` com degraus no `game-graphics`; o aquecimento compila os programas do pós (0 programas no
  meio do jogo).
- **T4.4** Print `shots/visual-alvo.png` no enquadramento da referência e veredito visual registrado (R6). Régua com e sem pós (gate 3).

## Fase 5 — Fechamento
> 🤖 Modelo: `sonnet` (revisão final → `code-reviewer` `sonnet`)

- **T5.1** Régua final nos dois cenários, RTX e Intel integrada, com o tuner ligado (R7). AMD: pedir a alguém com Radeon uma rodada de
  `pnpm check:district` e anexar o JSON.
- **T5.2** README do `game-kit-defaults` (como um jogo monta um mundo), referência na skill `game-kit`, e a §15 conferida.
- **T5.3** Transformar a carta da cena 2 em spec completa com o que esta cena ensinou (em sessão própria).

## Prompt de execução

```text
/oh-my-claudecode:autopilot Execute a spec specs/011-cena-de-referencia/ (leia spec.md, plan.md, tasks.md, cartas.md e as regras
§1, §2, §5, §11, §13, §14 e §15 antes). Ordem com a spec 010 conforme plan.md: a Fase 1 e a 2 daqui começam depois da T0.2 da 010.
Uma task por vez, na ordem do tasks.md, num worktree próprio; kit_owner antes de criar qualquer peça.
Modelos: Fase 1 → executor model=sonnet · T1.1 🧠 → opus (validar com architect) · Fase 2 → executor model=sonnet · T2.1 🧠 → opus ·
T2.5 → executor model=haiku · Fase 3 → executor model=sonnet · T3.1 e T3.3 🧠 → opus (validar com engenheiro-estrutural) ·
T3.9 e T3.10 → executor model=haiku · Fase 4 → executor model=sonnet · T4.1 🧠 → opus · revisão final → code-reviewer model=sonnet.
Escalada: gate falhou 2x → sobe um nível (haiku→sonnet→opus) e registra em evidence.md.
Cada task fecha com typecheck + testes + check:layers + kit-audit + commit isolado, evidência em evidence.md.
Medição só com flock ~/.cache/adatechnology-game-kit/perf-measure.lock e carga abaixo de 4; nunca no CI.
Pare e pergunte antes de: regravar golden, mudar padrão síncrono, a Fase 3 passar de 3 semanas, push e abertura de PR.
```
