import type { Preset } from "@core/schemas/preset";

export interface TypographyTokens {
  size: string;
  weight: string;
  lineHeight: string;
  letterSpacing: string;
}

export interface DesignTokens {
  colors: {
    background: string;
    text: string;
    accent: string;
    muted: string;
  };
  typography: {
    fontFamily: string;
    title: TypographyTokens;
    body: TypographyTokens;
    label: TypographyTokens;
  };
  spacing: {
    safeTop: string;
    safeRight: string;
    safeBottom: string;
    safeLeft: string;
    bandHeader: string;
    bandBody: string;
    bandFooter: string;
    contentMaxWidth: string;
  };
  canvas: {
    width: string;
    height: string;
  };
}

function px(n: number): string {
  return `${n}px`;
}

function pct(n: number): string {
  return `${n * 100}%`;
}

function em(n: number): string {
  return `${n}em`;
}

function levelTokens(level: {
  size: number;
  weight: number;
  lineHeight: number;
  letterSpacing: number;
}): TypographyTokens {
  return {
    size: px(level.size),
    weight: String(level.weight),
    lineHeight: String(level.lineHeight),
    letterSpacing: em(level.letterSpacing),
  };
}

export function presetToTokens(preset: Preset): DesignTokens {
  const { colors, typography, spacing, canvas } = preset;
  return {
    colors: {
      background: colors.background,
      text: colors.text,
      accent: colors.accent,
      muted: colors.muted,
    },
    typography: {
      fontFamily: typography.fontFamily.join(", "),
      title: levelTokens(typography.title),
      body: levelTokens(typography.body),
      label: levelTokens(typography.label),
    },
    spacing: {
      safeTop: px(spacing.safeZone.top),
      safeRight: px(spacing.safeZone.right),
      safeBottom: px(spacing.safeZone.bottom),
      safeLeft: px(spacing.safeZone.left),
      bandHeader: pct(spacing.verticalBands.header),
      bandBody: pct(spacing.verticalBands.body),
      bandFooter: pct(spacing.verticalBands.footer),
      contentMaxWidth: px(canvas.width * spacing.contentRatio),
    },
    canvas: {
      width: px(canvas.width),
      height: px(canvas.height),
    },
  };
}

/**
 * Render a tokens object as a CSS variable block.
 * If `scope` is provided, vars are scoped to that selector; otherwise `:root`.
 */
export function tokensToCSSVars(tokens: DesignTokens, scope?: string): string {
  const selector = scope ?? ":root";
  const vars: Array<[string, string]> = [
    ["--color-bg", tokens.colors.background],
    ["--color-text", tokens.colors.text],
    ["--color-accent", tokens.colors.accent],
    ["--color-muted", tokens.colors.muted],

    ["--font-family", tokens.typography.fontFamily],

    ["--font-title-size", tokens.typography.title.size],
    ["--font-title-weight", tokens.typography.title.weight],
    ["--font-title-line-height", tokens.typography.title.lineHeight],
    ["--font-title-letter-spacing", tokens.typography.title.letterSpacing],

    ["--font-body-size", tokens.typography.body.size],
    ["--font-body-weight", tokens.typography.body.weight],
    ["--font-body-line-height", tokens.typography.body.lineHeight],
    ["--font-body-letter-spacing", tokens.typography.body.letterSpacing],

    ["--font-label-size", tokens.typography.label.size],
    ["--font-label-weight", tokens.typography.label.weight],
    ["--font-label-line-height", tokens.typography.label.lineHeight],
    ["--font-label-letter-spacing", tokens.typography.label.letterSpacing],

    ["--safe-top", tokens.spacing.safeTop],
    ["--safe-right", tokens.spacing.safeRight],
    ["--safe-bottom", tokens.spacing.safeBottom],
    ["--safe-left", tokens.spacing.safeLeft],

    ["--band-header", tokens.spacing.bandHeader],
    ["--band-body", tokens.spacing.bandBody],
    ["--band-footer", tokens.spacing.bandFooter],

    ["--content-max-width", tokens.spacing.contentMaxWidth],

    ["--canvas-width", tokens.canvas.width],
    ["--canvas-height", tokens.canvas.height],
  ];
  const body = vars.map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `${selector} {\n${body}\n}`;
}
