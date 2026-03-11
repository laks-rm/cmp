/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== "production";

const cspDirectives = isDevelopment
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self' ws: wss:",
      "worker-src 'self' blob:",
    ].join("; ")
  : [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "font-src 'self' fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
    ].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

if (!isDevelopment) {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
}

const nextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
