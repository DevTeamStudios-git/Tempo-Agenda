/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Ensure trailing slash consistency for crawlers
  trailingSlash: false,
  // Security + perf headers so browser isn't confused about caching / framing
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Next.js sets immutable caching only for versioned production assets.
      // Overriding it for dev chunks serves stale JavaScript across restarts.
    ];
  },
  // Redirect www → apex if siteUrl is set (optional, not enforced without env)
};

export default nextConfig;
