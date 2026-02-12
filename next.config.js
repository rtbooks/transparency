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
  // Disable static optimization during CI builds to avoid Clerk key validation
  ...(process.env.CI === 'true' && {
    experimental: {
      isrMemoryCacheSize: 0,
    },
    generateBuildId: async () => {
      return 'ci-build'
    },
  }),
}

module.exports = nextConfig
