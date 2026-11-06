# AdA Technology Game Kit — regras do projeto

## 1. O SDK guarda tudo o que os times já fizeram — **OBRIGATÓRIO**

Este repositório é a base de **todo jogo futuro**, não só do ZombiAdA. Um jogo novo tem que começar com armas, casas, itens,
zumbis, personagens, veículos, vegetação, efeitos e animais **já prontos, com os comportamentos funcionando**.
Por isso o trabalho que os times entregaram vem para cá **uma vez**, e daí em diante tudo se monta a partir daqui.

**SDK primeiro em todo jogo** (dono, 2026-10-29): todo desenvolvimento de jogo do nosso lado (este repositório, o `zombiada` e qualquer
jogo novo) começa verificando se o SDK já tem aquilo. Tem: usa o pacote, importado. Não tem: cria primeiro no pacote certo do SDK e só depois
usa no jogo. Assim nunca se escreve o mesmo código duas vezes. O repositório de cada jogo repete esta regra no seu `CLAUDE.md`.

Antes de construir qualquer coisa (modelo 3D, animação, comportamento, efeito, tela ou ambiente de teste), nesta ordem:

1. **Procure no SDK** (`packages/*`, os README de cada pacote).
2. **Procure nas entregas dos times**: o site das equipes (`Andersonfrfilho/zombiada`, pastas `site/pages/<seção>/` e o portal
   `site/portal/portal-equipes.html`, que lista cada time com suas prévias e arquivos). Exemplos: Galeria 3D do Arsenal
   (armas com medida real, munição por calibre, tiro, recarga por tipo, pane, explosivos), Itens do Vale Cinzento, Bestiário e Elenco
   (zumbis, corpos, cortes, andar), Retratos e Os Vivos do Vale (sobreviventes), Bichos do Vale, Oficina de VFX e Laboratório de
   Explosões, Galeria do Vale Cinzento (tipologias de casa, prédios, mobília, postes, interiores), Bancada de Hordas.
3. **Só então crie**, e só o que de fato não existe.

- Achou na entrega de um time e não está no SDK: **porte a entrega** para o pacote certo, preservando medidas, animações,
  comportamentos e nomes de peças. **Proibido reescrever "parecido"** ou pôr substituto (caixas, placeholder) quando o time já
  entregou a versão real.
- Não achou nem no SDK nem nas entregas, ou a entrega está incompleta: **pergunte** antes de inventar.
- **Nada desenhado à mão quando o kit já tem** (dono, 2026-10-29): cenário de sala de teste, área de exemplo, prévia ou cena de jogo
  usa as peças do kit (móveis, paredes, itens, veículos, plantas) pelo catálogo, nunca caixas ou geometria montada na hora "parecida".
  Se a peça não existe no kit, ela entra primeiro num pacote do kit e só então é usada.
- **Cada peça vem do SDK dono, importada** (dono, 2026-10-29): carro e veículo sempre do SDK de veículos (`game-vehicles-three` com a
  frota), parede e casa do `game-floorplan`, móvel do catálogo de móveis, pessoa do `game-characters`, planta do `game-vegetation`, item do
  `game-items-goods`, arma e explosivo do `game-weapons`. Importe pelo pacote (ou receba o construtor por opção, como o `vehicles` do
  `createWeatherVisual`), nunca copie o modelo: a mudança no SDK tem que aparecer em todo lugar que usa a peça. Quem é dono de quê está em
  `tools/kit-audit/rules.json`; o MCP `game-kit` (`.mcp.json`) responde `kit_owner`, `kit_origin` e `kit_audit`, e a skill `kit-origem` diz como.
- **Parede sempre como as casas** (dono, 2026-10-29): toda parede ou muro (sala de teste, área, prévia, cena de jogo) tem o mesmo visual e o
  mesmo padrão de sustentação das paredes das casas. Use `wallPiece` do `game-floorplan-three` (a estrutura do `game-floorplan-structure`:
  parede sobre a fundação, pilares de concreto armado ao longo dela (nas pontas, nos encontros, ao lado dos vãos e a cada 4 m no máximo), cinta de concreto em cima, camadas, tijolos e furo; desenhada pelo renderizador das casas com reboco, pintura, rodapé
  e calçada) ou a casa inteira. Nada de parede de blocos soltos, cubos coloridos ou estrutura montada à parte.
