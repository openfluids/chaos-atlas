"""Tests pinned to exact analytic results where the maps have them."""

from __future__ import annotations

import math

import numpy as np
import pytest

from chaos_atlas.maps import (
    arnold,
    bakers,
    complex_quadratic,
    duffing,
    henon,
    ikeda,
    logistic,
    standard,
    tent,
    tinkerbell,
)


class TestLogistic:
    def test_iterate_matches_definition(self):
        assert logistic.iterate(0.5, r=4.0) == pytest.approx(1.0)

    def test_trajectory_starts_at_x0_and_has_requested_length(self):
        orbit = logistic.trajectory(r=3.9, x0=0.25, iterations=50)
        assert orbit.shape == (50,)
        assert orbit[0] == pytest.approx(0.25)

    def test_converges_to_fixed_point_below_period_doubling(self):
        # For 1 < r < 3 the non-zero fixed point 1 - 1/r is stable.
        r = 2.5
        orbit = logistic.trajectory(r=r, x0=0.2, iterations=500)
        assert orbit[-1] == pytest.approx(1.0 - 1.0 / r, abs=1e-9)

    def test_lyapunov_at_r4_is_log_two(self):
        # r = 4 is conjugate to the Bernoulli shift, so lambda = log 2 exactly.
        assert logistic.lyapunov(r=4.0, x0=0.2, iterations=200_000) == pytest.approx(
            math.log(2.0), abs=1e-2
        )

    def test_lyapunov_negative_on_stable_fixed_point(self):
        assert logistic.lyapunov(r=2.5, x0=0.2, iterations=5_000) < 0.0

    def test_preperiodic_x0_reports_its_own_orbit_not_the_attractor(self):
        # x0 = 0.5 is preperiodic at r = 4: it maps to 1.0, then to 0, and stays
        # on that unstable fixed point where |f'| = r. The exponent is log 4,
        # correct for that orbit but not the attractor's log 2. Pinned so the
        # documented trap cannot regress into a silent wrong answer.
        assert logistic.lyapunov(r=4.0, x0=0.5, iterations=1_000) == pytest.approx(
            math.log(4.0), abs=1e-9
        )
        assert logistic.lyapunov(r=4.0, x0=0.2, iterations=200_000) == pytest.approx(
            math.log(2.0), abs=1e-2
        )

    def test_bifurcation_returns_paired_flat_arrays(self):
        r_values, x_values = logistic.bifurcation(r_steps=50, iterations=20)
        assert r_values.shape == x_values.shape
        assert r_values.size == 50 * 20

    def test_bifurcation_shows_period_two_above_r3(self):
        # Just above r = 3 the attractor is a 2-cycle.
        r_values, x_values = logistic.bifurcation(
            r_min=3.2, r_max=3.2, r_steps=1, transient=2_000, iterations=50
        )
        assert np.unique(np.round(x_values, 6)).size == 2

    def test_bifurcation_at_r4_shows_the_full_chaotic_attractor(self):
        # The default seed x0 = 0.2 must actually explore the r = 4 column,
        # not collapse to the single preperiodic value that x0 = 0.5 hits.
        r_values, x_values = logistic.bifurcation()
        mask = np.isclose(r_values, 4.0)
        assert np.unique(np.round(x_values[mask], 9)).size > 50

    def test_cobweb_chains_x_to_previous_y(self):
        pairs = logistic.cobweb(r=3.9, x0=0.3, iterations=10)
        assert pairs.shape == (10, 2)
        np.testing.assert_allclose(pairs[1:, 0], pairs[:-1, 1])

    def test_rejects_negative_iterations(self):
        with pytest.raises(ValueError):
            logistic.trajectory(iterations=-1)


class TestTent:
    @pytest.mark.parametrize("alpha", [1.2, 1.5, 1.8, 1.99])
    def test_lyapunov_is_log_alpha(self, alpha):
        # Piecewise linear with slope +/- alpha, so the exponent is exact.
        assert tent.lyapunov(alpha=alpha, iterations=5_000) == pytest.approx(
            math.log(alpha)
        )

    def test_iterate_is_symmetric_about_one_half(self):
        assert tent.iterate(0.3, alpha=1.8) == pytest.approx(
            tent.iterate(0.7, alpha=1.8)
        )

    def test_symbolic_dynamics_is_binary_of_requested_length(self):
        itinerary = tent.symbolic_dynamics(alpha=1.9, x0=0.31, iterations=64)
        assert len(itinerary) == 64
        assert set(itinerary) <= {"0", "1"}


