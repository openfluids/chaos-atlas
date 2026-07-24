# Chaos Atlas

Interactive web application for exploring chaotic dynamical systems. Visualize strange attractors, bifurcation diagrams, cobweb plots, Lyapunov exponents, and spatiotemporal patterns across 10 iterated maps and coupled map lattices.

**Live demo:** [openfluids.github.io/chaos-atlas](https://openfluids.github.io/chaos-atlas/)

**Topics:** #chaos-theory #dynamical-systems #strange-attractors #bifurcation-diagrams #coupled-map-lattices #lyapunov-exponents #fractal-geometry #nextjs #d3js #react

## Maps

### 1D Maps
| Map | Key Features |
|-----|-------------|
| **Logistic** | Bifurcation diagram, cobweb plot, period doubling |
| **Tent** | Cobweb plot, symbolic dynamics, exact solutions |

### 2D Maps
| Map | Key Features |
|-----|-------------|
| **Henon** | Strange attractor, phase space, basins of attraction |
| **Standard (Chirikov)** | KAM islands, Hamiltonian chaos, mixed phase space |
| **Ikeda** | Spiral attractor, laser cavity dynamics, Lyapunov exponents |
| **Arnold Cat** | Area-preserving map, image scrambling |
| **Baker's** | Mixing, symbolic dynamics, invariant measure |
| **Tinkerbell** | Multi-loop attractor, fixed points, bistability |
| **Duffing** | Double-well oscillator, phase portraits |
| **Complex Quadratic** | Julia sets, Mandelbrot set, fractal zoom |

### Coupled Map Lattices
| Type | Key Features |
|------|-------------|
| **Diffusive CML** | Space-time plots, pattern formation, synchronization |
| **Global CML** | Mean-field coupling *(coming soon)* |

### Comparative Analysis
Side-by-side comparison of any maps with synchronized parameters, time series and phase space views.

## Visualization Types

- **Attractors & phase space** — D3.js scatter/path plots with color-coded iteration order
- **Cobweb plots** — iterative mapping on the diagonal
- **Bifurcation diagrams** — parameter sweeps revealing period-doubling cascades
- **Time series** — temporal evolution of state variables
- **Lyapunov exponents** — quantitative chaos measure displayed per parameter set
- **Power spectra & return maps** — frequency and recurrence analysis
- **Space-time heatmaps** — CML spatiotemporal evolution
- **Fractal rendering** — pixel-level canvas computation for Julia/Mandelbrot sets

## Python package

The map kernels are also published as a standalone Python package, so the same
systems can be driven from a script or notebook without the browser.

```bash
pip install chaos-atlas
```

```python
from chaos_atlas.maps import logistic, henon
from chaos_atlas import cml

r, x = logistic.bifurcation(r_min=2.5, r_max=4.0, r_steps=2000)
points = henon.attractor(a=1.4, b=0.3, iterations=10_000)
spacetime = cml.diffusive(r=3.9, epsilon=0.4, lattice_size=256, time_steps=512)
```

Source and full API in [`python/`](python/).

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install and Run

```bash
git clone https://github.com/openfluids/chaos-atlas.git
cd chaos-atlas
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build    # Static export to out/
```

Deploys automatically to GitHub Pages on push to `main`.

## Themes

Three themes with persistent selection (stored in localStorage):

- **Black & White** — high-contrast monochrome
- **Neon Vintage** — warm retro neon palette
- **Blue Tron** — cyan/blue on dark (default)

Theme colors propagate to D3 visualizations through CSS custom properties.

## Project Structure

```
app/                     # Next.js App Router pages
  maps/                  # Individual map pages (logistic, henon, ikeda, ...)
  cml/                   # Coupled map lattice pages
  compare/               # Side-by-side comparison
components/
  visualizations/        # D3/Canvas rendering (one per map)
  themes/                # ThemeProvider, ThemeSwitcher, NeonButton
  ui/                    # MapPageLayout (shared header + nav)
lib/
  maps/                  # Pure calculation functions (no React)
  themes/                # Theme config, CSS variable bridge
tests/                   # 184 tests (unit, integration, a11y, e2e)
```

## Adding a New Map

1. Create the calculation module in `lib/maps/yourmap.ts`
2. Create the visualization component in `components/visualizations/YourMapVisualization.tsx`
3. Add a page at `app/maps/yourmap/page.tsx` using `MapPageLayout`
4. Add a card to the home page in `app/page.tsx`

## Tech Stack

- **Framework:** Next.js 14 (static export)
- **Rendering:** D3.js (SVG) + Canvas (fractals)
- **Styling:** Tailwind CSS + CSS custom properties
- **Deployment:** GitHub Pages via Actions

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

Copyright 2026 Ricardo A S Frantz.

Releases up to and including v0.1.0 were documented in this README as MIT-licensed;
that grant is not withdrawn for code obtained under it. Apache-2.0 applies from v0.1.0 onward.