- **Peça fora do dono fica documentada**: `node tools/kit-audit/audit.mjs --check` roda no CI e falha numa peça nova desenhada fora do SDK
  dono. `node tools/kit-audit/scene.mjs --check` (na rodada diária de GPU, não no CI: abre o navegador, ver seção 9) abre cada área da sala de teste e falha em tudo o que aparece na tela sem a marca
  de origem de um construtor do kit (`markKitOrigin` do `game-contracts`); todo construtor de peça novo marca a raiz que devolve. O que ainda está fora está em `docs/pecas-fora-do-sdk.md` (peça, onde, dono certo, PR de origem, correção) e em `pending` do
  `tools/kit-audit/allowlist.json`; ao corrigir, tire das duas listas.
- Ao terminar uma migração, atualize o inventário da spec de migração (`specs/`) marcando o que entrou e onde.

## 2. Motor genérico; conteúdo de cada jogo no repositório do jogo

- O núcleo de cada pacote não conhece o ZombiAdA (nada de Vale Cinzento, facções ou nomes de cidade no código do motor).
- Conteúdo **reaproveitável por qualquer jogo** fica no SDK em pacote de conteúdo, como `-fleet`, `-species`, `-household`,
  `-residential`. Isso inclui coisas do mundo real com o nome real: armas com marca e modelo, calibres, veículos (decisão de 2026-10-23).
- **Teste do GTA** (dono, 2026-10-23): estamos fazendo um jogo de zumbi, mas o kit tem que servir igual a um GTA. Prédios, veículos,
  armas, pessoas e cidade são genéricos; o que é só de apocalipse zumbi (horda, triagem militar, barricada, infecção) entra como pacote
  à parte, estado (ex.: `game-floorplan-post-apocalyptic`) ou conteúdo do jogo, nunca no núcleo.
- **Mundo normal primeiro** (dono, 2026-10-23): o jogo começa antes do surto. O padrão de cada pacote é o mundo funcionando; o
  apocalipse é uma camada gradual (ver `game-infection`), nunca o estado único.
- **Tudo configurável** (dono, 2026-10-23): o kit já vem com muito conteúdo próprio pronto (armas, prédios, zumbis, itens, sons), e
  por isso cada jogo tem que poder usar o padrão, trocar valores, acrescentar e tirar itens **sem mexer no núcleo**: catálogos por
  registro, regras e números por opção, comportamento por plugin. Valor fixo no código só quando for constante física.
- Conteúdo **só de um jogo** (histórias, personagens nomeados, Vale Cinzento, sangue e marcas da horda) fica **no repositório do
  jogo**, que consome os SDKs do game-kit.
- three.js fica num adaptador `<lib>-three`, como `destruction-three`, `fluids-three`, `interactables-three` e `weapons-three`.

## 3. Os SDKs se compõem; o jogo só junta

A ideia do kit (dono, 2026-10-23) é **um SDK usar os outros para formar os itens e os elementos do mapa e do jogo**, e o jogo usar tudo
isso pronto. Exemplos: a casa (`game-floorplan-*`) usa os materiais e a estrutura da destruição (concreto armado, tijolo), os móveis
interativos, o catálogo de itens para os achados e a vegetação para o quintal; a cidade (`game-urban`) usa as casas, os veículos e a
multidão; a arma usa a destruição, os efeitos e o som. Antes de reimplementar algo dentro de um pacote, use o pacote que já faz aquilo.

## 4. Testes: contrato genérico, módulo específico por lib

- `game-test-room` e `game-contracts` têm **só contratos genéricos** (`TestableModule`, `ModuleArea`, `ModuleHost`, eventos de
  ferramenta). Nada de arma, carro ou móvel neles.
- O que é específico de um domínio (balcão de armas, arma na mão, cápsulas, sons) fica no pacote da lib e num
  `examples/<lib>-test-area` que carrega o módulo na sala com `room.loadModule`.
