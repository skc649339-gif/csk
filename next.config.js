const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
if (basePath && !/^\/[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*$/.test(basePath)) {
  throw new Error('NEXT_PUBLIC_BASE_PATH must be empty or a path such as /ziwei-doushu (no trailing slash).');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  basePath,
};

module.exports = nextConfig;
