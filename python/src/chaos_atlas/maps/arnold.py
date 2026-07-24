"""Arnold's cat map on the unit torus.

    (x, y) -> (x + y, x + 2y)  mod 1

Area preserving (det = 1) and hyperbolic, with eigenvalues (3 +/- sqrt 5) / 2.
On an N x N integer grid the map is a permutation, so it returns to the identity
after a finite Poincare recurrence time.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = [
    "iterate",
    "trajectory",
    "eigenvalues",
    "lyapunov",
    "recurrence_period",
    "scramble_grid",
]

# The map matrix [[1, 1], [1, 2]].
MATRIX = np.array([[1, 1], [1, 2]], dtype=np.int64)


def iterate(x: float, y: float) -> tuple[float, float]:
    """Advance a single state by one step of the cat map."""
    return (x + y) % 1.0, (x + 2.0 * y) % 1.0


def trajectory(x0: float = 0.1, y0: float = 0.1, iterations: int = 100) -> NDArray[np.float64]:
    """Return the orbit as an ``(iterations, 2)`` array of ``(x, y)`` pairs."""
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty((iterations, 2), dtype=np.float64)
    x, y = float(x0) % 1.0, float(y0) % 1.0
    for i in range(iterations):
        out[i, 0] = x
        out[i, 1] = y
        x, y = (x + y) % 1.0, (x + 2.0 * y) % 1.0
    return out


def eigenvalues() -> tuple[float, float]:
    """The two eigenvalues ``(3 + sqrt 5)/2`` and ``(3 - sqrt 5)/2``.

    Their product is 1, which is the area-preservation statement.
    """
    root5 = float(np.sqrt(5.0))
    return (3.0 + root5) / 2.0, (3.0 - root5) / 2.0


def lyapunov() -> float:
    """Largest Lyapunov exponent, ``log((3 + sqrt 5) / 2)``.

    The map is linear, so the exponent is exact and independent of the orbit.
    """
    return float(np.log(eigenvalues()[0]))


def recurrence_period(n: int) -> int:
    """Number of iterations after which an ``n x n`` integer grid returns to itself.

    The cat map permutes the ``n^2`` lattice sites, so some finite power of the
    matrix is the identity modulo ``n``.
    """
    if n < 1:
        raise ValueError("n must be >= 1")
    if n == 1:
        return 1

    identity = np.eye(2, dtype=np.int64)
    power = MATRIX % n
    period = 1
    # The period is bounded by 3n, a standard bound for this map.
    while not np.array_equal(power, identity):
        power = (power @ MATRIX) % n
        period += 1
        if period > 3 * n + 1:
            raise RuntimeError(f"no recurrence found for n={n}")
    return period


def scramble_grid(grid: NDArray, iterations: int = 1) -> NDArray:
    """Apply the cat map ``iterations`` times to a square 2D array.

    Used for the classic image-scrambling demonstration: repeated application
    shreds the image, and at ``recurrence_period(n)`` it reappears intact.
    """
    array = np.asarray(grid)
    if array.ndim < 2 or array.shape[0] != array.shape[1]:
        raise ValueError("grid must be square")

    n = array.shape[0]
    rows, cols = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")

    out = array
    for _ in range(iterations):
        new_rows = (rows + cols) % n
        new_cols = (rows + 2 * cols) % n
        moved = np.empty_like(out)
        moved[new_rows, new_cols] = out[rows, cols]
        out = moved
    return out
