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
 * Cover layout: full-canvas background image, label-tag in HeaderBand, title
 * (90~110px) and subtitle (34px) anchored toward the bottom of the canvas.
 *
 * design-guide rev 5 §2 cover:
 *   - title-subtitle gap ≥ 80px
 *   - subtitle = 34px (body standard)
 *   - text content sits in lower 60% of canvas (bottom: 200px in preview)
 *
 * Note: cover is full-bleed by design, so the bg image and content sit at the
 * canvas level rather than inside BodyBand. HeaderBand still hosts the label.
 */
export default function Cover(props: LayoutProps): React.JSX.Element {
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
        data-cn-role="cover-bg"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: imageSrc ? undefined : "var(--color-bg)",
          opacity: 0.95,
        }}
      />
      <HeaderBand>
        <LabelTag>{label}</LabelTag>
      </HeaderBand>
      <div
        data-cn-role="cover-content"
        style={{
          position: "absolute",
          left: "var(--safe-left)",
          right: "var(--safe-right)",
          bottom: sizeY(200),
        }}
      >
        <Title size={sizeY(100)} lineHeight={1.05}>
          {page.copy.title}
        </Title>
        {page.copy.subtitle ? (
          <div style={{ marginTop: sizeY(80) }}>
            <Subtitle>{page.copy.subtitle}</Subtitle>
          </div>
        ) : null}
      </div>
    </Frame>
  );
}
