import * as React from "react";
import type { Page } from "@core/schemas/page";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { Frame, HeaderBand } from "../Frame";
import { LabelTag, Title, Body, BulletList, sizeY } from "./_primitives";

export interface LayoutProps {
  page: Page;
  preset: Preset;
  series: Series;
  totalPages: number;
  imageSrc?: string;
}

/**
 * P1 layout: top image (50% height with gradient fade) + body copy below.
 *
 * design-guide rev 5 §2 P1:
 *   - image: top 50%, gradient fade to bg color at bottom edge
 *   - title (64px) ~ top:720
 *   - body (34px) below title, gap ≥ 200px (preview anchors body at top:980)
 *
 * If `page.copy.body` is missing but `page.copy.list` is present we fall back
 * to a simple bulleted list.
 */
export default function P1(props: LayoutProps): React.JSX.Element {
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
        data-cn-role="p1-image"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: imageSrc ? undefined : "var(--color-bg)",
        }}
      >
        <div
          data-cn-role="p1-image-fade"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(14,14,16,0) 0%, var(--color-bg) 100%)",
          }}
        />
      </div>
      <HeaderBand>
        <LabelTag>{label}</LabelTag>
      </HeaderBand>
      <div
        data-cn-role="p1-title"
        style={{
          position: "absolute",
          top: sizeY(720),
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
        data-cn-role="p1-body"
        style={{
          position: "absolute",
          top: sizeY(980),
          left: "var(--safe-left)",
          right: "var(--safe-right)",
        }}
      >
        {page.copy.body ? (
          <Body>{page.copy.body}</Body>
        ) : page.copy.list && page.copy.list.length > 0 ? (
          <BulletList items={page.copy.list} />
        ) : null}
      </div>
    </Frame>
  );
}
