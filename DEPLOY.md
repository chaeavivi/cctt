# 배포 가이드 — 센티넬·가이드 통합관리국

정적 페이지(`index.html`) + 선택적 AI 판정용 서버리스 함수(`netlify/functions/judge.mjs`) 구성입니다.

## 1. AI 판정 없이 그냥 쓰기 (무료·무설정)

`index.html` 만 있으면 됩니다. Netlify에 이 저장소를 연결해 배포하면 끝.
- 선택지 기반 **결정론 판정**으로 완전히 동작합니다.
- 같은 입력은 항상 같은 결과 → 공유/재현 가능.
- 로컬에서 확인하려면 `index.html` 을 브라우저로 열기만 하면 됩니다.

## 2. AI 판정 켜기 (Claude API 연동)

붙여넣은 프로필·설정을 바탕으로 캐해 소견을 **Claude가 생성**하게 하려면:

### (1) Claude **API 키** 발급 — ⚠️ claude.ai 구독과 별개
- https://console.anthropic.com 접속 → **API Keys** 에서 새 키 발급
- **Billing** 에서 크레딧 충전 (API는 채팅 구독과 별도로 **사용한 토큰만큼 종량 과금**)
- 즉, claude.ai Pro/Max 구독료로는 API가 열리지 않습니다. 콘솔에서 별도 결제 필요.

### (2) Netlify에 키 등록 (코드에 넣지 마세요)
- Netlify 대시보드 → **Site settings → Environment variables**
- `ANTHROPIC_API_KEY` = 발급받은 키 값
- (선택) `CLAUDE_MODEL` = 모델 변경. 기본값 `claude-sonnet-5`
  - 비용을 더 낮추려면 `claude-haiku-4-5-20251001` 로 바꿔도 됩니다.

### (3) 재배포
- 환경변수 저장 후 **Deploys → Trigger deploy** 로 재배포하면 AI 판정이 켜집니다.
- 결과 화면의 "캐해 소견"에 **AI 판정** 배지가 붙으면 정상 작동 중입니다.

## 동작 방식 / 안전장치
- 프론트가 먼저 결정론 판정을 계산 → 화면 표시
- 이어서 `/.netlify/functions/judge` 함수를 호출해 AI 소견으로 교체 시도
- 키가 없거나 함수 호출 실패 시 **자동으로 결정론 소견 유지** (앱이 절대 멈추지 않음)
- API 키는 **서버(함수) 환경변수에만** 존재하며 브라우저/소스에 노출되지 않습니다
- 프로필 붙여넣기는 인당 2,000자로 제한 (비용/남용 방지)

## 비용 주의
- AI 판정은 **판정서 발급 1회당 API 호출 1회** = 토큰 요금 발생
- 공개 사이트라면 방문자 사용량만큼 요금이 나갑니다. 트래픽이 많다면:
  - 더 저렴한 모델(`claude-haiku-4-5-20251001`) 사용
  - Netlify의 함수 호출 rate limit / 접근 제한 설정 고려
