"""Baker's map on the unit square.

    x_new = 2x mod 1
    y_new = y/2        if x < 1/2
            (y + 1)/2  otherwise

Area preserving, uniformly hyperbolic, and conjugate to a full shift on two
symbols. Its Kolmogorov-Sinai entropy is exactly log 2.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = [
    "iterate",
    "trajectory",
    "symbolic_dynamics",
    "topological_entropy",
    "ks_entropy",
    "lyapunov",
]


def iterate(x: float, y: float) -> tuple[float, float]:
    """Advance a single state by one step of the baker's map."""
    new_x = (2.0 * x) % 1.0
    new_y = y / 2.0 if x < 0.5 else (y + 1.0) / 2.0
    return new_x, new_y


def trajectory(x0: float = 0.1, y0: float = 0.1, iterations: int = 100) -> NDArray[np.float64]:
    """Return the orbit as an ``(iterations, 2)`` array of ``(x, y)`` pairs."""
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty((iterations, 2), dtype=np.float64)
    x, y = float(x0) % 1.0, float(y0) % 1.0
    for i in range(iterations):
        out[i, 0] = x
        out[i, 1] = y
        x, y = (2.0 * x) % 1.0, (y / 2.0 if x < 0.5 else (y + 1.0) / 2.0)
    return out


def symbolic_dynamics(x0: float = 0.1, iterations: int = 100) -> str:
    """Itinerary as a binary string, which is the binary expansion of ``x0``.

    ``"0"`` while the point is in the left half, ``"1"`` in the right half.
    """
    symbols = []
    x = float(x0) % 1.0
    for _ in range(iterations):
        symbols.append("0" if x < 0.5 else "1")
        x = (2.0 * x) % 1.0
    return "".join(symbols)


def topological_entropy() -> float:
    """Topological entropy, exactly ``log 2``."""
    return float(np.log(2.0))


def ks_entropy() -> float:
    """Kolmogorov-Sinai entropy, exactly ``log 2``.

    Equal to the topological entropy here because the invariant measure is
    Lebesgue, and equal to the positive Lyapunov exponent by Pesin's identity.
    """
    return float(np.log(2.0))


def lyapunov() -> float:
    """Largest Lyapunov exponent, exactly ``log 2``.

    The map stretches by a factor 2 in x everywhere, so the exponent is exact
    and independent of the orbit.
    """
    return float(np.log(2.0))
