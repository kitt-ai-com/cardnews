import { describe, expect, it } from "vitest";
import { PageSchema } from "@core/schemas/page";

const validBodyPage = {
  index: 2,
  role: "body",
  layout: "P1",
  message: "1M 컨텍스트의 실제 의미",
  mappingNote: "coreMessage의 '실제 변화'를 구체 예시로 보여줌",
  copy: {
    label: "CLAUDE 4.7",
    title: "1M 토큰 컨텍스트<br>실제로 뭐가 <accent>달라질까</accent>",
    subtitle: "긴 코드 한 번에 추론",
    body: "이전 200K 모델로는 쪼개야 했던 작업이 한 번에 끝난다.",
    pageNum: "02 / 08",
  },
  image: {
    path: "data/series/claude/cards/x/images/page-02.png",
    prompt: { text: "abstract dark lime", size: "1024x1536" },
    manualOverride: false,
  },
  manualEdit: false,
};

describe("Page", () => {
  it("accepts a valid body page", () => {
    expect(() => PageSchema.parse(validBodyPage)).not.toThrow();
  });

  it("requires message", () => {
    const { message: _omit, ...rest } = validBodyPage;
    expect(() => PageSchema.parse(rest)).toThrow();
  });

  it("requires mappingNote", () => {
    const { mappingNote: _omit, ...rest } = validBodyPage;
    expect(() => PageSchema.parse(rest)).toThrow();
  });

  it("rejects empty message / mappingNote", () => {
    expect(() =>
      PageSchema.parse({ ...validBodyPage, message: "" })
    ).toThrow();
    expect(() =>
      PageSchema.parse({ ...validBodyPage, mappingNote: "" })
    ).toThrow();
  });

  it("accepts no image (e.g., P3 checklist)", () => {
    const noImg = {
      ...validBodyPage,
      layout: "P3",
      image: undefined,
    };
    expect(() => PageSchema.parse(noImg)).not.toThrow();
  });

  it("rejects unknown role", () => {
    expect(() =>
      PageSchema.parse({ ...validBodyPage, role: "footer" })
    ).toThrow();
  });

  it("rejects unknown layout", () => {
    expect(() =>
      PageSchema.parse({ ...validBodyPage, layout: "P9" })
    ).toThrow();
  });

  it("rejects index < 1", () => {
    expect(() =>
      PageSchema.parse({ ...validBodyPage, index: 0 })
    ).toThrow();
    expect(() =>
      PageSchema.parse({ ...validBodyPage, index: -1 })
    ).toThrow();
  });

  it("rejects non-integer index", () => {
    expect(() =>
      PageSchema.parse({ ...validBodyPage, index: 2.5 })
    ).toThrow();
  });

  it("manualOverride and manualEdit default to false", () => {
    const minimal = {
      index: 1,
      role: "cover",
      layout: "cover",
      message: "m",
      mappingNote: "n",
      copy: { title: "T" },
    };
    const out = PageSchema.parse(minimal);
    expect(out.manualEdit).toBe(false);
  });

  it("manualOverride defaults to false when image given without it", () => {
    const out = PageSchema.parse({
      ...validBodyPage,
      image: {
        path: "x.png",
        prompt: { text: "t", size: "1024x1024" },
      },
    });
    expect(out.image?.manualOverride).toBe(false);
  });

  it("requires copy.title", () => {
    expect(() =>
      PageSchema.parse({
        ...validBodyPage,
        copy: { ...validBodyPage.copy, title: "" },
      })
    ).toThrow();
  });

  it("parses without v2 fields (backward compat for v1)", () => {
    const out = PageSchema.parse(validBodyPage);
    expect(out.copyIntent).toBeUndefined();
    expect(out.infoPattern).toBeUndefined();
    // v2 array fields are .optional() — omission produces undefined.
    // Consumers that need a list should default with `?? []`.
    expect(out.claims).toBeUndefined();
    expect(out.unsupportedClaims).toBeUndefined();
    expect(out.sourceNotes).toBeUndefined();
  });

  it("parses with all v2 fields populated", () => {
    const out = PageSchema.parse({
      ...validBodyPage,
      copyIntent: "evidence",
      infoPattern: "I1",
      claims: ["C1", "C2"],
      unsupportedClaims: ["C9"],
      sourceNotes: ["출처: anthropic.com"],
    });
    expect(out.copyIntent).toBe("evidence");
    expect(out.infoPattern).toBe("I1");
    expect(out.claims).toEqual(["C1", "C2"]);
    expect(out.unsupportedClaims).toEqual(["C9"]);
    expect(out.sourceNotes).toEqual(["출처: anthropic.com"]);
  });

  it("claims/unsupportedClaims/sourceNotes are undefined when omitted", () => {
    const minimal = {
      index: 1,
      role: "cover",
      layout: "cover",
      message: "m",
      mappingNote: "n",
      copy: { title: "T" },
    };
    const out = PageSchema.parse(minimal);
    expect(out.claims).toBeUndefined();
    expect(out.unsupportedClaims).toBeUndefined();
    expect(out.sourceNotes).toBeUndefined();
  });

  it("rejects unknown copyIntent", () => {
    expect(() =>
      PageSchema.parse({ ...validBodyPage, copyIntent: "intro" })
    ).toThrow();
  });
});
