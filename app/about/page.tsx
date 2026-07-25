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
              combining mathematical beauty with vintage Tron aesthetics. Built with Test-Driven Development
              and modern web standards, it brings complex dynamical systems to life through stunning visualizations.
            </p>
            <p className="text-gray-300 leading-relaxed">
              Step into a digital world where chaos meets order, where simple mathematical rules create
              breathtaking patterns, and where the legacy of Tron meets modern accessibility standards.
            </p>
          </section>

          {/* Key Features */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Core Features</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold neon-text-orange mb-3">🌊 Diffusive CML</h3>
                <p className="text-gray-300 mb-2">
                  Experience spatiotemporal pattern formation through diffusive coupling.
                  Watch as Turing patterns, spiral waves, and chaotic synchronization emerge.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-magenta mb-3">🔄 Global CML</h3>
                <p className="text-gray-300 mb-2">
                  Explore synchronization phenomena in globally coupled systems.
                  From independent chaos to complete synchronization, discover collective dynamics.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-yellow mb-3">🗺️ Classic Maps</h3>
                <p className="text-gray-300 mb-2">
                  Interactive visualizations of Logistic, Hénon, and Standard maps.
                  Experience period-doubling bifurcations and strange attractors.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-cyan mb-3">🎨 Tron Theme System</h3>
                <p className="text-gray-300 mb-2">
                  Vintage Tron aesthetic with neon glow effects and modern accessibility.
                  WCAG AA compliant with full keyboard navigation and screen reader support.
                </p>
              </div>
            </div>
          </section>

          {/* Technical Architecture */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Technical Excellence</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-lg font-semibold neon-text-orange mb-3">🧪 Test-Driven Development</h3>
                <p className="text-gray-300 text-sm">
                  140+ comprehensive tests covering unit, integration, accessibility,
                  performance, and error handling scenarios.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-magenta mb-3">⚡ Performance Optimized</h3>
                <p className="text-gray-300 text-sm">
                  60fps animations, React.memo optimization, efficient re-renders,
                  and minimal bundle size for lightning-fast performance.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-yellow mb-3">♿ Accessibility First</h3>
                <p className="text-gray-300 text-sm">
                  WCAG AA compliant, keyboard navigation, screen reader support,
                  reduced motion, and high contrast mode compatibility.
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
                  <h4 className="font-semibold neon-text-yellow mb-2">Global Coupling</h4>
                  <p className="text-gray-300 text-sm">
                    Each site couples to the global average of all sites,
                    leading to synchronization phenomena.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Visualizations */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Visualization Techniques</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold neon-text-orange mb-3">🎨 Color Mapping</h3>
                <p className="text-gray-300 mb-2">
                  Advanced color gradients map system states to visual properties,
                  making chaos patterns instantly recognizable and beautiful.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-magenta mb-3">⚡ Real-time Updates</h3>
                <p className="text-gray-300 mb-2">
                  Optimized rendering pipeline ensures smooth 60fps animations
                  even with large lattice sizes and complex dynamics.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-yellow mb-3">🔬 Parameter Control</h3>
                <p className="text-gray-300 mb-2">
                  Interactive controls allow real-time parameter adjustment,
                  enabling exploration of bifurcations and phase transitions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold neon-text-cyan mb-3">📊 Data Analysis</h3>
                <p className="text-gray-300 mb-2">
                  Built-in tools for measuring synchronization, calculating Lyapunov
                  exponents, and analyzing spatial correlations.
                </p>
              </div>
            </div>
          </section>

          {/* Development Team */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Built With Excellence</h2>
            <div className="space-y-4">
              <p className="text-gray-300">
                This project demonstrates modern web development practices combined with
                deep understanding of complex systems and chaos theory.
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold neon-text-orange mb-3">🛠️ Technology Stack</h3>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Next.js 14 with React 18</li>
                    <li>• TypeScript for type safety</li>
                    <li>• Tailwind CSS for styling</li>
                    <li>• Three.js for 3D visualizations</li>
                    <li>• D3.js for data visualization</li>
                    <li>• Playwright for E2E testing</li>
                    <li>• Jest for unit testing</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold neon-text-magenta mb-3">🎯 Development Methodology</h3>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Test-Driven Development (TDD)</li>
                    <li>• GitHub Spec Kit specification</li>
                    <li>• GitHub Actions CI/CD</li>
                    <li>• Accessibility-first design</li>
                    <li>• Performance optimization</li>
                    <li>• Semantic HTML and ARIA</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Call to Action */}
          <section className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs text-center">
            <h2 className="text-2xl font-bold neon-text-cyan mb-4">Start Exploring Chaos</h2>
            <p className="text-gray-300 mb-6">
              Ready to dive into the fascinating world of coupled map lattices?
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