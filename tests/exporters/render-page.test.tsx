import { describe, it, expect } from "vitest";
import { renderPageHTML, markMeasurable } from "../../src/exporters/render-page";
import type { Card } from "@core/schemas/card";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";

const series: Series = {
  id: "claude",
  name: "Claude Series",
  theme: "ai",
  defaultPreset: "c1-dark-lime",
  audience: "devs",
  tone: "informative",
  branding: { seriesTag: "#claude" },
  footerHandle: "@claude",
  trustedDomains: [],
  imageProvider: "codex-image",
};

const preset: Preset = {
  id: "c1-dark-lime",
  name: "Dark Lime",
  canvas: { width: 1080, height: 1350 },
  colors: {
    background: "#0e0e10",
    text: "#f5f5f5",
    accent: "#c8ff00",
    muted: "#888888",
  },
  typography: {
    fontFamily: ["Pretendard", "system-ui"],
    title: { size: 60, weight: 800, lineHeight: 1.15, letterSpacing: -1 },
    body: { size: 36, weight: 500, lineHeight: 1.45, letterSpacing: 0 },
    label: { size: 22, weight: 600, lineHeight: 1.3, letterSpacing: 0 },
    hierarchyRatio: 1.5,
  },
  spacing: {
    safeZone: { top: 80, right: 60, bottom: 120, left: 60 },
    verticalBands: { header: 0.15, body: 0.6, footer: 0.25 },
    contentRatio: 0.6,
  },
  layouts: ["cover", "cta", "P1", "P2", "P3", "P4", "P5"],
  imageStyle: "neon brutalist",
};

const samplePage: Page = {
  index: 2,
  role: "body",
  layout: "P1",
  message: "test message",
  mappingNote: "test mapping",
  copy: {
    title: "이것은 테스트 타이틀",
    body: "본문은 한 줄로 짧게.",
  },
  manualEdit: false,
};

const card: Card = {
  id: "card-render-test",
  series: "claude",
  preset: "c1-dark-lime",
  pipelineVersion: "v1-mocked",
  topic: "render-page test",
  sourcePolicy: { trustLevel: "unknown", factCheckMode: "skip" },
  coreMessage: "test core message",
  pages: [
    {
      index: 1,
      role: "cover",
      layout: "cover",
      message: "cover msg",
      mappingNote: "cover map",
      copy: { title: "표지" },
      manualEdit: false,
    },
    samplePage,
    {
      index: 3,
      role: "body",
      layout: "P2",
      message: "body 2",
      mappingNote: "body 2 map",
      copy: { title: "두 번째" },
      manualEdit: false,
    },
    {
      index: 4,
      role: "cta",
      layout: "cta",
      message: "cta msg",
      mappingNote: "cta map",
      copy: { title: "행동" },
      manualEdit: false,
    },
  ],
  status: "draft.images-ready",
  attempts: [],
  createdAt: "2026-05-02T00:00:00.000Z",
  updatedAt: "2026-05-02T00:00:00.000Z",
};

describe("renderPageHTML", () => {
  it("returns a complete HTML document with doctype, tokens, and the page title", () => {
    const html = renderPageHTML({ card, page: samplePage, preset, series });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<html lang=\"ko\">");
    expect(html).toContain("--color-bg: #0e0e10");
    expect(html).toContain("이것은 테스트 타이틀");
    // measurement attributes must be applied to the title role.
    expect(html).toMatch(/data-cn-role="title"\s+data-measure="title"/);
  });

  it("includes the pretendardCSS when provided", () => {
    const html = renderPageHTML({
      card,
      page: samplePage,
      preset,
      series,
      pretendardCSS: "/* pretendard mock */",
    });
    expect(html).toContain("/* pretendard mock */");
  });

  it("throws on unknown layout", () => {
    const bogus: Page = { ...samplePage, layout: "P99" as Page["layout"] };
    expect(() =>
      renderPageHTML({ card, page: bogus, preset, series })
    ).toThrow(/Unknown layout/);
  });
});

describe("markMeasurable", () => {
  it("adds data-measure to title/body/label-tag roles", () => {
    const input = `<div data-cn-role="title">x</div><div data-cn-role="body">y</div><div data-cn-role="label-tag">z</div>`;
    const out = markMeasurable(input);
    expect(out).toMatch(/data-cn-role="title"\s+data-measure="title"/);
    expect(out).toMatch(/data-cn-role="body"\s+data-measure="body"/);
    expect(out).toMatch(/data-cn-role="label-tag"\s+data-measure="label"/);
  });

  it("leaves non-measured roles alone", () => {
    const input = `<div data-cn-role="frame"></div><div data-cn-role="footer-handle"></div>`;
    expect(markMeasurable(input)).toBe(input);
  });
});
