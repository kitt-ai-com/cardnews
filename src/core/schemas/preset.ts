import { z } from "zod";

export const LayoutId = z.enum([
  "cover",
  "cta",
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
]);
export type LayoutId = z.infer<typeof LayoutId>;

const TypographyLevel = z.object({
  size: z.number().positive(),
  weight: z.number().int().min(100).max(900),
  lineHeight: z.number().positive(),
  letterSpacing: z.number(),
});

const Typography = z.object({
  fontFamily: z.array(z.string().min(1)).min(1),
  title: TypographyLevel,
  body: TypographyLevel,
  label: TypographyLevel,
  hierarchyRatio: z.number().min(1).default(1.5),
});

const Spacing = z
  .object({
    safeZone: z.object({
      top: z.number().nonnegative(),
      right: z.number().nonnegative(),
      bottom: z.number().nonnegative(),
      left: z.number().nonnegative(),
    }),
    verticalBands: z.object({
      header: z.number().min(0).max(1),
      body: z.number().min(0).max(1),
      footer: z.number().min(0).max(1),
    }),
    contentRatio: z.number().min(0).max(1),
  })
  .refine(
    (s) => {
      const sum =
        s.verticalBands.header + s.verticalBands.body + s.verticalBands.footer;
      return Math.abs(sum - 1) < 1e-6;
    },
    {
      message: "verticalBands must sum to 1.0",
      path: ["verticalBands"],
    }
  );

export const PresetSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    base: z.string().optional(),
    canvas: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
    }),
    colors: z.object({
      background: z.string().min(1),
      text: z.string().min(1),
      accent: z.string().min(1),
      muted: z.string().min(1),
    }),
    typography: Typography,
    spacing: Spacing,
    layouts: z.array(LayoutId).min(1),
    imageStyle: z.string().min(1),
  })
  .refine(
    (p) =>
      p.typography.title.size >=
      p.typography.body.size * p.typography.hierarchyRatio,
    {
      message:
        "title.size must be >= body.size * hierarchyRatio (typography.hierarchyRatio constraint)",
      path: ["typography", "hierarchyRatio"],
    }
  );

export type Preset = z.infer<typeof PresetSchema>;
