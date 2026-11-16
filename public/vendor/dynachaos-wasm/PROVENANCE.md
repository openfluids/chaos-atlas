# Provenance

Copy of `pkg/` from openfluids/dynachaos, built by the
`vendor-dynachaos-wasm` workflow so chaos-atlas can run the paper's
kernels without a Rust toolchain and without a local path in the module.

- Source commit: `654eb53a641fc18ca13681119b62e4369e59589d` (also `dynachaos.commit` in `package.json` and the one line of `SOURCE_REF`)
- Build command: `uv run python scripts/build_wasm_pkg.py`
- wasm-bindgen: 0.2.129
- Package version: 0.1.0 (`@openfluids/dynachaos-wasm`)
- Path check: `scripts/check_wasm_paths.py pkg` passed in the same run

`dynachaos_wasm.js`, `dynachaos_wasm_bg.wasm`, `dynachaos_wasm.d.ts`,
`dynachaos_wasm_bg.wasm.d.ts`, `package.json`, and `README.md`
are unmodified copies of that `pkg/` directory. `PROVENANCE.md` and
`SOURCE_REF` are chaos-atlas's own and are not part of the upstream package.

`LICENSE` is the one file that is not an unmodified copy. It is the Apache-2.0
text of the dynachaos `LICENSE` at the source commit, with one change: the
copyright holder line was changed to "Ricardo Frantz" on 16 Nov 2026
(chaos-atlas commit `b15f4c6`), to match the upstream `LICENSE` today. Upstream made
the same change in dynachaos commit `f3223f0` (pull request 24, 16 Nov 2026).
At the source commit the holder line used a longer form of the name.

To vendor another dynachaos commit, push a branch named
`vendor/dynachaos-wasm/<name>` with the new commit in `SOURCE_REF`.
The workflow builds it and pushes the files to that branch.
