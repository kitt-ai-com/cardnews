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
 * P6 layout: CTA with a lime pill button at the bottom.
 *
 * design-guide rev 5 §2 P6:
 *   - cta-shape (full-bleed bg) + 110px title + body + pill button
 *   - button: full-width minus padding, ~110px high, lime bg, dark text,
 *     glow shadow `0 0 60px rgba(196,255,61,0.25)`
 *   - `page.copy.highlight` is the button text. Default `"시작하기 →"`.
 */
export default function P6(props: LayoutProps): React.JSX.Element {
  const { page, preset, series, totalPages, imageSrc } = props;
  const label = page.copy.label ?? "";
  const buttonText = page.copy.highlight ?? "시작하기 →";

  return (
    <Frame
      preset={preset}
      series={series}
      pageIndex={page.index}
      totalPages={totalPages}
    >
      <div
        data-cn-role="p6-bg"
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
        data-cn-role="p6-title"
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
          data-cn-role="p6-body"
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
      <div
        data-cn-role="p6-button"
        style={{
          position: "absolute",
          bottom: sizeY(220),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
          height: sizeY(110),
          backgroundColor: "var(--color-accent)",
          color: "var(--color-bg)",
          borderRadius: sizeY(999),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: sizeY(38),
          fontWeight: 800,
          letterSpacing: "-0.01em",
          boxShadow: "0 0 60px rgba(196,255,61,0.25)",
        }}
      >
        {buttonText}
      </div>
    </Frame>
  );
}
