/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required for GitHub Pages deployment
  output: 'export',
  // GitHub Pages requires trailing slash for proper routing
  trailingSlash: true,
  // Required for static export
  images: {
    unoptimized: true
  },
  // Base path is handled by actions/configure-pages in CI.
}

module.exports = nextConfig