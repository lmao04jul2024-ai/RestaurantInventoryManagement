/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Force Next to skip git-based build-id generation (Render free = no git).
  generateBuildId: async () => 'render-build',
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;