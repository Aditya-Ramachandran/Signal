/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // GitHub Pages serves this repository at /Signal/ (the repository name is case-sensitive).
  basePath: '/Signal',
  assetPrefix: '/Signal',
  images: { unoptimized: true },
};

export default nextConfig;
