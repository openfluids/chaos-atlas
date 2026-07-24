"""Iterated maps.

Each module exposes a consistent surface: ``iterate`` for one step,
``trajectory`` for an orbit, and where meaningful ``attractor``, ``bifurcation``
and ``lyapunov``.
"""

from __future__ import annotations

from . import (
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

__all__ = [
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
