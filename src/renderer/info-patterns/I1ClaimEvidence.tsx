import * as React from "react";
import type { Claim } from "@core/schemas/claim";
import { renderInline } from "../inline";
import { sizeY } from "../layouts/_primitives";

export interface InfoPatternProps {
  claims?: Claim[];
  texts?: { primary?: string; secondary?: string; tertiary?: string };
}

/**
 * I1 — Claim + Evidence (spec §7).
 *
 * Layout:
 *   - Big claim (1-2 lines)            primary  / claims[0].text
 *   - 1~2 evidence chips (small)        claims[*].evidence (up to 2)
 *   - Annotation (source / asOf)        claims[0].sourceRef / asOf
 *
 * Compositional helper rendered inside an outer layout's BodyBand.
 */
export function I1ClaimEvidence(props: InfoPatternProps): React.JSX.Element {
  const claim = props.claims?.[0];
  const headline = props.texts?.primary ?? claim?.text ?? "";
  const evidenceChips = (props.claims ?? [])
    .map((c) => c.evidence)
    .filter((e): e is string => Boolean(e))
    .slice(0, 2);
  const annotation =
    props.texts?.tertiary ??
    [claim?.sourceRef, claim?.asOf].filter(Boolean).join(" · ");

  return (
    <div
      data-cn-role="i1-claim-evidence"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizeY(40),
      }}
    >
      <div
        data-cn-role="i1-headline"
        style={{
          fontSize: sizeY(56),
          fontWeight: 800,
          lineHeight: "1.2",
          color: "var(--color-text)",
        }}
      >
        {renderInline(headline)}
      </div>
      {evidenceChips.length > 0 ? (
        <div
          data-cn-role="i1-evidence"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: sizeY(16),
          }}
        >
          {evidenceChips.map((ev, i) => (
            <span
              key={i}
              data-cn-role="i1-chip"
              style={{
                color: "var(--color-bg)",
                backgroundColor: "var(--color-accent)",
                padding: `${sizeY(8)} ${sizeY(20)}`,
                borderRadius: sizeY(12),
                fontSize: sizeY(28),
                fontWeight: 700,
              }}
            >
              {ev}
            </span>
          ))}
        </div>
      ) : null}
      {annotation ? (
        <div
          data-cn-role="i1-annotation"
          style={{
            fontSize: sizeY(22),
            color: "var(--color-muted)",
          }}
        >
          {annotation}
        </div>
      ) : null}
    </div>
  );
}
