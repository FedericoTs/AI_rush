import js from "@eslint/js";
import tseslint from "typescript-eslint";
import next from "eslint-config-next";

export default tseslint.config(
  { ignores: ["node_modules/**", ".next/**", "out/**", "prototype/**", "coverage/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,

  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  /* ────────────────────────────────────────────────────────────────
     The level sandbox.

     A level is a pure function of its props. It may import from
     `input/`, `ui/slop/` and `engine/types` — nothing else. Two rules
     enforce the parts that would otherwise rot silently:

     1. No non-deterministic sources. A seed must reproduce a run
        exactly or the share link is a lie (VIRALITY.md §5).
     2. No reaching into the store or the router. Levels receive
        callbacks; they never drive navigation or read run state.
     ──────────────────────────────────────────────────────────────── */
  {
    files: ["src/levels/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='Math'][property.name='random']",
          message:
            "Levels must be deterministic: use the `rng` from props, not Math.random(). A seed has to reproduce a run exactly.",
        },
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message:
            "Levels must be deterministic: use the clock passed in props, not Date.now().",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "Levels must be deterministic: use the clock passed in props, not new Date().",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/engine/store", "@/engine/store", "next/navigation", "next/router"],
              message:
                "Levels are pure: they receive onSolve/onFail via props and never touch the run store or the router.",
            },
          ],
        },
      ],
    },
  },

  /* Tests and mocks are exempt — they exist to be non-deterministic on purpose. */
  {
    files: ["**/*.test.{ts,tsx}", "src/**/__mocks__/**", "e2e/**"],
    rules: { "no-restricted-syntax": "off", "no-restricted-imports": "off" },
  },
);
