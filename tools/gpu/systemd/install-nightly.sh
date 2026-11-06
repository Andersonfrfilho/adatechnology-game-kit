#!/bin/sh
# Turns the GPU daily run on, off, or runs it now (CONTRIBUTING.md, "GPU daily run").
#   sh tools/gpu/systemd/install-nightly.sh          install and enable the timer (04:30 every day)
#   sh tools/gpu/systemd/install-nightly.sh off      disable and remove it
#   sh tools/gpu/systemd/install-nightly.sh now      run it now, in the background, as the timer would
set -e
units="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
here=$(cd "$(dirname "$0")" && pwd)
# the checkout this script sits in runs the job; install it from the main checkout so it outlives any worktree
repo=$(git -C "$here" rev-parse --show-toplevel)
case "${1:-on}" in
  off)
    systemctl --user disable --now game-kit-nightly-gpu.timer 2>/dev/null || true
    rm -f "$units/game-kit-nightly-gpu.service" "$units/game-kit-nightly-gpu.timer"
    systemctl --user daemon-reload
    echo "GPU daily run: off" ;;
  now)
    systemctl --user start --no-block game-kit-nightly-gpu.service
    echo "GPU daily run: started (journalctl --user -u game-kit-nightly-gpu -f)" ;;
  on)
    mkdir -p "$units" "$HOME/.cache/adatechnology-game-kit"
    node_dir=$(dirname "$(command -v node)")
    sed -e "s|@REPO@|$repo|g" -e "s|@NODE@|$(command -v node)|g" -e "s|@NODE_PATH@|$node_dir:$(dirname "$(command -v pnpm)")|g" "$here/game-kit-nightly-gpu.service" > "$units/game-kit-nightly-gpu.service"
    cp "$here/game-kit-nightly-gpu.timer" "$units/"
    systemctl --user daemon-reload
    systemctl --user enable --now game-kit-nightly-gpu.timer
    systemctl --user list-timers game-kit-nightly-gpu.timer --no-pager ;;
  *) echo "usage: install-nightly.sh [on|off|now]" >&2; exit 2 ;;
esac