- Cada área da página do kit abre o seu ambiente de teste já montado (`?area=`).

## 5. Animação e bug: validar em todas as câmeras — **OBRIGATÓRIO**

Decidido pelo dono em 2026-10-30, depois de uma correção dos braços com arma feita só na terceira pessoa: a primeira pessoa continuou com o
braço esticado, e na terceira a mira para cima enfiava os braços no corpo.

- Toda mudança em animação, pose, IK, arma na mão ou correção de bug visual é validada em **todas as câmeras** da sala
  (primeira e terceira pessoa, e qualquer outra que exista), **antes** de dizer que está pronta.
- Em cada câmera: parado e andando, mirando para cima, reto e para baixo, e pelo menos uma arma de cada família (pistola, espingarda,
  fuzil, lançador, corpo a corpo, arremesso). Medir na sala real (`examples/test-room`) os números que provam o comportamento
  (ângulo de cotovelo, distância da palma à pega, mão à frente do peito) e tirar um print por câmera como prova final.
- Proporção: o que o corpo segura aparece no **tamanho real** nas duas câmeras, na mesma escala das mãos e dos braços (dono, 2026-10-31:
  a arma da primeira pessoa reduzida ficava de brinquedo nas mãos reais). O teste `hand-targets.test.ts` do `game-weapons-three` falha se a mão
  e a arma se separarem de novo.
- O relatório da tarefa diz em quais câmeras foi validado. Câmera não validada é tarefa não terminada.

## 6. Física de cada objeto: os vinte e um critérios

Nenhum objeto (móvel, item, veículo, parede, estrutura, planta) é dado como pronto sem passar nos vinte e um critérios de
[`docs/criterios-fisica-objetos.md`](docs/criterios-fisica-objetos.md) (material e massa, tiro, golpes, explosão e fogo, destruição no padrão da latinha, pegar,
usar, entre outros objetos, personagem esbarrando, ser empurrado, persistência, animações com o item inteiro e quebrado, som, peso, queda, líquidos, reação em cadeia, desgaste visual, desempenho, NPCs e zumbis, inventário), testado na sala de testes com print.

## 7. Veículos: o que deu errado e as regras para não repetir — **OBRIGATÓRIO**

Decidido pelo dono em 2026-11-01, depois de carros que passavam nos testes e estavam errados na tela: tiro na janela lateral furava o "teto", tiro no para-brisa furava o
"capô", tiro no ar acima do capô acertava o carro, furo ficava parado no ar quando a porta abria, trinca nascia num canto do vidro e a borracha da janela ficava para trás.

- **O tiro acerta o que está desenhado.** A caixa da peça só diz onde procurar; quem responde é a superfície (`DestructibleImpl.surfaceRay`). Ponto, peça e normal vêm dela.
- **Toda marca pertence à peça que a recebeu** (furo, trinca, amassado, queimado): é filha da peça, e vai com ela quando a porta, o capô ou a tampa se movem. Proibido marca solta no `c.vehicle` de peça móvel.
- **Todo vidro desenhado é uma peça de vidro**, mesmo sem zona de dano própria: nada de vidro que responde como o aço da cabine.
- **O que o desenho já mostra junto sai junto**: ao abrir, a porta leva pele, forro, borda, vidro, borracha e maçaneta.
- **Camada nova não substitui a antiga sem provar o mesmo comportamento**: o PR lista o que a antiga fazia e o teste mostra que continua (foi assim que o furo da camada `destructible/` perdeu o que `zone-decals` já fazia).
- **Todo modelo passa pelo teste de aceitação** `packages/game-vehicles-fleet/tests/vehicle-acceptance.test.ts`, na frota inteira, não numa amostra: contar filhos ou eventos não prova comportamento, o teste mede posição no mundo.
- **Cada categoria tem a sua lista de peças** em [`docs/veiculos-pecas-por-categoria.md`](docs/veiculos-pecas-por-categoria.md) (carro, moto, caminhão, trator, barco, avião, militar): material, movimento, resposta ao dano e o que conferir de cada peça. Modelo novo confere a lista da sua categoria.
- **Modelo novo ou mudança em porta, vidro, furo ou colisão** atualiza [`docs/veiculos-verificacao.md`](docs/veiculos-verificacao.md) e traz print no jogo real com a porta aberta depois do tiro. Pendência fica escrita lá, nunca escondida.

