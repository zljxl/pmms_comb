import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['86.48.16.178'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default nextConfig;
