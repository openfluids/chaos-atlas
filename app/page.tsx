// src/app/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { ThemeSwitcher } from '@/components/themes';

// --- Section & card data ---------------------------------------------------

interface MapCard {
  href: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  tag: string;
}

interface Section {
  title: string;
  subtitle: string;
  description: string;
  accent: 'cyan' | 'magenta' | 'orange' | 'purple';
  maps: MapCard[];
}

const sections: Section[] = [
  {
    title: '1D Maps',
    subtitle: 'Gateway to Chaos',
    description: 'One-dimensional maps that reveal the fundamental mechanisms of chaos',
    accent: 'cyan',
    maps: [
      {
        href: '/maps/logistic',
        name: 'Logistic Map',
        description: 'The simplest chaotic system, demonstrating period doubling and chaos',
        icon: '∞',
        iconColor: 'neon-text-orange',
        tag: 'Bifurcation',
      },
      {
        href: '/maps/tent',
        name: 'Tent Map',
        description: 'Piecewise linear chaos with exact analytical solutions and symbolic dynamics',
        icon: '▲',
        iconColor: 'neon-text-orange',
        tag: 'Symbolic',
      },
    ],
  },
  {
    title: '2D Maps',
    subtitle: 'Strange Attractors',
    description: 'Two-dimensional maps that produce intricate phase-space structures',
    accent: 'magenta',
    maps: [
      {
        href: '/maps/henon',
        name: 'Hénon Map',
        description: 'A classic 2D discrete dynamical system with a strange attractor',
        icon: '∞',
        iconColor: 'neon-text-magenta',
        tag: 'Attractor',
      },
      {
        href: '/maps/standard',
        name: 'Standard Map',
        description: 'Conservative system showing transition to chaos in Hamiltonian systems',
        icon: '⚡',
        iconColor: 'neon-text-yellow',
        tag: 'Chaos',
      },
      {
        href: '/maps/ikeda',
        name: 'Ikeda Map',
        description: 'Nonlinear optics model with stunning spiral attractors from laser cavity dynamics',
        icon: '◉',
        iconColor: 'neon-text-orange',
        tag: 'Spiral',
      },
      {
        href: '/maps/arnold',
        name: 'Arnold Cat Map',
        description: 'Area-preserving transformation with periodic orbits and Fibonacci connections',
        icon: '◈',
        iconColor: 'neon-text-orange',
        tag: 'Periodic',
      },
      {
        href: '/maps/bakers',
        name: "Baker\u2019s Map",
        description: 'Stretching and folding dynamics demonstrating exact mixing and symbolic dynamics',
        icon: '◧',
        iconColor: 'neon-text-orange',
        tag: 'Mixing',
      },
      {
        href: '/maps/tinkerbell',
        name: 'Tinkerbell Map',
        description: 'Complex polynomial dynamics with multi-loop attractors and bistable behavior',
        icon: '✦',
        iconColor: 'neon-text-orange',
        tag: 'Multi-loop',
      },
      {
        href: '/maps/duffing',
        name: 'Duffing Map',
        description: 'Double-well oscillator demonstrating bistable dynamics and physical chaos',
        icon: '⚛',
        iconColor: 'neon-text-orange',
        tag: 'Bistable',
      },
      {
        href: '/maps/complex',
        name: 'Complex Quadratic',
        description: 'Julia sets and Mandelbrot set exploring complex dynamics and fractals',
        icon: '◈',
        iconColor: 'neon-text-orange',
        tag: 'Fractals',
      },
    ],
  },
  {
    title: 'Coupled Map Lattices',
    subtitle: 'Spatiotemporal Dynamics',
    description: 'Spatially extended systems where many maps interact to produce collective behavior',
    accent: 'orange',
    maps: [
      {
        href: '/cml/diffusive',
        name: 'Diffusive CML',
        description: 'Spatiotemporal chaos and pattern formation in coupled map lattices',
        icon: '∇',
        iconColor: 'neon-text-orange',
        tag: 'Interactive',
      },
      {
        href: '/cml/global',
        name: 'Global CML',
        description: 'Synchronization phenomena in globally coupled systems',
        icon: '⟳',
        iconColor: 'neon-text-magenta',
        tag: 'Coming Soon',
      },
    ],
  },
  {
    title: 'Analysis Tools',
    subtitle: 'Compare & Quantify',
    description: 'Side-by-side tools for comparing chaotic systems and measuring their properties',
    accent: 'purple',
    maps: [
      {
        href: '/compare',
        name: 'Comparative Analysis',
        description: 'Side-by-side comparison of different chaotic systems with synchronized parameters',
        icon: '⚖',
        iconColor: 'neon-text-purple',
        tag: 'Interactive',
      },
    ],
  },
];

// --- Accent color mappings -------------------------------------------------

const accentBorder: Record<string, string> = {
  cyan: 'border-cyan-500/30',
  magenta: 'border-pink-500/30',
  orange: 'border-orange-500/30',
  purple: 'border-purple-500/30',
};

const accentDot: Record<string, string> = {
  cyan: 'bg-cyan-400',
  magenta: 'bg-pink-400',
  orange: 'bg-orange-400',
  purple: 'bg-purple-400',
};

const accentTagText: Record<string, string> = {
  cyan: 'text-cyan-400',
  magenta: 'text-pink-400',
  orange: 'text-orange-400',
  purple: 'text-purple-400',
};

const accentMuted: Record<string, string> = {
  cyan: 'text-cyan-500/60',
  magenta: 'text-pink-500/60',
  orange: 'text-orange-500/60',
  purple: 'text-purple-500/60',
};

const cardBorder: Record<string, string> = {
  cyan: 'border-cyan-500/20 hover:border-cyan-400/40',
  magenta: 'border-pink-500/20 hover:border-pink-400/40',
  orange: 'border-orange-500/20 hover:border-orange-400/40',
  purple: 'border-purple-500/20 hover:border-purple-400/40',
};

// --- Page ------------------------------------------------------------------

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{
      background: `linear-gradient(135deg, var(--bg-primary), var(--bg-secondary))`
    }}>
      {/* Header */}
      <header className="p-6 border-b bg-black/50 backdrop-blur-xs" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold neon-text-cyan mb-1">
              Chaos Atlas
            </h1>
            <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
              Explore chaos and complexity through interactive visualizations
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/about" className="text-sm text-gray-400 hover:text-cyan-400 transition-colors">
              About
            </Link>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      {/* Sections */}
      <main className="grow container mx-auto p-6 space-y-12">
        {sections.map((section) => (
          <section key={section.title}>
            {/* Section heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold">
                <span className={`neon-text-${section.accent}`}>{section.title}</span>
                <span className={`ml-3 text-lg font-normal ${accentMuted[section.accent]}`}>
                  — {section.subtitle}
                </span>
              </h2>
              <p className="text-sm text-gray-500 mt-1">{section.description}</p>
              <div className={`mt-3 border-b ${accentBorder[section.accent]}`} />
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {section.maps.map((map) => (
                <Link key={map.href} href={map.href} className="block">
                  <div className={`h-full p-5 rounded-lg transition-all duration-300 hover:scale-105 border-2 bg-black/30 backdrop-blur-xs ${cardBorder[section.accent]}`}>
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`text-3xl leading-none ${map.iconColor}`}>{map.icon}</span>
                      <h3 className={`text-xl font-bold neon-text-${section.accent}`}>
                        {map.name}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-300 mb-3">
                      {map.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 ${accentDot[section.accent]} rounded-full animate-pulse`} />
                      <span className={`text-xs ${accentTagText[section.accent]}`}>{map.tag}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
