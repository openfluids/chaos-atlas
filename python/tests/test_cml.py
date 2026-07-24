"""Coupled map lattice tests."""

from __future__ import annotations

import numpy as np
import pytest

from chaos_atlas import cml


@pytest.fixture
def rng():
    return np.random.default_rng(20260725)


class TestShapesAndBounds:
    @pytest.mark.parametrize(
        "evolve", [cml.diffusive, cml.global_coupled, cml.directional]
    )
    def test_spacetime_shape(self, evolve, rng):
        out = evolve(lattice_size=32, time_steps=64, rng=rng)
        assert out.shape == (64, 32)

    @pytest.mark.parametrize(
        "evolve", [cml.diffusive, cml.global_coupled, cml.directional]
    )
    def test_stays_in_unit_interval(self, evolve, rng):
        out = evolve(lattice_size=32, time_steps=100, rng=rng)
        assert np.all((out >= 0.0) & (out <= 1.0))

    @pytest.mark.parametrize(
        "evolve", [cml.diffusive, cml.global_coupled, cml.directional]
    )
    def test_first_row_is_the_initial_condition(self, evolve):
        initial = np.linspace(0.1, 0.9, 16)
        out = evolve(lattice_size=16, time_steps=10, initial=initial)
        np.testing.assert_allclose(out[0], initial)

    @pytest.mark.parametrize(
        "evolve", [cml.diffusive, cml.global_coupled, cml.directional]
    )
    def test_rejects_zero_time_steps(self, evolve):
        with pytest.raises(ValueError):
            evolve(time_steps=0)


class TestDeterminism:
    def test_same_seed_reproduces_run(self):
        a = cml.diffusive(lattice_size=16, time_steps=20, rng=np.random.default_rng(7))
        b = cml.diffusive(lattice_size=16, time_steps=20, rng=np.random.default_rng(7))
        np.testing.assert_array_equal(a, b)

    def test_different_seeds_diverge(self):
        a = cml.diffusive(lattice_size=16, time_steps=20, rng=np.random.default_rng(1))
        b = cml.diffusive(lattice_size=16, time_steps=20, rng=np.random.default_rng(2))
        assert not np.array_equal(a, b)


class TestCouplingBehaviour:
    def test_uniform_state_stays_uniform_under_every_coupling(self):
        # A spatially uniform lattice has nothing to exchange, so all three
        # topologies must reduce to the bare logistic map.
        uniform = np.full(16, 0.3)
        for step in (cml.diffusive_step, cml.global_step, cml.directional_step):
            out = step(uniform, r=3.9, epsilon=0.4)
            assert np.allclose(out, out[0])

    def test_uniform_state_follows_logistic_map(self):
        uniform = np.full(16, 0.3)
        expected = 3.9 * 0.3 * (1.0 - 0.3)
        for step in (cml.diffusive_step, cml.global_step, cml.directional_step):
            np.testing.assert_allclose(step(uniform, r=3.9, epsilon=0.4), expected)

    def test_zero_coupling_decouples_sites(self):
        # With epsilon = 0 each site is an independent logistic map.
        state = np.array([0.1, 0.5, 0.9])
        expected = np.clip(3.9 * state * (1.0 - state), 0.0, 1.0)
        np.testing.assert_allclose(cml.diffusive_step(state, r=3.9, epsilon=0.0), expected)

    def test_strong_global_coupling_synchronises(self):
        # Mean-field coupling at eps = 1 collapses the lattice onto one value.
        out = cml.global_coupled(
            epsilon=1.0, lattice_size=32, time_steps=5, rng=np.random.default_rng(3)
        )
        assert np.allclose(out[-1], out[-1][0])

    def test_directional_coupling_is_asymmetric(self):
        # A single perturbation must travel one way only.
        state = np.zeros(8)
        state[0] = 0.5
        out = cml.directional_step(state, r=3.9, epsilon=0.5)
        assert out[1] > 0.0
        assert out[-1] == pytest.approx(0.0)


class TestSpectrum:
    def test_spectrum_length_is_rfft_length(self):
        spectrum = cml.spatial_power_spectrum(np.random.default_rng(0).random(64))
        assert spectrum.shape == (33,)

    def test_uniform_lattice_has_no_power(self):
        assert np.allclose(cml.spatial_power_spectrum(np.full(32, 0.4)), 0.0)

    def test_single_mode_peaks_at_its_wavenumber(self):
        n = 64
        k = 5
        lattice = np.sin(2.0 * np.pi * k * np.arange(n) / n)
        spectrum = cml.spatial_power_spectrum(lattice)
        assert int(np.argmax(spectrum)) == k
