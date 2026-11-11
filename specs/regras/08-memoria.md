# 8. Memória: o que sai da cena é liberado — **OBRIGATÓRIO**

Texto completo da seção 8 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

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
