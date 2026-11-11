# 11. Construção: estrutura real e testes de construção — **OBRIGATÓRIO**

Texto completo da seção 11 do `CLAUDE.md` da raiz (lá fica só o resumo). Regra em vigor: mudar aqui é mudar a regra.

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
