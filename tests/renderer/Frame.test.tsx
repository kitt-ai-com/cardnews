import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Frame, HeaderBand, BodyBand } from "../../src/renderer/Frame";
import { PresetSchema } from "@core/schemas/preset";
import { SeriesSchema } from "@core/schemas/series";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDarkLime() {
  const json = JSON.parse(
    readFileSync(
      resolve(__dirname, "../../data/presets/variants/c1-dark-lime.json"),
      "utf8"
    )
  );
  return PresetSchema.parse(json);
}

function buildSeries() {
  return SeriesSchema.parse({
    id: "test-series",
    name: "Test",
    theme: "ai",
    defaultPreset: "c1-dark-lime",
    audience: "devs",
    tone: "informative",
    branding: { seriesTag: "#TestTag" },
    footerHandle: "@designkitt",
  });
}

describe("Frame", () => {
  it("renders a 1080×1350 canvas div with bg CSS var", () => {
    const preset = loadDarkLime();
    const series = buildSeries();
    const html = renderToStaticMarkup(
      <Frame
        preset={preset}
        series={series}
        pageIndex={1}
        totalPages={8}
        scopeId="cn-frame-test"
      >
        <BodyBand>Hello</BodyBand>
      </Frame>
    );
    expect(html).toContain('data-cn-role="frame"');
    expect(html).toContain("var(--canvas-width)");
    expect(html).toContain("var(--canvas-height)");
    expect(html).toContain("var(--color-bg)");
    expect(html).toContain("--color-bg: #0e0e10");
    expect(html).toContain(".cn-frame-test");
  });

  it("scopes CSS vars by class name (multiple frames don't clash)", () => {
    const preset = loadDarkLime();
    const series = buildSeries();
    const html = renderToStaticMarkup(
      <div>
        <Frame
          preset={preset}
          series={series}
          pageIndex={1}
          totalPages={2}
          scopeId="frame-a"
        >
          <BodyBand>A</BodyBand>
        </Frame>
        <Frame
          preset={preset}
          series={series}
          pageIndex={2}
          totalPages={2}
          scopeId="frame-b"
        >
          <BodyBand>B</BodyBand>
        </Frame>
      </div>
    );
    expect(html).toContain(".frame-a");
    expect(html).toContain(".frame-b");
  });

  it("HeaderBand and BodyBand render as positioned divs", () => {
    const html = renderToStaticMarkup(
      <div>
        <HeaderBand>H</HeaderBand>
        <BodyBand>B</BodyBand>
      </div>
    );
    expect(html).toContain('data-cn-role="header-band"');
    expect(html).toContain('data-cn-role="body-band"');
    expect(html).toContain("var(--band-header)");
    expect(html).toContain("var(--band-body)");
    expect(html).toContain("position:absolute");
  });

  it("FooterBand shows handle and zero-padded page indicator", () => {
    const preset = loadDarkLime();
    const series = buildSeries();
    const html = renderToStaticMarkup(
      <Frame
        preset={preset}
        series={series}
        pageIndex={1}
        totalPages={8}
        scopeId="cn-frame-test"
      >
        <BodyBand>x</BodyBand>
      </Frame>
    );
    expect(html).toContain('data-cn-role="footer-band"');
    expect(html).toContain("@designkitt");
    expect(html).toContain("01 / 08");
    expect(html).toContain("var(--color-muted)");
    expect(html).toContain("var(--color-accent)");
  });

  it("zero-pads page indices for double-digit totals", () => {
    const preset = loadDarkLime();
    const series = buildSeries();
    const html = renderToStaticMarkup(
      <Frame
        preset={preset}
        series={series}
        pageIndex={3}
        totalPages={12}
        scopeId="cn-frame-test"
      >
        <BodyBand>x</BodyBand>
      </Frame>
    );
    expect(html).toContain("03 / 12");
  });
});
