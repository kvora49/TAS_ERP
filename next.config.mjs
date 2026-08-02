/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Cloudflare R2 public bucket (*.r2.dev or custom domain)
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        // Supabase storage
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
      },
      {
        // Custom Cloudflare R2 domain (pub-*.r2.dev)
        protocol: "https",
        hostname: "pub-*.r2.dev",
      },
    ],
    // Allow unoptimized fallback for print pages where img dimensions are unknown
    // Use <Image unoptimized> for print layout pages
  },
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/(sw.js|sw-push.js|firebase-messaging-sw.js)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
