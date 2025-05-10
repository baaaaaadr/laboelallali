// next.config.js (or .mjs)
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'export', // This is key for static site generation - Commented out to allow middleware
};

module.exports = nextConfig; // or export default nextConfig; for .mjs