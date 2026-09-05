import type {NextConfig} from "next";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://mainnet.base.org https://*.base.org https://*.alchemy.com https://*.quicknode.pro https://*.walletconnect.org https://*.walletconnect.com wss://*.walletconnect.org wss://*.walletconnect.com https://keys.coinbase.com https://*.coinbase.com https://*.cbhq.net wss://*.coinbase.com",
  "frame-src 'self' https://keys.coinbase.com https://*.coinbase.com https://*.walletconnect.org",
  "child-src 'self' blob: https://keys.coinbase.com https://*.coinbase.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {key: "Content-Security-Policy", value: csp},
          {key: "X-Content-Type-Options", value: "nosniff"},
          {key: "X-Frame-Options", value: "DENY"},
          {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},
          {key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()"},
          {key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups"},
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
