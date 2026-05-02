import * as React from "react";
import type { Claim } from "@core/schemas/claim";
import { renderInline } from "../inline";
import { sizeY } from "../layouts/_primitives";

export interface InfoPatternProps {
  claims?: Claim[];
  texts?: { primary?: string; secondary?: string; tertiary?: string };
}

/**
 * I3 — Mechanism (spec §7).
 *
 * Three stages: cause → working → result, separated by accent arrows.
 */
export function I3Mechanism(props: InfoPatternProps): React.JSX.Element {
  const cause =
    props.texts?.primary ?? props.claims?.[0]?.text ?? "";
  const working =
    props.texts?.secondary ?? props.claims?.[1]?.text ?? "";
  const result =
    props.texts?.tertiary ?? props.claims?.[2]?.text ?? "";

  const labels = ["원인", "작동", "결과"];
  const stages = [cause, working, result];

  return (
    <div
      data-cn-role="i3-mechanism"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizeY(24),
      }}
    >
      {stages.map((text, i) => (
        <React.Fragment key={i}>
          <div
            data-cn-role="i3-stage"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: sizeY(8),
              padding: sizeY(20),
              borderRadius: sizeY(12),
              backgroundColor: "rgba(255,255,255,0.04)",
            }}
          >
            <div
              data-cn-role="i3-label"
              style={{
                fontSize: sizeY(20),
                color: "var(--color-accent)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 700,
              }}
            >
              {labels[i]}
            </div>
            <div
              data-cn-role="i3-text"
              style={{
                fontSize: sizeY(30),
                color: "var(--color-text)",
                lineHeight: "1.35",
              }}
            >
              {renderInline(text)}
            </div>
          </div>
          {i < stages.length - 1 ? (
            <div
              data-cn-role="i3-arrow"
              style={{
                fontSize: sizeY(28),
                color: "var(--color-accent)",
                textAlign: "center",
                fontWeight: 900,
              }}
            >
              {"↓"}
            </div>
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}
