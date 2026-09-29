// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "tools/*"],
  },
  {
    rules: {
      // React Compiler advisories. Resetting a dialog's local state when it
      // opens, or syncing route params into filters, are deliberate here.
      // Kept visible as warnings so new cases get a second look.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);
