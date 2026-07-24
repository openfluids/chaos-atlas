"""Henon map: (x, y) -> (1 - a x^2 + y, b x).

Classic dissipative 2D map. At a = 1.4, b = 0.3 it has a strange attractor of
correlation dimension ~1.22.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = ["iterate", "trajectory", "attractor", "lyapunov"]


def iterate(x: float, y: float, a: float = 1.4, b: float = 0.3) -> tuple[float, float]:
    """Advance a single state by one step of the Henon map."""
    return 1.0 - a * x * x + y, b * x


def trajectory(
    a: float = 1.4,
    b: float = 0.3,
    x0: float = 0.1,
    y0: float = 0.1,
    iterations: int = 1000,
) -> NDArray[np.float64]:
    """Return the orbit as an ``(iterations, 2)`` array of ``(x, y)`` pairs."""
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty((iterations, 2), dtype=np.float64)
    x, y = float(x0), float(y0)
    for i in range(iterations):
        out[i, 0] = x
        out[i, 1] = y
        x, y = 1.0 - a * x * x + y, b * x
    return out


def attractor(
    a: float = 1.4,
    b: float = 0.3,
    x0: float = 0.1,
    y0: float = 0.1,
    iterations: int = 1000,
    transient: int = 100,
) -> NDArray[np.float64]:
    """Orbit with the transient discarded, so only the attractor is sampled."""
    full = trajectory(a=a, b=b, x0=x0, y0=y0, iterations=iterations + transient)
    return full[transient:]


def lyapunov(
    a: float = 1.4,
    b: float = 0.3,
    x0: float = 0.1,
    y0: float = 0.1,
    iterations: int = 10_000,
    transient: int = 100,
) -> float:
    """Largest Lyapunov exponent, in nats per iteration.

    Evolves a tangent vector under the Jacobian
    ``J = [[-2 a x, 1], [b, 0]]`` and renormalises each step to avoid overflow.
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")

    x, y = float(x0), float(y0)
    for _ in range(transient):
        x, y = 1.0 - a * x * x + y, b * x

    # Tangent vector, kept at unit length by renormalising every step.
    vx, vy = 1.0, 0.0
    total = 0.0
    for _ in range(iterations):
        # J acting on (vx, vy) at the current point
        vx, vy = -2.0 * a * x * vx + vy, b * vx
        norm = np.hypot(vx, vy)
        if norm == 0.0:
            return float("-inf")
        total += np.log(norm)
        vx, vy = vx / norm, vy / norm
        x, y = 1.0 - a * x * x + y, b * x

    return total / iterations
