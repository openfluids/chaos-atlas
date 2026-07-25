"""Full Lyapunov spectrum for 2D maps, via QR-style tangent propagation.

Each per-map ``lyapunov`` function elsewhere in this package tracks a single
tangent vector and only ever recovers the largest exponent. Getting the full
spectrum out of a 2D map means propagating *two* tangent vectors and
re-orthonormalising them every step with Gram-Schmidt (this is the "QR"
step of the standard Benettin algorithm) rather than just renormalising each
vector independently. Skipping the orthogonalisation lets both vectors align
with the dominant expanding direction, so the second exponent silently comes
back equal to the first instead of the (usually contracting) sub-dominant
one.
"""

from __future__ import annotations

from typing import Callable

import numpy as np
from numpy.typing import NDArray

__all__ = ["spectrum"]

IterateFn = Callable[[float, float], tuple[float, float]]
JacobianFn = Callable[[float, float], NDArray[np.float64]]


def spectrum(
    iterate: IterateFn,
    jacobian: JacobianFn,
    state: tuple[float, float],
    iterations: int = 10_000,
    transient: int = 100,
) -> tuple[float, float]:
    """Full Lyapunov spectrum ``(lambda1, lambda2)`` of a 2D map, in nats.

    ``iterate(x, y) -> (x, y)`` advances the state by one step; ``jacobian(x,
    y) -> 2x2 array`` gives the Jacobian of ``iterate`` there. ``state`` is
    the initial condition, ``transient`` steps are discarded before
    accumulating, and the running orthonormal basis is re-derived by
    Gram-Schmidt every step so the two exponents stay distinct.

    ``lambda1 + lambda2`` should equal the time-average of ``log|det J|``
    along the orbit; that identity is the standard cross-check that the
    orthogonalisation (not just per-vector renormalisation) is actually
    happening.
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")
    if transient < 0:
        raise ValueError("transient must be >= 0")

    x, y = float(state[0]), float(state[1])
    for _ in range(transient):
        x, y = iterate(x, y)

    # Orthonormal tangent basis, updated by Gram-Schmidt every step.
    v1 = np.array([1.0, 0.0])
    v2 = np.array([0.0, 1.0])

    total1 = 0.0
    total2 = 0.0
    for _ in range(iterations):
        j = jacobian(x, y)

        w1 = j @ v1
        w2 = j @ v2

        n1 = float(np.linalg.norm(w1))
        if not np.isfinite(n1) or n1 == 0.0:
            return (float("inf") if not np.isfinite(n1) else float("-inf"), float("nan"))
        u1 = w1 / n1

        # Gram-Schmidt: strip the component of w2 along u1 before normalising.
        w2 = w2 - np.dot(w2, u1) * u1
        n2 = float(np.linalg.norm(w2))
        if not np.isfinite(n2) or n2 == 0.0:
            return (
                total1 / iterations,
                float("inf") if not np.isfinite(n2) else float("-inf"),
            )
        u2 = w2 / n2

        total1 += np.log(n1)
        total2 += np.log(n2)

        v1, v2 = u1, u2
        x, y = iterate(x, y)

    return total1 / iterations, total2 / iterations
