export function DataFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          데이터 출처: 국립중앙의료원 「전국 약국 정보 조회 서비스」 「전국 응급의료기관 정보 조회
          서비스」 (
          <a href="https://www.data.go.kr" rel="noopener">
            공공데이터포털
          </a>
          ). 운영시간과 병상 정보는 기관이 입력한 값으로 실제와 다를 수 있습니다. 방문 전 전화로
          확인하세요.
        </p>
        <p>응급 상황에서는 119, 의료 상담은 보건복지상담센터 129.</p>
      </div>
    </footer>
  );
}
