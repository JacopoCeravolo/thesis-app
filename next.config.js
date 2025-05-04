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
}

module.exports = nextConfig
