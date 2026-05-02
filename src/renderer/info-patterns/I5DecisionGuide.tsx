import * as React from "react";
import type { Claim } from "@core/schemas/claim";
import { renderInline } from "../inline";
import { sizeY } from "../layouts/_primitives";

export interface InfoPatternProps {
  claims?: Claim[];
  texts?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
  /** Optional pre-split lists for the ✓ and ✗ columns. */
  whenToUse?: string[];
  whenNotToUse?: string[];
}

function splitLines(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * I5 — Decision Guide (spec §7).
 *
 * Layout:
 *   - When to use        ✓ list (lime accents)   whenToUse / texts.primary lines
 *   - When NOT to use    ✗ list (muted)          whenNotToUse / texts.secondary lines
 *   - Recommended action pill                    texts.tertiary
 */
export function I5DecisionGuide(
  props: InfoPatternProps & { whenToUse?: string[]; whenNotToUse?: string[] }
): React.JSX.Element {
  const yes = props.whenToUse ?? splitLines(props.texts?.primary);
  const no = props.whenNotToUse ?? splitLines(props.texts?.secondary);
  const action = props.texts?.tertiary ?? "";

  return (
    <div
      data-cn-role="i5-decision-guide"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizeY(28),
      }}
    >
      <div
        data-cn-role="i5-row"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: sizeY(24),
        }}
      >
        <ul
          data-cn-role="i5-yes"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: sizeY(14),
            color: "var(--color-text)",
            fontSize: sizeY(28),
            lineHeight: "1.4",
          }}
        >
          {yes.map((item, i) => (
            <li
              key={i}
              data-cn-role="i5-yes-item"
              style={{ display: "flex", gap: sizeY(12) }}
            >
              <span style={{ color: "var(--color-accent)", fontWeight: 900 }}>
                {"✓"}
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
        <ul
          data-cn-role="i5-no"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: sizeY(14),
            color: "var(--color-muted)",
            fontSize: sizeY(28),
            lineHeight: "1.4",
          }}
        >
          {no.map((item, i) => (
            <li
              key={i}
              data-cn-role="i5-no-item"
              style={{ display: "flex", gap: sizeY(12) }}
            >
              <span style={{ color: "var(--color-muted)", fontWeight: 900 }}>
                {"✗"}
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      </div>
      {action ? (
        <div
          data-cn-role="i5-action"
          style={{
            display: "inline-block",
            alignSelf: "flex-start",
            padding: `${sizeY(14)} ${sizeY(28)}`,
            borderRadius: sizeY(999),
            backgroundColor: "var(--color-accent)",
            color: "var(--color-bg)",
            fontSize: sizeY(28),
            fontWeight: 800,
          }}
        >
          {renderInline(action)}
        </div>
      ) : null}
    </div>
  );
}
