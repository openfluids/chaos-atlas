/**
 * Shortest drawn series on which each measure still separates logistic
 * r = 4 from r = 3.2. Measured with dynachaos Python (scratch/measure_min_n.py),
 * series convention of the atlas time-series view: x0 = 0.2 included, no
 * discarded transient, x := r*x*(1-x). Grid N = 20, 50, 100, 200, 500.
 *
 * K (zero_one_statistic, n_c = 100, median over c):
 *   r=4:   1.0000, 0.9186, 0.9515, 0.9832, 0.9944
 *   r=3.2: 1.0000, 0.4169, 0.0819, 0.0780, 0.0139
 * Criterion from the goal: smallest N where r=4 gives K > 0.75 and r=3.2
 * gives K < 0.25. That first holds at 100, and at every larger measured N.
 *
 * PE (permutation_entropy, d = 5, tau = 1, normalised):
 *   r=4:   0.5180, 0.6041, 0.6402, 0.6577, 0.6574
 *   r=3.2: 0.1841, 0.3101, 0.2923, 0.2439, 0.1967
 * r=4 plateaus at 0.657 and never crosses the K threshold 0.75, so that
 * threshold cannot set MIN_N_PE. Criterion: smallest N where
 * PE(r=4) - PE(r=3.2) > 0.4 (the N=500 gap is 0.461) and every larger
 * measured N also satisfies it. Gaps are 0.334, 0.294, 0.348, 0.414, 0.461,
 * so the first hold is 200.
 *
 * D2 (correlation_dimension, n_r = 50, theiler = 0, chebyshev):
 *   r=4:   0.7034, 0.7155, 0.6953, 0.7340, 0.7785
 *   r=3.2: 0.0562, 0.0188, 0.6188, 0.0000, 0.0000
 * Criterion: finite, 0.5 < D2(r=4) < 1.5 (absolutely continuous on [0, 1],
 * D2 → 1), D2(r=3.2) < 0.25 (period-2, D2 → 0), and every larger measured N
 * also satisfies it. N = 100 misfires (r=3.2 D2 = 0.6188), which disqualifies
 * 20 and 50. The first hold is 200.
 */

export const MIN_N_K = 100;
export const MIN_N_PE = 200;
export const MIN_N_D2 = 200;
