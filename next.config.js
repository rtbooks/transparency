/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
    ],
  },
  // Skip static page generation during CI builds when Clerk keys are dummy values
  output: process.env.CI === 'true' ? 'standalone' : undefined,
}

module.exports = nextConfig
