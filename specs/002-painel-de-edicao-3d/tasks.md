# Tasks — Spec 002 (futura)

Só começa depois da Fase 8 da Spec 001. Mesmos gates da Spec 001: `pnpm build`, `pnpm -r typecheck`, testes do pacote, `pnpm lint`, skill do
pacote em `.claude/skills/<pacote>/SKILL.md`, commit isolado por task, evidência em `evidence.md` (desta pasta), PR por fase com o ok do
dono antes do merge.

## Fase 9 — Painel de edição 3D
> 🤖 Modelo: `sonnet` (T9.1 é 🧠 → `opus`)

- T9.1 🧠 Contrato `EditorAdapter` e `EditorField` em `game-contracts/src/editor.ts`, com `checkEditorAdapter`. Validar o desenho com o
  architect contra duas libs diferentes (armas e veículos) antes de implementar.
- T9.2 `game-editor`: documento, histórico, diferença (no formato `patches` por id), validação, importar e exportar, rascunhos.
- T9.3 `game-editor-three`: prévia com órbita, grade, régua, silhueta de 1,75 m, clique na peça, comparar com o original, refazer só o
  material quando `rebuild: 'material'`.
- T9.4 Painel DOM: lista de entradas, formulário gerado pelo esquema, aba JSON com edição e erros na linha, copiar, baixar, importar;
  `en` e `pt-BR`.
- T9.5 `examples/editor-test-area`, `?area=editor` na página do kit e botão **Editar** nas áreas da sala de testes.

## Fase 10 — Adaptadores por lib
> 🤖 Modelo: `sonnet`

Na ordem da migração, um commit por lib, cada um com o golden "sem edição monta igual":

- T10.1 Armas (`game-weapons-three`), com acessórios e encaixes.
- T10.2 Casas e prédios (`game-floorplan-three`).
- T10.3 Itens (`game-items-three`).
- T10.4 Personagens, zumbis e animais.
- T10.5 Efeitos (`game-vfx-three`).
- T10.6 Veículos, vegetação, móveis (`game-interactables-household`) e `game-props3d`.
- T10.7 Cópia offline do editor no repositório do jogo (`docs/offline/`), listada no índice e no Portal das Equipes.
