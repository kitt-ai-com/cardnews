import * as React from "react";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { Frame, HeaderBand } from "../Frame";
import { LabelTag, Title, sizeY } from "./_primitives";

export interface LayoutProps {
  page: Page;
  preset: Preset;
  series: Series;
  totalPages: number;
  imageSrc?: string;
}

/**
 * P7 layout: most minimal — label + title only with a small decorative lime
 * accent shape in the body region.
 *
 * design-guide rev 5: P7 is a library-archive layout (not in active rotation).
 */
export default function P7(props: LayoutProps): React.JSX.Element {
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
        data-cn-role="p7-title"
        style={{
          position: "absolute",
          top: sizeY(380),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
        }}
      >
        <Title size={sizeY(72)} lineHeight={1.1} color="var(--color-text)">
          {page.copy.title}
        </Title>
      </div>
      <div
        data-cn-role="p7-decoration"
        style={{
          position: "absolute",
          top: sizeY(820),
          left: "50%",
          width: sizeY(160),
          height: sizeY(160),
          transform: "translateX(-50%)",
          borderRadius: sizeY(999),
          backgroundColor: "rgba(196,255,61,0.12)",
          border: "1px solid rgba(196,255,61,0.35)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "25%",
            borderRadius: sizeY(999),
            backgroundColor: "var(--color-accent)",
            opacity: 0.9,
          }}
        />
      </div>
    </Frame>
  );
}
