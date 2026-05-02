# Cardnews Automation — Claude Code Project Context

> 이 파일은 Claude Code가 세션 시작 시 자동 로드합니다. 카드뉴스 작업 전 반드시 이 흐름을 따르세요.

## 이 프로젝트가 하는 일

한국어 인스타그램 카드뉴스 자동화 시스템. 주제 또는 원고를 입력하면 분석 → 카피 → 이미지 → 레이아웃 → PNG export까지 일관된 시리즈 voice로 산출.

**기본 시리즈:** Claude (`data/series/claude/`)
**프리셋:** C1 다크 모던 + 라임 (`data/presets/variants/c1-dark-lime.json`)
**규격:** 1080×1350 (인스타 세로형) → 2x retina export = 2160×2700

---

## 반드시 읽고 시작 (시리즈 작업 전)

작업 종류와 무관하게 다음 4개 파일을 먼저 read 하세요:

1. **`data/series/<series>/design-guide.md`** — 시리즈 디자인 시스템 (현재 rev 8)
2. **`data/series/<series>/references/editorial-style-references.md`** — 짐코딩·DEEPDIVE 레퍼런스 패턴
3. **`docs/superpowers/specs/2026-05-02-claim-ledger-revision.md`** — v2 editorial pipeline 정의
4. **`docs/superpowers/specs/2026-05-02-design-agent-addendum.md`** — Designer 에이전트 + Team Orchestrator 패턴

(이 4개를 안 읽으면 시리즈 voice가 일관되지 않고 같은 시행착오 반복.)

---

## Team Orchestrator 패턴 (필수)

**Solo CSS 편집·솔로 카피 작성 금지.** 사용자 피드백이 오면 항상 **에이전트 팀 디스패치**:

| 피드백 종류 | 디스패치할 에이전트 |
|---|---|
| 시각·레이아웃·간격 ("이상해", "답답해") | **DesignReviewer** (`data/agents/design-reviewer.md`) |
| 카피 약함·톤 어긋남 | **Copywriter** (`data/agents/copywriter.md`) |
| 사실 의심·평가어·일관성 | **EditorialReviewer** (`data/agents/editorial-reviewer.md`) |
| 흐름·구성 깨짐 | **Analyst** (`data/agents/analyst.md`) — WebFetch/WebSearch 활용 |
| 모름·종합 진단 | 위 4개 **병렬 디스패치** + 결과 통합 |
| 이미지 생성 | **ImageDirector** → `/codex-image` |

**병렬 디스패치 시 단일 메시지에 여러 Agent 도구 블록**으로 호출. 결과를 Orchestrator(이 채팅)가 통합.

**모든 에이전트 디스패치 프롬프트에 다음 줄을 넣을 것:**
```
이 작업 시작 전 읽으세요:
- projects/cardnews/data/series/<series>/design-guide.md
- projects/cardnews/data/series/<series>/references/editorial-style-references.md
```

---

## 핵심 룰 (다음 카드뉴스에서 자동 적용)

### 콘텐츠
- **사실 검증 후 카피.** 머릿속 추측 금지. WebFetch / claude-code-guide / sourceText 우선.
- **평가어 금지** (강력한·완벽한·혁신적인·필수·압도적·최고의 — 근거 없으면).
- **메타 내레이션 금지** ("핵심 차이는 ~다", "이제 이해됐을 것이다").
- **한 페이지 한 메시지.**
- **타이틀 accent: ONE 단어만**.
- **Anthropic voice 차용**: 공식 docs 첫 문장 키워드를 1장 후킹에 (예: "agentic coding tool that reads/edits/runs").

### 시리즈 일관성
- 후속 페이지에서 등장할 핵심 사실(멀티 환경·플랜·가격)은 **1-2장에 미리 노출**. 늦게 등장하면 surprise → confusion.
- 한국 입문자 misconception은 선제 해소 (P15 myth-reality 카드).
- 영어 명사 표기 통일 (Claude Code, Codex CLI, Opus 4.7, GPT-5).

