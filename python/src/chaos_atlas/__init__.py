"""Chaos Atlas: iterated maps, coupled map lattices, and Lyapunov exponents.

Every map lives in its own module under :mod:`chaos_atlas.maps` and shares the
same surface, so switching systems is a one-word change::

    from chaos_atlas.maps import logistic, henon

    orbit = logistic.trajectory(r=3.9, iterations=1000)
    exponent = logistic.lyapunov(r=3.9)

    points = henon.attractor(a=1.4, b=0.3, iterations=10_000)

Coupled map lattices live in :mod:`chaos_atlas.cml`::

    from chaos_atlas import cml

    spacetime = cml.diffusive(r=3.9, epsilon=0.4, lattice_size=128, time_steps=256)

All array returns are NumPy arrays. Trajectories of 2D maps are ``(N, 2)``.
"""

from __future__ import annotations

from . import cml, maps
from .maps import (
    arnold,
    bakers,
    complex_quadratic,
    duffing,
    henon,
    ikeda,
    logistic,
    standard,
    tent,
    tinkerbell,
)

__version__ = "0.2.0"

__all__ = [
    "__version__",
    "cml",
    "maps",
    "arnold",
    "bakers",
    "complex_quadratic",
    "duffing",
    "henon",
    "ikeda",
    "logistic",
    "standard",
    "tent",
    "tinkerbell",
]
