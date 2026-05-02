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

function PromptCard(props: { card: ColCard }): React.JSX.Element {
  const { card } = props;
  return (
    <div
      data-cn-role="p5-card"
      style={{
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(196,255,61,0.18)",
        borderRadius: sizeY(18),
        padding: sizeY(28),
        display: "flex",
        flexDirection: "column",
        gap: sizeY(16),
        minHeight: sizeY(280),
      }}
    >
      <div
        style={{
          color: "var(--color-accent)",
          fontSize: sizeY(34),
          fontWeight: 800,
        }}
      >
        {card.icon} {card.name}
      </div>
      <div
        style={{
          color: "var(--color-text)",
          fontSize: sizeY(24),
          lineHeight: "1.5",
        }}
      >
        {card.desc}
      </div>
      {card.meta ? (
        <div
          style={{
            color: "var(--color-muted)",
            fontSize: sizeY(20),
            lineHeight: "1.45",
            marginTop: "auto",
          }}
        >
          {card.meta}
        </div>
      ) : null}
    </div>
  );
}

/**
 * P5 layout: formula + 2 prompt cards (minimal stub).
 *
 * design-guide rev 5: P5 is a library-archive layout (not in active rotation
 * for the Claude series), so we render a minimal version: title at top,
 * formula via `page.copy.highlight` in middle, and 2 cards parsed from
 * `page.copy.list[0..1]` using the same pipe encoding as P2.
 */
export default function P5(props: LayoutProps): React.JSX.Element {
  const { page, preset, series, totalPages } = props;
  const label = page.copy.label ?? "";
  const list = page.copy.list ?? [];
  const cards: ColCard[] = [0, 1].map((i) => parseColCard(list[i]));

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
        data-cn-role="p5-title"
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
      {page.copy.highlight ? (
        <div
          data-cn-role="p5-formula"
          style={{
            position: "absolute",
            top: sizeY(540),
            left: "var(--safe-left)",
            right: "var(--safe-right)",
            textAlign: "center",
            color: "var(--color-accent)",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: sizeY(48),
            fontWeight: 700,
          }}
        >
          {page.copy.highlight}
        </div>
      ) : null}
      <div
        data-cn-role="p5-cards"
        style={{
          position: "absolute",
          top: sizeY(820),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: sizeY(20),
        }}
      >
        {cards.map((c, i) => (
          <PromptCard key={i} card={c} />
        ))}
      </div>
    </Frame>
  );
}
