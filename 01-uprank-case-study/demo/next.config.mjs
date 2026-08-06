/** @type {import('next').NextConfig} */
const nextConfig = {
  // The vendored engine keeps the source app's explicit .ts import extensions so
  // the parity script can run the same files unbundled under tsx.
  experimental: {
    extensionAlias: { '.ts': ['.ts', '.tsx'], '.tsx': ['.tsx'] },
  },
};
export default nextConfig;
