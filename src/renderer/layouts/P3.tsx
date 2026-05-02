import * as React from "react";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { Frame, HeaderBand } from "../Frame";
import { LabelTag, Title, CheckList, sizeY } from "./_primitives";

export interface LayoutProps {
  page: Page;
  preset: Preset;
  series: Series;
  totalPages: number;
  imageSrc?: string;
}

/**
 * P3 layout: checklist (no image, info density first).
 *
 * design-guide rev 5 §2 P3:
 *   - title (64px) at top:200
 *   - title-list gap ≥ 250px (preview anchors list at top:500)
 *   - 3-5 list items, each = lime check mark + text (32px, line-height 1.45)
 *   - items support `<b>`, `<code>` via renderInline
 */
export default function P3(props: LayoutProps): React.JSX.Element {
  const { page, preset, series, totalPages } = props;
  const label = page.copy.label ?? "";
  const items = page.copy.list ?? [];

  return (
    <Frame
      preset={preset}
      series={series}
      pageIndex={page.index}
      totalPages={totalPages}
    >
      <HeaderBand>
        <LabelTag>{label}</LabelTag>
      </HeaderBand>
      <div
        data-cn-role="p3-title"
        style={{
          position: "absolute",
          top: sizeY(200),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
        }}
      >
        <Title size={sizeY(64)} lineHeight={1.15} color="var(--color-text)">
          {page.copy.title}
        </Title>
      </div>
      <div
        data-cn-role="p3-list"
        style={{
          position: "absolute",
          top: sizeY(500),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
        }}
      >
        <CheckList items={items} />
      </div>
    </Frame>
  );
}
