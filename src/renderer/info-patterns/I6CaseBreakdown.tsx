import * as React from "react";
import type { Claim } from "@core/schemas/claim";
import { renderInline } from "../inline";
import { sizeY } from "../layouts/_primitives";

export interface InfoPatternProps {
  claims?: Claim[];
  texts?: {
    primary?: string; // case heading
    secondary?: string; // 1-2 sentences (description) / why-it-matters
    tertiary?: string; // lesson
  };
  caseTitle?: string;
  caseDescription?: string;
  whyItMatters?: string;
  lesson?: string;
}

/**
 * I6 — Case Breakdown (spec §7).
 *
 * Layout (vertical):
 *   - Case heading (caseTitle)      texts.primary
 *   - Case description (1~2 lines)  caseDescription / claims[0].text
 *   - Why it matters                whyItMatters / texts.secondary
 *   - Lesson (highlighted)          lesson / texts.tertiary
 */
export function I6CaseBreakdown(props: InfoPatternProps): React.JSX.Element {
  const caseTitle = props.caseTitle ?? props.texts?.primary ?? "";
  const description =
    props.caseDescription ?? props.claims?.[0]?.text ?? "";
  const why = props.whyItMatters ?? props.texts?.secondary ?? "";
  const lesson = props.lesson ?? props.texts?.tertiary ?? "";

  return (
    <div
      data-cn-role="i6-case-breakdown"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizeY(24),
      }}
    >
      <div
        data-cn-role="i6-case"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: sizeY(10),
        }}
      >
        <div
          data-cn-role="i6-tag"
          style={{
            fontSize: sizeY(20),
            color: "var(--color-accent)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            fontWeight: 700,
          }}
        >
          {"CASE"}
        </div>
        <div
          data-cn-role="i6-title"
          style={{
            fontSize: sizeY(40),
            color: "var(--color-text)",
            fontWeight: 800,
            lineHeight: "1.25",
          }}
        >
          {renderInline(caseTitle)}
        </div>
        {description ? (
          <div
            data-cn-role="i6-desc"
            style={{
              fontSize: sizeY(26),
              color: "var(--color-muted)",
              lineHeight: "1.45",
            }}
          >
            {renderInline(description)}
          </div>
        ) : null}
      </div>
      {why ? (
        <div
          data-cn-role="i6-why"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: sizeY(8),
          }}
        >
          <div
            data-cn-role="i6-tag"
            style={{
              fontSize: sizeY(20),
              color: "var(--color-accent)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              fontWeight: 700,
            }}
          >
            {"WHY IT MATTERS"}
          </div>
          <div
            style={{
              fontSize: sizeY(28),
              color: "var(--color-text)",
              lineHeight: "1.4",
            }}
          >
            {renderInline(why)}
          </div>
        </div>
      ) : null}
      {lesson ? (
        <div
          data-cn-role="i6-lesson"
          style={{
            padding: sizeY(20),
            borderLeft: `${sizeY(6)} solid var(--color-accent)`,
            color: "var(--color-text)",
            fontSize: sizeY(28),
            fontWeight: 700,
            lineHeight: "1.4",
            backgroundColor: "rgba(213,255,80,0.06)",
          }}
        >
          {renderInline(lesson)}
        </div>
      ) : null}
    </div>
  );
}
