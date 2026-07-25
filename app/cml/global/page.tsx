"use client";

import React from 'react';
import Link from 'next/link';
import { ThemeSwitcher } from '@/components/themes';

export default function GlobalCMLPage() {
  return (
    <div className="min-h-screen">
      <header className="p-6 border-b border-cyan-500/20 bg-black/50 backdrop-blur-xs">
        <div className="container mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <Link href="/" className="text-sm mb-2 inline-block text-cyan-400 hover:text-cyan-300 transition-colors">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold neon-text-cyan mb-2">
              Global Coupled Map Lattice
            </h1>
            <p className="text-lg text-gray-300">
              Experience synchronization and collective dynamics in globally coupled systems
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h2 className="text-xl font-semibold neon-text-cyan mb-4">Global Coupling Visualization</h2>
            <p className="text-gray-300 mb-6">
              In globally coupled map lattices, each site interacts with the global average of all sites.
              This creates fascinating synchronization phenomena and collective behavior.
            </p>

            <div className="bg-black/50 rounded-lg p-8 border border-cyan-500/10 text-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-full">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                  <span className="text-cyan-400 text-sm">Coming Soon</span>
                </div>
                <p className="text-gray-400">
                  Interactive global CML visualization will be available here
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
              <h3 className="text-lg font-semibold neon-text-orange mb-3">Synchronization Phenomena</h3>
              <p className="text-gray-300 mb-4">
                Global coupling leads to various synchronization states and collective dynamics
                that emerge from the interaction between local chaos and global order.
              </p>
              <ul className="space-y-2 text-gray-400">
                <li>• Complete synchronization</li>
                <li>• Phase synchronization</li>
                <li>• Cluster synchronization</li>
                <li>• Chimera states</li>
                <li>• Synchronization transitions</li>
              </ul>
            </div>

            <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
              <h3 className="text-lg font-semibold neon-text-magenta mb-3">Global Coupling Strength</h3>
              <p className="text-gray-300 mb-4">
                The global coupling parameter ε controls how strongly each site is influenced
                by the collective state of the entire system.
              </p>
              <ul className="space-y-2 text-gray-400">
                <li>• Weak coupling: Independent chaotic dynamics</li>
                <li>• Moderate coupling: Intermittent synchronization</li>
                <li>• Strong coupling: Full synchronization</li>
                <li>• Critical coupling values</li>
              </ul>
            </div>
          </div>

          <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
            <h3 className="text-lg font-semibold neon-text-yellow mb-4">Mathematical Framework</h3>
            <div className="bg-black/50 rounded-lg p-4 border border-cyan-500/10 font-mono text-sm">
              <p className="text-cyan-400 mb-2">Global Coupled Map Lattice:</p>
              <p className="text-gray-300 mb-2">
                x_i(t+1) = (1-ε)f(x_i(t)) + ε/N Σ f(x_j(t))
              </p>
              <div className="text-gray-400 text-xs mt-3">
                Where ε is the coupling strength, N is the system size,
                and f is the local map function.
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
              <h4 className="text-lg font-semibold neon-text-cyan mb-3">Ott-Antonsen Ansatz</h4>
              <p className="text-gray-300 text-sm">
                Powerful theoretical framework for understanding synchronization
                in large systems of globally coupled oscillators.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
              <h4 className="text-lg font-semibold neon-text-orange mb-3">Kuramoto Model</h4>
              <p className="text-gray-300 text-sm">
                Classic model for synchronization in globally coupled phase oscillators,
                related to coupled map lattices.
              </p>
            </div>

            <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
              <h4 className="text-lg font-semibold neon-text-magenta mb-3">Network Theory</h4>
              <p className="text-gray-300 text-sm">
                Global coupling represents the special case of a complete graph
                in complex network theory.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}