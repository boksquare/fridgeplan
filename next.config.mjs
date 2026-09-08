/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is only for the Docker image (the Dockerfile sets this);
  // `next start` refuses to run against a standalone build, so a plain
  // `npm run build && npm start` deploy leaves it off.
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  images: {
    // Recipe photos come from third-party source APIs; hosts are allow-listed here.
    remotePatterns: [
      { protocol: 'https', hostname: 'www.themealdb.com' },
      { protocol: 'https', hostname: 'img.spoonacular.com' },
    ],
  },
};

export default nextConfig;
