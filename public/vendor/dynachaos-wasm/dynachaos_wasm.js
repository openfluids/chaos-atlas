/* @ts-self-types="./dynachaos_wasm.d.ts" */

/**
 * Average mutual information `I(tau)` for `tau = 1 ..= tau_max`.
 *
 * This is the same estimator `dynachaos.diagnostics` runs in Python: `x` is
 * a scalar series and the result is the delayed mutual information at each
 * lag, estimated with a uniform `n_bins`-by-`n_bins` histogram as Fraser and
 * Swinney (1986) describe.
 *
 * # Returned layout
 *
 * One flat array of `3 + tau_max` values:
 *
 * - `[0]` = `N` actually used, after truncation.
 * - `[1]` = `tau_max` actually used, after clamping.
 * - `[2]` = `n_bins` actually used, after clamping.
 * - `[3 ..]` = `I(1) .. I(tau_max)`, in lag order.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — fewer than two samples,
 * or a non-finite sample anywhere in the kept prefix — returns an empty
 * array, never a trap.
 *
 * # Clamping
 *
 * - `x`: truncated to 20000 samples; a non-finite sample anywhere in the
 *   kept prefix returns an empty array.
 * - `tau_max`: clamped to `[1, 512]`.
 * - `n_bins`: clamped to `[1, 512]`.
 * - The `tau_max` histogram passes over `N` samples are the work budget.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Float64Array} x
 * @param {number} tau_max
 * @param {number} n_bins
 * @returns {Float64Array}
 */
