"""Coupled map lattices built on the logistic local map.

Three coupling topologies are provided: diffusive (nearest neighbour), global
(mean field), and directional (one-way advective). All use periodic boundaries
and clamp to [0, 1] so the lattice cannot escape the logistic domain.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = [
    "diffusive_step",
    "diffusive",
    "global_step",
    "global_coupled",
    "directional_step",
    "directional",
    "spatial_power_spectrum",
]


def _logistic(x: NDArray[np.float64], r: float) -> NDArray[np.float64]:
    return r * x * (1.0 - x)


def _initial_lattice(
    lattice_size: int, rng: np.random.Generator | None
) -> NDArray[np.float64]:
    generator = np.random.default_rng() if rng is None else rng
    return generator.random(lattice_size)


def diffusive_step(
    lattice: NDArray[np.float64], r: float = 3.9, epsilon: float = 0.4
) -> NDArray[np.float64]:
    """One step of nearest-neighbour diffusive coupling.

    ``x_i <- (1 - eps) f(x_i) + (eps / 2) (f(x_{i-1}) + f(x_{i+1}))``
    """
    state = np.asarray(lattice, dtype=np.float64)
    f = _logistic(state, r)
    coupled = (1.0 - epsilon) * f + (epsilon / 2.0) * (np.roll(f, 1) + np.roll(f, -1))
    return np.clip(coupled, 0.0, 1.0)


def diffusive(
    r: float = 3.9,
    epsilon: float = 0.4,
    lattice_size: int = 100,
    time_steps: int = 100,
    rng: np.random.Generator | None = None,
    initial: NDArray[np.float64] | None = None,
) -> NDArray[np.float64]:
    """Evolve a diffusive CML.

    Returns a ``(time_steps, lattice_size)`` space-time array whose first row is
    the initial condition. Pass ``rng`` (or ``initial``) for reproducibility.
    """
    if time_steps < 1:
        raise ValueError("time_steps must be >= 1")

    state = (
        _initial_lattice(lattice_size, rng)
        if initial is None
        else np.asarray(initial, dtype=np.float64).copy()
    )
    out = np.empty((time_steps, state.size), dtype=np.float64)
    out[0] = state
    for t in range(1, time_steps):
        state = diffusive_step(state, r, epsilon)
        out[t] = state
    return out


def global_step(
    lattice: NDArray[np.float64], r: float = 3.9, epsilon: float = 0.4
) -> NDArray[np.float64]:
    """One step of mean-field (globally coupled) dynamics.

    ``x_i <- (1 - eps) f(x_i) + eps <f(x)>``
    """
    state = np.asarray(lattice, dtype=np.float64)
    f = _logistic(state, r)
    coupled = (1.0 - epsilon) * f + epsilon * f.mean()
    return np.clip(coupled, 0.0, 1.0)


def global_coupled(
    r: float = 3.9,
    epsilon: float = 0.4,
    lattice_size: int = 100,
    time_steps: int = 100,
    rng: np.random.Generator | None = None,
    initial: NDArray[np.float64] | None = None,
) -> NDArray[np.float64]:
    """Evolve a globally coupled map lattice.

    Returns a ``(time_steps, lattice_size)`` space-time array.
    """
    if time_steps < 1:
        raise ValueError("time_steps must be >= 1")

    state = (
        _initial_lattice(lattice_size, rng)
        if initial is None
        else np.asarray(initial, dtype=np.float64).copy()
    )
    out = np.empty((time_steps, state.size), dtype=np.float64)
    out[0] = state
    for t in range(1, time_steps):
        state = global_step(state, r, epsilon)
        out[t] = state
    return out


def directional_step(
    lattice: NDArray[np.float64], r: float = 3.9, epsilon: float = 0.4
) -> NDArray[np.float64]:
    """One step of one-way (advective) coupling from the left neighbour.

    ``x_i <- (1 - eps) f(x_i) + eps f(x_{i-1})``
    """
    state = np.asarray(lattice, dtype=np.float64)
    f = _logistic(state, r)
    coupled = (1.0 - epsilon) * f + epsilon * np.roll(f, 1)
    return np.clip(coupled, 0.0, 1.0)


def directional(
    r: float = 3.9,
    epsilon: float = 0.4,
    lattice_size: int = 100,
    time_steps: int = 100,
    rng: np.random.Generator | None = None,
    initial: NDArray[np.float64] | None = None,
) -> NDArray[np.float64]:
    """Evolve a directionally coupled map lattice.

    Returns a ``(time_steps, lattice_size)`` space-time array.
    """
    if time_steps < 1:
        raise ValueError("time_steps must be >= 1")

    state = (
        _initial_lattice(lattice_size, rng)
        if initial is None
        else np.asarray(initial, dtype=np.float64).copy()
    )
    out = np.empty((time_steps, state.size), dtype=np.float64)
    out[0] = state
    for t in range(1, time_steps):
        state = directional_step(state, r, epsilon)
        out[t] = state
    return out


def spatial_power_spectrum(lattice: NDArray[np.float64]) -> NDArray[np.float64]:
    """Power spectrum of one lattice snapshot, over non-negative wavenumbers.

    The mean is removed first so the k = 0 bin reflects fluctuation power rather
    than the offset.
    """
    state = np.asarray(lattice, dtype=np.float64)
    spectrum = np.fft.rfft(state - state.mean())
    return np.abs(spectrum) ** 2
