"""Ikeda map, a model of a laser pulse in a nonlinear optical cavity.

    t     = c - d / (1 + x^2 + y^2)
    x_new = 1 + a (x cos t - y sin t)
    y_new =     b (x sin t + y cos t)
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = ["iterate", "trajectory", "attractor", "lyapunov"]

# Standard chaotic parameter set. In the usual form of the map there is a single
# dissipation parameter u appearing in both components, so a and b are equal.
DEFAULT_A = 0.9
DEFAULT_B = 0.9
DEFAULT_C = 0.4
DEFAULT_D = 6.0


def iterate(
    x: float,
    y: float,
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    c: float = DEFAULT_C,
    d: float = DEFAULT_D,
) -> tuple[float, float]:
    """Advance a single state by one step of the Ikeda map."""
    t = c - d / (1.0 + x * x + y * y)
    cos_t, sin_t = np.cos(t), np.sin(t)
    return 1.0 + a * (x * cos_t - y * sin_t), b * (x * sin_t + y * cos_t)


def trajectory(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    c: float = DEFAULT_C,
    d: float = DEFAULT_D,
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
        t = c - d / (1.0 + x * x + y * y)
        cos_t, sin_t = np.cos(t), np.sin(t)
        x, y = 1.0 + a * (x * cos_t - y * sin_t), b * (x * sin_t + y * cos_t)
    return out


def attractor(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    c: float = DEFAULT_C,
    d: float = DEFAULT_D,
    x0: float = 0.1,
    y0: float = 0.1,
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
    x0: float = 0.1,
    y0: float = 0.1,
    iterations: int = 10_000,
    transient: int = 100,
) -> float:
    """Largest Lyapunov exponent, in nats per iteration.

    The Jacobian is built by differentiating the rotation together with the
    state-dependent phase ``t``, whose derivatives are
    ``dt/dx = 2 d x / (1 + x^2 + y^2)^2`` and likewise for ``y``.
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")

    x, y = float(x0), float(y0)
    for _ in range(transient):
        x, y = iterate(x, y, a, b, c, d)

    vx, vy = 1.0, 0.0
    total = 0.0
    for _ in range(iterations):
        denom = 1.0 + x * x + y * y
        t = c - d / denom
        cos_t, sin_t = np.cos(t), np.sin(t)
        dt_dx = 2.0 * d * x / (denom * denom)
        dt_dy = 2.0 * d * y / (denom * denom)

        u = x * cos_t - y * sin_t
        v = x * sin_t + y * cos_t

        # d(x_new)/dx, d(x_new)/dy ; d(y_new)/dx, d(y_new)/dy
        j11 = a * (cos_t - v * dt_dx)
        j12 = a * (-sin_t - v * dt_dy)
        j21 = b * (sin_t + u * dt_dx)
        j22 = b * (cos_t + u * dt_dy)

        vx, vy = j11 * vx + j12 * vy, j21 * vx + j22 * vy
        norm = np.hypot(vx, vy)
        if norm == 0.0:
            return float("-inf")
        total += np.log(norm)
        vx, vy = vx / norm, vy / norm

        x, y = 1.0 + a * u, b * v

    return total / iterations