class TestHenon:
    def test_iterate_matches_definition(self):
        x, y = henon.iterate(0.0, 0.0, a=1.4, b=0.3)
        assert (x, y) == pytest.approx((1.0, 0.0))

    def test_trajectory_shape_is_n_by_two(self):
        orbit = henon.trajectory(iterations=500)
        assert orbit.shape == (500, 2)

    def test_attractor_discards_transient(self):
        assert henon.attractor(iterations=200, transient=50).shape == (200, 2)

    def test_lyapunov_matches_published_value(self):
        # Widely reported as lambda_1 ~= 0.419 for a = 1.4, b = 0.3.
        assert henon.lyapunov(iterations=100_000) == pytest.approx(0.419, abs=0.01)

    def test_attractor_stays_bounded(self):
        points = henon.attractor(iterations=5_000)
        assert np.all(np.abs(points) < 2.0)


class TestBakers:
    def test_entropies_and_exponent_are_log_two(self):
        assert bakers.lyapunov() == pytest.approx(math.log(2.0))
        assert bakers.ks_entropy() == pytest.approx(math.log(2.0))
        assert bakers.topological_entropy() == pytest.approx(math.log(2.0))

    def test_pesin_identity_holds(self):
        # For this map the KS entropy equals the positive Lyapunov exponent.
        assert bakers.ks_entropy() == pytest.approx(bakers.lyapunov())

    def test_orbit_stays_in_unit_square(self):
        orbit = bakers.trajectory(x0=0.31, y0=0.17, iterations=500)
        assert np.all((orbit >= 0.0) & (orbit < 1.0))

    def test_symbolic_dynamics_is_binary_expansion(self):
        # x0 = 0.625 = 0.101 in binary
        assert bakers.symbolic_dynamics(x0=0.625, iterations=3) == "101"


class TestArnold:
    def test_eigenvalues_multiply_to_one(self):
        # det = 1 is the area-preservation statement.
        large, small = arnold.eigenvalues()
        assert large * small == pytest.approx(1.0)

    def test_lyapunov_is_log_of_larger_eigenvalue(self):
        assert arnold.lyapunov() == pytest.approx(math.log((3.0 + math.sqrt(5.0)) / 2.0))

    def test_orbit_stays_on_unit_torus(self):
        orbit = arnold.trajectory(x0=0.31, y0=0.17, iterations=200)
        assert np.all((orbit >= 0.0) & (orbit < 1.0))

    @pytest.mark.parametrize("n", [2, 3, 5, 8, 11])
    def test_scrambled_grid_returns_after_recurrence_period(self, n):
        # The map permutes an n x n lattice, so it must come back intact.
        grid = np.arange(n * n).reshape(n, n)
        period = arnold.recurrence_period(n)
        np.testing.assert_array_equal(arnold.scramble_grid(grid, period), grid)

    def test_scrambling_actually_disturbs_the_grid(self):
        grid = np.arange(64).reshape(8, 8)
        assert not np.array_equal(arnold.scramble_grid(grid, 1), grid)

    def test_rejects_non_square_grid(self):
        with pytest.raises(ValueError):
            arnold.scramble_grid(np.zeros((3, 4)), 1)


class TestStandard:
    def test_integrable_at_k_zero(self):
        # K = 0 makes p a constant of motion, so there is no stretching.
        assert standard.lyapunov(k=0.0, iterations=5_000) == pytest.approx(0.0, abs=1e-6)

    def test_momentum_conserved_at_k_zero(self):
        orbit = standard.trajectory(k=0.0, theta0=1.0, p0=2.0, iterations=100)
        np.testing.assert_allclose(orbit[:, 1], 2.0)

    def test_chaotic_above_critical_k(self):
        assert standard.lyapunov(k=5.0, iterations=50_000) > 0.5

    def test_trajectory_includes_initial_condition(self):
        orbit = standard.trajectory(k=1.0, iterations=10)
        assert orbit.shape == (11, 2)

    def test_orbit_stays_on_torus(self):
        orbit = standard.trajectory(k=2.0, iterations=1_000)
        assert np.all((orbit >= 0.0) & (orbit < 2.0 * np.pi))


