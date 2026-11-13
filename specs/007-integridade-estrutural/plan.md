# Plano — Spec 007

## Onde cada coisa mora (`packages/game-floorplan-structure/src/`)

```text
validate/integrity.ts     checagens novas (pilares, lajes, balanço) — vem do WIP, novo arquivo
validate/codes.ts         códigos estáveis novos (STRUCTURAL_VIOLATION)
validate/index.ts         registra integrity.ts
validate/load-path.ts     SUPPORT_WITHOUT_CONTACT com folga de 5 cm; contatos em ponte contam
validate/members.ts       SLAB_UNDERSIZED sem a isenção larga; SLAB_ON_SINGLE_PILLAR
pillar-design.ts          dimensiona o pilar só em volume livre; classe de concreto lida da peça
structure/openings.ts     vergas (regressão a_frame_chalet)
structure/roof.ts         caibros e beirais (regressões high_end, single_storey)
structure/tank-parts.ts   caixa d'água
slab-panels/apply.ts      reaproveita a coluna existente (modelo de painéis)
balconies.ts              sacadas: vigas, balanço, sem sobreposição, igual em planta e painéis
tests/                    um teste por código novo + construction.test.ts por tipologia
```

## Ordem e dependências

1. Testes do validador primeiro (vermelho no que o WIP ainda não cobre), depois o validador do WIP passa a ser a rede de segurança.
2. Fechar as 3 regressões (beirais com apoio próprio) antes de mexer em pilar: senão o número da varredura não diz nada.
3. `pillar-design.ts` e `slab-panels/apply.ts` (pilares/torres) — maior bloco da varredura (2144 + 193 + 126 + 48).
4. Sacadas (`balconies.ts`): decisão de projeto, depende de 3 (reaproveita colunas).
5. Varredura completa em zero, revisão do engenheiro, print.

## Decisões a tomar (🧠)

- **Classe do concreto na peça** (C30 a C40): campo novo no contrato da peça estrutural lido por `pillarDesign`; muda tipo público.
- **Sacada**: viga com 2 apoios vs balanço curto e espesso; vale igual no modelo de planta e no de painéis.
Regra: pilar não cresce para fora; se não cabe, sobe a classe do concreto, e só depois entra pilar extra.

## Riscos

- Subir classe de concreto muda golden das tipologias: regenerar goldens só depois de o engenheiro aprovar a geometria.
- A varredura demora (todos os modelos × 8 sementes): rodar em segundo plano, com prazo.
- Rebase na `main`: a `release/casa-a-pa-2026-11-13` mexe no mesmo pacote; rebasear antes da T6.
