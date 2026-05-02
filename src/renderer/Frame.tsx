import * as React from "react";
import type { Preset } from "@core/schemas/preset";
import type { Series } from "@core/schemas/series";
import { presetToTokens, tokensToCSSVars } from "./tokens";

export interface FrameProps {
  preset: Preset;
  series: Series;
  pageIndex: number;
  totalPages: number;
  children: React.ReactNode;
  /** Optional override for the scope id (useful for tests / SSR-stable ids). */
  scopeId?: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The Frame: 1080×1350 canvas with safeZone + vertical bands enforced.
 * Children render inside `<BodyBand>`. Header (label/tag) and Footer
 * (handle + page index) are rendered automatically from props.
 */
export function Frame(props: FrameProps): React.JSX.Element {
  const { preset, series, pageIndex, totalPages, children, scopeId } = props;
  const generatedId = React.useId();
  // Sanitize React.useId() (which contains ":") to a CSS-class-safe token.
  const safeGeneratedId = generatedId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const id = scopeId ?? `cn-frame-${safeGeneratedId}`;
  const tokens = React.useMemo(() => presetToTokens(preset), [preset]);
  const css = React.useMemo(
    () => tokensToCSSVars(tokens, `.${id}`),
    [tokens, id]
  );

  return (
    <div
      data-cn-role="frame"
      className={id}
      style={{
        position: "relative",
        width: "var(--canvas-width)",
        height: "var(--canvas-height)",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-text)",
        fontFamily: "var(--font-family)",
        overflow: "hidden",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {React.Children.map(children, (child) => child)}
      <FooterBand
        series={series}
        pageIndex={pageIndex}
        totalPages={totalPages}
      />
    </div>
  );
}

export function HeaderBand(props: {
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-cn-role="header-band"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "var(--band-header)",
        paddingTop: "var(--safe-top)",
        paddingRight: "var(--safe-right)",
        paddingBottom: 0,
        paddingLeft: "var(--safe-left)",
        boxSizing: "border-box",
      }}
    >
      {props.children}
    </div>
  );
}

export function BodyBand(props: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-cn-role="body-band"
      style={{
        position: "absolute",
        top: "var(--band-header)",
        left: 0,
        right: 0,
        height: "var(--band-body)",
        paddingTop: "var(--safe-top)",
        paddingRight: "var(--safe-right)",
        paddingBottom: "var(--safe-bottom)",
        paddingLeft: "var(--safe-left)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {props.children}
    </div>
  );
}

export function FooterBand(props: {
  series: Series;
  pageIndex: number;
  totalPages: number;
}): React.JSX.Element {
  const { series, pageIndex, totalPages } = props;
  return (
    <div
      data-cn-role="footer-band"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "var(--band-footer)",
        paddingTop: 0,
        paddingRight: "var(--safe-right)",
        paddingBottom: "var(--safe-bottom)",
        paddingLeft: "var(--safe-left)",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        color: "var(--color-muted)",
        fontSize: "var(--font-label-size)",
        fontWeight: "var(--font-label-weight)",
        letterSpacing: "var(--font-label-letter-spacing)",
      }}
    >
      <span data-cn-role="footer-handle" style={{ color: "var(--color-accent)" }}>
        {series.footerHandle}
      </span>
      <span data-cn-role="footer-page">
        {pad2(pageIndex)} / {pad2(totalPages)}
      </span>
    </div>
  );
}
