#!/usr/bin/env bash
# Lets the current user run only `nvidia-smi` with sudo and no password, so the perf runs can lock the GPU clock in steps
# (examples/test-room/perf.mjs, specs/005-camadas-e-quadro/medicao-por-faixa.md). Undo with nvidia-smi-sudo-off.sh.
set -euo pipefail
binary="$(command -v nvidia-smi)"
rule="/etc/sudoers.d/nvidia-smi"
line="${USER} ALL=(root) NOPASSWD: ${binary}"
echo "$line" | sudo tee "$rule" > /dev/null
sudo chmod 440 "$rule"
sudo visudo -cf "$rule"
echo "on: ${line}"
