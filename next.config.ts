import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 서비스 키가 없을 때 API 라우트가 데모 XML 을 읽는다. 배포 번들에 함께 싣는다.
  outputFileTracingIncludes: {
    "/api/**": ["./fixtures/demo/**"],
  },
};

export default nextConfig;
