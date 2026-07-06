import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import jsdoc from "eslint-plugin-jsdoc";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // JSDoc 規約（TSDoc スタイル）の機械的に判定できる部分を強制する。
  // 有効ルールの唯一の真実はこのブロック。方針の根拠は .claude/rules/jsdoc.md。
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { jsdoc },
    // TS 前提。型は JSDoc ではなくシグネチャに委ねる。
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      // 型の再掲を禁止（TS シグネチャが型の唯一の真実）。
      "jsdoc/no-types": "error",
      // JSDoc ブロックを持つ関数は全引数を @param で説明する。
      // 分割代入 props は型（XxxProps）が真実なので props.x 単位には展開しない。
      "jsdoc/require-param": ["error", { checkDestructured: false, checkDestructuredRoots: false }],
      "jsdoc/require-param-description": "error",
      // @param 名と実引数名を突き合わせる（名前ズレ・順序・過不足を検出）。
      "jsdoc/check-param-names": "error",
      // 返り値がある関数は @returns に意味を書く（.tsx コンポーネントは後続ブロックで除外）。
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      // 書いた JSDoc の体裁を整える。
      "jsdoc/check-alignment": "warn",
      "jsdoc/no-multi-asterisks": "warn",
      // require-jsdoc は // 行コメントを誤検知するため未採用。ブロックの有無・質はレビューで確認する。
    },
  },
  {
    // React コンポーネント（JSX を返す .tsx）は @returns を要求しない（「@returns …の要素」はノイズ）。
    // .ts のフック / lib / API では @returns 必須のまま。
    files: ["src/**/*.tsx"],
    rules: {
      "jsdoc/require-returns": "off",
      "jsdoc/require-returns-description": "off",
    },
  },
  // Disable ESLint formatting rules that conflict with Prettier.
  // Must be last so it overrides the rules above.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
