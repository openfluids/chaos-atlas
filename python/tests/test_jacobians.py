"""Validate every hand-derived Jacobian against central finite differences.

The Lyapunov routines evolve a tangent vector under an analytic Jacobian. A sign
slip there does not crash or produce NaNs, it just yields a confidently wrong
exponent, so each Jacobian is checked against the map it claims to differentiate.
"""

from __future__ import annotations

import numpy as np
import pytest

from chaos_atlas.maps import duffing, henon, ikeda, standard, tinkerbell

H = 1e-6
TOL = 1e-6


def numeric_jacobian(step, x: float, y: float) -> np.ndarray:
    """Central-difference Jacobian of a two-component map."""
    fx_plus = np.asarray(step(x + H, y), dtype=float)
    fx_minus = np.asarray(step(x - H, y), dtype=float)
    fy_plus = np.asarray(step(x, y + H), dtype=float)
    fy_minus = np.asarray(step(x, y - H), dtype=float)
    return np.column_stack(
        [(fx_plus - fx_minus) / (2.0 * H), (fy_plus - fy_minus) / (2.0 * H)]
    )


def henon_jacobian(x: float, y: float, a: float, b: float) -> np.ndarray:
    return np.array([[-2.0 * a * x, 1.0], [b, 0.0]])


def duffing_jacobian(x: float, y: float, a: float, b: float) -> np.ndarray:
    return np.array([[0.0, 1.0], [a - 3.0 * x * x, -b]])


def tinkerbell_jacobian(x, y, a, b, c, d) -> np.ndarray:
    return np.array([[2.0 * x + a, -2.0 * y + b], [2.0 * y + c, 2.0 * x + d]])


def ikeda_jacobian(x, y, a, b, c, d) -> np.ndarray:
    denom = 1.0 + x * x + y * y
    t = c - d / denom
    ct, st = np.cos(t), np.sin(t)
    dt_dx = 2.0 * d * x / (denom * denom)
    dt_dy = 2.0 * d * y / (denom * denom)
    u = x * ct - y * st
    v = x * st + y * ct
    return np.array(
        [
            [a * (ct - v * dt_dx), a * (-st - v * dt_dy)],
            [b * (st + u * dt_dx), b * (ct + u * dt_dy)],
        ]
    )


def standard_jacobian(theta: float, p: float, k: float) -> np.ndarray:
    kc = k * np.cos(theta)
    return np.array([[1.0 + kc, 1.0], [kc, 1.0]])


@pytest.fixture
def points():
    rng = np.random.default_rng(20260725)
    return rng.uniform(-1.5, 1.5, size=(100, 2))


def test_henon_jacobian(points):
    for x, y in points:
        expected = numeric_jacobian(lambda a_, b_: henon.iterate(a_, b_, 1.4, 0.3), x, y)
        assert henon_jacobian(x, y, 1.4, 0.3) == pytest.approx(expected, abs=TOL)


def test_duffing_jacobian(points):
    for x, y in points:
        expected = numeric_jacobian(
            lambda a_, b_: duffing.iterate(a_, b_, 2.75, 0.2), x, y
        )
        assert duffing_jacobian(x, y, 2.75, 0.2) == pytest.approx(expected, abs=1e-5)


def test_tinkerbell_jacobian(points):
    a, b, c, d = 0.9, -0.6013, 2.0, 0.5
    for x, y in points:
        expected = numeric_jacobian(
            lambda x_, y_: tinkerbell.iterate(x_, y_, a, b, c, d), x, y
        )
        assert tinkerbell_jacobian(x, y, a, b, c, d) == pytest.approx(expected, abs=TOL)


def test_ikeda_jacobian(points):
    a, b, c, d = 0.9, 0.9, 0.4, 6.0
    for x, y in points:
        expected = numeric_jacobian(
            lambda x_, y_: ikeda.iterate(x_, y_, a, b, c, d), x, y
        )
        assert ikeda_jacobian(x, y, a, b, c, d) == pytest.approx(expected, abs=1e-5)


def test_standard_jacobian(points):
    k = 1.5
    for theta, p in points:
        theta_w, p_w = theta % (2 * np.pi), p % (2 * np.pi)
        # Stay away from the mod-2pi seam, where the wrapped map is discontinuous
        # and a finite difference straddles the branch cut.
        if min(theta_w, p_w) < 0.1 or max(theta_w, p_w) > 2 * np.pi - 0.1:
            continue
        expected = numeric_jacobian(
            lambda t_, p_: standard.iterate(t_, p_, k), theta_w, p_w
        )
        assert standard_jacobian(theta_w, p_w, k) == pytest.approx(expected, abs=1e-5)


def test_standard_jacobian_is_area_preserving():
    # Determinant must be exactly 1 for a symplectic map.
    for theta in np.linspace(0.0, 2.0 * np.pi, 50):
        assert np.linalg.det(standard_jacobian(float(theta), 0.0, 2.5)) == pytest.approx(
            1.0
        )


def test_henon_jacobian_determinant_is_minus_b():
    # det J = -b for the Henon map, independent of position.
    for x in np.linspace(-1.5, 1.5, 25):
        assert np.linalg.det(henon_jacobian(float(x), 0.0, 1.4, 0.3)) == pytest.approx(
            -0.3
        )
