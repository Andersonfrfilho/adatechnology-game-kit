# Spec 009 — Coordenador de workers do SDK

Pedido do dono (2026-11-18): o worker do chão da cratera funcionou (pior quadro da cratera de 8–13 ms para 3,9–5,8 ms, 100% dos ladrilhos a
tempo); o SDK precisa de um coordenador de workers configurável ou automático, que decida quantos workers usar e qual categoria de trabalho
vai para qual worker, para qualquer pessoa que use o kit nos próprios projetos, inspirado nas arquiteturas de motores de alta performance com
mundo vivo e detalhado. Em 2026-11-18 o dono pediu que **tudo o que o desenho deixava para o futuro entre agora** nesta spec.

Desenho completo, com as inspirações (Naughty Dog, Unity, Unreal, Frostbite, Bevy): https://claude.ai/artifact/37JV3UkwhMtqz1mAHWeCEf.
Regra: `CLAUDE.md` §14 e `specs/regras/14-workers.md`. Guia da API: `packages/game-workers/README.md`.

## Objetivo

Todo trabalho pesado do kit e dos jogos sai do quadro principal pelo mesmo coordenador, sem mudar o resultado da física, em navegador e Node.

## Requisitos

- R1. Quantidade de workers automática (`hardwareConcurrency − 1 − reservados`, teto 8) ou por configuração (número, por faixa, por categoria).
- R2. Faixas `sim` (resultado num quadro fixo), `build` (carga) e `background` (mundo vivo); `build` empresta para `sim`, `background` nunca toma `sim`.
- R3. Prioridade e prazo em quadros por tarefa; fila no quadro principal; no máximo 2 tarefas por worker.
- R4. Fallback no quadro principal com o mesmo kernel; mesmos bytes com 0, 1 ou 8 workers; o quadro principal nunca espera.
- R5. Navegador (worker de módulo), página de arquivo único (Blob URL), Node (`worker_threads`), Electron, e sem suporte.
- R6. Usuário registra as próprias categorias e o próprio arquivo de worker; o kit publica as suas com padrão em `WORKER_KIND_DEFAULTS`.
- R7. Teste de equivalência por categoria no CI; medição na sala com a trava `perf-measure.lock` antes do merge de cada migração.
- R8. Todas as categorias do desenho entram nesta spec: chão da cratera, física da multidão, caixas das peças, colisores fixos, formas e
  normais, reserva de núcleos para o Jolt, preset do kit e o mundo vivo em segundo plano.
- R9. Backend por plataforma (navegador, Electron, Node) e a thread de simulação em worker, com espera permitida dentro dela (fase G).

## Fora do escopo

- Nada: o transporte `shared` entrou na fase G (T21).
- Threads do próprio Jolt: decididas na thread do app desktop; aqui só a reserva de núcleos.
