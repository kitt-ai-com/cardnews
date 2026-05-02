import { ESLintUtils, TSESTree, AST_NODE_TYPES } from "@typescript-eslint/utils";

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://example.com/cardnews/eslint/${name}`
);

/**
 * Forbid direct px / numeric pixel values and Tailwind arbitrary values for
 * layout-related properties. Forces the use of design tokens via CSS vars.
 */
const STYLE_PROP_BLOCKLIST = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "gap",
  "rowGap",
  "columnGap",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
]);

// CSS-string equivalents for `style="width: 320px;"` (HTML-style).
const CSS_STRING_BLOCKLIST = new Set([
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "gap",
  "row-gap",
  "column-gap",
  "font-size",
  "line-height",
  "letter-spacing",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
]);

// Tailwind class prefixes that disallow arbitrary values like `w-[32px]`.
const TW_FORBIDDEN_PREFIX_RE =
  /(?:^|\s)(?:w|h|p[trblxy]?|m[trblxy]?|gap|inset|top|right|bottom|left|text|leading|tracking|font)-\[/;

// Allowed prefixes (for documentation only; matched against the same className tokens).
// border, outline, ring, shadow, stroke can keep arbitrary values.

function pxLiteralViolates(value: string): boolean {
  // raw px literal e.g. "320px", "1.5px"
  return /\d(?:\.\d+)?px\b/.test(value);
}

const rule = createRule({
  name: "no-direct-px",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct px values and Tailwind arbitrary values for layout properties; use design tokens via CSS variables.",
    },
    schema: [],
    messages: {
      noPxStyle:
        "Direct px / numeric pixel value on style.{{prop}} is forbidden. Use a CSS variable token (e.g. var(--safe-top)).",
      noPxCssString:
        "Direct px value in style attribute (CSS string) for `{{prop}}` is forbidden. Use a token via CSS variable.",
      noTailwindArbitrary:
        "Tailwind arbitrary value `{{token}}` is forbidden for layout/typography. Use a design-token utility (e.g. text-title, p-safe-top).",
    },
  },
  defaultOptions: [],
  create(context) {
    function checkJSXStyleObject(
      objExpr: TSESTree.ObjectExpression
    ): void {
      for (const prop of objExpr.properties) {
        if (prop.type !== AST_NODE_TYPES.Property) continue;
        if (prop.computed) continue;
        let propName: string | null = null;
        if (prop.key.type === AST_NODE_TYPES.Identifier) {
          propName = prop.key.name;
        } else if (
          prop.key.type === AST_NODE_TYPES.Literal &&
          typeof prop.key.value === "string"
        ) {
          propName = prop.key.value;
        }
        if (!propName) continue;
        if (!STYLE_PROP_BLOCKLIST.has(propName)) continue;
        const v = prop.value;
        if (v.type === AST_NODE_TYPES.Literal) {
          if (typeof v.value === "string" && pxLiteralViolates(v.value)) {
            context.report({
              node: v,
              messageId: "noPxStyle",
              data: { prop: propName },
            });
          } else if (typeof v.value === "number" && v.value !== 0) {
            // numeric literal in JSX style → treated as px by React
            context.report({
              node: v,
              messageId: "noPxStyle",
              data: { prop: propName },
            });
          }
        } else if (
          v.type === AST_NODE_TYPES.TemplateLiteral &&
          v.expressions.length === 0 &&
          v.quasis.length === 1
        ) {
          const raw = v.quasis[0].value.cooked ?? "";
          if (pxLiteralViolates(raw)) {
            context.report({
              node: v,
              messageId: "noPxStyle",
              data: { prop: propName },
            });
          }
        }
      }
    }

    function checkClassNameString(
      raw: string,
      reportNode: TSESTree.Node
    ): void {
      const tokens = raw.split(/\s+/).filter(Boolean);
      for (const t of tokens) {
        if (TW_FORBIDDEN_PREFIX_RE.test(" " + t)) {
          context.report({
            node: reportNode,
            messageId: "noTailwindArbitrary",
            data: { token: t },
          });
        }
      }
    }

    function checkCssStringValue(
      raw: string,
      reportNode: TSESTree.Node
    ): void {
      // parse "prop: val; prop2: val2;"
      const decls = raw.split(";");
      for (const d of decls) {
        const idx = d.indexOf(":");
        if (idx === -1) continue;
        const prop = d.slice(0, idx).trim().toLowerCase();
        const val = d.slice(idx + 1);
        if (!CSS_STRING_BLOCKLIST.has(prop)) continue;
        if (pxLiteralViolates(val)) {
          context.report({
            node: reportNode,
            messageId: "noPxCssString",
            data: { prop },
          });
        }
      }
    }

    return {
      JSXAttribute(node: TSESTree.JSXAttribute): void {
        const name =
          node.name.type === AST_NODE_TYPES.JSXIdentifier
            ? node.name.name
            : null;
        if (!name) return;
        if (name === "style") {
          // style={{ ... }} or style="..."
          if (node.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {
            const expr = node.value.expression;
            if (expr.type === AST_NODE_TYPES.ObjectExpression) {
              checkJSXStyleObject(expr);
            }
          } else if (node.value?.type === AST_NODE_TYPES.Literal) {
            if (typeof node.value.value === "string") {
              checkCssStringValue(node.value.value, node.value);
            }
          }
        } else if (name === "className" || name === "class") {
          if (node.value?.type === AST_NODE_TYPES.Literal) {
            if (typeof node.value.value === "string") {
              checkClassNameString(node.value.value, node.value);
            }
          } else if (
            node.value?.type === AST_NODE_TYPES.JSXExpressionContainer
          ) {
            const expr = node.value.expression;
            if (
              expr.type === AST_NODE_TYPES.Literal &&
              typeof expr.value === "string"
            ) {
              checkClassNameString(expr.value, expr);
            } else if (
              expr.type === AST_NODE_TYPES.TemplateLiteral &&
              expr.expressions.length === 0 &&
              expr.quasis.length === 1
            ) {
              const raw = expr.quasis[0].value.cooked ?? "";
              checkClassNameString(raw, expr);
            }
          }
        }
      },
    };
  },
});

export default rule;
