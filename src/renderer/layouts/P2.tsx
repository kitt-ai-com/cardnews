import * as React from "react";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { Frame, HeaderBand } from "../Frame";
import {
  LabelTag,
  Title,
  parseColCard,
  type ColCard,
  sizeY,
} from "./_primitives";

export interface LayoutProps {
  page: Page;
  preset: Preset;
  series: Series;
  totalPages: number;
  imageSrc?: string;
}

function ColCardView(props: { card: ColCard }): React.JSX.Element {
  const { card } = props;
  return (
    <div
      data-cn-role="p2-col"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(196,255,61,0.18)",
        borderRadius: sizeY(18),
        padding: `${sizeY(36)} ${sizeY(24)}`,
        display: "flex",
        flexDirection: "column",
        gap: sizeY(20),
        minHeight: sizeY(480),
      }}
    >
      <div
        data-cn-role="p2-col-icon"
        style={{
          width: sizeY(80),
          height: sizeY(80),
          borderRadius: sizeY(16),
          backgroundColor: "rgba(196,255,61,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-accent)",
          fontSize: sizeY(44),
          fontWeight: 800,
        }}
      >
        {card.icon}
      </div>
      <div
        data-cn-role="p2-col-name"
        style={{
          color: "var(--color-accent)",
          fontSize: sizeY(38),
          fontWeight: 800,
        }}
      >
        {card.name}
      </div>
      <div
        data-cn-role="p2-col-desc"
        style={{
          color: "var(--color-text)",
          fontSize: sizeY(26),
          lineHeight: "1.5",
        }}
      >
        {card.desc}
      </div>
      <div
        data-cn-role="p2-col-meta"
        style={{
          color: "var(--color-muted)",
          fontSize: sizeY(22),
          lineHeight: "1.45",
          marginTop: "auto",
        }}
      >
        {card.meta}
      </div>
    </div>
  );
}

/**
 * P2 layout: title at top + 3-column comparison cards.
 *
 * design-guide rev 5 §2 P2:
 *   - title (64px) at top:200
 *   - title-cols gap ≥ 250px (preview anchors cols at top:540)
 *   - 3 cards w/ icon + name + desc + meta
 *
 * `page.copy.list` is parsed as `"icon|name|desc|meta"` per item. If fewer
 * than 3 items, we pad with empty cols; if more, we render the first 3.
 */
export default function P2(props: LayoutProps): React.JSX.Element {
  const { page, preset, series, totalPages } = props;
  const label = page.copy.label ?? "";
  const list = page.copy.list ?? [];
  const cards: ColCard[] = [0, 1, 2].map((i) => parseColCard(list[i]));

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
        data-cn-role="p2-title"
        style={{
          position: "absolute",
          top: sizeY(200),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
        }}
      >
        <Title
          size={sizeY(64)}
          lineHeight={1.15}
          color="var(--color-text)"
        >
          {page.copy.title}
        </Title>
      </div>
      <div
        data-cn-role="p2-cols"
        style={{
          position: "absolute",
          top: sizeY(540),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: sizeY(18),
        }}
      >
        {cards.map((c, i) => (
          <ColCardView key={i} card={c} />
        ))}
      </div>
    </Frame>
  );
}
