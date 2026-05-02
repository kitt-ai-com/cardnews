import * as React from "react";
import { renderInline } from "../inline";

/**
 * Layout primitives shared across cardnews layouts P1~P7 + cover + cta.
 *
 * Positioning convention:
 * - The 1080×1350 canvas is referenced via CSS vars `--canvas-width` and
 *   `--canvas-height` (already published by `Frame`).
 * - Vertical positions like "top: 720px" are expressed as a fraction of the
 *   canvas height (`top: ${720/1350 * 100}%`) so we never inline raw px and
 *   stay portable across resolution changes.
 * - Horizontal positions inside BodyBand defer to the band's own padding
 *   (`var(--safe-left)` / `var(--safe-right)`); positions outside BodyBand
 *   (cover bg, etc.) use percentages or `inset: 0`.
 */

/** Convert a px-on-canvas vertical value to a percentage of canvas height. */
export function vy(px: number): string {
  return `${(px / 1350) * 100}%`;
}

/** Convert a px-on-canvas horizontal value to a percentage of canvas width. */
export function vx(px: number): string {
  return `${(px / 1080) * 100}%`;
}

/** Fixed canvas height used by the renderer (kept in sync with c1-dark-lime). */
const CANVAS_HEIGHT = 1350;
const CANVAS_WIDTH = 1080;

/**
 * Convert a px-on-canvas size to a `calc(var(--canvas-height) * ratio)` so the
 * value tracks the canvas-height var and never hits the eslint px guard.
 */
export function sizeY(px: number): string {
  return `calc(var(--canvas-height) * ${(px / CANVAS_HEIGHT).toFixed(6)})`;
}

export function sizeX(px: number): string {
  return `calc(var(--canvas-width) * ${(px / CANVAS_WIDTH).toFixed(6)})`;
}

/** A small label tag (24px, accent, uppercase tracking). */
export function LabelTag(props: { children?: React.ReactNode }): React.JSX.Element {
  if (!props.children) {
    return <></>;
  }
  return (
    <div
      data-cn-role="label-tag"
      style={{
        color: "var(--color-accent)",
        fontSize: "var(--font-label-size)",
        fontWeight: "var(--font-label-weight)",
        letterSpacing: "var(--font-label-letter-spacing)",
        lineHeight: "var(--font-label-line-height)",
        textTransform: "uppercase",
      }}
    >
      {props.children}
    </div>
  );
}

/** Block-level title with renderInline parsing. */
export function Title(props: {
  children: string;
  size?: string;
  weight?: number | string;
  lineHeight?: number | string;
  color?: string;
}): React.JSX.Element {
  const { children, size, weight = 900, lineHeight = 1.05, color } = props;
  return (
    <div
      data-cn-role="title"
      style={{
        fontSize: size ?? "var(--font-title-size)",
        fontWeight: weight,
        lineHeight,
        letterSpacing: "var(--font-title-letter-spacing)",
        color: color ?? "var(--color-text)",
      }}
    >
      {renderInline(children)}
    </div>
  );
}

/** Body text block with renderInline. */
export function Body(props: {
  children: string;
  size?: string;
  color?: string;
}): React.JSX.Element {
  const { children, size, color } = props;
  return (
    <div
      data-cn-role="body"
      style={{
        fontSize: size ?? "var(--font-body-size)",
        fontWeight: "var(--font-body-weight)",
        lineHeight: "var(--font-body-line-height)",
        letterSpacing: "var(--font-body-letter-spacing)",
        color: color ?? "var(--color-muted)",
      }}
    >
      {renderInline(children)}
    </div>
  );
}

/** Subtitle: same font as body but optional override. */
export function Subtitle(props: { children: string }): React.JSX.Element {
  return <Body>{props.children}</Body>;
}

/** Checklist mark (lime square with check glyph). */
export function CheckMark(): React.JSX.Element {
  return (
    <span
      data-cn-role="check-mark"
      style={{
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: sizeY(22),
        height: sizeY(22),
        marginTop: sizeY(12),
        backgroundColor: "var(--color-accent)",
        borderRadius: sizeY(4),
        color: "var(--color-bg)",
        fontWeight: 900,
        fontSize: sizeY(16),
        lineHeight: "1",
      }}
    >
      {"✓"}
    </span>
  );
}

/** A simple checklist (used by P3). */
export function CheckList(props: { items: string[] }): React.JSX.Element {
  return (
    <div
      data-cn-role="checklist"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizeY(38),
      }}
    >
      {props.items.map((item, i) => (
        <div
          key={i}
          data-cn-role="checklist-item"
          style={{
            display: "flex",
            gap: sizeY(18),
            alignItems: "flex-start",
            fontSize: sizeY(32),
            lineHeight: "1.45",
            color: "var(--color-text)",
          }}
        >
          <CheckMark />
          <div>{renderInline(item)}</div>
        </div>
      ))}
    </div>
  );
}

/** Bullet list fallback (used by P1 when body absent). */
export function BulletList(props: { items: string[] }): React.JSX.Element {
  return (
    <ul
      data-cn-role="bullet-list"
      style={{
        listStyle: "disc",
        paddingLeft: sizeX(36),
        display: "flex",
        flexDirection: "column",
        gap: sizeY(14),
        color: "var(--color-muted)",
        fontSize: "var(--font-body-size)",
        lineHeight: "var(--font-body-line-height)",
      }}
    >
      {props.items.map((item, i) => (
        <li key={i}>{renderInline(item)}</li>
      ))}
    </ul>
  );
}

/**
 * Parse `"icon|name|desc|meta"` (pipe-separated) into a card record. Falls
 * back to single-token interpretation if no pipes are present.
 */
export interface ColCard {
  icon: string;
  name: string;
  desc: string;
  meta: string;
}

export function parseColCard(raw: string | undefined): ColCard {
  if (!raw) return { icon: "·", name: "", desc: "", meta: "" };
  const parts = raw.split("|");
  if (parts.length < 2) {
    return { icon: "·", name: raw, desc: "", meta: "" };
  }
  const [icon = "·", name = "", desc = "", meta = ""] = parts;
  return { icon, name, desc, meta };
}
