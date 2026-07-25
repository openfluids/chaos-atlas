"use client";

import React from 'react';
import CMLVisualization from '@/components/visualizations/CMLVisualization';
import Link from 'next/link';
import { ThemeSwitcher } from '@/components/themes';

export default function DiffusiveCMLPage() {
  return (
    <div className="min-h-screen">
      <header className="p-6 border-b border-cyan-500/20 bg-black/50 backdrop-blur-xs">
        <div className="container mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <Link href="/" className="text-sm mb-2 inline-block text-cyan-400 hover:text-cyan-300 transition-colors">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold neon-text-cyan mb-2">
              Coupled Map Lattice
            </h1>
            <p className="text-lg text-gray-300">
              Observe spatiotemporal chaos and pattern formation
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
            <h2 className="text-xl font-semibold neon-text-cyan mb-4">Diffusive Coupling Visualization</h2>
            <p className="text-gray-300 mb-6">
              Explore how diffusive coupling creates complex spatiotemporal patterns in coupled map lattices.
              Watch as chaos spreads and synchronizes across the network.
            </p>
            <div className="bg-black/50 rounded-lg p-4 border border-cyan-500/10">
              <CMLVisualization />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
              <h3 className="text-lg font-semibold neon-text-orange mb-3">Pattern Formation</h3>
              <p className="text-gray-300 mb-4">
                Observe how local interactions create global patterns through diffusive coupling.
                See chaos, spirals, and traveling waves emerge from simple rules.
              </p>
              <ul className="space-y-2 text-gray-400">
                <li>• Turing patterns</li>
                <li>• Spiral waves</li>
                <li>• Chaotic synchronization</li>
                <li>• Phase transitions</li>
              </ul>
            </div>

            <div className="p-6 rounded-lg border border-cyan-500/20 bg-black/30 backdrop-blur-xs">
              <h3 className="text-lg font-semibold neon-text-magenta mb-3">Coupling Strength</h3>
              <p className="text-gray-300 mb-4">
                The diffusive coupling parameter controls how neighboring sites influence each other,
                determining the balance between local chaos and global order.
              </p>
              <ul className="space-y-2 text-gray-400">
                <li>• Weak coupling: Independent chaos</li>
                <li>• Moderate coupling: Pattern formation</li>
                <li>• Strong coupling: Synchronization</li>
                <li>• Critical transitions</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}