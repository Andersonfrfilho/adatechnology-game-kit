#!/usr/bin/env bash
# Puts the GPU clock and power limit back to their defaults and removes the sudo rule nvidia-smi-sudo-on.sh made.
set -euo pipefail
rule="/etc/sudoers.d/nvidia-smi"
sudo nvidia-smi -rgc > /dev/null || true
sudo nvidia-smi -pl "$(nvidia-smi --query-gpu=power.default_limit --format=csv,noheader,nounits | head -1)" > /dev/null || true
sudo rm -f "$rule"
echo "off: GPU clock and power back to default, ${rule} removed"