## 8. Memória: o que sai da cena é liberado — **OBRIGATÓRIO**

Decidido pelo dono em 2026-11-02, depois da medição que achou vazamento em todo ciclo da sala (cada troca de área deixava ~24 mil buffers na GPU e
+10 MB no heap; explosões, vidro, carros e horda também acumulavam).

- three.js só libera GPU no `dispose()`. **Todo objeto tirado da cena para sempre** (item, destroço, peça solta, projétil, corpo, pedaço cortado,
  efeito, rótulo) passa por `discardObject3D(objeto)` ou `releaseObject3D(raízes, { keep: cena })` do `game-shapes-three`, que liberam geometrias,
  materiais, texturas (mapas e uniforms) e esqueletos e preservam o que a cena ainda desenha. Recurso compartilhado de propósito (paleta, catálogo)
  leva `markShared(...)` do `game-shapes-three` (ou `userData.shared = true` onde não houver golden). Nada de `removeFromParent()` sozinho para algo que não volta:
  a regra de lint `kit/no-bare-remove` (`tools/eslint/no-bare-remove.mjs`) falha quando a função que tira algo da cena não libera nada; o que volta
  depois (pool, avatar trocado, objeto de outro módulo) leva `eslint-disable-next-line kit/no-bare-remove -- motivo`.
- Textura de canvas (trinca de vidro, rótulo, placa) é liberada quando a peça troca de material ou some.
- **Listas e mapas esquecem o que saiu**: módulo de área, sistema de ferimentos, som, multidão. Se guarda uma entrada por objeto, apaga quando a raiz
  sai da cena (ex.: `wounds.untrack`). Listener e `setInterval` têm remoção no `dispose`/teardown.
- Testes que barram a volta: `packages/game-test-room/tests/memory.test.ts` (o `clear()` libera o que tirou e preserva o cenário) e
  `node examples/test-room/leak.mjs` na rodada diária de GPU (`tools/gpu/nightly-gpu.mjs`; não no CI, ver seção 9): repete explosões, vidro e carros, a troca de áreas, todas as outras áreas (armas, itens, animais, efeitos, terreno, som, plantas, cidade,
  clima, jogador, histórias e móveis) e a arma na mão, e falha se buffers, texturas,
  canvases, listeners, intervals ou o heap crescerem por ciclo além do orçamento. Pacote novo que cria e remove coisas na cena ganha teste de
  `dispose` próprio, e uma área nova entra numa fase do `leak.mjs`.
- **Aviso na tela**: a sala mostra geometrias, texturas e heap no painel da bancada e, quando a memória sobe a cada limpeza (quatro seguidas na mesma
  área, acima do orçamento), põe uma faixa vermelha sob a ferramenta e um evento `memory_leak` no registro. Faixa vermelha na sala é vazamento a corrigir.

## 9. Testes de GPU e navegador: só no pre-push, nunca no CI — **OBRIGATÓRIO**

Decidido pelo dono em 2026-11-03. Testes que dependem de GPU/renderização (orçamentos de quadro, `perf.mjs`, e os testes que abrem a sala de teste
no navegador) **não rodam na pipeline de CI**. Eles rodam no pre-push, na máquina local com GPU, comparando com a main medida na mesma máquina. O CI
fica só com build, typecheck, lint e testes que não precisam de GPU.

- No pre-push (`.githooks/pre-push`): `tools/gpu/browser-checks.mjs`, só com as suítes das áreas que a branch muda (`examples/*-test-area` com o seu
  `test.mjs`). `PRE_PUSH_BROWSER=0` pula uma vez, de propósito.