export function ami_histogram(x, tau_max, n_bins) {
    const ptr0 = passArrayF64ToWasm0(x, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ami_histogram(ptr0, len0, tau_max, n_bins);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Approximate-entropy template matches: one count per template row.
 *
 * This is the same estimator `dynachaos.diagnostics.approximate_entropy`
 * runs in Python: `traj` is a row-major embedded trajectory of `n_pts` rows
 * of `dim` coordinates, and `counts[i]` is the number of rows `j` with
 * Chebyshev distance `max(abs(traj[i] - traj[j])) <= r`, self-matches
 * included as Pincus (1991) defines them.
 *
 * # Returned layout
 *
 * One flat array of `3 + n_pts` values:
 *
 * - `[0]` = `n_pts` actually used, after truncation.
 * - `[1]` = `dim` actually used, after clamping.
 * - `[2]` = `r` actually used, after the fallback below.
 * - `[3 ..]` = one match count per template row, in row order.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — fewer than one complete
 * row, a non-finite entry anywhere in the kept trajectory, or a tolerance
 * that stays non-positive after the fallback — returns an empty array,
 * never a trap.
 *
 * # Clamping
 *
 * - `traj`: `n_pts = traj.len() / dim` complete rows, truncated to 20000;
 *   a non-finite entry anywhere in the kept prefix returns an empty array.
 * - `dim`: clamped to `[1, 32]`.
 * - `r`: a non-finite or non-positive value falls back to `0.2 * std`
 *   (ddof = 1) over all coordinates of the kept trajectory. The Python
 *   diagnostics take the same fraction of the scalar series, which gives a
 *   slightly different value.
 * - `n_pts` is reduced further until `n_pts^2 x dim` fits the 2e8
 *   pair-term budget; the value actually used is reported in the header.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Float64Array} traj
 * @param {number} dim
 * @param {number} r
 * @returns {Float64Array}
 */
export function apen_counts(traj, dim, r) {
    const ptr0 = passArrayF64ToWasm0(traj, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.apen_counts(ptr0, len0, dim, r);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * CML space-time tile: the field of a coupled-map lattice after a transient.
 *
 * These are the three models `dynachaos.cml.spatiotemporal` simulates
 * (`src/dynachaos/cml/spatiotemporal.py:42-68`): `model` 0 is (A), the
 * piecewise Kaneko map; `model` 1 is (B), the circle map coupled through
 * `sin(2 pi u)`; `model` 2 is (C), the logistic map `1 - 1.752 u^2`. The
 * export iterates `n_transient` periodic CML steps from `x0`, then records
 * the state after each of the next `n_record` steps.
 *
 * # Returned layout
 *
 * One flat array of `4 + n_record * n_sites` values:
 *
 * - `[0]` = `model` actually used, after snapping to `{0, 1, 2}`.
 * - `[1]` = `n_sites` actually used.
 * - `[2]` = `n_transient` actually used.
 * - `[3]` = `n_record` actually used, which may be lower than requested when
 *   the step budget binds.
 * - `[4 ..]` = the field, row-major by time then site: entry
 *   `4 + t * n_sites + i` is site `i` of the `t`-th recorded row.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A kernel error — impossible after the clamps below — returns an empty
 * array, never a trap.
 *
 * # Clamping
 *
 * - `model`: snapped to `{0, 1, 2}`; anything above 2 is model (C).
 * - `eps`: clamped to `[0, 1]`; a non-finite value falls back to the middle
 *   of the model's paper sweep (0.07, 0.024, 0.2).
 * - `n_sites`: 2 to 512 sites; `n_transient`: 0 to 20000 steps; `n_record`:
 *   1 to 2048 rows, reduced further to respect the step budget.
 * - `x0`: the first `n_sites` entries are used; a missing or non-finite
 *   entry falls back to 0.5, then every entry clamps to `[0, 1]`, the
 *   interval the paper draws its initial field from.
 * @param {number} model
 * @param {number} eps
 * @param {number} n_sites
 * @param {number} n_transient
 * @param {number} n_record
 * @param {Float64Array} x0
 * @returns {Float64Array}
 */
export function cml_spacetime_tile(model, eps, n_sites, n_transient, n_record, x0) {
    const ptr0 = passArrayF64ToWasm0(x0, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.cml_spacetime_tile(model, eps, n_sites, n_transient, n_record, ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Correlation integral counts: pairs within each distance threshold.
 *
 * This is the same estimator `dynachaos.diagnostics.correlation_integral`
 * runs in Python: `traj` is a row-major embedded trajectory of `n_pts` rows
 * of `dim` coordinates, and `counts[k]` is the number of pairs with
 * `|i - j| > theiler_window` and distance below `r_values[k]`. The kernel
 * requires the thresholds sorted ascending, so this export sorts a copy and
 * returns the radii it actually used; the counts line up with that list,
 * not with the caller's order.
 *
 * # Returned layout
 *
 * One flat array of `5 + n_r + n_r` values:
 *
 * - `[0]` = `n_pts` actually used, after truncation.
 * - `[1]` = `dim` actually used, after clamping.
 * - `[2]` = `n_r` actually used, after truncation.
 * - `[3]` = `theiler_window` actually used, after clamping.
 * - `[4]` = `use_chebyshev` actually used: 1 for the max norm, 0 for
 *   Euclidean.
 * - `[5 .. 5 + n_r]` = the radii actually used, sorted ascending.
 * - `[5 + n_r ..]` = one count per radius, in the same order.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — fewer than one complete
 * row, no radii, or a non-finite entry anywhere in the kept trajectory or
 * radius prefix — returns an empty array, never a trap.
 *
 * # Clamping
 *
 * - `traj`: `n_pts = traj.len() / dim` complete rows, truncated to 20000;
 *   a non-finite entry anywhere in the kept prefix returns an empty array.
 * - `dim`: clamped to `[1, 32]`.
 * - `r_values`: truncated to 256 entries; a non-finite entry in the kept
 *   prefix returns an empty array; negative radii are clamped to 0 and the
 *   list is sorted ascending.
 * - `theiler_window`: clamped to `n_pts - 1`.
 * - `n_pts` is reduced further until `pairs x dim` fits the 2e8 pair-term
 *   budget; the value actually used is reported in the header.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Float64Array} traj
 * @param {number} dim
 * @param {Float64Array} r_values
 * @param {number} theiler_window
 * @param {boolean} use_chebyshev
 * @returns {Float64Array}
 */
export function correlation_counts(traj, dim, r_values, theiler_window, use_chebyshev) {
    const ptr0 = passArrayF64ToWasm0(traj, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(r_values, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.correlation_counts(ptr0, len0, dim, ptr1, len1, theiler_window, use_chebyshev);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}

/**
 * Delayed-logistic attractor tile: one `(x, y)` trajectory per D value.
 *
 * This is the map `dynachaos.maps.delayed_logistic` iterates
 * (`delayed_logistic`, `src/dynachaos/maps/delayed_logistic.py:82`):
 * `x' = A * x + (1 - A) * (1 - D * y * y)`, `y' = x`. The export sweeps `n_D`
 * evenly spaced D values from `d_min` to `d_max` and, for each, iterates
 * `n_transient` steps from `state0` then records `n_plot` states.
 *
 * # Returned layout
 *
 * One flat array of `4 + n_D * n_plot * 2` values:
 *
 * - `[0]` = `n_D` actually used, after clamping.
 * - `[1]` = `n_plot` actually used, after clamping and the step budget.
 * - `[2]` = `n_transient` actually used.
 * - `[3]` = the state dimension, always 2.
 * - `[4 ..]` = the samples, D-major: `n_D` blocks of `n_plot` `(x, y)`
 *   pairs each.
 *
 * A D whose orbit diverges (any `|state| > 1e10`) yields a block of `NaN`
 * pairs, matching the `None` the Python pipeline stores for that D. Read the
 * header rather than assuming the values you passed were honoured. A kernel
 * error — impossible after the clamps below — returns an empty array,
 * never a trap.
 *
 * # Clamping
 *
 * - `a`: clamped to `[0, 1]`; a non-finite value falls back to 0.3.
 * - `d_min`, `d_max`: clamped to `[1.4, 3.5]`, the range the paper sweeps;
 *   non-finite values fall back to the full range.
 * - `n_D`: clamped to `[1, 64]`; `n_transient` to `[0, 20000]`; `n_plot` to
 *   `[1, 4096]`, reduced further to respect the step budget.
 * - `state0`: the first two entries are used; a missing or non-finite
 *   component falls back to 0.5, then every component clamps to `[-4, 4]`.
 * @param {number} a
 * @param {number} d_min
 * @param {number} d_max
 * @param {number} n_d
 * @param {number} n_transient
 * @param {number} n_plot
 * @param {Float64Array} state0
 * @returns {Float64Array}
 */
export function delayed_logistic_attractor_tile(a, d_min, d_max, n_d, n_transient, n_plot, state0) {
    const ptr0 = passArrayF64ToWasm0(state0, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.delayed_logistic_attractor_tile(a, d_min, d_max, n_d, n_transient, n_plot, ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Diagonal line lengths of a recurrence matrix (determinism runs).
 *
 * This is the same estimator `dynachaos.diagnostics.recurrence` runs in
 * Python: `mask` is a row-major `u8` recurrence matrix of `side` rows and
 * `side` columns where any nonzero byte counts as recurrent, and the result
 * is the length of every run of recurrent cells along the super-diagonals
 * `k = 1 .. side` that meets `l_min`. The kernel is the run-length counter
 * `count_line_lengths`; this export gathers each super-diagonal into a
 * reusable buffer and hands it to that counter, which applies the same
 * run-length rule as the native kernel; `scripts/check_wasm_diagnostics.py`
 * checks the two agree exactly.
 *
 * # Returned layout
 *
 * One flat array of `3 + n_lines` values:
 *
 * - `[0]` = `side` actually used, after clamping.
 * - `[1]` = `l_min` actually used, after clamping.
 * - `[2]` = `n_lines`, the number of line lengths returned.
 * - `[3 ..]` = the line lengths, in super-diagonal order `k = 1 .. side`.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — a mask shorter than
 * `side * side`, or a side that clamps below 2 — returns an empty array,
 * never a trap.
 *
 * # Clamping
 *
 * - `side`: clamped to `[2, 1024]` so the `side * side` mask stays
 *   interactive (at 1024 the mask is one megabyte and the scan is about a
 *   million cell visits).
 * - `l_min`: clamped to `[1, side]`.
 * - `mask`: the first `side * side` bytes are used; a nonzero byte is
 *   recurrent. The `O(side^2)` scan is the work budget.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Uint8Array} mask
 * @param {number} side
 * @param {number} l_min
 * @returns {Float64Array}
 */
export function diagonal_lines(mask, side, l_min) {
    const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.diagonal_lines(ptr0, len0, side, l_min);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Fuzzy-entropy membership sum over the valid template pairs.
 *
 * This is the same accumulator `dynachaos.diagnostics.fuzzy_entropy` runs
 * in Python: `traj` is a row-major embedded trajectory of `n_pts` rows of
 * `dim` coordinates, and the result is the sum of `exp(-(d / r)^n)` over
 * the pairs with `j > i + theiler_window`, Chebyshev distance `d`. The
 * Python diagnostic mean-centres its templates before calling the kernel;
 * this export sums over the trajectory it is given, so centre first if
 * that is the comparison you want.
 *
 * # Returned layout
 *
 * One flat array of `6` values:
 *
 * - `[0]` = `n_pts` actually used, after truncation.
 * - `[1]` = `dim` actually used, after clamping.
 * - `[2]` = `r` actually used, after the fallback below.
 * - `[3]` = `n` actually used, after clamping.
 * - `[4]` = `theiler_window` actually used, after clamping.
 * - `[5]` = the membership sum.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — fewer than one complete
 * row, a non-finite entry anywhere in the kept trajectory, or a tolerance
 * that stays non-positive after the fallback — returns an empty array,
 * never a trap.
 *
 * # Clamping
 *
 * - `traj`: `n_pts = traj.len() / dim` complete rows, truncated to 20000;
 *   a non-finite entry anywhere in the kept prefix returns an empty array.
 * - `dim`: clamped to `[1, 32]`.
 * - `r`: a non-finite or non-positive value falls back to `0.2 * std`
 *   (ddof = 1) over all coordinates of the kept trajectory. The Python
 *   diagnostics take the same fraction of the scalar series, which gives a
 *   slightly different value.
 * - `n`: clamped to `[1, 16]`.
 * - `theiler_window`: clamped to `n_pts - 1`.
 * - `n_pts` is reduced further until `pairs x dim` fits the 2e8 pair-term
 *   budget; the value actually used is reported in the header.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Float64Array} traj
 * @param {number} dim
 * @param {number} r
 * @param {number} n
 * @param {number} theiler_window
 * @returns {Float64Array}
 */
export function fuzzy_entropy_sum(traj, dim, r, n, theiler_window) {
    const ptr0 = passArrayF64ToWasm0(traj, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.fuzzy_entropy_sum(ptr0, len0, dim, r, n, theiler_window);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Modulated-circle rotation numbers over a `D` sweep.
 *
 * This is the map `dynachaos.maps.modulated_circle` iterates
 * (`src/dynachaos/maps/modulated_circle.py:35`): `theta` advances by
 * `A * sin(2 pi theta) + D + eps * sin(2 pi phi)` while `phi` advances by
 * `C`, both unwrapped. For each `D` in the sweep the export iterates
 * `n_transient` steps from `(theta0, phi0)`, then returns the mean
 * increments over the next `n_iter` steps — the pair `rotation_numbers`
 * computes (`src/dynachaos/maps/modulated_circle.py:48`).
 *
 * # Returned layout
 *
 * One flat array of `4 + n_d * 2` values:
 *
 * - `[0]` = `n_d` actually used, after clamping.
 * - `[1]` = `n_transient` actually used.
 * - `[2]` = `n_iter` actually used, which may be lower than requested when
 *   the step budget binds.
 * - `[3]` = 2, the pair width.
 * - `[4 ..]` = the `(rho_theta, rho_phi)` pairs, D-major.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A kernel error — impossible after the clamps below — returns an empty
 * array, never a trap.
 *
 * # Clamping
 *
 * - `n_d`: 1 to 512 values; `n_transient`: 0 to 20000 steps; `n_iter`: 1 to
 *   200000 steps, reduced further to respect the step budget.
 * - `a`, `c`, `eps`, `d_min`, `d_max`, `theta0`, `phi0`: clamped to
 *   `[0, 1]`; a non-finite value falls back to the paper's setting (0.1,
 *   the golden-mean inverse, 0.05, the sweep endpoints 0 and 1, and 0.1 for
 *   the phases).
 * @param {number} a
 * @param {number} c
 * @param {number} d_min
 * @param {number} d_max
 * @param {number} n_d
 * @param {number} eps
 * @param {number} n_transient
 * @param {number} n_iter
 * @param {number} theta0
 * @param {number} phi0
 * @returns {Float64Array}
 */
export function modulated_circle_rotation_tile(a, c, d_min, d_max, n_d, eps, n_transient, n_iter, theta0, phi0) {
    const ret = wasm.modulated_circle_rotation_tile(a, c, d_min, d_max, n_d, eps, n_transient, n_iter, theta0, phi0);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Multifractal partition moments over dyadic box scales.
 *
 * This is the same estimator `dynachaos.diagnostics.multifractal` runs in
 * Python: `field` is a row-major nonnegative measure field of `ny` rows and
 * `nx` columns, and for each box size `r` and moment order `q` the kernel
 * returns `log_z = ln(sum p^q)`, `alpha_num = sum mu ln p` and
 * `f_num = sum mu ln mu`, plus `ln(r)` per scale. Boxes do not overlap and
 * edge remainders are truncated, exactly as the native kernel does.
 *
 * # Returned layout
 *
 * One flat array of `4 + 3 * n_scales * n_q + n_scales` values:
 *
 * - `[0]` = `ny` actually used, after clamping.
 * - `[1]` = `nx` actually used, after clamping.
 * - `[2]` = `n_scales` actually used, after truncation.
 * - `[3]` = `n_q` actually used, after truncation.
 * - `[4 .. 4 + n_scales * n_q]` = `log_z`, row-major `(n_scales, n_q)`.
 * - then `alpha_num`, row-major `(n_scales, n_q)`.
 * - then `f_num`, row-major `(n_scales, n_q)`.
 * - then `ln_scales`, `n_scales` values.
 *
 * A skipped scale or a non-finite `q` leaves `NaN` in its slot, matching the
 * native kernel. Read the header rather than assuming the values you passed
 * were honoured. A request that cannot produce a result at all — a field
 * shorter than `ny * nx`, a non-finite or negative entry, or a non-positive
 * total mass — returns an empty array, never a trap.
 *
 * # Clamping
 *
 * - `ny`, `nx`: clamped to `[1, 512]` so the `ny * nx` field stays
 *   interactive.
 * - `box_sizes`: truncated to 64 entries; each is rounded toward zero and a
 *   non-positive or too-large size leaves `NaN` in its row.
 * - `q_values`: truncated to 64 entries; a non-finite `q` leaves `NaN` in
 *   its column.
 * - The `O(ny * nx)` box accumulation is the work budget.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Float64Array} field
 * @param {number} ny
 * @param {number} nx
 * @param {Float64Array} box_sizes
 * @param {Float64Array} q_values
 * @returns {Float64Array}
 */
export function multifractal_moments(field, ny, nx, box_sizes, q_values) {
    const ptr0 = passArrayF64ToWasm0(field, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(box_sizes, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArrayF64ToWasm0(q_values, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.multifractal_moments(ptr0, len0, ny, nx, ptr1, len1, ptr2, len2);
    var v4 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v4;
}

/**
 * Ordinal pattern distribution: raw Lehmer-code counts of length `d!`.
 *
 * This is the same estimator `dynachaos.diagnostics.ordinal_distribution`
 * runs in Python: each sliding window of `d` samples spaced `tau` apart is
 * encoded as the Lehmer code of its argsort permutation, and `counts[k]` is
 * the number of windows that landed on code `k`.
 *
 * # Returned layout
 *
 * One flat array of `4 + d!` values:
 *
 * - `[0]` = `N` actually used, after truncation.
 * - `[1]` = `d` actually used, after clamping.
 * - `[2]` = `tau` actually used, after clamping.
 * - `[3]` = `n_windows` actually analysed.
 * - `[4 ..]` = `d!` counts in Lehmer-code order.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — a non-finite sample
 * anywhere in the kept prefix, or a series too short for a single window —
 * returns an empty array, never a trap.
 *
 * # Clamping
 *
 * - `x`: truncated to 20000 samples; a non-finite sample anywhere in the
 *   kept prefix returns an empty array.
 * - `d`: clamped to `[2, 8]` (the kernel accepts 10, but `10!` counts will
 *   not fit a browser message).
 * - `tau`: clamped to `[1, N]`.
 * - The sample cap is the work budget: at most 20000 windows of at most 8
 *   samples each, sized for interactive use.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Float64Array} x
 * @param {number} d
 * @param {number} tau
 * @returns {Float64Array}
 */
export function ordinal_distribution(x, d, tau) {
    const ptr0 = passArrayF64ToWasm0(x, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ordinal_distribution(ptr0, len0, d, tau);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Rotation number of one (Omega, K) point, lock detection on, display stop off.
 *
 * This is the value the live figure quotes on hover. Locked orbits return the
 * exact rational; unlocked orbits run the full `n_iter` average. The tile
 * export keeps the display-tolerance stop; this one does not.
 *
 * # Returned layout
 *
 * One `f64`: `[0]` is the rotation number after clamping.
 *
 * # Clamping
 *
 * - `n_transient`: 0 to 20000 steps.
 * - `n_iter`: 1 to 200000 steps, reduced further to respect the step budget
 *   for a single cell.
 * - `omega`, `k`, `theta0`: a non-finite value falls back to the published
 *   figure's defaults (0, 0, 0.1).
 * @param {number} omega
 * @param {number} k
 * @param {number} n_transient
 * @param {number} n_iter
 * @param {number} theta0
 * @returns {Float64Array}
 */
export function rotation_number_point(omega, k, n_transient, n_iter, theta0) {
    const ret = wasm.rotation_number_point(omega, k, n_transient, n_iter, theta0);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Rotation numbers of the sine circle map over a tile of the (Omega, K) plane.
 *
 * The map is `theta -> theta + Omega + K * sin(2 * pi * theta)`, iterated
 * without reduction modulo 1. It is the map
 * `dynachaos.maps.arnold_tongues` sweeps to draw the Arnold tongues, and in
 * this convention it stops being invertible at `K = 1 / (2 * pi)`, about
 * 0.159.
 *
 * # Returned layout
 *
 * One flat array of `4 + n_k * n_omega` values:
 *
 * - `[0]` = `n_omega` actually used, after clamping.
 * - `[1]` = `n_k` actually used, after clamping.
 * - `[2]` = `n_transient` actually used.
 * - `[3]` = `n_iter` actually used, which may be lower than requested when
 *   the step budget binds.
 * - `[4 ..]` = the rotation numbers, row-major, `n_k` rows of `n_omega`
 *   values. K varies down the rows, Omega along the columns, matching the
 *   `rho` array the reproduction pipeline stores.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * Every input is clamped, so a request outside the documented range comes
 * back as the nearest allowed one instead of an error.
 *
 * # Clamping
 *
 * - `n_omega`, `n_k`: 1 to 512 cells.
 * - `n_transient`: 0 to 20000 steps.
 * - `n_iter`: 1 to 200000 steps, reduced further to respect the step budget.
 * - `omega_min`, `omega_max`, `k_min`, `k_max`, `theta0`: a non-finite value
 *   falls back to the value the published figure uses.
 * @param {number} omega_min
 * @param {number} omega_max
 * @param {number} n_omega
 * @param {number} k_min
 * @param {number} k_max
 * @param {number} n_k
 * @param {number} n_transient
 * @param {number} n_iter
 * @param {number} theta0
 * @returns {Float64Array}
 */
export function rotation_number_tile(omega_min, omega_max, n_omega, k_min, k_max, n_k, n_transient, n_iter, theta0) {
    const ret = wasm.rotation_number_tile(omega_min, omega_max, n_omega, k_min, k_max, n_k, n_transient, n_iter, theta0);
    var v1 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v1;
}

/**
 * Cao's embedding-dimension selector from an E1(d) curve.
 *
 * This is the same selector `dynachaos.diagnostics` runs in Python: `e1` is
 * the E1 curve indexed by dimension, and the result is the chosen embedding
 * dimension — the onset of a stable near-1 plateau, else the first near-one
 * crossing, else the closest value to 1.
 *
 * # Returned layout
 *
 * One flat array of `4` values:
 *
 * - `[0]` = `N`, the E1 length actually used, after truncation.
 * - `[1]` = `min_dim` actually used, after clamping.
 * - `[2]` = `max_dim` actually used: `0` when the caller left it automatic,
 *   else the clamped bound.
 * - `[3]` = the selected dimension.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — an empty E1 curve —
 * returns an empty array, never a trap.
 *
 * # Clamping
 *
 * - `e1`: truncated to 256 entries; a non-finite entry is skipped by the
 *   selector, matching the native kernel.
 * - `near_one_lower`, `near_one_upper`, `saturation_tol`: a non-finite
 *   value falls back to the published defaults (0.95, 1.05, 0.02).
 * - `plateau_span`: clamped to `[2, N]`; `smoothing_window` to `[1, N]`;
 *   `min_dim` to `[1, N]`; `max_dim` to `[min_dim, N]` when set.
 * - The single `O(N)` pass is the work budget.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Float64Array} e1
 * @param {number} near_one_lower
 * @param {number} near_one_upper
 * @param {number} saturation_tol
 * @param {number} plateau_span
 * @param {number} smoothing_window
 * @param {number} min_dim
 * @param {number} max_dim
 * @returns {Float64Array}
 */
export function select_dimension_cao(e1, near_one_lower, near_one_upper, saturation_tol, plateau_span, smoothing_window, min_dim, max_dim) {
    const ptr0 = passArrayF64ToWasm0(e1, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.select_dimension_cao(ptr0, len0, near_one_lower, near_one_upper, saturation_tol, plateau_span, smoothing_window, min_dim, max_dim);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Torus-doubling attractor tile: one trajectory of map I or map IV.
 *
 * These are the maps `dynachaos.maps.torus_doubling` iterates
 * (`src/dynachaos/maps/torus_doubling.py:46,63`): with
 * `L_D(u) = 1 - D * u * u`, map I (`map_kind` 1) steps `(X, Y, Z)` to
 * `(A * X + (1 - A) * L_D(Y), Z, X)` and map IV (`map_kind` 4) steps
 * `(X, Y, Z, W)` to `(A * X + (1 - A) * L_D(Y), Z, A * Z + (1 - A) * L_D(W), X)`.
 * The export iterates `n_transient` steps from `state0`, then records up to
 * `n_plot` states.
 *
 * # Returned layout
 *
 * One flat array of `4 + n_produced * dim` values:
 *
 * - `[0]` = `map_kind` actually used, after snapping to `{1, 4}`.
 * - `[1]` = the state dimension: 3 for map I, 4 for map IV.
 * - `[2]` = `n_transient` actually used.
 * - `[3]` = `n_produced`, the number of samples actually recorded.
 * - `[4 ..]` = the samples, `dim` values each, in iteration order.
 *
 * Divergence (any `|state| > 1e10`) stops the record and returns the samples
 * produced so far — possibly zero when the transient itself diverged —
 * exactly as `iterate_map` does in Python. Read the header rather than
 * assuming `n_plot` samples came back. A kernel error — impossible after
 * the clamps below — returns an empty array, never a trap.
 *
 * # Clamping
 *
 * - `map_kind`: snapped to the nearer of `{1, 4}`: 2 and below is map I,
 *   3 and above is map IV.
 * - `a`: clamped to `[0, 1]`; a non-finite value falls back to 0.4.
 * - `d`: clamped to `[1.48, 2.25]`, the union of the paper's map-I and
 *   map-IV sweeps; a non-finite value falls back to 1.9.
 * - `n_transient`: clamped to `[0, 20000]`; `n_plot` to `[1, 4096]`,
 *   reduced further to respect the step budget.
 * - `state0`: the first `dim` entries are used; a missing or non-finite
 *   component falls back to 0.5, then every component clamps to `[-4, 4]`.
 * @param {number} map_kind
 * @param {number} a
 * @param {number} d
 * @param {number} n_transient
 * @param {number} n_plot
 * @param {Float64Array} state0
 * @returns {Float64Array}
 */
export function torus_doubling_attractor_tile(map_kind, a, d, n_transient, n_plot, state0) {
    const ptr0 = passArrayF64ToWasm0(state0, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.torus_doubling_attractor_tile(map_kind, a, d, n_transient, n_plot, ptr0, len0);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * Vertical line lengths of a recurrence matrix (laminarity runs).
 *
 * This is the same estimator `dynachaos.diagnostics.recurrence` runs in
 * Python: `mask` is a row-major `u8` recurrence matrix of `side` rows and
 * `side` columns where any nonzero byte counts as recurrent, and the result
 * is the length of every run of recurrent cells down each column that meets
 * `v_min`. The kernel is the run-length counter `count_line_lengths`; this
 * export gathers each column into a reusable buffer and hands it to that
 * counter, which applies the same run-length rule as
 * the native kernel; `scripts/check_wasm_diagnostics.py` checks the two
 * agree exactly.
 *
 * # Returned layout
 *
 * One flat array of `3 + n_lines` values:
 *
 * - `[0]` = `side` actually used, after clamping.
 * - `[1]` = `v_min` actually used, after clamping.
 * - `[2]` = `n_lines`, the number of line lengths returned.
 * - `[3 ..]` = the line lengths, in column order `j = 0 .. side`.
 *
 * Read the header rather than assuming the values you passed were honoured.
 * A request that cannot produce a result at all — a mask shorter than
 * `side * side`, or a side that clamps below 2 — returns an empty array,
 * never a trap.
 *
 * # Clamping
 *
 * - `side`: clamped to `[2, 1024]` so the `side * side` mask stays
 *   interactive (at 1024 the mask is one megabyte and the scan is about a
 *   million cell visits).
 * - `v_min`: clamped to `[1, side]`.
 * - `mask`: the first `side * side` bytes are used; a nonzero byte is
 *   recurrent. The `O(side^2)` scan is the work budget.
 *
 * The browser is for exploration; the Python package is for production runs.
 * @param {Uint8Array} mask
 * @param {number} side
 * @param {number} v_min
 * @returns {Float64Array}
 */
export function vertical_lines(mask, side, v_min) {
    const ptr0 = passArray8ToWasm0(mask, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.vertical_lines(ptr0, len0, side, v_min);
    var v2 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v2;
}

/**
 * The 0-1 test for chaos: one K per frequency in `c_values`.
 *
 * This is the same estimator `dynachaos.diagnostics.zero_one_test` runs in
 * Python: per frequency `c` it builds the translation variables
 * `p_n = Σ φ_j cos(jc)`, `q_n = Σ φ_j sin(jc)`, forms the mean-square
 * displacement from the autocovariance identity, and returns the Pearson
 * correlation of the lag with `D`. The caller draws the frequencies; the
 * kernel only evaluates them.
 *
 * # Returned layout
 *
 * One flat array of `3 + n_c` values:
 *
 * - `[0]` = `N` actually used, after truncation.
 * - `[1]` = `n_c` actually used, after truncation.
 * - `[2]` = `n_cut` actually used, after clamping to `[2, N]`.
 * - `[3 ..]` = one K per c value kept, in the order they were passed.
 * Read the header rather than assuming the values you passed were honoured.
 * An oversized request is cut, not refused. A request that cannot produce a
 * statistic at all — a non-finite sample or frequency, fewer than three
 * samples, or no frequencies — returns an empty array, never a trap.
 *
 * # Clamping
 *
 * - `phi`: truncated to 20000 samples; a non-finite sample anywhere in the
 *   kept prefix returns an empty array.
 * - `c_values`: truncated to 100 frequencies; a non-finite frequency
 *   anywhere in the kept prefix returns an empty array.
 * - `n_cut`: clamped to `[2, N]`. The kernel forms the autocovariance by
 *   FFT, so a call costs `n_c` transforms of a power-of-two length below
 *   `4N` and needs no further work budget.
 * @param {Float64Array} phi
 * @param {Float64Array} c_values
 * @param {number} n_cut
 * @returns {Float64Array}
 */
export function zero_one_k(phi, c_values, n_cut) {
    const ptr0 = passArrayF64ToWasm0(phi, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArrayF64ToWasm0(c_values, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.zero_one_k(ptr0, len0, ptr1, len1, n_cut);
    var v3 = getArrayF64FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 8, 8);
    return v3;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./dynachaos_wasm_bg.js": import0,
    };
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('dynachaos_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
