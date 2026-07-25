"""The version is written in two places; make disagreement a test failure.

``pyproject.toml`` feeds the wheel metadata and therefore what PyPI shows,
while ``chaos_atlas.__version__`` is what a user sees at runtime. Nothing
enforces that they match, and a mismatch is invisible until someone reports
a version that was never released.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

import chaos_atlas

PYPROJECT = Path(__file__).resolve().parent.parent / "pyproject.toml"


def test_runtime_version_matches_packaging_metadata() -> None:
    declared = tomllib.loads(PYPROJECT.read_text())["project"]["version"]
    assert chaos_atlas.__version__ == declared
