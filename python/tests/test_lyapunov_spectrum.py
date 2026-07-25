"""Cross-check the full Lyapunov spectrum against the conservation identity.

For any 2D map, the sum of the two Lyapunov exponents must equal the time
average of ``log|det J|`` along the orbit -- volumes contract or expand at
exactly the rate the Jacobian determinant says they do, and nothing else. A
QR/Gram-Schmidt step that has been skipped or botched (e.g. renormalising the
two tangent vectors independently instead of orthonormalising them together)
lets both vectors collapse onto the dominant direction; the sum of the two
"exponents" it reports then drifts away from this identity even though each
individual exponent can look plausible on its own. That makes the identity
the most sensitive test in this file.
"""

from __future__ import annotations

import numpy as np
import pytest

from chaos_atlas.lyapunov import spectrum
from chaos_atlas.maps import duffing, henon, ikeda, standard, tinkerbell

SEED = 20260725


def henon_jacobian(x: float, y: float, a: float = 1.4, b: float = 0.3) -> np.ndarray:
    return np.array([[-2.0 * a * x, 1.0], [b, 0.0]])


def duffing_jacobian(x: float, y: float, a: float = 2.75, b: float = 0.2) -> np.ndarray:
    return np.array([[0.0, 1.0], [-b, a - 3.0 * y * y]])


def tinkerbell_jacobian(
    x: float,
    y: float,
    a: float = 0.9,
    b: float = -0.6013,
    c: float = 2.0,
    d: float = 0.5,
) -> np.ndarray:
    return np.array([[2.0 * x + a, -2.0 * y + b], [2.0 * y + c, 2.0 * x + d]])


def ikeda_jacobian(
    x: float, y: float, a: float = 0.9, b: float = 0.9, c: float = 0.4, d: float = 6.0
) -> np.ndarray:
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


def mean_log_abs_det(iterate, jacobian, state, iterations, transient):
    """Time average of log|det J| along the orbit ``spectrum`` actually took."""
    x, y = state
    for _ in range(transient):
        x, y = iterate(x, y)

    total = 0.0
    for _ in range(iterations):
        total += np.log(np.abs(np.linalg.det(jacobian(x, y))))
        x, y = iterate(x, y)
    return total / iterations


CASES = {
    "henon": (
        lambda x, y: henon.iterate(x, y),
        henon_jacobian,
        (0.1, 0.1),
    ),
    "ikeda": (
        lambda x, y: ikeda.iterate(x, y),
        ikeda_jacobian,
        (0.1, 0.1),
    ),
    "duffing": (
        lambda x, y: duffing.iterate(x, y),
        duffing_jacobian,
        (0.1, 0.1),
    ),
    "tinkerbell": (
        lambda x, y: tinkerbell.iterate(x, y),
        tinkerbell_jacobian,
        (-0.72, -0.64),
    ),
    "standard": (
        lambda theta, p: standard.iterate(theta, p, k=1.5),
        lambda theta, p: standard_jacobian(theta, p, k=1.5),
        (0.1, 0.1),
    ),
}


@pytest.mark.parametrize("name", sorted(CASES))
def test_conservation_identity_lambda1_plus_lambda2(name):
    iterate, jacobian, state = CASES[name]
    iterations, transient = 20_000, 200

    lambda1, lambda2 = spectrum(
        iterate, jacobian, state, iterations=iterations, transient=transient
    )
    expected = mean_log_abs_det(iterate, jacobian, state, iterations, transient)

    assert lambda1 + lambda2 == pytest.approx(expected, abs=1e-3)


def test_henon_determinant_is_minus_b_everywhere():
    for x in np.linspace(-1.5, 1.5, 25):
        assert np.linalg.det(henon_jacobian(float(x), 0.0)) == pytest.approx(-0.3)


def test_duffing_determinant_is_b_everywhere():
    for y in np.linspace(-1.5, 1.5, 25):
        assert np.linalg.det(duffing_jacobian(0.0, float(y))) == pytest.approx(0.2)


def test_standard_map_determinant_is_one_everywhere():
    for theta in np.linspace(0.0, 2.0 * np.pi, 25):
        assert np.linalg.det(
            standard_jacobian(float(theta), 0.0, k=1.5)
        ) == pytest.approx(1.0)


def test_henon_lambda1_matches_published_value():
    lambda1, lambda2 = spectrum(
        CASES["henon"][0], CASES["henon"][1], CASES["henon"][2],
        iterations=100_000, transient=200,
    )
    assert lambda1 == pytest.approx(0.419, abs=0.01)
    # Dissipative: the second exponent must be distinctly negative, not equal
    # to the first -- the tell-tale sign of a Gram-Schmidt step that never ran.
    assert lambda2 < lambda1 - 0.1
