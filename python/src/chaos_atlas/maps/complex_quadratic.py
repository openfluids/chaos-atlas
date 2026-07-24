"""Complex quadratic family z -> z^2 + c.

Varying ``z0`` at fixed ``c`` gives a Julia set; varying ``c`` from ``z0 = 0``
gives the Mandelbrot set.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = ["iterate", "escape_time", "julia_set", "mandelbrot_set", "INTERESTING_JULIA"]

# Points outside |z| = 2 always escape, so this is the standard bailout radius.
ESCAPE_RADIUS = 2.0

INTERESTING_JULIA: dict[str, complex] = {
    "dendrite": complex(0.0, 1.0),
    "douady_rabbit": complex(-0.123, 0.745),
    "san_marco": complex(-0.75, 0.0),
    "siegel_disk": complex(-0.391, -0.587),
    "airplane": complex(-1.7549, 0.0),
}


def iterate(z: complex, c: complex) -> complex:
    """Advance a single state by one step of ``z -> z^2 + c``."""
    return z * z + c


def escape_time(z0: complex, c: complex, max_iterations: int = 100) -> int:
    """Iterations before ``|z|`` exceeds the escape radius.

    Returns ``max_iterations`` for points that never escape, i.e. points taken
    to be in the filled set.
    """
    z = complex(z0)
    for n in range(max_iterations):
        if abs(z) > ESCAPE_RADIUS:
            return n
        z = z * z + c
    return max_iterations


def _escape_grid(
    z: NDArray[np.complex128],
    c: NDArray[np.complex128] | complex,
    max_iterations: int,
) -> NDArray[np.int32]:
    """Vectorised escape-time over a grid, with escaped points frozen."""
    counts = np.full(z.shape, max_iterations, dtype=np.int32)
    active = np.ones(z.shape, dtype=bool)

    for n in range(max_iterations):
        z[active] = z[active] * z[active] + (
            c[active] if isinstance(c, np.ndarray) else c
        )
        escaped = active & (np.abs(z) > ESCAPE_RADIUS)
        counts[escaped] = n
        active &= ~escaped
        if not active.any():
            break

    return counts


def julia_set(
    c: complex = complex(-0.7, 0.27015),
    width: int = 400,
    height: int = 400,
    x_range: tuple[float, float] = (-1.5, 1.5),
    y_range: tuple[float, float] = (-1.5, 1.5),
    max_iterations: int = 100,
) -> NDArray[np.int32]:
    """Escape-time array of shape ``(height, width)`` for a Julia set.

    Row 0 corresponds to the top of ``y_range``, matching image convention.
    """
    xs = np.linspace(x_range[0], x_range[1], width)
    ys = np.linspace(y_range[1], y_range[0], height)
    z = (xs[None, :] + 1j * ys[:, None]).astype(np.complex128)
    return _escape_grid(z, complex(c), max_iterations)


def mandelbrot_set(
    width: int = 400,
    height: int = 400,
    x_range: tuple[float, float] = (-2.5, 1.0),
    y_range: tuple[float, float] = (-1.25, 1.25),
    max_iterations: int = 100,
) -> NDArray[np.int32]:
    """Escape-time array of shape ``(height, width)`` for the Mandelbrot set."""
    xs = np.linspace(x_range[0], x_range[1], width)
    ys = np.linspace(y_range[1], y_range[0], height)
    c = (xs[None, :] + 1j * ys[:, None]).astype(np.complex128)
    z = np.zeros_like(c)
    return _escape_grid(z, c, max_iterations)
