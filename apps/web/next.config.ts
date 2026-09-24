import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV !== "production";
const appDirectory = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      `connect-src 'self'${isDevelopment ? " http://localhost:8000 ws://localhost:3000" : ""}`,
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "manifest-src 'self'",
      "object-src 'none'",
      `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(appDirectory, "../.."),
  experimental: {
    // Next.js defaults to a child-process TypeScript CLI. The compiler API keeps
    // configuration loading deterministic in restricted CI/container runtimes.
    useTypeScriptCli: false,
  },
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: [
    "@inorganic/chemistry",
    "@inorganic/content",
    "@inorganic/contracts",
    "@inorganic/ui",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    const apiProxyTarget = process.env.API_PROXY_TARGET;
    return apiProxyTarget
      ? [{ source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` }]
      : [];
  },
};

export default nextConfig;
