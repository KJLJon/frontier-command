import { defineConfig } from "vite";
export default defineConfig({
  base: "/frontier-command/",
  build: { chunkSizeWarningLimit: 1800 },
  server: { port: 4173 },
  preview: { port: 4173 },
});
