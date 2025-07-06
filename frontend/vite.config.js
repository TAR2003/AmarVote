import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  server: {
    https: {
      key: fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./certs/localhost.key")),
      cert: fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./certs/localhost.crt")),
    },
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://backend:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.js",
        "**/*.config.ts",
      ],
    },
  },
});
