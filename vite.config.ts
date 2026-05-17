import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// When deploying to a project page at https://<user>.github.io/<repo>/,
// `base` must match the repo name. Override with VITE_BASE for forks.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    base: env.VITE_BASE ?? "/tides/",
  };
});
