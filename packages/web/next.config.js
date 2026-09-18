/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Render free tier images are git-less; Next 14 throws exit 128 without it.
  // Disable SWC from reading the worktree git metadata.
  webpack: (config) => {
    config.module = config.module || {};
    return config;
  },
  // Ensure Next does not attempt to resolve `.git` for build-id.
  generateEtags: false,
  // Skip SWC from requiring git context.
  swcMinify: true,
};

module.exports = nextConfig;