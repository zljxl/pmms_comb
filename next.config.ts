import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['86.48.16.178'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Native SQLite bindings must be loaded by Node.js, not bundled by Webpack.
  serverExternalPackages: ['@prisma/adapter-better-sqlite3', 'better-sqlite3'],
};

export default nextConfig;
