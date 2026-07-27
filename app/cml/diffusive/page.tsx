"use client";

import React from 'react';
import CMLVisualization from '@/components/visualizations/CMLVisualization';
import MapPageLayout from '@/components/ui/MapPageLayout';

export default function DiffusiveCMLPage() {
  return (
    <MapPageLayout
      title="Coupled Map Lattice"
      description="Observe spatiotemporal chaos and pattern formation"
    >
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
    </MapPageLayout>
  );
}
