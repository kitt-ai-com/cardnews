import * as React from "react";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { Frame, HeaderBand } from "../Frame";
import { LabelTag, Title, Subtitle, sizeY } from "./_primitives";

export interface LayoutProps {
  page: Page;
  preset: Preset;
  series: Series;
  totalPages: number;
  imageSrc?: string;
}

/**
 * P4 layout: save-prompt badge (minimal). Left-aligned title + subtitle, with
 * a "SAVE FOR LATER" pill near the bottom of BodyBand.
 *
 * design-guide rev 5: P4 is a library-archive layout (not in active rotation
 * for the Claude series), so we keep it minimal but render-safe.
 */
export default function P4(props: LayoutProps): React.JSX.Element {
  const { page, preset, series, totalPages } = props;
  const label = page.copy.label ?? "";
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
        data-cn-role="p4-title"
        style={{
          position: "absolute",
          top: sizeY(220),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
        }}
      >
        <Title size={sizeY(64)} lineHeight={1.15} color="var(--color-text)">
          {page.copy.title}
        </Title>
      </div>
      {page.copy.subtitle ? (
        <div
          data-cn-role="p4-subtitle"
          style={{
            position: "absolute",
            top: sizeY(420),
            left: "var(--safe-left)",
            right: "var(--safe-right)",
          }}
        >
          <Subtitle>{page.copy.subtitle}</Subtitle>
        </div>
      ) : null}
      <div
        data-cn-role="p4-badge"
        style={{
          position: "absolute",
          bottom: sizeY(260),
          left: "var(--safe-left)",
          display: "inline-flex",
          alignItems: "center",
          padding: `${sizeY(14)} ${sizeY(28)}`,
          border: "1px solid rgba(196,255,61,0.6)",
          borderRadius: sizeY(999),
          color: "var(--color-accent)",
          fontSize: sizeY(24),
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        SAVE FOR LATER
      </div>
    </Frame>
  );
}