- **Rodada diária na main** (dono, 2026-11-06: com várias sessões na mesma trava de GPU, a bateria inteira em cada push deixava os pushes horas na fila).
  As suítes que abrem a sala inteira (`test-room`, `scene.mjs` e `cost.mjs` do `tools/kit-audit`, `examples/test-room/leak.mjs`) e o
  `tools/gpu/perf-gate.mjs` (`examples/test-room/perf.mjs`) saíram do push e rodam uma vez por dia, às 04:30, por `tools/gpu/nightly-gpu.mjs`: num worktree
  próprio da `origin/main` mais nova, espera a máquina ficar ociosa e no carregador, faz build e roda tudo sob a mesma trava (`GPU_SCOPE=nightly`), com o
  desempenho comparado com a última main aprovada nesta mesma máquina (`~/.cache/adatechnology-game-kit/nightly-state.json`). O relatório fica em
  `~/Documents/personal/adatechnology-game-kit-shots/nightly/AAAA-MM-DD/` (`summary.md`, um `.log` por etapa e `STATUS`), e a falha abre um aviso na
  área de trabalho. **Main com a rodada diária vermelha é a primeira coisa a corrigir no dia.** Ligar, desligar e rodar na mão:
  `sh tools/gpu/systemd/install-nightly.sh` (liga o timer do systemd do usuário), `... off` e `... now` (ou `node tools/gpu/nightly-gpu.mjs`), sempre a
  partir do checkout principal. Uma branch que precisa da bateria inteira antes do merge roda `GPU_SCOPE=nightly PRE_PUSH_BROWSER=all node
  tools/gpu/browser-checks.mjs` e `node tools/gpu/perf-gate.mjs` na mão.
- **Só no carregador** (dono, 2026-11-06: nenhum push fica bloqueado). `tools/gpu/power.mjs` lê `/sys/class/power_supply`: no carregador (Mains ou
  USB-C online, ou desktop sem bateria) os dois rodam; na bateria são pulados com aviso (`pre-push: ... skipped: on battery ...`) e o push segue.
  Bateria de dispositivo (mouse, fone) não conta; sem a pasta (fora do Linux) roda. `PRE_PUSH_ON_BATTERY=1` roda mesmo na bateria.
- **O pre-push roda só as suítes de navegador do que a branch muda** (dono, 2026-11-04: a bateria inteira levava 60-90 min e, com várias sessões na
  mesma trava de GPU, bloqueava a noite). `tools/gpu/select-suites.mjs` lê o diff contra a `origin/main` e imprime que suítes vão rodar e por quê:
  - cada `examples/<área>` roda quando muda a própria pasta ou um pacote que a página carrega (o `package.json` e os `@adatechnology/*` importados em
    `src/` e nos `.mjs`), direto ou pelas dependências desses pacotes; a sala (`test-room`), `scene.mjs`, `cost.mjs` e `leak.mjs` abrem a sala com
    todos os módulos (o build dela embute a entrada do `interactables-test-area`), então rodam para qualquer pacote de conteúdo; `tools/kit-audit`
    roda `scene` e `cost`;
  - **base, roda tudo:** `game-contracts`, `game-shapes`, `game-shapes-three` e `game-render-three` (pelo grafo: carregados por 3/4 ou mais das
    páginas de área; o teste unitário falha se outro pacote passar desse limite sem entrar em `BASE_PACKAGES`), `game-test-room` e
    `examples/test-room` (toda área é montada sobre a página da sala), `game-destruction` e `game-destruction-three` (a sala quebra os objetos de
    toda área por eles), `tools/gpu`, `.githooks`, `package.json` da raiz, `pnpm-lock.yaml`, `pnpm-workspace.yaml` e `tsconfig.base.json`. Caminho
    que o mapa não conhece também roda tudo;
  - **não roda nenhuma:** `.md`, `docs/`, `specs/`, `site/`, `.changeset/`, `.github/`, `test-support/`, `packages/*/tests/` e a configuração de lint.
  - `PRE_PUSH_BROWSER=all` (ou `PRE_PUSH_ALL=1`) força todas as áreas; as suítes da sala inteira só entram com `GPU_SCOPE=nightly`.
  - Área nova entra em `AREAS` do `select-suites.mjs`; pacote novo é achado sozinho pelo `package.json` e pelos imports das páginas.
