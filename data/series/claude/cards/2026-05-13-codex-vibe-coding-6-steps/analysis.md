# CODEX 바이브코딩 6단계 — 분석

작성일: 2026-05-13

## 입력

- 원문: repo root `doc`
- 주제: 초보자를 위한 CODEX 바이브코딩 6단계 입문
- 목표: 코드를 직접 쓰기 전에 AI에게 줄 문서와 구현 흐름을 이해시키는 카드뉴스

## 편집 판단

- 원문의 큰 흐름은 유지했다: 표지 → 바이브코딩 정의 → PLAN/DESIGN/AGENTS → 앞 3단계 중요성 → 백엔드/API/배포 → 요약 → 마무리.
- "AI가 90% 해준다"는 수치는 출처가 없어서 카드에서는 "대부분의 반복 구현을 AI에게 맡기기 쉬워진다"로 완화했다.
- "코드 한 줄 몰라도 OK"는 초보자 후킹으로는 살리되, 본문에서는 "기준을 쓰고 검증한다"는 메시지로 안전하게 균형을 잡았다.
- `AGENTS.md`는 Codex 공식 문서에서 별도 가이드가 있는 실제 프로젝트 지침 파일이므로 핵심 문서로 유지했다.
- Supabase/Vercel은 원문 의도를 살려 예시로만 썼고, "무료/클릭 몇 번/끝" 같은 단정은 줄였다.

## 검증 메모

- OpenAI Codex CLI 문서: Codex CLI는 터미널에서 로컬로 실행되는 coding agent이며, 선택된 디렉터리의 코드를 읽고 바꾸고 실행할 수 있다고 설명한다. CLI 설치는 `npm i -g @openai/codex`, 실행은 `codex`로 안내된다.
- OpenAI AGENTS.md 문서: Codex는 작업 전 `AGENTS.md`를 읽고, 전역/프로젝트 지침을 계층적으로 적용한다. 따라서 "AI가 먼저 읽는 규칙 문서"라는 설명은 적절하다.
- Supabase 문서: 프로젝트마다 Postgres 데이터베이스가 제공되고, Auth는 인증/권한 부여를 구현하는 기능이다. 따라서 "DB/인증"을 백엔드 준비 항목으로 둔 것은 타당하다.
- Vercel 문서: Git 저장소를 연결하면 branch push와 production branch merge에 따라 자동 배포가 가능하다. 따라서 "GitHub에 올리고 Vercel에 연결하면 자동 배포 흐름"은 타당하다.
- GitHub secret leakage 문서: API 키, 비밀번호, 토큰 같은 secret이 저장소에 커밋되면 악용될 수 있다. 따라서 "비밀번호를 코드에 직접 쓰지 말기"는 필수 주의로 유지했다.

## 참고 출처

- OpenAI Codex CLI: https://developers.openai.com/codex/cli
- OpenAI AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Supabase Database: https://supabase.com/docs/guides/database/overview
- Supabase Auth: https://supabase.com/docs/guides/auth
- Vercel Git Deployments: https://vercel.com/docs/deployments/git
- GitHub Secret Leakage Risks: https://docs.github.com/en/code-security/concepts/secret-security/secret-leakage-risks
