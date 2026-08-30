import globals from "globals"
import tsParser from "@typescript-eslint/parser"
import * as astroEslintParser from "astro-eslint-parser"
import path from "node:path"
import { fileURLToPath } from "node:url"
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import eslintPluginAstro from "eslint-plugin-astro"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default tseslint.config(
  {
    ignores: ["dist/**/*", ".astro/"],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },

      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        tsconfigRootDir: __dirname,
      },
    },

    rules: {
      "no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
    },
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginAstro.configs.recommended,
  {
    files: ["**/*.ts"],

    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["**/*.astro"],

    languageOptions: {
      parser: astroEslintParser,
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".astro"],
      },
    },
  },
  {
    files: ["**/*.astro/*.js", "*.astro/*.js"],

    languageOptions: {
      parser: tsParser,
    },
  },

  /**
   * The experiments boundary, from `CONTEXT-MAP.md` and
   * `src/experiments/docs/adr/0001-experiments-inside-the-site-project.md`: an
   * experiment imports nothing from the site — no layout, no stylesheet, no
   * component. The dependency runs one way, and the site may eventually link
   * to an experiment but no experiment reaches back.
   *
   * Until now that was convention alone, which is the kind of invariant that
   * rots silently: the first accidental `@/components/…` would work, pass CI
   * and go unnoticed. Making it a lint failure is most of what extracting the
   * experiments into their own project would buy, for almost none of the cost
   * — see issue #47.
   *
   * **A page's `<script>` block is covered by the plain `.astro` glob**, which
   * the ticket asked to confirm rather than assume. `astro-eslint-parser` reads
   * the frontmatter and the script blocks into one AST, so the file is linted
   * whole and needs no `<page>.astro/<n>_<n>.js` virtual-file pattern. A draft
   * of this config carried those patterns anyway; removing them changed
   * nothing, which is how it was established they were doing nothing. That
   * matters because the script block is the file most likely to reach for a
   * site component — the only place in a page that imports behaviour rather
   * than a stylesheet. `tests/unit/experiments-boundary.test.ts` holds the
   * coverage down.
   */
  {
    files: [
      "src/experiments/**/*.ts",
      "src/experiments/**/*.astro",
      "src/pages/experiments/**/*.ts",
      "src/pages/experiments/**/*.astro",
    ],

    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              /**
               * Everything under the alias except the experiments themselves.
               *
               * Deliberately an allow-list rather than the four site folders
               * named one by one. Naming `components`, `layouts`, `styles` and
               * `lib` would leave `@/assets/…`, `@/content.config` and every
               * folder the site grows next quietly permitted, and the rule
               * would rot the same way the convention did. What the boundary
               * actually says is that an experiment reaches nothing outside
               * itself, so that is what is written.
               *
               * **`!@/experiments` is load-bearing and does not look it.**
               * These groups are gitignore-style, and gitignore cannot
               * re-include a path whose parent directory is excluded. Without
               * that middle pattern `@/**` swallows the `@/experiments`
               * directory itself, `!@/experiments/**` is then powerless, and
               * every one of the section's own imports is reported — 104 of
               * them, on correct code. Delete it and lint goes red everywhere,
               * which at least says so.
               */
              group: ["@/**", "!@/experiments", "!@/experiments/**"],
              message:
                "An experiment imports nothing from the site — see CONTEXT-MAP.md and " +
                "src/experiments/docs/adr/0001-experiments-inside-the-site-project.md. " +
                "Copy what you need into src/experiments/, or share it at the section " +
                "level beside poster.ts.",
            },
            {
              /**
               * The same reach written relatively, which the alias rule cannot
               * see. A path climbing out of the experiments tree and into one
               * of the site's four folders is the same violation with a
               * different spelling.
               */
              group: ["../**/components/**", "../**/layouts/**", "../**/styles/**", "../**/lib/**"],
              message:
                "An experiment imports nothing from the site, however the path is spelled — " +
                "see CONTEXT-MAP.md and " +
                "src/experiments/docs/adr/0001-experiments-inside-the-site-project.md.",
            },
          ],
        },
      ],
    },
  },
)
