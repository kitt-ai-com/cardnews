# Claude Code 처음 시작 — 분석 (2026-05-02)

> v7 후속 카피·디자인 작업의 토대가 되는 1차 자료 분석. 모든 단정형은 출처에 따라 검증함.
> Researcher: Analyst agent (general-purpose, WebFetch + WebSearch).

## Anthropic 공식 메시징

**code.claude.com/docs/en/overview 첫 문장:**
> "Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools. **Available in your terminal, IDE, desktop app, and browser.**"

**반복되는 핵심 어구**: "agentic coding tool" / "reads, edits, runs" / "build, debug, ship" / "understands your entire codebase" / "Available in your terminal, IDE, desktop app, and browser"

**핵심 시그널**: Anthropic은 "터미널 AI"라고 자기소개하지 **않는다**. 터미널은 첫 환경일 뿐 본질이 아니라는 메시지가 일관됨.

## 멀티 환경 메시징 — v7의 가장 큰 일관성 이슈

공식 모델: **"하나의 엔진, 여러 표면(surface)"** — Terminal · VS Code · Desktop · Web · JetBrains · Slack · iOS

공식 디폴트는 Terminal CLI지만, **InstallConfigurator는 4탭 동등 노출**. 한국 입문자 후기는 일관되게 "터미널 자체가 진입장벽" 보고 → 데스크탑/Web 친화도가 더 높음.

**v7 혼선 진단**:
- 1장: "터미널에 AI 개발자가 산다" (터미널로 단언)
- 2장: "터미널 띄워두면..." (강화)
- 3장: "둘 다 터미널 AI" (또 강화)
- 5장: 갑자기 데스크탑·터미널·VS Code 3환경 등장
- 5장 callout: "처음이면 데스크탑 앱" (앞 4장 메시지 뒤집음)
→ "터미널 AI라더니 왜 데스크탑이 추천이지?"에서 신뢰 상실.

## Codex CLI 공정 비교 (검증)

| 축 | Claude Code | Codex CLI |
|---|---|---|
| 본체 라이선스 | proprietary | **Apache-2.0 open source** |
| 기본 모델 | Opus 4.7 | **gpt-5.5** (gpt-5-Codex 아님) |
| 컨텍스트 | 1M 표준 | 272K 기본, 1.05M 옵션(가산) |
| 안전 모델 | App-layer hooks (26 lifecycle events) | Kernel-level sandbox (Seatbelt/Landlock) |
| 벤치마크 (terminal) | 65.4% | **77.3%** |
| 블라인드 코드 품질 | **67% 승** | 33% |

**v7 카피 오류**: "GPT-5-Codex" 부정확 (`gpt-5.5`가 정확) / "Claude는 길게 생각하고, Codex는 빨리 답한다"는 인상비평으로 벤치마크와 어긋남.

## 한국 개발자 첫 질문/오해 (web search)

**자주 나오는 질문**:
1. "무료로 쓸 수 있나?" → Pro $20/월 이상 필수
2. "API 키 꼭 필요한가?" → **아니오**. Pro 구독 로그인이면 OK
3. "VS Code 확장으로만 써도 되나?" → 가능
4. "Cursor·Copilot이랑 뭐가 다른가?"
5. "한국어로 명령해도 되나?" → 네

**자주 나오는 오해**:
- ❌ "터미널 못 쓰면 못 쓴다"
- ❌ "Claude.ai 무료 계정으로 Claude Code 쓸 수 있다"
- ❌ "API 키 없으면 못 쓴다"

## 설치 명령 검증

| 환경 | 명령 |
|---|---|
| macOS/Linux/WSL | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Windows PowerShell | `irm https://claude.ai/install.ps1 \| iex` |
| Windows WinGet | `winget install Anthropic.ClaudeCode` |
| Homebrew | `brew install --cask claude-code` |
| 데스크탑 앱 | claude.com/download |
| VS Code 확장 | Marketplace `anthropic.claude-code` |
| Web (무설치) | claude.ai/code |
| 첫 실행 | `claude` (자동 로그인) |
| 버전 확인 | `claude --version` |

## 가격·플랜 (2026-05)

| 플랜 | 가격 | Claude Code |
|---|---|---|
| Free | $0 | ❌ |
| Pro | $17~20/mo | ✅ |
| Max | $100~200/mo | ✅ + Opus 4.7 우선 |
| Team | $20~125/seat | ✅ |
| Enterprise | 영업 | ✅ |
| API | Opus 4.7 $5/$25 per Mtok | ✅ |

**한국어 카피 주의**: 무료 Claude.ai ≠ 무료 Claude Code

## v8 추천 구성

| # | 카드 | 메시지 | v7과의 차이 |
|---|---|---|---|
| 01 | 후킹 | "내 코드베이스를 읽고·고치고·돌리는 AI" | "터미널에 산다" 제거 |
| 02 | 정의 + 멀티 환경 | "한 엔진, 다섯 표면" | 멀티 환경을 앞당겨 5장 surprise 제거 |
| 03 | 입문자 오해 깨기 | 유료 / API 키 불필요 / 한국어 OK | **새 카드** (v7엔 없음) |
| 04 | 4가지 특징 | 코드베이스 통째 / 셀프 테스트 / Git / 내 손 맞춤 | v7 04 유지 |
| 05 | 설치 — 어디서 시작 | 데스크탑/터미널/VS Code 비교 | 02에서 환경 풀어뒀으니 자연스러움 |
| 06 | 한 줄 설치 명령 | macOS/Linux + Win-PS + WinGet + Homebrew | winget 추가 |
| 07 | 첫 4단계 | claude → 묻기 → 작은 변경 → 커밋 | step1에 "Pro 로그인" 명시 |
| 08 | CTA | "5분이면 끝" | docs URL 보조 추가 |

**Codex 비교 카드 제거** — 입문 카드뉴스에 부적절. 별도 후속 시리즈로 분리.

## v7 사실 검증 (Critical/Important)

**Critical**:
- 카드 1 "터미널에 AI 개발자가 산다" — 공식 framing과 어긋남
- 카드 3 "GPT-5-Codex" 부정확 (gpt-5.5)
- 카드 3 "Claude는 길게 생각하고, Codex는 빨리 답한다" — 벤치마크 정반대

**Important**:
- 카드 2 callout — Free 미포함 명시 누락
- 카드 5 "처음이면 데스크탑 앱" — 공식 디폴트는 Terminal, 한국 입문자만 데스크탑 친화
- 카드 6 winget 누락
- 카드 7 step1 — Pro 계정 필요 흐려짐

## 출처

### Fetched
- code.claude.com/docs/en/overview, /quickstart, /docs/ko/quickstart
- claude.com/pricing, claude.com/product/claude-code
- developers.openai.com/codex/cli, /codex/models, /codex/pricing
- github.com/openai/codex

### WebSearch (Korean)
- wikidocs.net/book/19202, sungjk.github.io, velog.io/@laply, tech.hyperithm.com
- gpters.org (multiple), 0x00.kr/ai/claude, blog.highoutputclub.com
- digitalmarketer.co.kr, aifactory.space, magicaiprompts.com

### Comparison
- blakecrosley.com/blog/codex-vs-claude-code-2026
- nxcode.io, smartscope.blog, morphllm.com
