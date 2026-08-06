/** @type {import('next').NextConfig} */
const nextConfig = {
  // The pipeline sources use explicit .ts extensions so the same files run
  // unbundled under `node --experimental-strip-types` (tests, CLI) and bundled
  // under Next. Without this the bundler treats "./rules.ts" as a literal
  // filename and fails to resolve it.
  experimental: {
    extensionAlias: {
      '.ts': ['.ts', '.tsx'],
      '.tsx': ['.tsx'],
    },
  },
};

export default nextConfig;
