/** @type {import('next').NextConfig} */

// Proxy /api/* to the backend so the browser talks to a single origin.
// This keeps auth cookies (httpOnly JWT) and CSRF tokens same-origin.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || "http://localhost:8080";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
