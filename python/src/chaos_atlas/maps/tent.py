"""Tent map: x -> a x for x < 1/2, else a (1 - x).

Piecewise linear, so the Lyapunov exponent is exactly log(a) wherever the orbit
stays in the unit interval.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = [
    "iterate",
    "trajectory",
    "cobweb",
    "bifurcation",
    "lyapunov",
    "symbolic_dynamics",
]


def iterate(x: float, alpha: float = 1.8) -> float:
    """Advance a single state by one step of the tent map."""
    return alpha * x if x < 0.5 else alpha * (1.0 - x)


def trajectory(alpha: float = 1.8, x0: float = 0.4, iterations: int = 100) -> NDArray[np.float64]:
    """Return the orbit of ``x0``, including ``x0`` itself."""
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty(iterations, dtype=np.float64)
    x = float(x0)
    for i in range(iterations):
        out[i] = x
        x = alpha * x if x < 0.5 else alpha * (1.0 - x)
    return out


def cobweb(alpha: float = 1.8, x0: float = 0.4, iterations: int = 50) -> NDArray[np.float64]:
    """Return ``(iterations, 2)`` pairs ``(x_n, x_{n+1})`` for a cobweb plot."""
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty((iterations, 2), dtype=np.float64)
    x = float(x0)
    for i in range(iterations):
        y = alpha * x if x < 0.5 else alpha * (1.0 - x)
        out[i, 0] = x
        out[i, 1] = y
        x = y
    return out


def bifurcation(
    alpha_min: float = 1.0,
    alpha_max: float = 2.0,
    alpha_steps: int = 500,
    transient: int = 100,
    iterations: int = 100,
    x0: float = 0.4,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Sample the attractor over a range of ``alpha``.

    Returns ``(alpha_values, x_values)`` as flat, equal-length arrays.
    """
    if alpha_steps < 1:
        raise ValueError("alpha_steps must be >= 1")

    grid = np.linspace(alpha_min, alpha_max, alpha_steps)
    x = np.full(alpha_steps, float(x0), dtype=np.float64)

    def step(state: NDArray[np.float64]) -> NDArray[np.float64]:
        return np.where(state < 0.5, grid * state, grid * (1.0 - state))

    for _ in range(transient):
        x = step(x)

    xs = np.empty((iterations, alpha_steps), dtype=np.float64)
    for i in range(iterations):
        x = step(x)
        xs[i] = x

    return np.tile(grid, iterations), xs.ravel()


def lyapunov(
    alpha: float = 1.8,
    x0: float = 0.4,
    iterations: int = 1000,
    transient: int = 100,
) -> float:
    """Largest Lyapunov exponent, in nats per iteration.

    The map is piecewise linear with slope +/- alpha everywhere, so for orbits
    that remain bounded this converges to exactly ``log(alpha)``.
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")
    if alpha <= 0.0:
        raise ValueError("alpha must be positive")

    x = float(x0)
    for _ in range(transient):
        x = alpha * x if x < 0.5 else alpha * (1.0 - x)

    total = 0.0
    for _ in range(iterations):
        total += np.log(alpha)
        x = alpha * x if x < 0.5 else alpha * (1.0 - x)

    return total / iterations


def symbolic_dynamics(
    alpha: float = 1.8, x0: float = 0.4, iterations: int = 100
) -> str:
    """Itinerary of the orbit as a binary string.

    ``"0"`` when the orbit is on the left branch (x < 1/2), ``"1"`` on the right.
    """
    orbit = trajectory(alpha=alpha, x0=x0, iterations=iterations)
    return "".join("0" if value < 0.5 else "1" for value in orbit)
