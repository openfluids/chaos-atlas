"""Chirikov standard map on the torus.

    p_new     = p + K sin(theta)   mod 2 pi
    theta_new = theta + p_new      mod 2 pi

Area preserving. The last KAM torus breaks at K ~= 0.971635, above which
global chaotic transport sets in.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

__all__ = ["iterate", "trajectory", "phase_space", "lyapunov", "CRITICAL_K"]

TWO_PI = 2.0 * np.pi

# Greene's critical parameter: the golden-mean KAM torus is destroyed here.
CRITICAL_K = 0.971635


def iterate(theta: float, p: float, k: float) -> tuple[float, float]:
    """Advance a single state by one step of the standard map."""
    new_p = (p + k * np.sin(theta)) % TWO_PI
    new_theta = (theta + new_p) % TWO_PI
    return new_theta, new_p


def trajectory(
    k: float,
    theta0: float = 0.1,
    p0: float = 0.1,
    iterations: int = 1000,
) -> NDArray[np.float64]:
    """Return the orbit as an ``(iterations + 1, 2)`` array of ``(theta, p)``.

    The initial condition is included, matching the convention that a
    trajectory of ``n`` iterations visits ``n + 1`` states.
    """
    if iterations < 0:
        raise ValueError("iterations must be non-negative")

    out = np.empty((iterations + 1, 2), dtype=np.float64)
    theta, p = float(theta0) % TWO_PI, float(p0) % TWO_PI
    out[0, 0], out[0, 1] = theta, p
    for i in range(1, iterations + 1):
        p = (p + k * np.sin(theta)) % TWO_PI
        theta = (theta + p) % TWO_PI
        out[i, 0], out[i, 1] = theta, p
    return out


def phase_space(
    k: float,
    n_trajectories: int = 20,
    iterations: int = 500,
) -> list[NDArray[np.float64]]:
    """Orbits from a spread of initial conditions, for a phase portrait.

    Initial points are laid on a line in ``p`` at fixed ``theta``, which is the
    usual way to expose the island chains and the surrounding chaotic sea.
    """
    if n_trajectories < 1:
        raise ValueError("n_trajectories must be >= 1")

    p_values = np.linspace(0.0, TWO_PI, n_trajectories, endpoint=False)
    return [
        trajectory(k=k, theta0=np.pi, p0=float(p0), iterations=iterations)
        for p0 in p_values
    ]


def lyapunov(
    k: float,
    theta0: float = 0.1,
    p0: float = 0.1,
    iterations: int = 10_000,
    transient: int = 100,
) -> float:
    """Largest Lyapunov exponent, in nats per iteration.

    Jacobian ``[[1 + K cos(theta), 1], [K cos(theta), 1]]``, which has unit
    determinant as area preservation requires.
    """
    if iterations < 1:
        raise ValueError("iterations must be >= 1")

    theta, p = float(theta0) % TWO_PI, float(p0) % TWO_PI
    for _ in range(transient):
        theta, p = iterate(theta, p, k)

    vx, vy = 1.0, 0.0
    total = 0.0
    for _ in range(iterations):
        kc = k * np.cos(theta)
        # (dtheta, dp) under the Jacobian
        d_p = kc * vx + vy
        d_theta = vx + d_p
        vx, vy = d_theta, d_p

        norm = np.hypot(vx, vy)
        if norm == 0.0:
            return float("-inf")
        total += np.log(norm)
        vx, vy = vx / norm, vy / norm

        theta, p = iterate(theta, p, k)

    return total / iterations
