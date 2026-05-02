import * as React from "react";
import type { Claim } from "@core/schemas/claim";
import { renderInline } from "../inline";
import { sizeY } from "../layouts/_primitives";

export interface InfoPatternProps {
  claims?: Claim[];
  texts?: { primary?: string; secondary?: string; tertiary?: string };
}

/**
 * I4 — Myth / Reality (spec §7).
 *
 * Layout:
 *   - Myth column      texts.primary    / claims[0]
 *   - Reality column   texts.secondary  / claims[1]
 *   - Caveat below     texts.tertiary
 */
export function I4MythReality(props: InfoPatternProps): React.JSX.Element {
  const myth = props.texts?.primary ?? props.claims?.[0]?.text ?? "";
  const reality = props.texts?.secondary ?? props.claims?.[1]?.text ?? "";
  const caveat = props.texts?.tertiary ?? "";

  return (
    <div
      data-cn-role="i4-myth-reality"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizeY(28),
      }}
    >
      <div
        data-cn-role="i4-row"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: sizeY(24),
        }}
      >
        <div
          data-cn-role="i4-myth"
          style={{
            padding: sizeY(28),
            borderRadius: sizeY(16),
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "var(--color-muted)",
          }}
        >
          <div
            data-cn-role="i4-tag"
            style={{
              fontSize: sizeY(22),
              color: "var(--color-muted)",
              marginBottom: sizeY(12),
              fontWeight: 700,
            }}
          >
            {"흔한 오해"}
          </div>
          <div
            style={{
              fontSize: sizeY(32),
              lineHeight: "1.3",
              textDecoration: "line-through",
            }}
          >
            {renderInline(myth)}
          </div>
        </div>
        <div
          data-cn-role="i4-reality"
          style={{
            padding: sizeY(28),
            borderRadius: sizeY(16),
            backgroundColor: "rgba(213,255,80,0.08)",
            color: "var(--color-text)",
          }}
        >
          <div
            data-cn-role="i4-tag"
            style={{
              fontSize: sizeY(22),
              color: "var(--color-accent)",
              marginBottom: sizeY(12),
              fontWeight: 700,
            }}
          >
            {"실제는"}
          </div>
          <div
            style={{
              fontSize: sizeY(32),
              lineHeight: "1.3",
              fontWeight: 700,
            }}
          >
            {renderInline(reality)}
          </div>
        </div>
      </div>
      {caveat ? (
        <div
          data-cn-role="i4-caveat"
          style={{
            fontSize: sizeY(24),
            color: "var(--color-muted)",
            lineHeight: "1.45",
          }}
        >
          {renderInline(caveat)}
        </div>
      ) : null}
    </div>
  );
}
