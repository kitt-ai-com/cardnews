import * as React from "react";
import type { Claim } from "@core/schemas/claim";
import { renderInline } from "../inline";
import { sizeY } from "../layouts/_primitives";

export interface InfoPatternProps {
  claims?: Claim[];
  texts?: { primary?: string; secondary?: string; tertiary?: string };
}

/**
 * I2 — Before / After (spec §7).
 *
 * Layout:
 *   - Before (large text + negative tint)        texts.primary    / claims[0]
 *   - After  (large text + positive tint)        texts.secondary  / claims[1]
 *   - Meaning (one sentence)                      texts.tertiary
 */
export function I2BeforeAfter(props: InfoPatternProps): React.JSX.Element {
  const before = props.texts?.primary ?? props.claims?.[0]?.text ?? "";
  const after = props.texts?.secondary ?? props.claims?.[1]?.text ?? "";
  const meaning = props.texts?.tertiary ?? "";

  return (
    <div
      data-cn-role="i2-before-after"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizeY(28),
      }}
    >
      <div
        data-cn-role="i2-row"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: sizeY(24),
        }}
      >
        <div
          data-cn-role="i2-before"
          style={{
            padding: sizeY(28),
            borderRadius: sizeY(16),
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "var(--color-muted)",
            fontSize: sizeY(34),
            lineHeight: "1.3",
            fontWeight: 600,
          }}
        >
          <div
            data-cn-role="i2-tag"
            style={{
              fontSize: sizeY(20),
              color: "var(--color-muted)",
              marginBottom: sizeY(12),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {"Before"}
          </div>
          {renderInline(before)}
        </div>
        <div
          data-cn-role="i2-after"
          style={{
            padding: sizeY(28),
            borderRadius: sizeY(16),
            backgroundColor: "rgba(213,255,80,0.08)",
            color: "var(--color-text)",
            fontSize: sizeY(34),
            lineHeight: "1.3",
            fontWeight: 700,
          }}
        >
          <div
            data-cn-role="i2-tag"
            style={{
              fontSize: sizeY(20),
              color: "var(--color-accent)",
              marginBottom: sizeY(12),
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {"After"}
          </div>
          {renderInline(after)}
        </div>
      </div>
      {meaning ? (
        <div
          data-cn-role="i2-meaning"
          style={{
            fontSize: sizeY(26),
            color: "var(--color-muted)",
            lineHeight: "1.5",
          }}
        >
          {renderInline(meaning)}
        </div>
      ) : null}
    </div>
  );
}
