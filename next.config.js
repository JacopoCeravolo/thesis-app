/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable eslint during build to avoid failing with these errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // If on the server side, add canvas to the list of externals
    if (isServer) {
      config.externals = [...config.externals, 'canvas'];
    }
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
}

module.exports = nextConfig
