#!/usr/bin/env python3
"""Write dynachaos diagnostic fixtures for the chaos-atlas panel.

No CLI arguments. Paths are derived from this file so the working directory
does not matter. Rerunning overwrites the same bytes.

Ground truth is dynachaos Python (Rust kernels when the extension is
installed): correlation_dimension, permutation_entropy, zero_one_statistic.
The series themselves are fixed recurrences, not a second copy of the atlas UI.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from dynachaos.diagnostics.correlation import correlation_dimension
from dynachaos.diagnostics.permutation import permutation_entropy
from dynachaos.diagnostics.zero_one_test import zero_one_series, zero_one_statistic

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "tests" / "fixtures" / "dynachaos-diagnostics"
C_PATH = ROOT / "lib" / "diagnostics" / "default-c.json"

# Same defaults as dynachaos.diagnostics.
N_R = 50
THEILER = 0
ORDINAL_D = 5
ORDINAL_TAU = 1
N_C = 100
SERIES_N = 400
TRANSIENT = 50


def _logistic(r: float, x0: float, n: int, transient: int) -> list[float]:
    x = x0
    for _ in range(transient):
        x = r * x * (1.0 - x)
    out: list[float] = []
    for _ in range(n):
        out.append(x)
        x = r * x * (1.0 - x)
    return out


def _henon_x(n: int, transient: int) -> list[float]:
    """Classical Hénon (a=1.4, b=0.3); the fixture keeps the x component."""
    a = 1.4
    b = 0.3
    x = 0.1
    y = 0.1
    for _ in range(transient):
        x, y = 1.0 - a * x * x + y, b * x
    out: list[float] = []
    for _ in range(n):
        out.append(x)
        x, y = 1.0 - a * x * x + y, b * x
    return out


def _jsonable(value):
    if isinstance(value, str):
        return value
    if value is None:
        return None
    if isinstance(value, np.ndarray):
        return [_jsonable(v) for v in value.tolist()]
    if isinstance(value, (np.floating, float)):
        number = float(value)
        if not np.isfinite(number):
            return None
        return number
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in value.items()}
    raise TypeError(f"unsupported fixture value {type(value)!r}")


def _dumps(payload: dict) -> str:
    return json.dumps(_jsonable(payload), indent=2, sort_keys=True, allow_nan=False) + "\n"


def _measure(series: list[float]) -> dict:
    arr = np.asarray(series, dtype=np.float64)
    d2, r_values, c_values, _slopes, scaling = correlation_dimension(
        arr,
        n_r=N_R,
        theiler_window=THEILER,
        norm="chebyshev",
    )
    pe = permutation_entropy(arr, d=ORDINAL_D, tau=ORDINAL_TAU, normalise=True)
    pe_raw = permutation_entropy(arr, d=ORDINAL_D, tau=ORDINAL_TAU, normalise=False)
    c_freq, k_values = zero_one_series(arr, n_c=N_C)
    k = zero_one_statistic(arr, n_c=N_C)
    k_mean = float(np.mean(k_values))
    return {
        "series": series,
        "n": len(series),
        "d2": float(d2),
        "r_values": r_values,
        "C_values": c_values,
        "scaling_mask": scaling.astype(bool),
        "pe": float(pe),
        "pe_raw": float(pe_raw),
        "k": float(k),
        "k_mean": k_mean,
        "k_values": k_values,
        "c_values": c_freq,
        "n_cut": max(2, len(series) // 10),
        "n_r": N_R,
        "theiler_window": THEILER,
        "ordinal_d": ORDINAL_D,
        "ordinal_tau": ORDINAL_TAU,
        "n_c": N_C,
    }


def main() -> None:
    cases = [
        (
            "logistic-r4.json",
            {
                "id": "logistic-r4",
                "description": "Logistic map r*x*(1-x), r=4, x0=0.2, after 50 transient steps.",
                "map": "logistic",
                "r": 4.0,
                "x0": 0.2,
            },
            _logistic(4.0, 0.2, SERIES_N, TRANSIENT),
        ),
        (
            "logistic-r3.2.json",
            {
                "id": "logistic-r3.2",
                "description": "Logistic map r*x*(1-x), r=3.2 (period-2), x0=0.2, after 50 transient steps.",
                "map": "logistic",
                "r": 3.2,
                "x0": 0.2,
            },
            _logistic(3.2, 0.2, SERIES_N, TRANSIENT),
        ),
        (
            "henon-x.json",
            {
                "id": "henon-x",
                "description": "Classical Henon a=1.4 b=0.3, x component, x0=y0=0.1, after 50 transient steps.",
                "map": "henon",
                "component": "x",
                "a": 1.4,
                "b": 0.3,
            },
            _henon_x(SERIES_N, TRANSIENT),
        ),
    ]

    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    C_PATH.parent.mkdir(parents=True, exist_ok=True)

    shared_c = None
    for filename, meta, series in cases:
        measured = _measure(series)
        if shared_c is None:
            shared_c = measured["c_values"]
        payload = {**meta, **measured}
        path = FIXTURE_DIR / filename
        path.write_text(_dumps(payload), encoding="utf-8")

    if shared_c is None:
        raise RuntimeError("no fixtures written")
    C_PATH.write_text(
        _dumps(
            {
                "source": "numpy.random.default_rng(42).uniform(pi/5, 4*pi/5, 100)",
                "n_c": N_C,
                "c_values": shared_c,
            }
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
