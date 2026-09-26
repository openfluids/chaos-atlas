# Provenance

Byte copy of `pkg/` from openfluids/dynachaos, vendored so chaos-atlas can run
the paper's kernels without a Rust toolchain.

- Source commit: `7100fc476959dafc5c963967d1e02f7b9054f0ab` (also `dynachaos.commit` in `package.json`)
- Build command: `uv run python scripts/build_wasm_pkg.py`
- wasm-bindgen: 0.2.128
- Package version: 0.1.0 (`@openfluids/dynachaos-wasm`)

`dynachaos_wasm.js`, `dynachaos_wasm_bg.wasm`, `dynachaos_wasm.d.ts`,
`dynachaos_wasm_bg.wasm.d.ts`, `package.json`, `LICENSE`, and `README.md` are
unmodified copies of that `pkg/` directory. This file is the chaos-atlas
provenance note and is not part of the upstream package.