### CSS / 타이포
- **`word-break: keep-all`** + `overflow-wrap: break-word` (`.card-inner`에) — 한글 어절 단위 줄바꿈 (rev 8 룰).
- 코드 블록은 예외 (`overflow-wrap: anywhere`).
- 폰트: Pretendard / Noto Sans KR.
- letter-spacing: `-0.02em` 기본.

### 색 시맨틱
- 라임 (`#c4ff3d`) = 메인·강조 (한 페이지 1-2회만)
- 녹 (`#58e07a`) = 장점 ✓
- 빨 (`#ff6b6b`) = 한계 ✗
- 파 (`#6fb8ff`) = 대안·대비

색은 **정보를 코딩**한다. 시각 다양성 위해 색 쓰면 시맨틱 혼선.

### 이미지
- 추상 글로우 일색 X. 자연 톤 사진 스타일 우선.
- 콘텐츠와 시각적 연결 필요 (예: Claude Code → 노트북·터미널, MCP → 케이블·연결).
- 라임은 작은 액센트만, 이미지 전체가 라임이면 AI 생성 티 남.
- gpt-image-2: 텍스트 절대 X (한글·영문·숫자·기호 다 깨짐).

### 레이아웃 일관성
- 브랜드 스트립 (avatar + 핸들 + 시리즈 + 해시태그) y=60 모든 페이지.
- 페이지 번호 우상단 y=130.
- 라벨 y=220, 타이틀 y=280, 콘텐츠 y=540, 콜아웃 y=1100 고정.
- 콘텐츠는 캔버스 60-70%만 채우고 하단 30-40% 비움.
- 푸터 핸들 좌하단 모든 페이지.

---

## 산출물 위치

```
data/series/<series>/cards/<YYYY-MM-DD-slug>/
├─ analysis.md           ← Analyst 산출물 (web 리서치 + 추천 구성)
├─ preview.html          ← 수동 MVP 또는 M3 렌더 결과
├─ images/               ← 배경 이미지 (gpt-image-2)
└─ exports/              ← 최종 PNG (1080×1350 또는 2160×2700)
```

기존 살아있는 사례:
- `cards/2026-05-01-claude-code-three/` — v1 mocked baseline (스킬·훅·루프)
- `cards/2026-05-02-claude-code-getting-started/` — v8 final (Claude Code 처음 시작)

---

## 시스템 (M1·M2·M3 결과)

| 마일스톤 | 무엇 | 상태 |
|---|---|---|
| **M1** | 모킹 파이프라인 (schema · validator · orchestrator) | ✅ 완료 |
| **M2** | 실 LLM 통합 + Claim Ledger + 4 에이전트 시스템 프롬프트 | ✅ 완료 (script 빌드, 실행은 사용자 키 필요) |
| **M3** | Renderer + L2 측정 + transactional PNG export | ✅ 완료 (`m3:export` 사용 가능) |

---

## CLI 명령

```sh
# 모킹 파이프라인 smoke test
bun run m1:smoke

# 실 Claude API 카드뉴스 (ANTHROPIC_API_KEY 필요)
bun run m2:first-v2 "<주제>"

# 어떤 카드든 PNG export (M3 React 카드 한정)
bun run m3:export --card <card-id>

# 수동 MVP 카드 PNG 변환 (preview.html 기반)
bun run scripts/render-getting-started.ts  # 또는 비슷하게 작성
```

---

## 메모리 (Claude Code 세션 자동 로드)

`~/.claude/projects/-Users-uhuru-dev-design-agent/memory/MEMORY.md`에 인덱스. 핵심:
- `feedback_workflow.md` — phase batching, autonomous progress
- `feedback_cardnews_research.md` — 사실 검증 우선
- `feedback_cardnews_depth.md` — 주장 검증형 편집 시스템
- `feedback_cardnews_references.md` — references 파일 먼저 읽기
- `feedback_cardnews_team.md` — 5-에이전트 팀 워크플로우

---

## 확장

- 새 시리즈 만들 때: `data/series/<new-id>/{series.json, design-guide.md, references/}` 동일 구조.
- 새 카드뉴스: `data/series/<series>/cards/<date-slug>/` + 새 카드 시작 시 위 4개 파일 read.
- 새 에이전트: `data/agents/<role>.md` + `src/core/agents/contracts/<role>.ts`.
