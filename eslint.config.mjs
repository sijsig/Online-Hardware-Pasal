import { defineConfig, globalIgnores } from "eslint/config";
import nextConfig from "eslint-config-next";

const nextVitals = nextConfig.configs["core-web-vitals"];
const nextTs = nextConfig.configs.typescript;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