- Teste novo que abre página, usa Playwright, WebGL ou mede quadro entra no `browser-checks.mjs` ou no `perf.mjs`, **nunca** num job do
  `.github/workflows/ci.yml`. Revisão que vê Playwright/Chromium no CI barra.
- Falha de teste de navegador no pre-push não se resolve tirando o teste: corrige a causa, como qualquer teste.

## 10. Tudo tipado — **OBRIGATÓRIO**

Decidido pelo dono em 2026-11-03: o kit é a base de vários jogos, e os contratos entre os pacotes (materiais, golpes, `TestableModule`) têm
que quebrar no editor e no build, nunca no jogo.

- Código novo ou alterado é **TypeScript** com `strict` (o `tsconfig.base.json`). Os pacotes já estão todos em `.ts`; sala de teste, `tools/` e
  `site/` que ainda estão em JS passam para `.ts` ao serem mexidos (ou, durante a migração, ganham tipos JSDoc checados por `checkJs`).
- **Sem `any`**, implícito ou explícito. O tipo que ainda não se conhece é `unknown` estreitado por verificação; three.js tem tipos
  (`@types/three`). Contrato público de pacote (o que o `index.ts` exporta) tem tipo explícito em parâmetros e retorno.
- Sem `@ts-nocheck`, `@ts-ignore` ou `strict: false` em `tsconfig`. `@ts-expect-error` só com o motivo na mesma linha.
- O que é anterior à regra está contado e só pode diminuir: os `any` por arquivo em `eslint-suppressions.json` (o `pnpm lint` falha num `any`
  novo), e `strict: false` e `@ts-nocheck` em `STRICT_OFF_KNOWN` e `TS_NOCHECK_KNOWN` do `tools/check-packages.mjs` (o `pnpm check:packages`
  falha num novo). Ao tirar `any` de um arquivo, rode `npx eslint . --prune-suppressions` para baixar a contagem; ao deixar um pacote strict ou
  tirar um `@ts-nocheck`, tire-o da lista. O checklist do que falta está em `docs/migracao-typescript.md`.
- Tipar não pode deixar o jogo mais lento: tipo não muda o código gerado, mas uma refatoração para tipar passa pelo mesmo gate de desempenho
  do pre-push, sem `--no-verify`.

## 11. Construção: estrutura real e testes de construção — **OBRIGATÓRIO**

Decidido pelo dono em 2026-11-04, depois de paredes que tinham só a cinta em cima e nenhum pilar saindo do piso: numa parede de verdade os pilares
vão do piso até a cinta.

- Toda construção do kit (parede, muro, casa, prédio, torre, peça estrutural) é **estrutura real**: alvenaria confinada (viga baldrame, pilares de
  concreto armado do piso até a cinta nas pontas, nos cantos, nos encontros, ao lado dos vãos e a cada 4 m, cinta em cima, verga e contraverga, tijolo
  amarrado e reboco nas duas faces), concreto armado pela NBR 6118 (seção mínima, armadura, viga com altura de L/10) e nenhuma peça sem caminho de
  carga até o chão.
- Toda construção nova ou alterada passa pelo agente **`engenheiro-estrutural`** (`.claude/agents/engenheiro-estrutural.md`) e pelos **testes de
  construção** antes do PR. Os testes usam o validador do SDK (`validateStructure` e `validateSpec` do `game-floorplan-structure`, códigos estáveis
  em `STRUCTURAL_VIOLATION`) e rodam no CI, sem GPU: `tests/construction.test.ts` de cada pacote de tipologia e o `validate-structure.test.ts` do
  `game-floorplan-structure`.
- **Peça ou tipologia nova entra na lista do teste de construção** do seu pacote (template, preset, torre, parede da sala) no mesmo PR.
- Falha do validador se corrige **na causa** (no construtor da estrutura), nunca tirando o teste, afrouxando o código ou desligando a regra.
  Opção que desliga uma regra (`wallPillars: false`, `groundBeams: false`, `visorSections: true`) existe só para reproduzir o Visor de casas 3D no golden do time.
