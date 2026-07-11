/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/master-data/workers',
        destination: '/parties?type=worker',
        permanent: true,
      },
      {
        source: '/master-data/workers/:path*',
        destination: '/parties?type=worker',
        permanent: true,
      },
      {
        source: '/master-data/parties',
        destination: '/parties',
        permanent: true,
      },
      {
        source: '/master-data/parties/:path*',
        destination: '/parties',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
