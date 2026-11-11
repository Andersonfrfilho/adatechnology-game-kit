# 10. Tudo tipado — **OBRIGATÓRIO**

Texto completo da seção 10 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

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
