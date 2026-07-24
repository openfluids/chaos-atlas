"""Logistic map: x -> r x (1 - x).

The canonical route to chaos by period doubling. Chaotic for most r above the
Feigenbaum point r_inf ~= 3.5699.
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
]


def iterate(x: float, r: float = 3.9) -> float:
    """Advance a single state by one step of the logistic map."""
    return r * x * (1.0 - x)


def trajectory(r: float = 3.9, x0: float = 0.5, iterations: int = 100) -> NDArray[np.float64]:
    """Return the orbit of ``x0``, including ``x0`` itself.

    The returned array has length ``iterations``.
    """
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty(iterations, dtype=np.float64)
    x = float(x0)
    for i in range(iterations):
        out[i] = x
        x = r * x * (1.0 - x)
    return out


def cobweb(r: float = 3.9, x0: float = 0.5, iterations: int = 100) -> NDArray[np.float64]:
    """Return ``(iterations, 2)`` pairs ``(x_n, x_{n+1})`` for a cobweb plot."""
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty((iterations, 2), dtype=np.float64)
    x = float(x0)
    for i in range(iterations):
        y = r * x * (1.0 - x)
        out[i, 0] = x
        out[i, 1] = y
        x = y
    return out


def bifurcation(
    r_min: float = 2.5,
    r_max: float = 4.0,
    r_steps: int = 500,
    transient: int = 100,
    iterations: int = 100,
    x0: float = 0.5,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Sample the attractor over a range of ``r``.

    Returns ``(r_values, x_values)``, both flat arrays of the same length, so
    they can be handed straight to a scatter plot.

    The transient is discarded per ``r`` so only the attractor is sampled.
    """
    if r_steps < 1:
        raise ValueError("r_steps must be >= 1")

    r_grid = np.linspace(r_min, r_max, r_steps)
    # Vectorised across r: every column is an independent orbit.
    x = np.full(r_steps, float(x0), dtype=np.float64)
    for _ in range(transient):
        x = r_grid * x * (1.0 - x)

    xs = np.empty((iterations, r_steps), dtype=np.float64)
    for i in range(iterations):
        x = r_grid * x * (1.0 - x)
        xs[i] = x

    r_out = np.tile(r_grid, iterations)
    return r_out, xs.ravel()


def lyapunov(
    r: float = 3.9,
    x0: float = 0.5,
    iterations: int = 1000,
    transient: int = 100,
) -> float:
    """Largest Lyapunov exponent, in nats per iteration.

    Uses the exact derivative f'(x) = r (1 - 2x). Positive values indicate
    sensitive dependence on initial conditions.

    Beware preperiodic initial conditions. The exponent describes the orbit you
    actually start, and a few special ``x0`` values fall onto a fixed point
    instead of the attractor. The default ``x0 = 0.5`` is one of them at r = 4:
    it maps to 1.0, then to 0, and stays there, so the result is log 4 rather
    than the log 2 of the chaotic attractor. Pass a generic ``x0`` such as 0.2
    when you want the attractor's exponent::

        logistic.lyapunov(r=4.0)           # 1.3863 = log 4, the orbit at x = 0
        logistic.lyapunov(r=4.0, x0=0.2)   # 0.6931 = log 2, the attractor
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")

    x = float(x0)
    for _ in range(transient):
        x = r * x * (1.0 - x)

    total = 0.0
    counted = 0
    for _ in range(iterations):
        derivative = abs(r * (1.0 - 2.0 * x))
        # The orbit can land exactly on the critical point x = 1/2, where the
        # derivative vanishes and log diverges. Skip that sample rather than
        # returning -inf for the whole exponent.
        if derivative > 0.0:
            total += np.log(derivative)
            counted += 1
        x = r * x * (1.0 - x)

    if counted == 0:
        return float("-inf")
    return total / counted
