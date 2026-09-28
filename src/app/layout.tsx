import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "지금 문 연 약국·응급실",
  description:
    "내 주변에서 지금 문을 연 약국, 심야·공휴일 약국, 응급실 실시간 가용 병상을 확인하세요. 국립중앙의료원 공공데이터 기반.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b6e4f",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <a className="skip-link" href="#main">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
