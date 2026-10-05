# Bash commands

Prefer these over defaults when available. Fall back silently if missing.

## General

- **Search content:** `rg` over `grep`
- **Find files:** `fd` over `find`
- **Never** use `find -exec` or `xargs` chains when `fd -x` or `rg -l | xargs` would be clearer. Prefer readable pipelines.
- **Structural/AST search:** `ast-grep` for refactors and pattern-based code search, especially in TS/TSX. Use the full name — the `sg` alias is deprecated upstream and prints a warning.
- **JSON:** `jq` for any parsing, filtering, or transformation in pipelines
- **YAML/TOML:** `yq`
- **GitHub operations:** `gh` for PRs, issues, reviews, CI status, and releases. Do not scrape github.com or hit the REST API directly when `gh` can do it.
- **Benchmarking (shell commands):** `hyperfine`. For Rust code use `criterion` instead — it measures the function, not the process.

> `fd` respects `.gitignore` by default. That is usually what you want, but it means `dist/`, `node_modules/` and build output are invisible. Pass `-H -I` when you need them.

## JavaScript / TypeScript

`pnpm` is this repo's package manager. Run one-off tools with `pnpm dlx` — do not install them globally.

- **Typecheck only:** `pnpm exec tsc --noEmit`, or `pnpm check` (runs `astro check`)
- **Dead code, unused deps and exports:** `pnpm dlx knip`
- **Circular deps:** `pnpm dlx madge --circular src/` — narrow value in an Astro islands app; reach for it only when imports actually look tangled

## Rust / WASM — the engine

See [`../../engine/architecture/05-testing.md`](../../engine/architecture/05-testing.md) for what each one enforces.

- **Build to WASM:** `wasm-pack build --target web`
- **Test runner:** `cargo nextest run` over `cargo test` — per-test process isolation and faster on the golden corpus
- **Crate boundaries:** `cargo deny check` — enforces the dependency rule of [`02-architecture.md`](../../engine/architecture/02-architecture.md) §2 (`ms-core`/`ms-num` depend on nothing; everything else downward, never lateral)
- **WASM size budget:** `twiggy top` and `twiggy dominators` on the `.wasm`. The budget is **< 3 MB compressed for E0–E3**, a hard CI threshold. When it breaks, `twiggy` says *what* grew; without it you are guessing.

These live in the Rust toolchain, not in `Cargo.toml`:

```sh
brew install wasm-pack cargo-nextest cargo-deny
cargo install twiggy
```

Dev-dependencies (`criterion`, `proptest`, `cargo-fuzz`) are declared per crate, not installed here.
