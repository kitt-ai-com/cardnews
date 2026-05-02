import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";
import noDirectPx from "../../eslint-rules/no-direct-px";

// Wire up RuleTester to vitest globals.
RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run("no-direct-px", noDirectPx, {
  valid: [
    // CSS-var values are allowed.
    `const x = <div style={{ width: "var(--canvas-width)" }} />;`,
    // Token-named Tailwind class.
    `const x = <div className="text-title" />;`,
    // Border arbitrary values are allowed (exception list).
    `const x = <div className="border-[2px]" />;`,
    `const x = <div className="border-2" />;`,
    // Shadow with px values inside is allowed.
    `const x = <div className="shadow-[0_0_60px_rgba(0,0,0,0.5)]" />;`,
    // Outline / ring / stroke with arbitrary values allowed.
    `const x = <div className="outline-[3px]" />;`,
    `const x = <div className="ring-[2px]" />;`,
    `const x = <div className="stroke-[1.5]" />;`,
    // Style prop with safe properties (color, opacity, etc.).
    `const x = <div style={{ color: "red", opacity: 0.5 }} />;`,
    // Numeric 0 is allowed.
    `const x = <div style={{ top: 0, left: 0 }} />;`,
  ],
  invalid: [
    {
      code: `const x = <div style={{ width: "320px" }} />;`,
      errors: [{ messageId: "noPxStyle" }],
    },
    {
      code: `const x = <div style={{ padding: 24 }} />;`,
      errors: [{ messageId: "noPxStyle" }],
    },
    {
      code: `const x = <div style={{ fontSize: "32px" }} />;`,
      errors: [{ messageId: "noPxStyle" }],
    },
    {
      code: `const x = <div style="width: 320px;" />;`,
      errors: [{ messageId: "noPxCssString" }],
    },
    {
      code: `const x = <div className="text-[32px]" />;`,
      errors: [{ messageId: "noTailwindArbitrary" }],
    },
    {
      code: `const x = <div className="w-[1080px] h-[1350px]" />;`,
      errors: [
        { messageId: "noTailwindArbitrary" },
        { messageId: "noTailwindArbitrary" },
      ],
    },
    {
      code: `const x = <div className="p-[24px]" />;`,
      errors: [{ messageId: "noTailwindArbitrary" }],
    },
    {
      code: `const x = <div className="leading-[1.5] tracking-[0.05em]" />;`,
      errors: [
        { messageId: "noTailwindArbitrary" },
        { messageId: "noTailwindArbitrary" },
      ],
    },
  ],
});
