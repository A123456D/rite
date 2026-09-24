import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5191, host: true, strictPort: true },
  preview: { port: 5191, host: true, strictPort: true },
});
