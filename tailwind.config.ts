import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        text: "var(--color-text)",
        accent: "var(--color-accent)",
        muted: "var(--color-muted)",
      },
      fontFamily: {
        sans: ["var(--font-family)"],
      },
      // Design-token-named utilities. Forces use of these instead of arbitrary px.
      fontSize: {
        title: [
          "var(--font-title-size)",
          {
            lineHeight: "var(--font-title-line-height)",
            letterSpacing: "var(--font-title-letter-spacing)",
          },
        ],
        body: [
          "var(--font-body-size)",
          {
            lineHeight: "var(--font-body-line-height)",
            letterSpacing: "var(--font-body-letter-spacing)",
          },
        ],
        label: [
          "var(--font-label-size)",
          {
            lineHeight: "var(--font-label-line-height)",
            letterSpacing: "var(--font-label-letter-spacing)",
          },
        ],
      },
      spacing: {
        "safe-top": "var(--safe-top)",
        "safe-right": "var(--safe-right)",
        "safe-bottom": "var(--safe-bottom)",
        "safe-left": "var(--safe-left)",
      },
      width: {
        canvas: "var(--canvas-width)",
        content: "var(--content-max-width)",
      },
      height: {
        canvas: "var(--canvas-height)",
      },
    },
  },
  plugins: [],
};
export default config;
