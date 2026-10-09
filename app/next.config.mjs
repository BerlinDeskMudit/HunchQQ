/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // pg is only imported by the webhook route handler — keep it external.
    serverComponentsExternalPackages: ["pg"],
  },
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false, os: false };
    return config;
  },
};

export default nextConfig;
