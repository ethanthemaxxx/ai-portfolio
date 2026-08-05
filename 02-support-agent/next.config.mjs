/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo is written with explicit .ts/.tsx import extensions so the same
  // sources run unbundled under `tsx` (tests, ingest, evals) and bundled under
  // Next. Without this, the bundler resolves ./widget.tsx as a literal filename
  // and misses it.
  experimental: {
    extensionAlias: {
      '.ts': ['.ts', '.tsx'],
      '.tsx': ['.tsx'],
    },
  },
};

export default nextConfig;
