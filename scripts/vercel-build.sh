#!/usr/bin/env bash
# Build command for Vercel. The site imports the engine's WASM (src/lib/engine/pkg/), which is
# a build artifact and not committed, and Vercel's build image ships without Rust — so the
# toolchain is installed here before the engine and the site are built.
set -euo pipefail

if ! command -v rustup >/dev/null 2>&1; then
  # No default toolchain: engine/rust-toolchain.toml pins the version and the wasm32 target,
  # and rustup installs exactly that the first time cargo runs inside engine/.
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none
fi
# shellcheck source=/dev/null
source "$HOME/.cargo/env"

if [ ! -f engine/Cargo.toml ]; then
  echo "engine/ is empty: the submodule was not checked out (git submodule update --init)." >&2
  exit 1
fi

if ! command -v wasm-pack >/dev/null 2>&1; then
  (cd engine && cargo install wasm-pack --locked)
fi

pnpm engine:build
pnpm build