class TestIkeda:
    def test_trajectory_shape_is_n_by_two(self):
        assert ikeda.trajectory(iterations=500).shape == (500, 2)

    def test_attractor_is_chaotic_at_default_parameters(self):
        assert ikeda.lyapunov(iterations=50_000) > 0.0

    def test_attractor_stays_bounded(self):
        points = ikeda.attractor(iterations=5_000)
        assert np.all(np.isfinite(points))
        assert np.all(np.abs(points) < 10.0)


class TestTinkerbell:
    def test_trajectory_shape_is_n_by_two(self):
        assert tinkerbell.trajectory(iterations=500).shape == (500, 2)

    def test_attractor_stays_bounded_at_default_parameters(self):
        points = tinkerbell.attractor(iterations=5_000)
        assert np.all(np.isfinite(points))
        assert np.all(np.abs(points) < 5.0)

    def test_chaotic_at_default_parameters(self):
        assert tinkerbell.lyapunov(iterations=20_000) > 0.0


class TestDuffing:
    def test_origin_is_always_a_fixed_point(self):
        points = duffing.fixed_points()
        assert np.any(np.all(np.isclose(points, 0.0), axis=1))

    def test_symmetric_pair_appears_above_threshold(self):
        # x (x^2 + b + 1 - a) = 0 gives a pair once a > b + 1.
        assert duffing.fixed_points(a=2.75, b=0.2).shape[0] == 3
        assert duffing.fixed_points(a=0.5, b=0.2).shape[0] == 1

    def test_fixed_points_are_actually_fixed(self):
        for x, y in duffing.fixed_points(a=2.75, b=0.2):
            nx, ny = duffing.iterate(float(x), float(y), a=2.75, b=0.2)
            assert (nx, ny) == pytest.approx((x, y), abs=1e-12)

    def test_trajectory_shape_is_n_by_two(self):
        assert duffing.trajectory(iterations=500).shape == (500, 2)

    def test_trajectory_stays_finite_at_default_parameters(self):
        # A transposed x/y recurrence blows up almost immediately at the
        # canonical (a, b) = (2.75, 0.2); the correct map does not.
        assert np.isfinite(duffing.trajectory(iterations=500)).all()

    def test_chaotic_at_canonical_parameters(self):
        # a = 2.75, b = 0.2 is the canonical chaotic Duffing map parameter set.
        assert duffing.lyapunov(iterations=100_000) == pytest.approx(0.478, abs=0.02)


class TestComplexQuadratic:
    def test_origin_never_escapes_for_c_zero(self):
        assert complex_quadratic.escape_time(0j, 0j, max_iterations=50) == 50

    def test_large_c_escapes_immediately(self):
        assert complex_quadratic.escape_time(0j, complex(3.0, 0.0), max_iterations=50) < 5

    def test_mandelbrot_shape_and_range(self):
        grid = complex_quadratic.mandelbrot_set(width=64, height=48, max_iterations=40)
        assert grid.shape == (48, 64)
        assert grid.min() >= 0
        assert grid.max() <= 40

    def test_mandelbrot_contains_its_interior(self):
        # c = -0.5 + 0i is well inside the main cardioid.
        grid = complex_quadratic.mandelbrot_set(
            width=101, height=101, x_range=(-0.5, -0.5), y_range=(0.0, 0.0),
            max_iterations=60,
        )
        assert np.all(grid == 60)

    def test_julia_shape(self):
        grid = complex_quadratic.julia_set(width=64, height=48, max_iterations=40)
        assert grid.shape == (48, 64)

    def test_known_julia_parameters_are_complex(self):
        assert all(
            isinstance(v, complex) for v in complex_quadratic.INTERESTING_JULIA.values()
        )
