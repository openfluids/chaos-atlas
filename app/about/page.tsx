"use client";

import React from 'react';
import Link from 'next/link';
import { NeonButton, ThemeSwitcher } from '@/components/themes';

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <header className="p-6 border-b border-cyan-500/20 bg-black/50 backdrop-blur-xs">
        <div className="container mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <Link href="/" className="text-sm mb-2 inline-block text-cyan-400 hover:text-cyan-300 transition-colors">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold neon-text-cyan mb-2">
              About Chaos Atlas
            </h1>
            <p className="text-lg text-gray-300">
              Explore chaos theory through interactive visualizations with vintage Tron aesthetics
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="space-y-8">
          {/* Introduction */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Welcome to the Grid</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Chaos Atlas is an interactive exploration platform for chaotic dynamical systems,
              combining mathematical rigor with vintage Tron aesthetics. It brings complex dynamical systems
              to life through real-time visualizations, built with Test-Driven Development and modern web standards.
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              Available both as a <strong>live web application</strong> and as a <strong>Python package</strong>,
              Chaos Atlas provides tools for studying bifurcations, attractors, and chaos across dozens of canonical
              systems and spatiotemporal coupled dynamics.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Source code is freely available on <Link href="https://github.com/openfluids/chaos-atlas" className="text-cyan-400 hover:text-cyan-300 transition-colors">GitHub</Link>.
            </p>
          </section>

          {/* Python Package */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Python Package</h2>
            <p className="text-gray-300 mb-4">
              The same numerical kernels powering the web visualizations are available as a NumPy-vectorised library.
              Install from PyPI:
            </p>
            <div className="bg-black/50 rounded-lg p-4 border border-cyan-500/10 font-mono text-sm mb-4">
              <p className="text-cyan-400">
                pip install chaos-atlas
              </p>
            </div>
            <p className="text-gray-300">
              See the <Link href="https://pypi.org/project/chaos-atlas/" className="text-cyan-400 hover:text-cyan-300 transition-colors">PyPI page</Link> for documentation
              and usage examples.
            </p>
          </section>

          {/* Core Features */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Core Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold neon-text-orange mb-3">🌊 Diffusive CML</h3>
                <p className="text-gray-300 mb-2">
                  Explore spatiotemporal pattern formation through diffusive coupling.
                  Watch Turing patterns, spiral waves, and chaotic synchronization emerge in real time.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-magenta mb-3">🗺️ Ten Map Pages</h3>
                <p className="text-gray-300 mb-2">
                  Interactive visualizations of Logistic, Tent, Hénon, Standard, Ikeda, Arnold Cat,
                  Baker&apos;s, Tinkerbell, Duffing, and Complex Quadratic maps.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-yellow mb-3">📊 Comparative Analysis</h3>
                <p className="text-gray-300 mb-2">
                  Side-by-side comparison of chaotic systems with synchronized parameters.
                  Bifurcation and Lyapunov comparison views are still in progress.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-cyan mb-3">🎨 Tron Aesthetic</h3>
                <p className="text-gray-300 mb-2">
                  Vintage Tron-inspired visual design with neon glow effects and a dark, immersive interface.
                </p>
              </div>
            </div>
          </section>

          {/* Numerical Methods */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Numerical Methods</h2>
            <p className="text-gray-300 mb-4">
              Chaos Atlas computes Lyapunov spectra using Benettin&apos;s algorithm with Gram-Schmidt
              reorthonormalisation. Every spectrum is validated against the conservation identity
              sum(λ_i) = ⟨ln|det J|⟩. All analytic Jacobians are verified against central finite differences.
            </p>
            <p className="text-gray-300">
              This rigorous approach ensures that visual patterns reflect genuine dynamical properties,
              not numerical artifacts.
            </p>
          </section>

          {/* Technical Excellence */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Testing & Quality</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-semibold neon-text-orange mb-3">🧪 Comprehensive Testing</h3>
                <p className="text-gray-300 text-sm">
                  322 tests covering unit, integration, and end-to-end scenarios:
                  283 Jest unit tests and 39 Playwright E2E tests.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-magenta mb-3">🔍 Numerical Validation</h3>
                <p className="text-gray-300 text-sm">
                  Jacobian verification, conservation law checks, and stability tests
                  ensure correctness of dynamical computations.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-yellow mb-3">📦 Modern Stack</h3>
                <p className="text-gray-300 text-sm">
                  Next.js 16, React 19, TypeScript, Tailwind CSS, and D3.js,
                  with GitHub Actions CI/CD.
                </p>
              </div>
            </div>
          </section>

          {/* Mathematics */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">The Mathematics Behind</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold neon-text-orange mb-3">Coupled Map Lattices</h3>
                <p className="text-gray-300 mb-3">
                  Coupled Map Lattices (CMLs) are discrete-time dynamical systems where multiple
                  identical maps are coupled together on a lattice structure.
                </p>
                <div className="bg-black/50 rounded-lg p-4 border border-cyan-500/10 font-mono text-sm">
                  <p className="text-cyan-400 mb-2">General Form:</p>
                  <p className="text-gray-300">
                    x_i(t+1) = (1-ε)f(x_i(t)) + ε/2 Σ_neighbors [f(x_j(t)) - f(x_i(t))]
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold neon-text-magenta mb-2">Diffusive Coupling</h4>
                  <p className="text-gray-300 text-sm">
                    Each site interacts with its immediate neighbors through
                    a diffusion-like process, creating local pattern formation.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold neon-text-yellow mb-2">Lyapunov Exponents</h4>
                  <p className="text-gray-300 text-sm">
                    Measure of sensitivity to initial conditions. Positive values indicate chaos;
                    zero indicates bifurcation points.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Visualization Techniques */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Visualization Techniques</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold neon-text-orange mb-3">🎨 Color Mapping</h3>
                <p className="text-gray-300 mb-2">
                  Color gradients encode system dynamics: escape times, Lyapunov exponents,
                  or density of orbits.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-magenta mb-3">⚡ Real-time Rendering</h3>
                <p className="text-gray-300 mb-2">
                  Canvas-based rendering with optimized pixel updates enables parameter sweeps
                  and interactive exploration at reasonable frame rates.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-yellow mb-3">🔬 Parameter Control</h3>
                <p className="text-gray-300 mb-2">
                  Interactive sliders allow real-time parameter adjustment,
                  enabling exploration of bifurcations and phase transitions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-cyan mb-3">📊 Lyapunov Spectra</h3>
                <p className="text-gray-300 mb-2">
                  Built-in tools compute and visualize the full spectrum of Lyapunov exponents
                  to quantify multidimensional chaos.
                </p>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs text-center">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Start Exploring Chaos</h2>
            <p className="text-gray-300 mb-6">
              Ready to explore coupled map lattices and discrete dynamics?
              Experience the beauty of chaos with our interactive visualizations.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/">
                <NeonButton variant="primary">
                  Explore Visualizations
                </NeonButton>
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
