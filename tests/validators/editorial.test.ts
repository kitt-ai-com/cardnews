import { describe, expect, it } from "vitest";
import { CardSchema, type Card } from "@core/schemas/card";
import {
  collectCopyText,
  hasAssertiveSentence,
  loadEvaluativeWords,
  validateEditorial,
} from "@core/validators/editorial";

// ---------- v1 fixture (mirrors tests/schemas/card.test.ts) ----------

function v1Page(
  index: number,
  role: "cover" | "body" | "cta",
  layout: "cover" | "cta" | "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7"
) {
  return {
    index,
    role,
    layout,
    message: `m${index}`,
    mappingNote: `n${index}`,
    copy: { title: `T${index}` },
    manualEdit: false,
  };
}

const v1CardRaw = {
  id: "2026-05-01-test",
  series: "claude",
  preset: "c1-dark-lime",
  topic: "test",
  sourcePolicy: { trustLevel: "unknown" as const, factCheckMode: "strict" as const },
  coreMessage: "core",
  pages: [
    v1Page(1, "cover", "cover"),
    v1Page(2, "body", "P1"),
    v1Page(3, "body", "P2"),
    v1Page(4, "cta", "cta"),
  ],
  status: "draft.outline-ready" as const,
  attempts: [],
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

// ---------- v2 fixture factory ----------

interface MakeV2Opts {
  arc?: {
    hook: string;
    context: string;
    mechanism: string;
    evidence: string;
    implication: string;
    action: string;
  };
  claims?: Array<{
    id: string;
    text: string;
    type: "fact" | "number" | "quote" | "interpretation" | "recommendation";
    evidence?: string;
    confidence: "high" | "medium" | "low";
    sourceRef?: string;
    risk?: "none" | "needs-context" | "disputed" | "outdated";
    asOf?: string;
  }>;
  pages?: Array<{
    index: number;
    role: "cover" | "body" | "cta";
    layout:
      | "cover"
      | "cta"
      | "P1"
      | "P2"
      | "P3"
      | "P4"
      | "P5"
      | "P6"
      | "P7";
    copyIntent: string;
    claims?: string[];
    sourceNotes?: string[];
    copy?: {
      title: string;
      subtitle?: string;
      body?: string;
      list?: string[];
      highlight?: string;
    };
  }>;
}

const defaultArc = {
  hook: "독자가 멈칫할 한 줄 훅이다 진짜.",
  context: "이 변화가 일어난 시점과 배경을 설명한다.",
  mechanism: "어떻게 작동하는지 단계별로 살핀다.",
  evidence: "실제 사례와 수치를 함께 제시한다.",
  implication: "독자에게 어떤 의미인지 정리한다.",
  action: "오늘 당장 시도할 첫 단계를 제안한다.",
};

const defaultClaims: NonNullable<MakeV2Opts["claims"]> = [
  {
    id: "C1",
    text: "Claude Code는 터미널 기반 개발 환경이다.",
    type: "fact",
    confidence: "high",
    sourceRef: "https://code.claude.com/docs",
  },
  {
    id: "C2",
    text: "후크 시스템은 일관성을 강화한다고 볼 수 있다.",
    type: "interpretation",
    confidence: "medium",
  },
];

function defaultPages(): NonNullable<MakeV2Opts["pages"]> {
  return [
    {
      index: 1,
      role: "cover",
      layout: "cover",
      copyIntent: "hook",
      claims: ["C1"],
      copy: { title: "표지 제목" },
    },
    {
      index: 2,
      role: "body",
      layout: "P1",
      copyIntent: "evidence",
      claims: ["C1"],
      copy: {
        title: "근거 페이지",
        body: "공식 문서에 따르면 이 도구는 터미널 기반으로 동작한다고 한다.",
      },
    },
    {
      index: 3,
      role: "body",
      layout: "P2",
      copyIntent: "mechanism",
      claims: ["C2"],
      copy: {
        title: "메커니즘 페이지",
        body: "후크는 단계적으로 일관성을 만들어 낼 수 있다고 보인다.",
      },
    },
    {
      index: 4,
      role: "cta",
      layout: "cta",
      copyIntent: "cta",
      claims: [],
      copy: { title: "지금 시작하기" },
    },
  ];
}

function makeV2Card(overrides: MakeV2Opts = {}): Card {
  const arc = overrides.arc ?? defaultArc;
  const claims = overrides.claims ?? defaultClaims;
  const pages = (overrides.pages ?? defaultPages()).map((p) => ({
    ...p,
    message: `m${p.index}`,
    mappingNote: `n${p.index}`,
    manualEdit: false,
  }));

  const raw = {
    id: "2026-05-02-v2-fixture",
    series: "claude",
    preset: "c1-dark-lime",
    pipelineVersion: "v2-editorial" as const,
    topic: "test",
    sourcePolicy: { trustLevel: "primary" as const, factCheckMode: "strict" as const },
    coreMessage: "core",
    thesis: "thesis sentence",
    audienceQuestion: "독자가 진짜 묻는 질문은?",
    narrativeArc: arc,
    claimLedger: {
      claims,
      sourceDigest: { audienceQuestion: "독자가 진짜 묻는 질문은?" },
    },
    pages,
    status: "draft.copy-ready" as const,
    attempts: [],
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  };

  // Parse so we get a Card instance (and also assert the fixture is valid).
  return CardSchema.parse(raw);
}

// ============ Helpers ============

describe("hasAssertiveSentence", () => {
  it("detects '이다.' ending sentences over 10 chars", () => {
    expect(
      hasAssertiveSentence("이 도구는 매우 빠른 터미널 환경이다.")
    ).toBe(true);
  });

  it("detects '다.' ending sentences over 10 chars", () => {
    expect(
      hasAssertiveSentence("후크 시스템은 일관성을 강화한다.")
    ).toBe(true);
  });

  it("does not flag short labels under 10 chars", () => {
    expect(hasAssertiveSentence("좋다.")).toBe(false);
  });

  it("does not flag tentative endings", () => {
    expect(
      hasAssertiveSentence("이 도구는 일관성을 강화할 수 있다고 보인다")
    ).toBe(false);
  });
});

describe("collectCopyText", () => {
  it("concatenates title, subtitle, body, list, highlight", () => {
    const text = collectCopyText({
      index: 1,
      role: "body",
      layout: "P1",
      message: "m",
      mappingNote: "n",
      copy: {
        title: "T",
        subtitle: "S",
        body: "B",
        list: ["L1", "L2"],
        highlight: "H",
      },
      manualEdit: false,
    });
    expect(text).toContain("T");
    expect(text).toContain("S");
    expect(text).toContain("B");
    expect(text).toContain("L1");
    expect(text).toContain("L2");
    expect(text).toContain("H");
  });
});

describe("loadEvaluativeWords", () => {
  it("returns inline list as-is", async () => {
    const words = await loadEvaluativeWords(["foo", "bar"]);
    expect(words).toEqual(["foo", "bar"]);
  });

  it("loads default dictionary when nothing provided", async () => {
    const words = await loadEvaluativeWords(undefined);
    expect(words).toContain("강력하다");
    expect(words).toContain("완벽한");
  });
});

// ============ validateEditorial ============

describe("validateEditorial", () => {
  it("v1 card returns ok regardless", async () => {
    const card = CardSchema.parse(v1CardRaw);
    const r = await validateEditorial(card);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("valid v2 card with all checks satisfied returns ok", async () => {
    const card = makeV2Card();
    const r = await validateEditorial(card);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
  });

  it("triggers EDITORIAL/UNSUPPORTED_CLAIM when assertive copy has no claim refs", async () => {
    const card = makeV2Card({
      pages: [
        {
          index: 1,
          role: "cover",
          layout: "cover",
          copyIntent: "hook",
          claims: ["C1"],
          copy: { title: "표지" },
        },
        {
          index: 2,
          role: "body",
          layout: "P1",
          copyIntent: "evidence",
          claims: [],
          copy: {
            title: "본문",
            body: "이 시스템은 완전히 새로운 패러다임이다.",
          },
        },
        {
          index: 3,
          role: "body",
          layout: "P2",
          copyIntent: "mechanism",
          claims: ["C2"],
          copy: {
            title: "메커니즘",
            body: "이 메커니즘은 단계적으로 작동한다고 볼 수 있다.",
          },
        },
        {
          index: 4,
          role: "cta",
          layout: "cta",
          copyIntent: "cta",
          claims: [],
          copy: { title: "CTA" },
        },
      ],
    });
    const r = await validateEditorial(card);
    expect(r.ok).toBe(false);
    const v = r.violations.find(
      (x) => x.code === "EDITORIAL/UNSUPPORTED_CLAIM"
    );
    expect(v).toBeDefined();
    expect(v?.pageIndex).toBe(2);
  });

  it("triggers EDITORIAL/LOW_CONFIDENCE_ASSERTION when assertive copy refs low-confidence claim", async () => {
    const card = makeV2Card({
      claims: [
        {
          id: "C1",
          text: "추측에 가까운 주장",
          type: "interpretation",
          confidence: "low",
        },
        {
          id: "C2",
          text: "보조 주장",
          type: "fact",
          confidence: "high",
          sourceRef: "ref",
        },
      ],
      pages: [
        {
          index: 1,
          role: "cover",
          layout: "cover",
          copyIntent: "hook",
          claims: ["C2"],
          copy: { title: "표지" },
        },
        {
          index: 2,
          role: "body",
          layout: "P1",
          copyIntent: "evidence",
          claims: ["C1"],
          copy: {
            title: "본문",
            body: "이 변화는 모든 개발자에게 결정적인 전환점이다.",
          },
        },
        {
          index: 3,
          role: "body",
          layout: "P2",
          copyIntent: "mechanism",
          claims: ["C2"],
          copy: {
            title: "메커니즘",
            body: "이 메커니즘은 단계적으로 작동할 수 있다고 보인다",
          },
        },
        {
          index: 4,
          role: "cta",
          layout: "cta",
          copyIntent: "cta",
          claims: [],
          copy: { title: "CTA" },
        },
      ],
    });
    const r = await validateEditorial(card);
    const v = r.violations.find(
      (x) => x.code === "EDITORIAL/LOW_CONFIDENCE_ASSERTION"
    );
    expect(v).toBeDefined();
    expect(v?.pageIndex).toBe(2);
    expect(v?.details).toMatchObject({ claimId: "C1" });
  });

  it("triggers EDITORIAL/OUTDATED_NO_DATE when outdated claim used without date", async () => {
    const card = makeV2Card({
      claims: [
        {
          id: "C1",
          text: "오래된 통계",
          type: "number",
          evidence: "2024-03 보고서",
          confidence: "high",
          risk: "outdated",
          asOf: "2024-03",
        },
        {
          id: "C2",
          text: "보조 주장",
          type: "interpretation",
          confidence: "medium",
        },
      ],
      pages: [
        {
          index: 1,
          role: "cover",
          layout: "cover",
          copyIntent: "hook",
          claims: ["C1"],
          copy: { title: "표지" },
        },
        {
          index: 2,
          role: "body",
          layout: "P1",
          copyIntent: "evidence",
          claims: ["C1"],
          // no "2024" anywhere, no sourceNotes with year
          copy: {
            title: "근거",
            body: "보고서에 따르면 사용자가 늘어났다고 한다",
          },
        },
        {
          index: 3,
          role: "body",
          layout: "P2",
          copyIntent: "mechanism",
          claims: ["C2"],
          copy: {
            title: "메커니즘",
            body: "이 흐름은 점진적으로 굳어질 수 있다고 보인다",
          },
        },
        {
          index: 4,
          role: "cta",
          layout: "cta",
          copyIntent: "cta",
          claims: [],
          copy: { title: "CTA" },
        },
      ],
    });
    const r = await validateEditorial(card);
    const v = r.violations.find(
      (x) => x.code === "EDITORIAL/OUTDATED_NO_DATE"
    );
    expect(v).toBeDefined();
    expect(v?.pageIndex).toBe(2);
    expect(v?.details).toMatchObject({ claimId: "C1" });
  });

  it("triggers EDITORIAL/EVALUATIVE_NO_BACKING when evaluative word used without high-confidence claim", async () => {
    const card = makeV2Card({
      claims: [
        {
          id: "C1",
          text: "약한 주장",
          type: "interpretation",
          confidence: "medium",
        },
        {
          id: "C2",
          text: "다른 주장",
          type: "fact",
          confidence: "high",
          sourceRef: "ref",
        },
      ],
      pages: [
        {
          index: 1,
          role: "cover",
          layout: "cover",
          copyIntent: "hook",
          claims: ["C2"],
          copy: { title: "표지" },
        },
        {
          index: 2,
          role: "body",
          layout: "P1",
          copyIntent: "evidence",
          claims: ["C1"], // medium-confidence only
          copy: {
            title: "본문",
            body: "이 도구는 강력하다고 평가받는다고 보인다",
          },
        },
        {
          index: 3,
          role: "body",
          layout: "P2",
          copyIntent: "mechanism",
          claims: ["C2"],
          copy: {
            title: "메커니즘",
            body: "이 메커니즘은 단계적으로 작동할 수 있다고 보인다",
          },
        },
        {
          index: 4,
          role: "cta",
          layout: "cta",
          copyIntent: "cta",
          claims: [],
          copy: { title: "CTA" },
        },
      ],
    });
    const r = await validateEditorial(card);
    const v = r.violations.find(
      (x) => x.code === "EDITORIAL/EVALUATIVE_NO_BACKING"
    );
    expect(v).toBeDefined();
    expect(v?.pageIndex).toBe(2);
    expect(v?.details?.words).toEqual(
      expect.arrayContaining(["강력하다"])
    );
  });

  it("triggers EDITORIAL/UNUSED_CLAIM when high-confidence claim never referenced", async () => {
    const card = makeV2Card({
      claims: [
        {
          id: "C1",
          text: "사용된 주장",
          type: "fact",
          confidence: "high",
          sourceRef: "ref",
        },
        {
          id: "C2",
          text: "사용된 보조 주장",
          type: "interpretation",
          confidence: "medium",
        },
        {
          id: "C3",
          text: "한 번도 안 쓰인 high-confidence 주장",
          type: "fact",
          confidence: "high",
          sourceRef: "ref",
        },
      ],
      // default pages reference only C1, C2 — C3 left dangling
    });
    const r = await validateEditorial(card);
    const v = r.violations.find((x) => x.code === "EDITORIAL/UNUSED_CLAIM");
    expect(v).toBeDefined();
    expect(v?.details).toMatchObject({ claimId: "C3" });
  });

  it("triggers EDITORIAL/THIN_ARC when 4 of 6 sections are under 10 chars", async () => {
    const thinArc = {
      hook: "짧음",
      context: "짧음",
      mechanism: "이 메커니즘은 단계적으로 작동한다고 볼 수 있다.",
      evidence: "짧음",
      implication: "이 의미는 독자에게 직접적으로 영향을 준다.",
      action: "짧음",
    };
    const card = makeV2Card({ arc: thinArc });
    const r = await validateEditorial(card);
    const v = r.violations.find((x) => x.code === "EDITORIAL/THIN_ARC");
    expect(v).toBeDefined();
    expect(v?.details?.thinSections).toEqual(
      expect.arrayContaining(["hook", "context", "evidence", "action"])
    );
  });

  it("does not trigger UNSUPPORTED_CLAIM on cover or cta pages", async () => {
    // Default cta page has empty claims and copy "지금 시작하기" — no
    // assertive form anyway, but verify cover/cta are skipped explicitly by
    // forcing assertive copy on the cta page.
    const card = makeV2Card({
      pages: [
        {
          index: 1,
          role: "cover",
          layout: "cover",
          copyIntent: "hook",
          claims: [],
          copy: {
            title: "이 시스템은 완전히 새로운 패러다임이다.",
          },
        },
        {
          index: 2,
          role: "body",
          layout: "P1",
          copyIntent: "evidence",
          claims: ["C1"],
          copy: {
            title: "근거",
            body: "공식 문서에 따르면 이 도구는 터미널 기반으로 작동한다고 한다",
          },
        },
        {
          index: 3,
          role: "body",
          layout: "P2",
          copyIntent: "mechanism",
          claims: ["C2"],
          copy: {
            title: "메커니즘",
            body: "이 흐름은 단계적으로 굳어질 수 있다고 보인다",
          },
        },
        {
          index: 4,
          role: "cta",
          layout: "cta",
          copyIntent: "cta",
          claims: [],
          copy: { title: "이 시스템은 완전히 새로운 패러다임이다." },
        },
      ],
    });
    const r = await validateEditorial(card);
    const v = r.violations.find(
      (x) => x.code === "EDITORIAL/UNSUPPORTED_CLAIM"
    );
    expect(v).toBeUndefined();
  });
});
