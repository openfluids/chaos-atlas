# Chaos Atlas

Iterated maps, coupled map lattices, and Lyapunov exponents for chaotic dynamical
systems. NumPy arrays in, NumPy arrays out.

This is the Python companion to the [Chaos Atlas web
explorer](https://openfluids.github.io/chaos-atlas/), which visualises the same
systems interactively.

## Install

Requires Python 3.14 or newer.

```bash
pip install chaos-atlas
```

## Use

Every map shares the same surface, so switching systems is a one-word change.

```python
from chaos_atlas.maps import logistic, henon

orbit = logistic.trajectory(r=3.9, x0=0.5, iterations=1000)
exponent = logistic.lyapunov(r=4.0)          # -> log 4, the default x0 = 0.5 is preperiodic
exponent = logistic.lyapunov(r=4.0, x0=0.2)  # -> log 2, a generic x0 gives the attractor's exponent

points = henon.attractor(a=1.4, b=0.3, iterations=10_000)   # (10000, 2)
```

Bifurcation diagrams come back as paired flat arrays, ready to scatter:

```python
import matplotlib.pyplot as plt

r, x = logistic.bifurcation(r_min=2.5, r_max=4.0, r_steps=2000)
plt.plot(r, x, ",k", alpha=0.25)
```

Coupled map lattices return a `(time_steps, lattice_size)` space-time array:

```python
from chaos_atlas import cml

spacetime = cml.diffusive(r=3.9, epsilon=0.4, lattice_size=256, time_steps=512)
plt.imshow(spacetime, aspect="auto", cmap="magma")
```

Pass `rng=` (or `initial=`) when you need a run to be reproducible.

## Maps

| Module | System | Notes |
|---|---|---|
| `logistic` | x → rx(1−x) | period doubling, bifurcation, cobweb |
| `tent` | piecewise linear | λ = log α exactly, symbolic dynamics |
| `henon` | (1−ax²+y, bx) | strange attractor, λ₁ ≈ 0.419 |
| `standard` | Chirikov | area preserving, KAM islands |
| `ikeda` | optical cavity | spiral attractor |
| `arnold` | cat map | area preserving, finite recurrence period |
| `bakers` | baker's transformation | entropy = log 2 exactly |
| `tinkerbell` | quadratic 2D | multi-loop attractor |
| `duffing` | double well | fixed points in closed form |
| `complex_quadratic` | z² + c | Julia and Mandelbrot escape-time |

Lyapunov exponents for the nonlinear 2D maps evolve a tangent vector under the
analytic Jacobian with renormalisation each step. Where a map has an exact
exponent — tent, baker's, Arnold, logistic at r = 4 — the test suite pins the
numerical result to it.

## Development

```bash
uv venv --python 3.14
uv pip install -e ".[dev]"
uv run pytest
```

## License

Apache-2.0. Copyright 2026 Ricardo A S Frantz.
