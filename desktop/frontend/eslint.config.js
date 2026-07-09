import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs["flat"].recommended,
  {
    ignores: ["wailsjs/", "dist/"],
  },
);
