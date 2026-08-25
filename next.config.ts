import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Native SQLite bindings must be loaded by Node.js, not bundled by Webpack.
  serverExternalPackages: ['@prisma/adapter-better-sqlite3', 'better-sqlite3'],
};

export default nextConfig;
