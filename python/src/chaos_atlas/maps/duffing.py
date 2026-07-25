"""Duffing map, the discrete double-well oscillator.

    x_new = y
    y_new = -b x + a y - y^3

This is the Holmes cubic 2D Duffing map. It is dissipative for ``0 < b < 1``,
with a constant Jacobian determinant equal to ``b`` everywhere (see
``lyapunov`` below), which is the quickest way to sanity-check any change to
the recurrence: a broken transcription of x and y shows up immediately as a
Jacobian determinant that varies with position instead of being pinned to
``b``.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = ["iterate", "trajectory", "attractor", "lyapunov", "fixed_points"]

DEFAULT_A = 2.75
DEFAULT_B = 0.2


def iterate(
    x: float, y: float, a: float = DEFAULT_A, b: float = DEFAULT_B
) -> tuple[float, float]:
    """Advance a single state by one step of the Duffing map."""
    return y, -b * x + a * y - y * y * y


def trajectory(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
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
        x, y = y, -b * x + a * y - y * y * y
    return out


def attractor(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    x0: float = 0.1,
    y0: float = 0.1,
    iterations: int = 1000,
    transient: int = 100,
) -> NDArray[np.float64]:
    """Orbit with the transient discarded."""
    full = trajectory(a=a, b=b, x0=x0, y0=y0, iterations=iterations + transient)
    return full[transient:]


def fixed_points(a: float = DEFAULT_A, b: float = DEFAULT_B) -> NDArray[np.float64]:
    """Fixed points of the map, as an ``(n, 2)`` array.

    A fixed point needs ``x_new = x``, i.e. ``y = x``, and then
    ``y_new = y`` becomes ``-b y + a y - y^3 = y``, i.e.
    ``y (y^2 + b + 1 - a) = 0``, so the origin is always fixed and a
    symmetric pair exists when ``a > b + 1``.
    """
    points = [(0.0, 0.0)]
    discriminant = a - b - 1.0
    if discriminant > 0.0:
        root = float(np.sqrt(discriminant))
        points.append((root, root))
        points.append((-root, -root))
    return np.asarray(points, dtype=np.float64)


def lyapunov(
    a: float = DEFAULT_A,
    b: float = DEFAULT_B,
    x0: float = 0.1,
    y0: float = 0.1,
    iterations: int = 10_000,
    transient: int = 100,
) -> float:
    """Largest Lyapunov exponent, in nats per iteration.

    Jacobian ``[[0, 1], [-b, a - 3y^2]]``, whose determinant is the constant
    ``b`` (dissipation is uniform, unlike the ``a - 3x^2`` term which varies
    with position).
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")

    x, y = float(x0), float(y0)
    for _ in range(transient):
        x, y = y, -b * x + a * y - y * y * y

    vx, vy = 1.0, 0.0
    total = 0.0
    for _ in range(iterations):
        j22 = a - 3.0 * y * y
        vx, vy = vy, -b * vx + j22 * vy

        norm = np.hypot(vx, vy)
        if not np.isfinite(norm):
            return float("inf")
        if norm == 0.0:
            return float("-inf")
        total += np.log(norm)
        vx, vy = vx / norm, vy / norm

        x, y = y, -b * x + a * y - y * y * y

    return total / iterations
