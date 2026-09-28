import { DataFooter } from "@/components/DataFooter";
import { DemoNotice } from "@/components/DemoNotice";
import { Finder } from "@/components/Finder";
import { dataMode } from "@/lib/api";

// 서비스 키 유무(데모 여부)를 요청 시점에 판단한다.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const mode = dataMode();
  return (
    <>
      <header className="site-header">
        <div className="container">
          <h1>지금 문 연 약국·응급실</h1>
          <p className="lede">내 주변 영업 중인 약국과 응급실 가용 병상을 한눈에</p>
        </div>
      </header>
      <main id="main" className="container">
        {mode === "demo" && <DemoNotice />}
        <p className="emergency-callout">
          생명이 위급하면 망설이지 말고 <a href="tel:119">119</a>에 전화하세요.
        </p>
        <Finder />
      </main>
      <DataFooter />
    </>
  );
}
