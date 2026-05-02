import * as React from "react";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { Frame, HeaderBand } from "../Frame";
import { LabelTag, Title, Body, sizeY } from "./_primitives";

export interface LayoutProps {
  page: Page;
  preset: Preset;
  series: Series;
  totalPages: number;
  imageSrc?: string;
}

/**
 * CTA layout: full-bleed background image, big title (110px) at top region,
 * body copy below with at least 300px gap.
 *
 * design-guide rev 5 §2 cta:
 *   - title 110px (압도적 마무리)
 *   - title-body gap ≥ 300px
 */
export default function Cta(props: LayoutProps): React.JSX.Element {
  const { page, preset, series, totalPages, imageSrc } = props;
  const label = page.copy.label ?? "";
  return (
    <Frame
      preset={preset}
      series={series}
      pageIndex={page.index}
      totalPages={totalPages}
    >
      <div
        data-cn-role="cta-bg"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: imageSrc ? undefined : "var(--color-bg)",
          opacity: 0.85,
        }}
      />
      <HeaderBand>
        <LabelTag>{label}</LabelTag>
      </HeaderBand>
      <div
        data-cn-role="cta-title"
        style={{
          position: "absolute",
          top: sizeY(200),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
        }}
      >
        <Title size={sizeY(110)} lineHeight={1.05}>
          {page.copy.title}
        </Title>
      </div>
      {page.copy.body ? (
        <div
          data-cn-role="cta-body"
          style={{
            position: "absolute",
            top: sizeY(580),
            left: "var(--safe-left)",
            right: "var(--safe-right)",
          }}
        >
          <Body size={sizeY(32)}>{page.copy.body}</Body>
        </div>
      ) : null}
    </Frame>
  );
}
