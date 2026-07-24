"""Tinkerbell map.

    x_new = x^2 - y^2 + a x + b y
    y_new = 2 x y + c x + d y
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = ["iterate", "trajectory", "attractor", "lyapunov"]

DEFAULT_A = 0.9
DEFAULT_B = -0.6013
DEFAULT_C = 2.0
DEFAULT_D = 0.50


def iterate(
    x: float,
    y: float,
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    c: float = DEFAULT_C,
    d: float = DEFAULT_D,
) -> tuple[float, float]:
    """Advance a single state by one step of the Tinkerbell map."""
    return x * x - y * y + a * x + b * y, 2.0 * x * y + c * x + d * y


def trajectory(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    c: float = DEFAULT_C,
    d: float = DEFAULT_D,
    x0: float = -0.72,
    y0: float = -0.64,
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
        x, y = x * x - y * y + a * x + b * y, 2.0 * x * y + c * x + d * y
    return out


def attractor(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    c: float = DEFAULT_C,
    d: float = DEFAULT_D,
    x0: float = -0.72,
    y0: float = -0.64,
    iterations: int = 1000,
    transient: int = 100,
) -> NDArray[np.float64]:
    """Orbit with the transient discarded."""
    full = trajectory(
        a=a, b=b, c=c, d=d, x0=x0, y0=y0, iterations=iterations + transient
    )
    return full[transient:]


def lyapunov(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    c: float = DEFAULT_C,
    d: float = DEFAULT_D,
    x0: float = -0.72,
    y0: float = -0.64,
    iterations: int = 10_000,
    transient: int = 100,
) -> float:
    """Largest Lyapunov exponent, in nats per iteration.

    Jacobian ``[[2x + a, -2y + b], [2y + c, 2x + d]]``.
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")

    x, y = float(x0), float(y0)
    for _ in range(transient):
        x, y = iterate(x, y, a, b, c, d)

    vx, vy = 1.0, 0.0
    total = 0.0
    for _ in range(iterations):
        j11 = 2.0 * x + a
        j12 = -2.0 * y + b
        j21 = 2.0 * y + c
        j22 = 2.0 * x + d

        vx, vy = j11 * vx + j12 * vy, j21 * vx + j22 * vy
        norm = np.hypot(vx, vy)
        if not np.isfinite(norm) or norm == 0.0:
            return float("-inf") if norm == 0.0 else float("inf")
        total += np.log(norm)
        vx, vy = vx / norm, vy / norm

        x, y = x * x - y * y + a * x + b * y, 2.0 * x * y + c * x + d * y

    return total / iterations
