import tsParser from "@typescript-eslint/parser";
import noDirectPx from "./eslint-rules/no-direct-px";

export default [
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      cardnews: { rules: { "no-direct-px": noDirectPx } },
    },
    rules: {
      "cardnews/no-direct-px": "error",
    },
  },
];
