import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { presetToTokens, tokensToCSSVars } from "../renderer/tokens";
import {
  Cover,
  Cta,
  P1,
  P2,
  P3,
  P4,
  P5,
  P6,
  P7,
  type LayoutProps,
} from "../renderer/layouts";
import type { Card } from "@core/schemas/card";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";

type LayoutComponent = (props: LayoutProps) => React.JSX.Element;

const LAYOUT_MAP: Record<string, LayoutComponent> = {
  cover: Cover as LayoutComponent,
  cta: Cta as LayoutComponent,
  P1: P1 as LayoutComponent,
  P2: P2 as LayoutComponent,
  P3: P3 as LayoutComponent,
  P4: P4 as LayoutComponent,
  P5: P5 as LayoutComponent,
  P6: P6 as LayoutComponent,
  P7: P7 as LayoutComponent,
};

export interface RenderPageArgs {
  card: Card;
  page: Page;
  preset: Preset;
  series: Series;
  imageSrc?: string;
  pretendardCSS?: string;
}

/**
 * Returns a complete HTML document (with <!doctype>) for one page.
 * Embeds a minimal preflight reset + design tokens + (optional) Pretendard
 * font CSS. Page renders at the canvas size declared by the preset (1080×1350
 * for c1-dark-lime).
 */
export function renderPageHTML(args: RenderPageArgs): string {
  const Layout = LAYOUT_MAP[args.page.layout];
  if (!Layout) {
    throw new Error(`Unknown layout: ${args.page.layout}`);
  }

  const body = renderToStaticMarkup(
    <Layout
      page={args.page}
      preset={args.preset}
      series={args.series}
      totalPages={args.card.pages.length}
      imageSrc={args.imageSrc}
    />
  );

  const measurableBody = markMeasurable(body);

  const cssVars = tokensToCSSVars(presetToTokens(args.preset));

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
${args.pretendardCSS ?? ""}
${TAILWIND_PREFLIGHT}
${cssVars}
html, body { margin: 0; padding: 0; background: var(--color-bg); }
body { width: var(--canvas-width); height: var(--canvas-height); }
</style>
</head>
<body>${measurableBody}</body>
</html>`;
}

/**
 * Post-process rendered HTML to add `data-measure="<field>"` attributes onto
 * elements carrying the layout-primitive `data-cn-role` markers. We only target
 * a small whitelist that maps directly to schema fields the L2 measurement
 * cares about: title, body, subtitle, label.
 *
 * We deliberately use a regex rather than a DOM library — the rendered output
 * is well-formed (we control it) and adding a parser dep is overkill. If a
 * future layout needs richer markers, extend the role-to-field map here.
 */
const ROLE_TO_FIELD: Record<string, string> = {
  title: "title",
  body: "body",
  "label-tag": "label",
};

export function markMeasurable(html: string): string {
  return html.replace(
    /data-cn-role="([^"]+)"/g,
    (match: string, role: string): string => {
      const field = ROLE_TO_FIELD[role];
      if (!field) return match;
      // If the element already has data-measure, leave it alone.
      return `${match} data-measure="${field}"`;
    }
  );
}

const TAILWIND_PREFLIGHT = `/* minimal preflight reset */
*, ::before, ::after { box-sizing: border-box; }
body, h1, h2, h3, p, ul, ol, li, figure, blockquote, dl, dd { margin: 0; }
ul, ol { list-style: none; padding: 0; }
img, picture, video { display: block; max-width: 100%; }
`;
